"use client";
// =============================================================================
// GhostFix — Teams Management Page
// Route: /teams
//
// Client Component — all CRUD happens via the /api/teams/* routes.
// No auth needed — owner email is pre-filled from localStorage.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Ghost, Users, GitBranch, Plus, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ExternalLink,
  Code2, Settings, UserPlus, Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror API response shape)
// ---------------------------------------------------------------------------
interface TeamMember { id: string; email: string; role: string; created_at: string; }
interface TeamRepo   { id: string; repo_owner: string; repo_name: string; default_branch: string; modules: string[]; created_at: string; }
interface Team {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  created_at: string;
  team_members: TeamMember[];
  team_repos: TeamRepo[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ---------------------------------------------------------------------------
// Sub: Create Team Form
// ---------------------------------------------------------------------------
function CreateTeamForm({ onCreated }: { onCreated: (team: Team) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch signed-up users for the owner dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d: { users?: { id: string; email: string }[] }) => {
        const list = d.users ?? [];
        setUsers(list);
        // Pre-select the stored visitor email if it's in the list
        try {
          const stored = localStorage.getItem("gf_visitor_email") ?? "";
          if (stored && list.some((u) => u.email === stored)) setEmail(stored);
          else if (list.length > 0) setEmail(list[0].email);
        } catch (_) {
          if (list.length > 0) setEmail(list[0].email);
        }
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), owner_email: email.trim() }),
      });
      const data = await res.json() as { team?: Team; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create team");
      onCreated(data.team!);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-3">
      <p className="text-sm font-semibold">Create a new team</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name (e.g. Backend Platform)"
          className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          required
        />
        {users.length > 0 ? (
          <select
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring"
            required
          >
            {users.map((u) => (
              <option key={u.id} value={u.email} className="bg-card text-foreground">
                {u.email}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Owner email"
            className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
            required
          />
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Create
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub: Team Card (expandable — members + repo sections)
// ---------------------------------------------------------------------------
function TeamCard({ team, onUpdated }: { team: Team; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);

  // Member form
  const [memberEmail, setMemberEmail] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberOk, setMemberOk] = useState(false);

  // Repo form
  const [repoOwner, setRepoOwner] = useState(team.team_repos?.[0]?.repo_owner ?? "");
  const [repoName, setRepoName] = useState(team.team_repos?.[0]?.repo_name ?? "");
  const [branch, setBranch] = useState(team.team_repos?.[0]?.default_branch ?? "main");
  const [pat, setPat] = useState("");
  const [modulesRaw, setModulesRaw] = useState(
    (team.team_repos?.[0]?.modules ?? []).join(", ")
  );
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [repoOk, setRepoOk] = useState(false);

  const repo = team.team_repos?.[0];

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setMemberError(""); setMemberOk(false); setMemberLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add member");
      setMemberEmail(""); setMemberOk(true);
      setTimeout(() => setMemberOk(false), 2500);
      onUpdated();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Error");
    } finally { setMemberLoading(false); }
  }

  async function removeMember(email: string) {
    await fetch(`/api/teams/${team.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    onUpdated();
  }

  async function connectRepo(e: React.FormEvent) {
    e.preventDefault();
    setRepoError(""); setRepoOk(false); setRepoLoading(true);
    try {
      const modules = modulesRaw.split(",").map((m) => m.trim()).filter(Boolean);
      const res = await fetch(`/api/teams/${team.id}/repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_owner: repoOwner.trim(),
          repo_name: repoName.trim(),
          default_branch: branch.trim() || "main",
          github_pat: pat.trim(),
          modules,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to connect repo");
      setRepoOk(true);
      setTimeout(() => setRepoOk(false), 3000);
      onUpdated();
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : "Error");
    } finally { setRepoLoading(false); }
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
          <Users className="size-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{team.name}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            {(team.team_members ?? []).length} member{(team.team_members ?? []).length !== 1 ? "s" : ""}
            {" · "}
            {repo
              ? <span className="text-emerald-400">{repo.repo_owner}/{repo.repo_name}</span>
              : <span className="text-amber-400/80">No repo connected</span>}
            {" · created "}{timeAgo(team.created_at)}
          </p>
        </div>
        {/* Tags */}
        <div className="hidden sm:flex items-center gap-2">
          {repo && (
            <a
              href={`https://github.com/${repo.repo_owner}/${repo.repo_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/15"
            >
              <GitBranch className="size-3" />
              GitHub
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 rounded-lg border border-border/40 p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border/30 divide-y divide-border/20">

          {/* ── Members section ── */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="size-3.5 text-indigo-400" />
              <p className="text-xs font-semibold">Members</p>
            </div>
            {/* Member list */}
            <div className="space-y-1.5">
              {(team.team_members ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
                  <div className="size-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-300 uppercase shrink-0">
                    {m.email[0]}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">{m.email}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    m.role === "owner"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-zinc-500/10 text-zinc-400"
                  }`}>{m.role}</span>
                  {m.role !== "owner" && (
                    <button
                      onClick={() => removeMember(m.email)}
                      className="shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {/* Add member form */}
            <form onSubmit={addMember} className="flex gap-2">
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                type="email"
                placeholder="colleague@company.com"
                className="h-8 flex-1 rounded-lg border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                required
              />
              <button
                type="submit"
                disabled={memberLoading}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-600/80 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {memberLoading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                Add
              </button>
            </form>
            {memberError && <p className="text-[11px] text-red-400">{memberError}</p>}
            {memberOk && <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="size-3" /> Member added!</p>}
          </div>

          {/* ── GitHub Repo section ── */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="size-3.5 text-violet-400" />
              <p className="text-xs font-semibold">GitHub Repository</p>
              {repo && (
                <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Connected
                </span>
              )}
            </div>

            {repo && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
                <p className="font-mono text-emerald-300">{repo.repo_owner}/{repo.repo_name}</p>
                <p className="mt-0.5 text-muted-foreground/60">
                  Branch: <span className="text-foreground/70">{repo.default_branch}</span>
                  {repo.modules.length > 0 && (
                    <> · Modules: <span className="text-foreground/70">{repo.modules.join(", ")}</span></>
                  )}
                </p>
              </div>
            )}

            <form onSubmit={connectRepo} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="GitHub owner (user/org)"
                  className="h-8 rounded-lg border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                  required
                />
                <input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Repo name"
                  className="h-8 rounded-lg border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Default branch (main)"
                  className="h-8 rounded-lg border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                />
                <input
                  value={modulesRaw}
                  onChange={(e) => setModulesRaw(e.target.value)}
                  placeholder="Modules (comma-separated)"
                  className="h-8 rounded-lg border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  type="password"
                  placeholder="GitHub Personal Access Token (repo scope)"
                  className="h-8 flex-1 rounded-lg border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                  required
                />
                <button
                  type="submit"
                  disabled={repoLoading}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600/80 px-3 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                >
                  {repoLoading ? <Loader2 className="size-3 animate-spin" /> : <Settings className="size-3" />}
                  {repo ? "Update" : "Connect"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                Generate a PAT at GitHub → Settings → Developer Settings → Fine-grained tokens → repo scope.
                GhostFix uses it to read your source files and open pull requests automatically.
              </p>
              {repoError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle className="size-3" /> {repoError}</p>}
              {repoOk && <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="size-3" /> Repo connected successfully!</p>}
            </form>
          </div>

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const data = await res.json() as { teams?: Team[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load teams");
      setTeams(data.teams ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  function handleCreated(_team: Team) {
    fetchTeams();
    setShowCreate(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Ghost className="size-[18px] text-white" />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-violet-300 bg-clip-text text-sm font-semibold tracking-tight text-transparent">GhostFix</span>
              <span className="text-[10px] text-muted-foreground/70">Autonomous SRE Triage</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex">
              <ArrowLeft className="size-3" /> Dashboard
            </Link>
            <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5">
              <Users className="size-3 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-400">Teams</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Users className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect a GitHub repo — GhostFix will open real PRs when a bug is triaged
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500"
          >
            <Plus className="size-3.5" />
            New Team
          </button>
        </div>

        {/* How it works callout */}
        <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 size-4 shrink-0 text-indigo-400" />
            <div>
              <p className="text-sm font-medium text-indigo-300">How real patches work</p>
              <p className="mt-1 text-xs leading-relaxed text-indigo-400/70">
                Create a team, connect your GitHub repo with a PAT, and add your module names.
                Next time someone submits a bug, GhostFix finds the relevant source file,
                generates a real fix with AI, and opens an actual pull request on your repo.
              </p>
            </div>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mb-6">
            <CreateTeamForm onCreated={handleCreated} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-6 animate-spin text-muted-foreground/40" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && teams.length === 0 && !showCreate && (
          <div className="flex flex-col items-center gap-5 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/20">
              <Users className="size-8 text-muted-foreground/30" />
            </div>
            <div className="max-w-sm">
              <p className="font-medium text-foreground/60">No teams yet</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Create a team, connect your GitHub repo, and GhostFix will open
                real pull requests instead of simulated patches.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
            >
              <Plus className="size-4" /> Create your first team
            </button>
          </div>
        )}

        {/* Team list */}
        {!loading && teams.length > 0 && (
          <div className="space-y-4">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} onUpdated={fetchTeams} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
