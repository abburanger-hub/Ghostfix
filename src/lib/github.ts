// =============================================================================
// GhostFix — GitHub API Helpers
//
// Used by the ingest pipeline to:
//   1. Find source files related to the failing module
//   2. Fetch their content
//   3. Create a branch + commit + PR with the AI-generated patch
//
// Uses GitHub REST API v3 — no extra SDK needed (plain fetch).
// PAT requires: repo scope (read + write + PR creation on the target repo).
// =============================================================================

const GH = "https://api.github.com";

function ghHeaders(pat: string) {
  return {
    Authorization: `token ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GithubFile {
  path: string;
  sha: string;        // blob SHA — needed for updating the file
  content: string;    // decoded UTF-8 file content (max ~8 KB returned)
}

export interface PrResult {
  url: string;        // e.g. https://github.com/owner/repo/pull/42
  number: number;
  branch: string;
}

// ---------------------------------------------------------------------------
// 1. Search for files relevant to the failing module
//    Uses the recursive tree endpoint to list all paths, then filters
//    for files whose path contains a keyword derived from the module name.
// ---------------------------------------------------------------------------

export async function findModuleFiles(
  pat: string,
  owner: string,
  repo: string,
  failingModule: string,
  branch = "main",
): Promise<{ path: string; sha: string }[]> {
  // Common English words that appear in bug reports but are not file/module identifiers
  const NOISE_WORDS = new Set([
    "with", "from", "that", "this", "have", "been", "they", "will", "would", "could",
    "should", "after", "before", "about", "getting", "showing", "throwing", "every",
    "even", "though", "very", "just", "still", "when", "then", "also", "both", "each",
    "more", "some", "randomly", "failing", "working", "errors", "error", "issue",
    "problem", "production", "started", "affected", "aborted", "operation", "fast",
    "connections", "customers", "backend", "endpoint", "types", "confirmation",
    "receiving", "charged", "transactions", "increase", "increased", "server", "load",
    "last", "week", "clear", "cause", "logs", "show", "card", "even", "all",
  ]);

  // Derive search keywords from module name or issue text
  // "Payment Service" → ["payment", "service"]
  // Filters noise words so issue-text fallback doesn't match on generic verbs
  const keywords = failingModule
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !NOISE_WORDS.has(w))
    .slice(0, 6);

  const res = await fetch(
    `${GH}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders(pat) },
  );
  if (!res.ok) {
    throw new Error(`GitHub tree fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { tree: { path: string; type: string; sha: string }[] };

  const files = data.tree.filter((node) => {
    if (node.type !== "blob") return false;
    // Only consider source files
    if (!/\.(ts|tsx|js|jsx|py|go|rb|java|cs|php)$/.test(node.path)) return false;
    const lowerPath = node.path.toLowerCase();
    return keywords.some((kw) => lowerPath.includes(kw));
  });

  // Return up to 3 most relevant (shortest path = most likely the right file)
  return files
    .sort((a, b) => a.path.length - b.path.length)
    .slice(0, 3)
    .map((f) => ({ path: f.path, sha: f.sha }));
}

// ---------------------------------------------------------------------------
// 2. Fetch a single file's decoded content + its blob SHA
// ---------------------------------------------------------------------------

export async function fetchFileContent(
  pat: string,
  owner: string,
  repo: string,
  path: string,
): Promise<GithubFile> {
  const res = await fetch(
    `${GH}/repos/${owner}/${repo}/contents/${path}`,
    { headers: ghHeaders(pat) },
  );
  if (!res.ok) {
    throw new Error(`GitHub file fetch failed: ${res.status}`);
  }
  const data = await res.json() as { sha: string; content: string; encoding: string };
  const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return { path, sha: data.sha, content: decoded };
}

// ---------------------------------------------------------------------------
// 3. Create a branch, commit the patched file, open a PR
//    Returns the PR HTML URL.
// ---------------------------------------------------------------------------

export async function createPullRequest(opts: {
  pat: string;
  owner: string;
  repo: string;
  baseBranch: string;
  ticketId: string;
  filePath: string;
  fileSha: string;          // SHA of the original blob (required by GitHub for updates)
  patchedContent: string;   // full new file content (UTF-8)
  failingModule: string;
  fixSummary: string;
}): Promise<PrResult> {
  const {
    pat, owner, repo, baseBranch, ticketId,
    filePath, fileSha, patchedContent, failingModule, fixSummary,
  } = opts;

  const h = ghHeaders(pat);
  const branchName = `ghostfix/fix-${ticketId.slice(0, 8)}`;

  // ── a) Get SHA of base branch tip ────────────────────────────────────────
  const refRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
    { headers: h },
  );
  if (!refRes.ok) throw new Error(`Could not resolve base branch: ${refRes.status}`);
  const refData = await refRes.json() as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // ── b) Create the feature branch ─────────────────────────────────────────
  const createBranchRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    },
  );
  if (!createBranchRes.ok) {
    const err = await createBranchRes.text();
    throw new Error(`Branch creation failed: ${createBranchRes.status} — ${err}`);
  }

  // ── c) Commit the patched file via contents API ───────────────────────────
  const contentB64 = Buffer.from(patchedContent, "utf-8").toString("base64");
  const updateRes = await fetch(
    `${GH}/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        message: `fix(${failingModule}): ${fixSummary.slice(0, 72)}\n\nAutomated patch by GhostFix · ticket ${ticketId.slice(0, 8)}`,
        content: contentB64,
        sha: fileSha,
        branch: branchName,
      }),
    },
  );
  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`File commit failed: ${updateRes.status} — ${err}`);
  }

  // ── d) Open the PR ────────────────────────────────────────────────────────
  const prBody = `## GhostFix Automated Patch\n\n` +
    `**Affected module:** \`${failingModule}\`\n\n` +
    `**Fix applied:** ${fixSummary}\n\n` +
    `**Ticket ID:** \`${ticketId}\`\n\n` +
    `---\n*This pull request was created automatically by [GhostFix](https://ghostfix.vercel.app) ` +
    `after AI triage of an incoming bug report.*`;

  const prRes = await fetch(
    `${GH}/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: `[GhostFix] Fix ${failingModule}: ${fixSummary.slice(0, 60)}`,
        body: prBody,
        head: branchName,
        base: baseBranch,
        draft: false,
      }),
    },
  );
  if (!prRes.ok) {
    const err = await prRes.text();
    throw new Error(`PR creation failed: ${prRes.status} — ${err}`);
  }
  const prData = await prRes.json() as { html_url: string; number: number };
  return { url: prData.html_url, number: prData.number, branch: branchName };
}
