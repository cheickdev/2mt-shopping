"use client";

import { useState } from "react";
import Stars from "@/components/Stars";

// Note moyenne + etoiles cliquables pour que le client donne SA note.
export default function RateProduct({ productId, avg, count, mine }: { productId: string; avg: number; count: number; mine: number | null }) {
  const [state, setState] = useState({ avg, count, mine });
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function rate(stars: number) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, stars }),
      });
      const d = await res.json();
      if (d.ok) {
        setState({ avg: d.avg, count: d.count, mine: d.mine });
        setMsg("Merci pour votre note !");
      } else setMsg(d.error ?? "Note non enregistrée.");
    } catch {
      setMsg("Pas de connexion. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || state.mine || 0;
  return (
    <div className="rate">
      {state.count > 0 ? <Stars avg={state.avg} count={state.count} size={18} /> : <span className="note">Pas encore de note</span>}
      <div className="rate-me">
        <span className="note">{state.mine ? "Votre note :" : "Notez ce produit :"}</span>
        <span className="rate-stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= shown ? "on" : ""}
              onMouseEnter={() => setHover(n)}
              onClick={() => rate(n)}
              disabled={busy}
              aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
        </span>
      </div>
      {msg && <span className="note rate-msg">{msg}</span>}
    </div>
  );
}
