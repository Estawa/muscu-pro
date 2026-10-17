// Note du bac en musculation (v1.9.0), selon les protocoles du lycée Georges-Brassens
// (référentiels établissement, session 2021). L'enseignant choisit les degrés ; la note est
// affichée à côté de la note de suivi de cycle /20, qui reste calculée comme avant, et
// l'enseignant choisit celle qu'il retient.
//
// BAC GT — AFL 1 /12 = élément 1 « produire » /8 + élément 2 « exploiter ses ressentis » /4,
//   plages par degré. Fil de séquence /8 : AFL 2 + AFL 3 (un rôle : coach OU observateur-pareur),
//   points fixes (sur 2 : 0,5/1/1,5/2 ; sur 4 : 1/2/3/4 ; sur 6 : 1,5/3/4,5/6).
// BAC PRO — AFLP 1 /7 (projet d'entraînement) + AFLP 2 /5 (méthodes), plages par degré.
//   Fil de séquence /8 : AFLP 3 (retour réflexif, charges) + AFLP 5 (motricité sécuritaire),
//   plages (meilleur degré atteint).

export const ELEMENTS = {
  gt: [
    {
      cle: "e1", titre: "Élément 1 — Produire : effort adapté à ses ressources et au thème", sur: 8, pas: 0.5,
      plages: { 1: [0, 1.5], 2: [2, 3.5], 3: [4, 6], 4: [6.5, 8] },
      degres: [
        "Échauffement inexistant ou incohérent ; butée articulaire, postures de sécurité non maîtrisées, apnée ; répétitions, séries, récupérations non respectées.",
        "Échauffement inconsistant ; amplitude limitée, nombreuses postures compensatoires ; quelques erreurs dans les paramètres liés au projet.",
        "Échauffement structuré et cohérent ; paramètres techniques respectés, quelques postures compensatoires ; maîtrise continue des paramètres.",
        "Échauffement complet et personnalisé ; postures, trajets, respiration toujours placés ; séance intégrée à un programme planifié.",
      ],
    },
    {
      cle: "e2", titre: "Élément 2 — Exploiter ses ressentis pour réguler sa séance", sur: 4, pas: 0.25,
      plages: { 1: [0, 0.75], 2: [1, 1.75], 3: [2, 3], 4: [3.25, 4] },
      degres: [
        "Charge dangereuse ou insignifiante ; analyse des ressentis superficielle ; pas de bilan ni de régulation.",
        "Charge trop lourde, trop légère ou non personnalisée ; ressentis succincts ; bilan très concis.",
        "Charge adaptée mais non affinée ; ressentis lucides ; bilan de la séance et régulation pour la suivante.",
        "Charge adaptée et régulée selon les ressentis ; identification fine reliée au thème ; bilan détaillé et propositions.",
      ],
    },
  ],
  pro: [
    {
      cle: "aflp1", titre: "AFLP 1 — Concevoir et mettre en œuvre un projet d'entraînement", sur: 7, pas: 0.5,
      plages: { 1: [0, 1], 2: [1.5, 3], 3: [3.5, 5], 4: [5.5, 7] },
      degres: [
        "Échauffement inexistant ou incohérent ; répétitions, séries, récupérations non respectées ; principes liés au mobile méconnus.",
        "Échauffement inconsistant ; quelques erreurs dans les paramètres ; répétitions cohérentes avec le mobile mais le reste est flou.",
        "Échauffement structuré ; maîtrise continue des paramètres ; quelques incohérences mais principes du mobile connus.",
        "Échauffement complet et personnalisé ; séance planifiée ; séries, charges, répétitions et récupérations cohérentes avec le mobile.",
      ],
    },
    {
      cle: "aflp2", titre: "AFLP 2 — Éprouver différentes méthodes d'entraînement", sur: 5, pas: 0.5,
      plages: { 1: [0, 0.5], 2: [1, 2], 3: [2.5, 4], 4: [4.5, 5] },
      degres: [
        "Méthodes méconnues ; ateliers complémentaires absents ou incohérents.",
        "Une méthode utilisée, d'autres vaguement connues ; ateliers complémentaires peu cohérents.",
        "2 méthodes utilisées et leurs principes connus ; ateliers complémentaires cohérents.",
        "Au moins 3 méthodes utilisées et identifiées ; ateliers complémentaires maîtrisés, équilibre et intensité.",
      ],
    },
  ],
};

export const DEGRES_AFL2_GT = [
  "Séquence copiée ou inadaptée ; paramètres et groupes musculaires méconnus ; aucune méthode ; engagement très insuffisant.",
  "Projet stéréotypé avec incohérences ; paramètres approximatifs ; une seule méthode ; engagement insuffisant.",
  "Projet pertinent ; paramètres et vocabulaire adaptés ; équilibre visé ; engagement réel dans une zone d'effort proche de l'optimale.",
  "Paramètres maîtrisés, groupes musculaires (localisation et fonction) ; formes de contraction cohérentes ; planification optimale.",
];

export const ROLES_AFL3_GT = [
  {
    id: "coach", libelle: "Coach",
    degres: [
      "Agit seul ; peu ou pas attentif ; n'apporte pas de conseils.",
      "Collabore ponctuellement ; conseils surtout d'encouragement (« continue », « encore 2 »).",
      "Disponible et réactif ; attentif à l'observation OU aux ressentis ; conseils justes mais génériques.",
      "Conseille volontairement à partir d'indicateurs précis ; attentif à l'observation ET aux ressentis ; conseils ciblés.",
    ],
  },
  {
    id: "observateur", libelle: "Observateur-pareur",
    degres: [
      "Nombre de répétitions non fiable ; n'identifie pas le non-respect de l'amplitude ni des postures.",
      "Répétitions approximatives ; identifie partiellement l'amplitude OU les postures.",
      "Répétitions précises ; identifie précisément l'amplitude OU les postures sécuritaires.",
      "Répétitions précises ; identifie constamment l'amplitude ET les postures sécuritaires.",
    ],
  },
];

export const DEGRES_PRO_AFLP3 = [
  "Charges trop légères ou dangereuses ; analyse non pertinente, aucune piste d'intensification.",
  "Charges non optimales ; difficultés à donner des pistes d'intensification.",
  "Charges adaptées mais manque d'intensité ; donne des pistes simples d'intensification.",
  "Charges adaptées, programme intense ; sait perfectionner son programme pour le rendre plus efficient.",
];

export const DEGRES_PRO_AFLP5 = [
  "Plus de 5 erreurs techniques ; butée articulaire, postures de sécurité non maîtrisées, apnée.",
  "4 à 5 erreurs techniques ; amplitude limitée, nombreuses postures compensatoires.",
  "2 à 3 erreurs techniques ; paramètres techniques respectés, quelques postures compensatoires.",
  "1 erreur maximum ; postures, trajets et respiration toujours placés.",
];

// AFLP 5 : degré conseillé d'après le nombre d'erreurs techniques relevées.
export function degreDepuisErreurs(n) {
  if (n == null || n === "") return null;
  const v = Number(n);
  if (v > 5) return 1;
  if (v >= 4) return 2;
  if (v >= 2) return 3;
  return 4;
}

export const REPARTITIONS = ["6-2", "4-4", "2-6"];
export function pointsRepartition(r) {
  return (REPARTITIONS.includes(r) ? r : "4-4").split("-").map(Number);
}
export function pointsFixes(pts, degre) {
  return degre ? (pts * degre) / 4 : null;
}
const PLAGES_FIL = {
  2: [[0, 0.4], [0.5, 0.9], [1, 1.4], [1.5, 2]],
  4: [[0, 0.9], [1, 1.9], [2, 2.9], [3, 4]],
  6: [[0, 1.4], [1.5, 2.9], [3, 4.4], [4.5, 6]],
};
export function plageFil(pts, degre) {
  return degre ? PLAGES_FIL[pts]?.[degre - 1] || null : null;
}
export function valeurs([min, max], pas) {
  const res = [];
  for (let v = min; v <= max + 1e-9; v += pas) res.push(Math.round(v * 100) / 100);
  return res;
}

const r2 = (v) => Math.round(v * 100) / 100;
const num = (v) => (typeof v === "number" ? v : null);

export function calculerNoteBacMuscu(typeBac, saisie) {
  const s = saisie || {};
  const [pa, pb] = pointsRepartition(s.repartition);
  if (typeBac === "gt") {
    const e1 = num(s.e1Note), e2 = num(s.e2Note);
    const afl2 = pointsFixes(pa, s.afl2Degre);
    const afl3 = s.afl3Role ? pointsFixes(pb, s.afl3Degre) : null;
    const fin = e1 == null && e2 == null ? null : r2((e1 ?? 0) + (e2 ?? 0));
    const fil = afl2 == null && afl3 == null ? null : r2((afl2 ?? 0) + (afl3 ?? 0));
    return { e1, e2, afl2, afl3, fin, fil, pa, pb, total: fin == null && fil == null ? null : r2((fin ?? 0) + (fil ?? 0)) };
  }
  const aflp1 = num(s.aflp1Note), aflp2 = num(s.aflp2Note), aflp3 = num(s.aflp3Note), aflp5 = num(s.aflp5Note);
  const fin = aflp1 == null && aflp2 == null ? null : r2((aflp1 ?? 0) + (aflp2 ?? 0));
  const fil = aflp3 == null && aflp5 == null ? null : r2((aflp3 ?? 0) + (aflp5 ?? 0));
  return { aflp1, aflp2, aflp3, aflp5, fin, fil, pa, pb, total: fin == null && fil == null ? null : r2((fin ?? 0) + (fil ?? 0)) };
}

// ---------- Ateliers de l'épreuve (avertissement non bloquant dans le projet de l'élève) ----------
// Ateliers de base du protocole, reliés aux noms d'ateliers de l'appli.
const BASE = {
  terre: ["Soulevé de terre", "Rowing épaule"], // soulevé de terre / rowing épaule
  couche: ["Développé couché"],
  squat: ["Cage à squat"], // demi-squat
  poulie: ["Tirage barre haute"], // tirage vertical à la poulie haute
};
export const LIBELLES_BASE = {
  terre: "soulevé de terre / rowing épaule",
  couche: "développé couché",
  squat: "demi-squat (cage à squat)",
  poulie: "tirage vertical à la poulie haute (tirage barre haute)",
};

export function verifierAteliers(typeBac, ateliers) {
  const liste = ateliers || [];
  const presents = Object.keys(BASE).filter((k) => BASE[k].some((n) => liste.includes(n)));
  if (typeBac === "pro") {
    const ok = presents.includes("terre") && presents.length >= 2;
    return {
      ok,
      message: ok
        ? null
        : !presents.includes("terre")
          ? `Bac Pro : le ${LIBELLES_BASE.terre} est obligatoire, avec un 2e atelier de base au choix (développé couché, demi-squat ou tirage vertical à la poulie haute).`
          : "Bac Pro : ajoute un 2e atelier de base (développé couché, demi-squat ou tirage vertical à la poulie haute) en plus du soulevé de terre / rowing.",
      presents,
    };
  }
  if (typeBac === "gt") {
    const ok = presents.length >= 2;
    return {
      ok,
      message: ok ? null : `Bac GT : ton projet doit comporter au moins 2 ateliers parmi développé couché, demi-squat, tirage vertical à la poulie haute et soulevé de terre / rowing épaule (${presents.length} pour l'instant).`,
      presents,
    };
  }
  return { ok: true, message: null, presents };
}
