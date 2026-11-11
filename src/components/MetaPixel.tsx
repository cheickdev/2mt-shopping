"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { flushPending, track } from "@/lib/pixel";

// Charge le Pixel Facebook (Meta) une fois, puis signale chaque page vue.
// Pas de suivi dans l'administration. Les clics vers WhatsApp comptent comme « Contact ».
export default function MetaPixel({ id }: { id: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const loaded = useRef(false);
  const admin = pathname.startsWith("/admin");

  useEffect(() => {
    if (!id || admin || loaded.current) return;
    loaded.current = true;
    /* eslint-disable */
    // Code officiel de Meta (fbevents.js), ecrit lisiblement.
    const w = window as any;
    if (!w.fbq) {
      const n: any = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      };
      w.fbq = n;
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(s);
    }
    /* eslint-enable */
    w.fbq("init", id);
    w.fbq("track", "PageView");
    flushPending();
  }, [id, admin]);

  // Une « page vue » a chaque changement de page (la premiere est comptee a l'initialisation).
  const first = useRef(true);
  useEffect(() => {
    if (!id || admin) return;
    if (first.current) {
      first.current = false;
      return;
    }
    track("PageView");
  }, [id, admin, pathname, search]);

  // Clic vers WhatsApp = prise de contact.
  useEffect(() => {
    if (!id || admin) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (a && /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(a.href)) track("Contact", { content_name: "WhatsApp" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [id, admin]);

  return null;
}
