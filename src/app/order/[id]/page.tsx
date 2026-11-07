"use client";

import { use, useEffect, useState } from "react";

interface OrderView {
  publicId: string;
  serviceName: string;
  imei: string;
  status: string;
  resultText: string | null;
  errorMessage: string | null;
}

const LABELS: Record<string, string> = {
  PENDING: "En attente de paiement",
  PAID: "Paye",
  PROCESSING: "En cours de traitement",
  DELIVERED: "Livre",
  FAILED: "Echec",
  REFUNDED: "Rembourse",
};

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Commande introuvable.");
          return;
        }
        setOrder(data.order);
        // Continue de rafraichir tant que la commande n'est pas finalisee.
        // (Le serveur interroge le fournisseur pour les commandes non instantanees ;
        // on espace les appels a 6 s pour ne pas le solliciter inutilement.)
        if (data.order.status !== "DELIVERED" && data.order.status !== "FAILED") {
          setTimeout(load, 6000);
        }
      } catch {
        if (active) setError("Impossible de contacter le serveur.");
      }
    }
    async function begin() {
      // Au retour du paiement CinetPay : on verifie le statut avant de suivre.
      // (La notification serveur-a-serveur finalise de toute facon ; le polling suit.)
      try {
        await fetch(`/api/order/confirm?order=${encodeURIComponent(id)}`);
      } catch {
        // ignore : le polling ci-dessous prendra le relais
      }
      load();
    }

    begin();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main style={{ padding: "48px 0", maxWidth: 640, margin: "0 auto" }}>
      <a href="/">← Nouvelle commande</a>
      <h1 style={{ marginTop: 16 }}>Suivi de commande</h1>

      {error && <div className="card error">{error}</div>}

      {order && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{order.publicId}</strong>
            <span className={`status-pill status-${order.status}`}>
              {LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 12 }}>
            {order.serviceName}
            <br />
            IMEI : {order.imei}
          </p>

          {order.status === "DELIVERED" && order.resultText && (
            <div className="result-box">{order.resultText}</div>
          )}
          {order.status === "FAILED" && (
            <div className="error">{order.errorMessage ?? "Le traitement a echoue."}</div>
          )}
          {(order.status === "PROCESSING" || order.status === "PAID" || order.status === "PENDING") && (
            <div className="note">Traitement en cours… cette page se met a jour automatiquement.</div>
          )}
        </div>
      )}

      {!order && !error && <div className="card">Chargement…</div>}
    </main>
  );
}
