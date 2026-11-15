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
    'nav.history': 'Historique',
    'home.eyebrow': 'Bilan guidé par caméra · de l’orbite au Nord',
    'home.h1': 'Votre dernier bilan, aligné sur celui d’aujourd’hui.',
    'home.lede': 'La caméra d’un téléphone ou d’un portable vous guide jusqu’à la même position que votre bilan de référence, ne mesure que lorsque le signal est bon, et prépare un court dossier qu’un professionnel à distance peut consulter.',
    'home.start': 'Commencer le bilan guidé',
    'home.board': 'Tableau de mission',
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
    'alert.step': 'Test de vigilance · expérimental',
    'alert.h1': 'Test de réaction de 3 minutes',
    'alert.lede': 'Un compteur démarre à des moments aléatoires. Appuyez sur le grand bouton, ou sur la barre d’espace, dès que vous le voyez. Un cerveau fatigué rate plus de signaux et répond plus lentement, souvent avant qu’on le sente.',
    'alert.start': 'Commencer le test',
  },
  // Every key exists so a translator can fill them in place; null means "awaiting certified translation".
  iu: {},
};

export const NOTICE = {
  fr: 'Version française partielle, à faire vérifier. Certains écrans restent en anglais.',
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
