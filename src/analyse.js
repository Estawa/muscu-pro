// ---------------------------------------------------------------------------
// Analyse des séances et note de cycle (v1.7.0)
//
// Module "pur" (aucune dépendance React / Firebase) : il compare ce que l'élève
// a réalisé à ce que son projet prévoyait, fait le bilan de chaque séance, puis
// calcule un score de cycle et les notes de la classe.
//
//   Ce qui était prévu pour un atelier = le mobile choisi pour sa zone dans le
//   projet (R6 / R10 / R15 / R25) :
//     - plage de répétitions du mobile
//     - nombre minimum de séries du mobile
//     - charge cible = R1 théorique du dernier test (onglet Suivi) × % du mobile
//
//   Depuis la v1.7.0, chaque nouvelle séance mémorise le mobile visé, la charge
//   cible et l'appartenance au projet au moment de l'enregistrement, ainsi que le
//   détail des séries. Les séances plus anciennes sont analysées avec le projet
//   et les tests actuels de l'élève.
// ---------------------------------------------------------------------------

// % représentatif de chaque mobile, pour la conversion (milieu de fourchette d'intensité)
export const PCT_MOBILE = { r1: 0.95, r6: 0.80, r10: 0.70, r15: 0.55, r25: 0.40 };

// Ce que demande chaque mobile (programmation) : plage de répétitions et séries minimum.
export const REGLES_MOBILE = {
  r6: { label: "R6", repsMin: 4, repsMax: 8, seriesMin: 6 },
  r10: { label: "R10", repsMin: 8, repsMax: 12, seriesMin: 5 },
  r15: { label: "R15", repsMin: 15, repsMax: 20, seriesMin: 5 },
  r25: { label: "R25", repsMin: 20, repsMax: 30, seriesMin: 5 },
};

// Écart toléré entre la charge moyenne réalisée et la charge cible.
export const TOLERANCE_CHARGE = 0.10;

// Pondération des 4 composantes de la note de cycle (en %).
export const POIDS = { conformite: 40, regulation: 25, progression: 20, assiduite: 15 };

// Barèmes possibles pour la note de connaissances.
export const BAREMES_CONNAISSANCES = [0, 1, 2, 3, 4, 5, 6, 8];

// Correspondance répétitions réalisées → % de charge max (tableau de conversion)
export function repsToPercent(reps) {
  const table = [
    { max: 1, pct: 100 }, { max: 2, pct: 95 }, { max: 3, pct: 90 }, { max: 5, pct: 85 },
    { max: 6, pct: 80 }, { max: 8, pct: 75 }, { max: 10, pct: 70 }, { max: 12, pct: 65 },
    { max: 15, pct: 60 }, { max: 20, pct: 55 }, { max: 25, pct: 50 }, { max: 28, pct: 40 },
  ];
  for (const t of table) if (reps <= t.max) return t.pct;
  return 35;
}

export const arrondi1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Charge cible d'un atelier : dernier test de l'atelier (R1 théorique) × % du mobile.
export function chargeCible(atelier, mobileId, tests) {
  if (!mobileId || !PCT_MOBILE[mobileId]) return null;
  const t = (tests || []).filter((x) => x.atelier === atelier && x.r1Theorique > 0);
  if (!t.length) return null;
  return arrondi1(t[t.length - 1].r1Theorique * PCT_MOBILE[mobileId]);
}

// Données mémorisées avec chaque atelier d'une nouvelle séance (instantané du projet).
export function instantaneAtelier(atelier, zone, project, tests) {
  const mobileVise = zone && zone !== "cardio" ? (project?.mobiles?.[zone] || null) : null;
  return {
    mobileVise,
    chargeCible: chargeCible(atelier, mobileVise, tests),
    dansProjet: (project?.ateliers || []).includes(atelier),
  };
}

// ---------------------------------------------------------------------------
// 1. Récapitulatif d'un atelier
// ---------------------------------------------------------------------------
//
// Renvoie { statut, criteres: { reps, charge, series }, score, ... }
//   statut : "conforme" (score 1) | "partiel" (0.5) | "eloigne" (0)
//            "cardio" (non évalué) | "sans-objectif" (aucun mobile pour la zone : 0)
//   critère : { ok: bool|null, sens: "plus"|"moins"|null } — ok null = non jugé
// Un atelier hors projet ne peut pas dépasser "partiel".

export function analyserAtelier(a, ctx) {
  const zone = a.zone || null;
  const snap = a.mobileVise !== undefined;
  const dansProjet = snap ? !!a.dansProjet : (ctx.project?.ateliers || []).includes(a.atelier);
  const base = { atelier: a.atelier, zone, dansProjet, realise: a };

  if (zone === "cardio") return { ...base, statut: "cardio", score: null };

  const mobileId = snap ? a.mobileVise : (zone ? ctx.project?.mobiles?.[zone] || null : null);
  const regle = mobileId ? REGLES_MOBILE[mobileId] : null;
  if (!regle) return { ...base, statut: "sans-objectif", score: 0, mobileId: null };

  const cible = snap ? a.chargeCible : chargeCible(a.atelier, mobileId, ctx.tests);
  const reps = a.repsMoyenne;
  const critReps = reps >= regle.repsMin && reps <= regle.repsMax
    ? { ok: true, sens: null }
    : { ok: false, sens: reps < regle.repsMin ? "moins" : "plus" };
  let critCharge = { ok: null, sens: null };
  if (cible) {
    const ratio = a.chargeMoyenne / cible;
    // Au-dessus de la cible MAIS avec des répétitions dans la plage du mobile : la cible
    // (estimée au test) est dépassée grâce à la progression → considéré comme conforme.
    if (Math.abs(ratio - 1) <= TOLERANCE_CHARGE) critCharge = { ok: true, sens: null, ecart: ratio - 1 };
    else if (ratio > 1 && critReps.ok) critCharge = { ok: true, sens: "plus", ecart: ratio - 1, depassee: true };
    else critCharge = { ok: false, sens: ratio > 1 ? "plus" : "moins", ecart: ratio - 1 };
  }
  const critSeries = a.nbSeries >= regle.seriesMin ? { ok: true, sens: null } : { ok: false, sens: "moins" };

  const juges = [critReps, critCharge, critSeries].filter((c) => c.ok !== null);
  const nbOk = juges.filter((c) => c.ok).length;
  const manques = juges.length - nbOk;
  let statut = manques === 0 ? "conforme" : manques === 1 ? "partiel" : "eloigne";
  if (!dansProjet && statut === "conforme") statut = "partiel";
  const score = statut === "conforme" ? 1 : statut === "partiel" ? 0.5 : 0;

  return {
    ...base, statut, score, mobileId, regle, cible,
    criteres: { reps: critReps, charge: critCharge, series: critSeries },
  };
}

// ---------------------------------------------------------------------------
// 2. Bilan d'une séance
// ---------------------------------------------------------------------------

// Dernière occurrence d'un atelier dans les séances précédant l'index i.
function occurrencePrecedente(seances, i, atelier) {
  for (let j = i - 1; j >= 0; j--) {
    const a = (seances[j].ateliers || []).find((x) => x.atelier === atelier);
    if (a) return a;
  }
  return null;
}

// R1 estimé à partir d'une série moyenne (charge × table de conversion).
export function r1Estime(a) {
  if (!a || !(a.chargeMoyenne > 0) || !(a.repsMoyenne > 0)) return null;
  return a.chargeMoyenne / (repsToPercent(a.repsMoyenne) / 100);
}

// seances : liste chronologique ; i : index de la séance analysée.
// ctx : { project, tests, estCardio(nom) }
export function analyserSeance(seances, i, ctx) {
  const s = seances[i];
  const ateliers = (s.ateliers || []).map((a) => analyserAtelier(a, ctx));
  const evalues = ateliers.filter((x) => x.statut !== "cardio");
  const scoreConformite = evalues.length ? evalues.reduce((t, x) => t + x.score, 0) / evalues.length : null;
  const nb = {
    conforme: ateliers.filter((x) => x.statut === "conforme").length,
    partiel: ateliers.filter((x) => x.statut === "partiel").length,
    eloigne: ateliers.filter((x) => x.statut === "eloigne" || x.statut === "sans-objectif").length,
    evalues: evalues.length,
  };

  // Couverture du projet : ateliers du projet non travaillés aujourd'hui.
  const faits = new Set((s.ateliers || []).map((a) => a.atelier));
  const projetAteliers = ctx.project?.ateliers || [];
  const nonTravailles = projetAteliers.filter((n) => !faits.has(n));
  const horsProjet = ateliers.filter((x) => !x.dansProjet).map((x) => x.atelier);

  // Évolution par rapport à la dernière fois où chaque atelier a été travaillé,
  // et régulation (ressenti ↑ / ↓ suivi d'un ajustement de charge cohérent).
  const evolutions = [];
  const regulations = [];
  for (const a of s.ateliers || []) {
    if (a.zone === "cardio") continue;
    const p = occurrencePrecedente(seances, i, a.atelier);
    if (!p) continue;
    evolutions.push({
      atelier: a.atelier,
      diffCharge: arrondi1(a.chargeMoyenne - p.chargeMoyenne),
      diffTonnage: Math.round((a.tonnage || 0) - (p.tonnage || 0)),
    });
    if (p.ressenti === "legere" || p.ressenti === "lourde") {
      const coherent = p.ressenti === "legere" ? a.chargeMoyenne > p.chargeMoyenne : a.chargeMoyenne < p.chargeMoyenne;
      regulations.push({ atelier: a.atelier, ressentiAvant: p.ressenti, avant: p.chargeMoyenne, apres: a.chargeMoyenne, coherent });
    }
  }
  const diffTonnageSeance = i > 0 ? Math.round((s.tonnage || 0) - (seances[i - 1].tonnage || 0)) : null;

  return { seance: s, index: i, ateliers, scoreConformite, nb, nonTravailles, horsProjet, evolutions, regulations, diffTonnageSeance };
}

export function analyserSeances(seances, ctx) {
  return (seances || []).map((_, i) => analyserSeance(seances, i, ctx));
}

// ---------------------------------------------------------------------------
// 3. Bilan de cycle (score brut sur 100)
// ---------------------------------------------------------------------------
//
// Composantes (chacune de 0 à 1) :
//   conformité  : moyenne des scores de séance
//   régulation  : ajustements cohérents / ressentis ↑↓ à exploiter
//   progression : évolution de la charge moyenne, à répétitions dans la plage du mobile,
//                 entre la 1re et la dernière fois, par atelier
//                 (+10 % ou plus → 1 ; stable → 0,5 ; −10 % ou moins → 0)
//   assiduité   : séances renseignées / séances attendues
// Une composante impossible à calculer (ex. aucun ressenti ↑↓) est écartée et
// son poids reporté sur les autres.

export function bilanCycle(seances, ctx, seancesAttendues = 7) {
  const analyses = analyserSeances(seances, ctx);
  const nbSeances = analyses.length;

  const scores = analyses.map((x) => x.scoreConformite).filter((x) => x !== null);
  const conformite = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : (nbSeances ? 0 : null);

  const regs = analyses.flatMap((x) => x.regulations);
  const regulation = regs.length ? regs.filter((r) => r.coherent).length / regs.length : null;

  // Progression par atelier (hors cardio) : évolution de la charge moyenne entre la
  // première et la dernière fois où l'atelier a été travaillé DANS la plage de
  // répétitions de son mobile (comparaison à régime de travail identique, pour ne pas
  // confondre un changement de mobile avec une perte de force).
  const parAtelier = {};
  for (const an of analyses) {
    for (const x of an.ateliers) {
      if (x.statut === "cardio" || !x.criteres || !x.criteres.reps.ok) continue;
      if (!(x.realise.chargeMoyenne > 0)) continue;
      (parAtelier[x.atelier] = parAtelier[x.atelier] || []).push(x.realise.chargeMoyenne);
    }
  }
  const progressions = Object.entries(parAtelier)
    .filter(([, l]) => l.length >= 2)
    .map(([atelier, l]) => {
      const gain = (l[l.length - 1] - l[0]) / l[0];
      return { atelier, gain, score: clamp(0.5 + gain / 0.2, 0, 1) };
    });
  const progression = progressions.length ? progressions.reduce((a, p) => a + p.score, 0) / progressions.length : null;

  const assiduite = seancesAttendues > 0 ? Math.min(1, nbSeances / seancesAttendues) : null;

  const composantes = { conformite, regulation, progression, assiduite };
  let somme = 0, poidsTotal = 0;
  for (const [k, v] of Object.entries(composantes)) {
    if (v === null || v === undefined) continue;
    somme += v * POIDS[k];
    poidsTotal += POIDS[k];
  }
  const brut = nbSeances === 0 ? 0 : (poidsTotal ? arrondi1((somme / poidsTotal) * 100) : 0);

  return {
    nbSeances, composantes, brut, analyses, progressions,
    nbRegulations: regs.length, nbRegulationsCoherentes: regs.filter((r) => r.coherent).length,
  };
}

// ---------------------------------------------------------------------------
// 4. Notes de la classe
// ---------------------------------------------------------------------------
//
// reglages : {
//   seancesAttendues, ptsConnaissances (0..8),
//   refHaut: { numero, note } | null, refBas: { numero, note } | null   (notes de suivi sur 20)
//   connaissances: { [numero]: ratio 0..1 }, exclus: [numero]
// }
// eleves : [{ numero, brut }]
// Ajustement : le score brut de l'élève de référence haute reçoit sa note, celui de
// la référence basse la sienne, les autres sont placés proportionnellement entre les
// deux puis bornés à ces deux notes. La note de suivi (/20) est ensuite ramenée sur
// (20 − barème connaissances) et la note de connaissances s'y ajoute.

export function calculerNotesClasse(eleves, reglages) {
  const X = reglages.ptsConnaissances || 0;
  const partSuivi = 20 - X;
  const exclus = new Set(reglages.exclus || []);
  const parNumero = Object.fromEntries(eleves.map((e) => [e.numero, e]));
  const haut = reglages.refHaut && parNumero[reglages.refHaut.numero] && !exclus.has(reglages.refHaut.numero) ? reglages.refHaut : null;
  const bas = reglages.refBas && parNumero[reglages.refBas.numero] && !exclus.has(reglages.refBas.numero) ? reglages.refBas : null;

  let mode = "brut"; // "brut" | "ajuste"
  let avertissement = null;
  let fn = (brut) => brut / 5;
  if (haut && bas) {
    const bh = parNumero[haut.numero].brut, bb = parNumero[bas.numero].brut;
    if (haut.numero === bas.numero) {
      avertissement = "Les deux élèves de référence sont identiques : ajustement non appliqué.";
    } else if (bh <= bb) {
      avertissement = "L'élève de référence haute a un score brut inférieur ou égal à celui de la référence basse : ajustement non appliqué.";
    } else if (haut.note < bas.note) {
      avertissement = "La note de la référence haute est inférieure à celle de la référence basse : ajustement non appliqué.";
    } else {
      mode = "ajuste";
      if (bh - bb < 10) avertissement = `Écart faible entre les deux références (${arrondi1(bh - bb)} points de score brut) : les différences entre élèves sont fortement amplifiées.`;
      const pente = (haut.note - bas.note) / (bh - bb);
      fn = (brut) => clamp(bas.note + (brut - bb) * pente, bas.note, haut.note);
    }
  } else if (haut || bas) {
    avertissement = "Choisis les deux élèves de référence (haute et basse) pour ajuster les notes.";
  }

  const lignes = eleves.map((e) => {
    if (exclus.has(e.numero)) return { numero: e.numero, exclu: true };
    const suivi20 = clamp(fn(e.brut), 0, 20);
    const suiviPart = suivi20 * partSuivi / 20;
    const ratio = reglages.connaissances?.[e.numero];
    const connaissancesSaisie = ratio !== undefined && ratio !== null && ratio !== "";
    const conn = X > 0 && connaissancesSaisie ? ratio * X : 0;
    return {
      numero: e.numero,
      exclu: false,
      brut: e.brut,
      suivi20: arrondi1(suivi20),
      suiviPart: arrondi1(suiviPart),
      connaissances: X > 0 && connaissancesSaisie ? arrondi1(conn) : null,
      connaissancesManquante: X > 0 && !connaissancesSaisie,
      finale: arrondi1(suiviPart + conn),
    };
  });
  return { lignes, mode, avertissement, partSuivi, X };
}

// Moyenne / min / max d'une liste de notes (pour l'en-tête du tableau).
export function statsNotes(lignes) {
  const n = lignes.filter((l) => !l.exclu).map((l) => l.finale);
  if (!n.length) return null;
  return { moyenne: arrondi1(n.reduce((a, b) => a + b, 0) / n.length), min: Math.min(...n), max: Math.max(...n), nb: n.length };
}
