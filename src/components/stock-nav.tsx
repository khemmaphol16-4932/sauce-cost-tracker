"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";

export function StockNav() {
  const pathname = usePathname();
  return <Nav active={pathname?.startsWith("/stock/low") ? "low" : "stock"} />;
}
