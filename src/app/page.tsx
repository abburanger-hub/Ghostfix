import { redirect } from "next/navigation";

// Root route — immediately redirects to the GhostFix dashboard
export default function Home() {
  redirect("/dashboard");
}
