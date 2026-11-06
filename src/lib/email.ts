// Emails transactionnels.
//  - RESEND_API_KEY defini  -> envoi reel via l'API Resend (simple appel HTTP).
//  - sinon                  -> mode simulation : l'email est journalise en console.
// Aucune dependance : on appelle l'API Resend avec fetch.

export function emailMode(): "live" | "simulation" {
  return process.env.RESEND_API_KEY ? "live" : "simulation";
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "UnlockPro <onboarding@resend.dev>";
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (emailMode() === "simulation") {
    console.log(`[EMAIL SIMULE] -> ${msg.to} | ${msg.subject}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: msg.to, subject: msg.subject, html: msg.html }),
    });
    if (!res.ok) {
      console.error(`[EMAIL] Echec d'envoi (${res.status}) :`, await res.text());
    }
  } catch (err) {
    console.error("[EMAIL] Erreur reseau :", (err as Error).message);
  }
}

// --- Gabarit commun ---------------------------------------------------------
function layout(title: string, bodyHtml: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif;color:#e8ecf7;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#141b31;border:1px solid #273154;border-radius:14px;padding:28px">
    <div style="font-size:20px;font-weight:bold;margin-bottom:16px">Unlock<span style="color:#4f8cff">Pro</span></div>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    ${bodyHtml}
    <p style="color:#9aa6c4;font-size:12px;margin-top:24px;border-top:1px solid #273154;padding-top:14px">
      Vous recevez cet email suite a une commande sur <a style="color:#4f8cff" href="${site}">UnlockPro</a>.
    </p>
  </div></body></html>`;
}

export function orderDeliveredEmail(o: {
  publicId: string;
  serviceName: string;
  imei: string;
  resultText: string | null;
}): EmailMessage {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const body = `
    <p>Votre commande <strong>${o.publicId}</strong> est prete.</p>
    <p style="color:#9aa6c4;margin:4px 0">${o.serviceName} — IMEI ${o.imei}</p>
    <div style="background:#1b2340;border:1px solid #273154;border-radius:10px;padding:16px;white-space:pre-wrap;font-family:monospace;font-size:14px;margin:16px 0">${(o.resultText ?? "").replace(/</g, "&lt;")}</div>
    <a href="${site}/order/${o.publicId}" style="display:inline-block;background:#4f8cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Voir ma commande</a>`;
  return { to: "", subject: `Votre commande ${o.publicId} est prete`, html: layout("Resultat disponible", body) };
}

export function welcomeEmail(name?: string | null): EmailMessage {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const hello = name ? `Bienvenue ${name} !` : "Bienvenue !";
  const body = `
    <p>${hello} Votre compte UnlockPro est cree.</p>
    <p>Depuis votre espace, verifiez l'historique d'un telephone (iCloud, blacklist, operateur)
    ou debloquez-le par IMEI, et retrouvez tous vos resultats au meme endroit.</p>
    <a href="${site}" style="display:inline-block;background:#4f8cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;margin:12px 0">Lancer une verification</a>
    <p style="color:#9aa6c4;font-size:13px">Astuce : composez *#06# sur un telephone pour afficher son IMEI.</p>`;
  return { to: "", subject: "Bienvenue sur UnlockPro", html: layout("Votre compte est pret", body) };
}

export function passwordResetEmail(resetUrl: string): EmailMessage {
  const body = `
    <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
    <p>Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien expire dans 1 heure.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#4f8cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;margin:12px 0">Reinitialiser mon mot de passe</a>
    <p style="color:#9aa6c4;font-size:13px">Si vous n'etes pas a l'origine de cette demande, ignorez cet email.</p>`;
  return { to: "", subject: "Reinitialisation de votre mot de passe", html: layout("Mot de passe oublie", body) };
}

export function orderFailedEmail(o: {
  publicId: string;
  serviceName: string;
  imei: string;
}): EmailMessage {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const body = `
    <p>Nous n'avons pas pu traiter votre commande <strong>${o.publicId}</strong> (${o.serviceName}, IMEI ${o.imei}).</p>
    <p>Si vous avez ete debite, vous serez rembourse. Notre equipe peut relancer la demande.</p>
    <a href="${site}/order/${o.publicId}" style="display:inline-block;background:#4f8cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Voir ma commande</a>`;
  return { to: "", subject: `Probleme avec votre commande ${o.publicId}`, html: layout("Commande non aboutie", body) };
}
