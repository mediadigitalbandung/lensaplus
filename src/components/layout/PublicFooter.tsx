"use client";
import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function PublicFooter({ dewanPersNumber }: { dewanPersNumber?: string }) {
  const pathname = usePathname();
  const hideFooter = pathname.startsWith("/panel") || pathname === "/login";
  if (hideFooter) return null;
  return <Footer dewanPersNumber={dewanPersNumber} />;
}
