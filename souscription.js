(() => {
const VERSION = 'CGV-PARTENAIRES-2026-10-20-v2';
const OFFERS = Object.freeze({
 monthly: '19,90 € par mois, engagement minimum de 6 mois, soit 119,40 €, puis poursuite mensuelle jusqu’à résiliation en fin de période selon les conditions.',
 annual: '220 € en un paiement pour 12 mois, sans renouvellement automatique.'
});
function prepare(data) {
 if (!Object.hasOwn(OFFERS, data.plan)) throw Error('Choisissez une formule.');
 if (!['distance','place','incertain'].includes(data.context)) throw Error('Précisez le contexte de votre demande.');
 for (const key of ['restaurant','email']) {
  if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 250 || /[\r\n]/.test(data[key])) throw Error('Vérifiez vos coordonnées.');
 }
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw Error('Vérifiez votre adresse e-mail.');
 const remote = data.context === 'distance';
 if (remote && (data.accept !== true || data.commitment !== true)) throw Error('Votre accord sur les conditions est nécessaire pour préparer une commande.');
 return {remote};
}

globalThis.SoleilOrder = Object.freeze({VERSION, OFFERS, prepare});

})();
