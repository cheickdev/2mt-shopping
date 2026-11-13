"use client";

import { useState } from "react";

// Barres « visiteurs par jour » avec infobulle au survol / au toucher.
export default function VisitChart({ series }: { series: { day: string; visitors: number; views: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((s) => s.visitors));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = series.length > 31 ? 14 : series.length > 10 ? 5 : 1;
  const h = hover !== null ? series[hover] : null;

  return (
    <div className="vc">
      <div className="vc-tip" aria-live="polite">
        {h ? (
          <>
            <b>{longDate(h.day)}</b> · {h.visitors} visiteur{h.visitors > 1 ? "s" : ""} · {h.views} page{h.views > 1 ? "s" : ""} vue{h.views > 1 ? "s" : ""}
          </>
        ) : (
          <span className="muted">Touchez une barre pour voir le détail.</span>
        )}
      </div>
      <div className="vc-plot">
        <div className="vc-grid">
          {ticks.map((t) => (
            <div key={t} className="vc-line" style={{ bottom: `${(t / top) * 100}%` }}>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div className="vc-bars" onMouseLeave={() => setHover(null)}>
          {series.map((s, i) => (
            <button
              key={s.day}
              type="button"
              className={`vc-col ${hover === i ? "on" : ""}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${longDate(s.day)} : ${s.visitors} visiteurs`}
            >
              <span className="vc-bar" style={{ height: `${(s.visitors / top) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="vc-x">
        {series.map((s, i) => (
          <span key={s.day}>{i % labelEvery === 0 || i === series.length - 1 ? shortDate(s.day) : ""}</span>
        ))}
      </div>
    </div>
  );
}

function niceStep(max: number): number {
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  for (const m of [1, 2, 5, 10]) if (raw <= m * p) return Math.max(1, m * p);
  return 10 * p;
}
const shortDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const longDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
