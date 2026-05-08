"use client";

import { usePathname } from "next/navigation";
import NewsTicker from "./NewsTicker";

// Mirrors PublicNav/PublicFooter — show ticker chrome on every public page,
// hide on the admin panel and login screen so those surfaces stay focused.
export default function PublicTicker() {
  const pathname = usePathname() || "";
  const hide = pathname.startsWith("/panel") || pathname === "/login";
  if (hide) return null;
  return <NewsTicker />;
}
