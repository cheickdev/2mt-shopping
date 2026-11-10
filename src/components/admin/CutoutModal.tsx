"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { composeCutout, preparePhoto, segment, type Box, type Prepared } from "@/components/admin/cutout";

type Step = "draw" | "working" | "result";

// Ecran plein « Enlever le fond » : on trace un cadre autour d'un produit,
// l'IA le detoure, on garde la photo (ou on l'enregistre sur le telephone).
// Une photo d'etagere peut servir a detourer plusieurs produits a la suite.
export default function CutoutModal({
  src,
  useLabel,
  onUse,
  onClose,
}: {
  src: string;
  useLabel: string;
  onUse: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [status, setStatus] = useState<string | null>("Préparation de l'outil…");
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("draw");
  const [box, setBox] = useState<Box | null>(null); // en px de la photo analysee
  const [result, setResult] = useState<string | null>(null);
  const [count, setCount] = useState(0); // produits deja detoures sur cette photo
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<Box | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Charge l'IA et analyse la photo des l'ouverture (on peut tracer le cadre pendant ce temps).
  useEffect(() => {
    let alive = true;
    setError(null);
    preparePhoto(src, (p, label) => {
      if (!alive) return;
      setPct(p);
      setStatus(label);
    })
      .then((p) => {
        if (!alive) return;
        setPrep(p);
        setStatus(null);
        setPct(null);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        pending.current = null;
        setStep("draw");
        setError("L'outil n'a pas pu démarrer. Vérifiez votre connexion internet puis réessayez.");
      });
    return () => {
      alive = false;
    };
  }, [src, attempt]);

  // Bloque le defilement de la page derriere.
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);

  async function run(b: Box, p: Prepared) {
    setStep("working");
    setError(null);
    try {
      const url = composeCutout(p, await segment(p, b));
      if (!url) {
        setError("Aucun produit trouvé dans ce cadre. Tracez un cadre bien autour du produit.");
        setStep("draw");
        return;
      }
      setResult(url);
      setStep("result");
    } catch (e) {
      console.error(e);
      setError("Le découpage a échoué. Réessayez avec un autre cadre.");
      setStep("draw");
    }
  }

  // Quand l'analyse se termine alors qu'un cadre attend deja.
  useEffect(() => {
    if (prep && pending.current) {
      const b = pending.current;
      pending.current = null;
      run(b, prep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep]);

  /** Convertit un point de l'ecran en px de la photo analysee. */
  function toPhoto(e: React.PointerEvent): { x: number; y: number } | null {
    const img = imgRef.current;
    if (!img) return null;
    const r = img.getBoundingClientRect();
    const fullW = prep?.width ?? img.naturalWidth;
    const fullH = prep?.height ?? img.naturalHeight;
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    return { x: (x / r.width) * fullW, y: (y / r.height) * fullH };
  }

  function onDown(e: React.PointerEvent) {
    if (step !== "draw") return;
    const p = toPhoto(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = p;
    setBox([p.x, p.y, p.x, p.y]);
    setError(null);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const p = toPhoto(e);
    if (!p) return;
    const s = drag.current;
    setBox([Math.min(s.x, p.x), Math.min(s.y, p.y), Math.max(s.x, p.x), Math.max(s.y, p.y)]);
  }
  function onUp() {
    if (!drag.current) return;
    drag.current = null;
    if (!box) return;
    const minSide = Math.max(prep?.width ?? 0, imgRef.current?.naturalWidth ?? 0) * 0.03;
    if (box[2] - box[0] < minSide || box[3] - box[1] < minSide) {
      setBox(null);
      setError("Cadre trop petit : faites glisser le doigt d'un coin à l'autre du produit.");
      return;
    }
    go(box);
  }

  function go(b: Box) {
    if (prep) run(b, prep);
    else {
      pending.current = b;
      setStep("working");
    }
  }

  function wholePhoto() {
    const img = imgRef.current;
    const W = prep?.width ?? img?.naturalWidth ?? 0;
    const H = prep?.height ?? img?.naturalHeight ?? 0;
    if (!W || !H) return;
    const b: Box = [W * 0.02, H * 0.02, W * 0.98, H * 0.98];
    setBox(b);
    go(b);
  }

  function again() {
    setResult(null);
    setBox(null);
    setStep("draw");
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `produit-sans-fond-${count + 1}.${result.startsWith("data:image/webp") ? "webp" : "png"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setCount((c) => c + 1);
  }

  // Cadre en % de l'image affichee.
  const W = prep?.width ?? imgRef.current?.naturalWidth ?? 1;
  const H = prep?.height ?? imgRef.current?.naturalHeight ?? 1;
  const boxStyle = box
    ? {
        left: `${(box[0] / W) * 100}%`,
        top: `${(box[1] / H) * 100}%`,
        width: `${((box[2] - box[0]) / W) * 100}%`,
        height: `${((box[3] - box[1]) / H) * 100}%`,
      }
    : undefined;

  const busy = step === "working" ? (prep ? "Découpage du produit…" : status ?? "Analyse de la photo…") : null;

  if (!mounted) return null;
  return createPortal(
    <div className="cut-root" role="dialog" aria-modal="true" aria-label="Enlever le fond">
      <div className="cut-bar">
        <strong>✂️ Enlever le fond</strong>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Fermer
        </button>
      </div>

      {step !== "result" ? (
        <>
          <p className="cut-help">
            <b>Avec le doigt, tracez un cadre autour du produit</b> (d'un coin à l'autre, couvercle compris).
          </p>
          <div className="cut-stage">
            <div className="cut-frame" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={src} alt="Photo à découper" draggable={false} onLoad={() => setBox((b) => b)} />
              {boxStyle && <div className="cut-box" style={boxStyle} />}
              {busy && (
                <div className="cut-busy">
                  <span className="cut-spin" aria-hidden />
                  <span>{busy}</span>
                  {pct !== null && !prep && (
                    <span className="cut-progress">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="error">
              {error}
              {!prep && status && (
                <>
                  {" "}
                  <button type="button" className="btn sm" onClick={() => setAttempt((a) => a + 1)}>
                    Réessayer
                  </button>
                </>
              )}
            </div>
          )}
          <div className="cut-foot">
            {!prep && status && !error && (
              <span className="note">
                {status}
                {pct !== null ? ` ${pct} %` : ""} — vous pouvez déjà tracer le cadre.
              </span>
            )}
            <button type="button" className="btn ghost sm" onClick={wholePhoto} disabled={step === "working"}>
              Un seul produit sur la photo ? Toute la photo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cut-help">Voici le produit sans fond, tel qu'il apparaîtra sur la boutique :</p>
          <div className="cut-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {result && <img className="cut-result" src={result} alt="Produit sans fond" />}
          </div>
          <div className="cut-foot cut-actions">
            <button type="button" className="btn" onClick={() => result && onUse(result)}>
              ✅ {useLabel}
            </button>
            <button type="button" className="btn ghost" onClick={download}>
              ⬇️ Enregistrer sur le téléphone
            </button>
            <button type="button" className="btn ghost" onClick={again}>
              ✂️ Découper un autre produit (ou recommencer)
            </button>
            {count > 0 && <span className="note">{count} photo{count > 1 ? "s" : ""} enregistrée{count > 1 ? "s" : ""} sur l'appareil.</span>}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
