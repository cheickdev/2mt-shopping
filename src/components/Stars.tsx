// Affichage d'une note en etoiles (lecture seule). Utilisable cote serveur.
export default function Stars({ avg, count, size = 14, showCount = true }: { avg: number; count: number; size?: number; showCount?: boolean }) {
  if (!count) return null;
  const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
  return (
    <span className="stars" aria-label={`Note ${avg.toFixed(1)} sur 5 (${count} avis)`} title={`${avg.toFixed(1)} / 5 — ${count} avis`}>
      <span className="stars-bg" style={{ fontSize: size }} aria-hidden>
        ★★★★★
        <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      {showCount && <span className="stars-n">{avg.toFixed(1)} ({count})</span>}
    </span>
  );
}
