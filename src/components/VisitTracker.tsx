"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Compte chaque page vue (statistiques anonymes du site).
export default function VisitTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // La page precedente ne compte que pour la 1re page (d'ou vient le visiteur).
    const ref = first.current ? document.referrer : location.href;
    first.current = false;
    fetch("/api/visite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, search: location.search, ref }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
