import { redirect } from "next/navigation";

/**
 * Statistik Editor has been merged into /panel/statistik as the "Editor" tab.
 * This route now permanently redirects to keep old links/bookmarks working.
 */
export default function StatistikEditorRedirect() {
  redirect("/panel/statistik");
}
