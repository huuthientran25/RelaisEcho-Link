// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Interface language. English is read from the page itself, so the HTML stays the single English source.
// French: draft by the team, to be checked by a fluent reviewer. Inuktitut: slots exist for every string,
// but no text is shipped until a certified translator provides it. Machine translation is not used,
// because no evaluation of machine translated Inuktitut health text was found.

export const LANGS = {
  en: { label: 'English', htmlLang: 'en' },
  fr: { label: 'Français', htmlLang: 'fr-CA' },
  iu: { label: 'ᐃᓄᒃᑎᑐᑦ (Inuktitut)', htmlLang: 'iu', pending: true },
};

export const STRINGS = {
  fr: {
    'nav.board': 'Tableau',
    'nav.overview': 'Aperçu',
    'nav.checkup': 'Bilan',
    'nav.exp': 'Expérimental',
    'nav.history': 'Historique',
    'home.eyebrow': 'Bilan guidé par caméra · de l’orbite au Nord',
    'home.h1': 'Votre dernier bilan, aligné sur celui d’aujourd’hui.',
    'home.lede': 'La caméra d’un téléphone ou d’un portable vous guide jusqu’à la même position que votre bilan de référence, ne mesure que lorsque le signal est bon, et prépare un court dossier qu’un professionnel à distance peut consulter.',
    'home.start': 'Commencer le bilan guidé',
    'home.board': 'Tableau de mission',
    'home.overview': 'Aperçu',
    'home.sample': 'Voir l’exemple',
    'home.disclaimer': 'Prototype de recherche créé au NASA Space Apps 2026, Montréal. Ce n’est pas un dispositif diagnostique. Si quelque chose ne va pas, contactez directement un professionnel de la santé.',
    'home.captures.h': 'Ce qu’il mesure',
    'home.captures.1': 'Estimation du pouls à partir de la vidéo du visage, avec un indice de qualité',
    'home.captures.2': 'Fréquence respiratoire à partir des mouvements du cou et du haut du corps',
    'home.captures.3': 'Photos dentaires appariées : face et deux côtés',
    'home.new.h': 'Ce qui est nouveau',
    'home.new.1': 'Aucun appareil à porter, aucun téléversement : la vidéo ne quitte jamais l’appareil',
    'home.new.2': 'Comparé à votre propre référence, pas à une moyenne de population',
    'home.new.3': 'Fonctionne hors ligne et prépare un court dossier pour une infirmière',
    'home.quality': 'Comment fonctionnent les contrôles de qualité',
    'board.step': 'Tableau de mission',
    'board.h1': 'Gardez les habitudes qui vous gardent en mission.',
    'board.lede': 'Des tuiles séparées, chacune indiquant d’où vient son chiffre. Il n’y a pas de score de santé combiné : un seul chiffre cacherait ce qui a changé.',
    'board.t.check': 'Rythme des bilans',
    'board.t.alert': 'Vigilance',
    'board.t.sleep': 'Pression de sommeil',
    'board.t.rad': 'Budget de radiation',
    'board.t.gly': 'Nettoyage du cerveau et sommeil',
    'board.t.sw': 'Météo spatiale',
    'board.t.delay': 'Délai du signal',
    'board.t.eye': 'Grille visuelle',
    'board.t.exp': 'Contrôles expérimentaux',
    'board.t.day': 'Lumière du jour',
    'alert.step': 'Test de vigilance · expérimental',
    'alert.h1': 'Test de réaction de 3 minutes',
    'alert.lede': 'Un compteur démarre à des moments aléatoires. Appuyez sur le grand bouton, ou sur la barre d’espace, dès que vous le voyez. Un cerveau fatigué rate plus de signaux et répond plus lentement, souvent avant qu’on le sente.',
    'alert.start': 'Commencer le test',
    'tour.h': 'Essayez en une minute, sans caméra',
    'board.t.today': 'Aujourd’hui',
    'board.t.crew': 'Analyses sanguines de l’équipage',
    'review.h1': 'Ouvrir un dossier de révision',
    'history.h1': 'Historique',
    'crew.h1': 'Pourquoi votre propre référence compte',
  },
  // Every key exists so a translator can fill them in place; null means "awaiting certified translation".
  iu: {},
};

export const NOTICE = {
  fr: 'Brouillon en français rédigé avec l’aide de l’IA, à faire vérifier par une personne qui parle couramment. Le fichier du dossier de révision reste en anglais (seul son affichage est traduit), comme le rapport d’appareil et quelques lignes techniques.',
  iu: 'ᐃᓄᒃᑎᑐᑦ · Inuktitut text is awaiting a certified translator. English is shown until then. Machine translation is not used.',
};

export function translatableKeys(root = document) {
  return [...root.querySelectorAll('[data-i18n]')].map((el) => el.dataset.i18n);
}

// Returns the text to show for one key: the translation if present, else the English original.
export function pick(lang, key, english) {
  const t = STRINGS[lang]?.[key];
  return typeof t === 'string' && t.trim() ? t : english;
}

export function applyLang(lang, root = document) {
  const code = LANGS[lang] ? lang : 'en';
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.dataset.en === undefined) el.dataset.en = el.textContent;
    el.textContent = pick(code, el.dataset.i18n, el.dataset.en);
  });
  root.documentElement.lang = LANGS[code].htmlLang;
  return { code, notice: NOTICE[code] || '' };
}

// Live coaching phrases (scan, dental capture, status chips), keyed by the English text.
// French drafts; anything missing falls back to English.
export const PHRASES_FR = {
  'Hold still': 'Restez immobile',
  'Hold still and breathe normally': 'Restez immobile et respirez normalement',
  'Bring your face into the outline': 'Placez votre visage dans le contour',
  'Come a little closer': 'Rapprochez-vous un peu',
  'Move back a little': 'Reculez un peu',
  'Too dark: turn on a light facing you': 'Trop sombre : allumez une lumière face à vous',
  'Too bright: move out of direct light': 'Trop clair : éloignez-vous de la lumière directe',
  'Camera is running slowly; close other apps': 'La caméra est lente; fermez les autres applications',
  'Move a little to your right': 'Déplacez-vous un peu vers votre droite',
  'Move a little to your left': 'Déplacez-vous un peu vers votre gauche',
  'Move up a little, or lower the camera': 'Montez un peu, ou baissez la caméra',
  'Move down a little, or raise the camera': 'Descendez un peu, ou montez la caméra',
  'Level your head': 'Gardez la tête droite',
  'Turn your head slightly to your right': 'Tournez légèrement la tête vers votre droite',
  'Turn your head slightly to your left': 'Tournez légèrement la tête vers votre gauche',
  'Raise your chin a little': 'Levez un peu le menton',
  'Lower your chin a little': 'Baissez un peu le menton',
  'Adjust your position': 'Ajustez votre position',
  'Starting…': 'Démarrage…',
  'Loading the face model…': 'Chargement du modèle du visage…',
  'Spoken instructions on.': 'Instructions vocales activées.',
  Light: 'Éclairage', Still: 'Immobile', Distance: 'Distance', Aligned: 'Aligné', Moving: 'En mouvement',
  'Too dark': 'Trop sombre', 'Too bright': 'Trop clair', 'Too far': 'Trop loin', 'Not aligned': 'Pas aligné',
  'Face not found': 'Visage introuvable', 'Neck and shoulders out of view': 'Cou et épaules hors du cadre',
  'Turn a little to your right to face the camera': 'Tournez-vous un peu vers votre droite pour faire face à la caméra',
  'Turn a little to your left to face the camera': 'Tournez-vous un peu vers votre gauche pour faire face à la caméra',
  'Turn your head further to your left': 'Tournez davantage la tête vers votre gauche',
  'Turn your head further to your right': 'Tournez davantage la tête vers votre droite',
  'Turn back a little': 'Revenez un peu',
  'Face not found. Bring the camera closer to your mouth area.': 'Visage introuvable. Approchez la caméra de votre bouche.',
  'Smile with lips apart so your teeth show': 'Souriez, lèvres entrouvertes, pour montrer vos dents',
  'Too dark. Add light facing you (a phone flashlight helps).': 'Trop sombre. Ajoutez une lumière face à vous (la lampe d’un téléphone aide).',
  'Glare on the teeth. Tilt the light or the camera slightly.': 'Reflet sur les dents. Inclinez légèrement la lumière ou la caméra.',
  'Move closer to the camera, as at your baseline': 'Rapprochez-vous de la caméra, comme lors de votre référence',
  'Move back a little, as at your baseline': 'Reculez un peu, comme lors de votre référence',
  Front: 'Face', 'Your right side': 'Votre côté droit', 'Your left side': 'Votre côté gauche',
};

export function phrase(lang, text) {
  if (lang !== 'fr' || typeof text !== 'string') return text;
  if (PHRASES_FR[text]) return PHRASES_FR[text];
  let m = text.match(/^Low frame rate \((\d+) fps\)(, results less certain)?$/);
  if (m) return `Fréquence d’images basse (${m[1]} i/s)${m[2] ? ', résultats moins sûrs' : ''}`;
  m = text.match(/^(.+) captured$/);
  if (m) return `${PHRASES_FR[m[1]] || m[1]} : photo prise`;
  m = text.match(/^(Front|Your right side|Your left side): (.+)$/);
  if (m) return `${PHRASES_FR[m[1]]} : ${phrase(lang, m[2])}`;
  return text;
}
