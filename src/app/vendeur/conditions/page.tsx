import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions vendeurs",
  description: "Les règles pour vendre sur 2MT - Shopping en tant que vendeur partenaire.",
  alternates: { canonical: "/vendeur/conditions" },
};

// Regles simples pour les vendeurs partenaires (texte statique).
export default function VendorTerms() {
  return (
    <article className="terms">
      <h1>Conditions vendeurs</h1>
      <p className="note">Vendeurs partenaires de 2MT - Shopping · Bamako</p>
      <p>
        2MT - Shopping permet à des vendeurs partenaires de présenter leurs articles sur le site. En utilisant
        l'espace vendeur, vous acceptez les règles ci-dessous.
      </p>

      <h2>1. Votre compte</h2>
      <ul>
        <li>Les comptes vendeurs sont ouverts sur invitation de 2MT - Shopping.</li>
        <li>Votre mot de passe est personnel : ne le donnez à personne. En cas de perte, demandez-en un nouveau à 2MT.</li>
        <li>Le numéro WhatsApp de votre compte est celui que les clients contactent. Il doit être joignable.</li>
      </ul>

      <h2>2. Vos produits</h2>
      <ul>
        <li>Chaque nouveau produit est vérifié par 2MT avant d'apparaître sur le site. 2MT peut le refuser en indiquant le motif.</li>
        <li><b>Photos</b> : nettes, bien éclairées, montrant le vrai article que vous vendez. Pas de photo floue ni de texte ou de numéro écrit dessus.</li>
        <li><b>Nom et description</b> : clairs et honnêtes (marque, taille, couleur, état). Pas de fausse marque ni de contrefaçon présentée comme originale.</li>
        <li><b>Prix</b> : le prix affiché est le prix réel en francs CFA. Ne demandez pas plus au client que le prix affiché (hors frais de livraison annoncés).</li>
        <li><b>Stock</b> : retirez ou mettez à jour un article dès qu'il n'est plus disponible.</li>
        <li>Le nombre de produits est limité selon votre compte (20 au départ).</li>
      </ul>

      <h2>3. Articles interdits</h2>
      <ul>
        <li>Médicaments, produits dangereux ou périmés, produits éclaircissants contenant des substances interdites.</li>
        <li>Armes, alcool, tabac, contenus pour adultes.</li>
        <li>Articles volés, contrefaçons, ou tout ce qui est interdit par la loi au Mali.</li>
      </ul>

      <h2>4. Vente et livraison</h2>
      <ul>
        <li>Le client vous contacte directement sur WhatsApp. <b>Vous êtes le vendeur</b> : vous confirmez la commande, livrez et encaissez le paiement.</li>
        <li>Répondez aux clients rapidement, au plus tard dans la journée.</li>
        <li>Annoncez clairement au client le délai et les frais de livraison avant de livrer.</li>
        <li>Livrez l'article tel qu'il est montré sur le site. En cas d'article abîmé ou différent, trouvez une solution avec le client (échange ou remboursement).</li>
        <li>Soyez poli et respectueux : vous représentez aussi l'image de 2MT - Shopping.</li>
      </ul>

      <h2>5. Prix du service</h2>
      <ul>
        <li>Le service est <b>gratuit</b> jusqu'à la date indiquée dans votre espace vendeur.</li>
        <li>Après cette date, 2MT pourra proposer un abonnement ou une commission. Vous serez prévenu <b>au moins un mois à l'avance</b>, et vous pourrez arrêter sans frais si vous n'êtes pas d'accord.</li>
      </ul>

      <h2>6. Suspension</h2>
      <ul>
        <li>2MT peut retirer un produit ou suspendre un compte en cas de plaintes répétées de clients, d'articles interdits, de prix trompeurs ou de non-respect de ces règles.</li>
        <li>Un compte suspendu n'est plus visible sur le site. Contactez 2MT pour en discuter.</li>
        <li>Vous pouvez arrêter quand vous voulez : supprimez vos produits ou demandez la fermeture de votre compte.</li>
      </ul>

      <h2>7. Responsabilité</h2>
      <p>
        2MT - Shopping met le site à disposition pour présenter vos articles. La vente se fait entre vous et le client :
        2MT n'est pas responsable des articles, des paiements ni des livraisons des vendeurs partenaires. En cas de litige,
        2MT peut aider à trouver une solution mais n'est pas tenu de rembourser.
      </p>

      <h2>8. Changements</h2>
      <p>Ces conditions peuvent évoluer. En cas de changement important, les vendeurs seront prévenus sur WhatsApp.</p>

      <p className="note">Dernière mise à jour : novembre 2026.</p>
    </article>
  );
}
