import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { db } from "./firebase.js";

// ---------------------------------------------------------------------------
// Cette couche remplace l'API window.storage (spécifique aux artifacts
// Claude) par : localStorage pour le profil personnel de l'élève (propre à
// son téléphone), et Firestore pour tout ce qui doit être partagé /
// consultable par le professeur (mapping numéro <-> nom, historiques).
//
// Isolation entre professeurs : chaque professeur a son propre code d'accès
// (VITE_PROFS) et ne voit/gère que SES classes. Toutes les clés Firestore
// sont donc préfixées par le professeur, pas seulement par la classe — deux
// collègues peuvent avoir chacun une classe "1G3" sans collision, et aucun
// des deux ne peut réinitialiser les données de l'autre.
//
// Schéma Firestore :
//   mapping/{profSlug-classeSlug}            { students: [{numero, nom, prenom}] }
//   meta/classes-{profSlug}                  { list: [classe, ...] }
//   historique/{profSlug-classeSlug-numero}  { entries: [...] }   (tests R15-R20)
//   seances/{profSlug-classeSlug-numero}     { entries: [...] }   (séances)
//   projets/{profSlug-classeSlug-numero}     { project }          (projet de l'élève)
//   meta/notation-{profSlug-classeSlug}      réglages de notation de la classe (v1.7.0)
// ---------------------------------------------------------------------------

// Liste des professeurs autorisés à utiliser le Mode professeur (administrateur + collègues
// ajoutés dynamiquement depuis l'onglet Accès), stockée sur Firestore — remplace l'ancienne
// configuration statique par variable d'environnement VITE_PROFS.
export async function loadAcces() {
  try {
    const snap = await getDoc(doc(db, "meta", "acces"));
    if (snap.exists()) {
      const d = snap.data();
      return {
        pinAdmin: d.pinAdmin || "2025",
        nomAdmin: d.nomAdmin || "Mr Guilhem",
        collegues: Array.isArray(d.collegues) ? d.collegues : [],
      };
    }
  } catch (e) {}
  return { pinAdmin: "2025", nomAdmin: "Mr Guilhem", collegues: [] };
}

export async function saveAcces(config) {
  try { await setDoc(doc(db, "meta", "acces"), config); } catch (e) {}
}

export function slug(s) {
  return (s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

function classeDocId(prof, classe) {
  return `${slug(prof)}-${slug(classe)}`;
}
function studentDocId(prof, classe, numero) {
  return `${slug(prof)}-${slug(classe)}-${numero}`;
}
export function clearProfilStorage() {
  try { localStorage.removeItem("muscupro_profil"); } catch (e) {}
}

// ---------- Profil personnel (localStorage, propre à l'appareil) ----------

export async function loadProfil() {
  try {
    const raw = localStorage.getItem("muscupro_profil");
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export async function saveProfilStorage(p) {
  try { localStorage.setItem("muscupro_profil", JSON.stringify(p)); } catch (e) {}
}

// ---------- Ateliers personnalisés (localStorage, propres à l'appareil) ----------
//
// Ajoutés par l'élève/utilisateur en plus des ateliers pré-enregistrés de la
// salle. Stockés uniquement en local (comme le profil) : chaque appareil a
// sa propre liste, ce qui permet un usage personnel hors de l'établissement
// sans jamais modifier la liste commune utilisée au lycée.

export async function loadAteliersPerso() {
  try {
    const raw = localStorage.getItem("muscupro_ateliers_perso");
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
export async function saveAteliersPerso(list) {
  try { localStorage.setItem("muscupro_ateliers_perso", JSON.stringify(list)); } catch (e) {}
}

// ---------- Mapping numéro <-> nom (Firestore, par prof + classe) ----------

export async function loadMapping(prof, classe) {
  try {
    const snap = await getDoc(doc(db, "mapping", classeDocId(prof, classe)));
    return snap.exists() ? (snap.data().students || []) : [];
  } catch (e) { return []; }
}
export async function saveMapping(prof, classe, students) {
  try { await setDoc(doc(db, "mapping", classeDocId(prof, classe)), { students }); } catch (e) {}
}

// ---------- Index des classes connues, par professeur ----------

export async function loadClassesIndex(prof) {
  try {
    const snap = await getDoc(doc(db, "meta", `classes-${slug(prof)}`));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch (e) { return []; }
}
export async function addClasseToIndex(prof, classe) {
  try {
    const list = await loadClassesIndex(prof);
    if (!list.includes(classe)) {
      list.push(classe);
      // merge : ne jamais écraser la liste des groupes stockée dans le même document
      await setDoc(doc(db, "meta", `classes-${slug(prof)}`), { list }, { merge: true });
    }
  } catch (e) {}
}
async function removeClasseFromIndex(prof, classe) {
  try {
    const snap = await getDoc(doc(db, "meta", `classes-${slug(prof)}`));
    const d = snap.exists() ? snap.data() : {};
    await setDoc(doc(db, "meta", `classes-${slug(prof)}`), {
      list: (d.list || []).filter((c) => c !== classe),
      groupes: (d.groupes || []).filter((c) => c !== classe),
    });
  } catch (e) {}
}

// ---------- Classes et groupes classe ----------
//
// Un "groupe classe" est une classe comme une autre (les élèves s'y connectent en le choisissant
// dans la liste des classes, leurs données y sont rangées) ; il est seulement marqué comme groupe
// dans meta/classes-{prof}.groupes, et chacun de ses élèves venu d'une autre classe garde la trace
// de sa classe d'origine (champ classeOrigine dans le mapping) pour pouvoir y être renvoyé.

export async function loadGroupes(prof) {
  try {
    const snap = await getDoc(doc(db, "meta", `classes-${slug(prof)}`));
    return snap.exists() ? (snap.data().groupes || []) : [];
  } catch (e) { return []; }
}

// Retrouve le nom exact d'une classe déjà connue (insensible à la casse/accents), sinon null.
export async function resoudreNomClasse(prof, saisie) {
  const list = await loadClassesIndex(prof);
  return list.find((c) => slug(c) === slug(saisie)) || null;
}

// Crée une classe ou un groupe classe vide. Renvoie { ok, nom, erreur }.
export async function creerClasse(prof, nomSaisi, estGroupe) {
  const nom = (nomSaisi || "").trim().replace(/\s+/g, " ");
  if (!nom) return { ok: false, erreur: "Donne un nom." };
  const existante = await resoudreNomClasse(prof, nom);
  if (existante) return { ok: false, erreur: `« ${existante} » existe déjà.` };
  const ref = doc(db, "meta", `classes-${slug(prof)}`);
  const snap = await getDoc(ref);
  const d = snap.exists() ? snap.data() : {};
  const list = [...(d.list || []), nom];
  const groupes = estGroupe ? [...(d.groupes || []), nom] : (d.groupes || []);
  await setDoc(ref, { list, groupes });
  await setDoc(doc(db, "mapping", classeDocId(prof, nom)), { students: [] });
  return { ok: true, nom };
}

export function genNumero(existants) {
  let n;
  do { n = Math.floor(1000 + Math.random() * 9000); } while (existants.includes(n));
  return n;
}

// Cherche un élève par nom+prénom dans TOUTES les classes connues d'un prof (sauf, si précisée,
// celle en cours de traitement) — sert à ne jamais créer de doublon quand le même élève est
// repéré sous un nom de classe différent d'un import à l'autre (ex. classe d'origine vs groupe
// classe). Renvoie { classe, numero, eleve } ou null. Coûte un aller-retour Firestore par classe
// du prof (hors celle ignorée), acceptable pour une opération ponctuelle d'import.
export async function trouverEleveParNomPartout(prof, nom, prenom, classeAIgnorer = null) {
  const classes = await loadClassesIndex(prof);
  for (const classe of classes) {
    if (classe === classeAIgnorer) continue;
    const mapping = await loadMapping(prof, classe);
    const trouve = mapping.find((m) => slug(m.nom) === slug(nom) && slug(m.prenom) === slug(prenom));
    if (trouve) return { classe, numero: trouve.numero, eleve: trouve };
  }
  return null;
}

// Déplace un élève d'une classe vers une autre AVEC toutes ses données (tests, séances, projet,
// PIN). Les documents Firestore étant indexés par prof+classe+numéro, ils sont recopiés sous la
// nouvelle classe puis supprimés de l'ancienne — sans ça, l'élève arriverait "vide" dans sa
// nouvelle classe. Si son numéro est déjà pris dans la classe d'arrivée, il en reçoit un nouveau
// (son téléphone se recale tout seul au prochain lancement, voir resynchroniserProfil).
// options.origine : "garder" (défaut : inchangée, effacée si on revient dans la classe d'origine),
// "definir" (ajout à un groupe : mémorise la classe actuelle comme origine si aucune ne l'est déjà).
// Renvoie le nom exact de la classe d'arrivée.
const COLLECTIONS_ELEVE = ["historique", "seances", "projets"];

export async function deplacerEleveMapping(prof, classeActuelle, numero, nouvelleClasse, options = {}) {
  const mappingActuel = await loadMapping(prof, classeActuelle);
  const eleve = mappingActuel.find((m) => m.numero === numero);
  if (!eleve) return null;
  const cible = (await resoudreNomClasse(prof, nouvelleClasse)) || nouvelleClasse.trim().toUpperCase();
  if (cible === classeActuelle) return cible;
  const mappingCible = await loadMapping(prof, cible);
  const nouveauNumero = mappingCible.some((m) => m.numero === numero)
    ? genNumero([...mappingCible.map((m) => m.numero), ...mappingActuel.map((m) => m.numero)])
    : numero;

  // 1) Recopie des données (lecture/écriture strictes : en cas d'échec, rien n'est encore retiré).
  for (const col of COLLECTIONS_ELEVE) {
    const snap = await getDoc(doc(db, col, studentDocId(prof, classeActuelle, numero)));
    const dest = doc(db, col, studentDocId(prof, cible, nouveauNumero));
    if (snap.exists()) await setDoc(dest, snap.data());
    else await deleteDoc(dest); // pas d'héritage accidentel de données orphelines
  }

  // 2) Mise à jour des listes de classe.
  let classeOrigine = eleve.classeOrigine || null;
  if (options.origine === "definir" && !classeOrigine) classeOrigine = classeActuelle;
  if (classeOrigine && slug(classeOrigine) === slug(cible)) classeOrigine = null;
  const { classeOrigine: _ancienne, ...reste } = eleve;
  const eleveDeplace = { ...reste, numero: nouveauNumero, ...(classeOrigine ? { classeOrigine } : {}) };
  await saveMapping(prof, cible, [...mappingCible, eleveDeplace]);
  await saveMapping(prof, classeActuelle, mappingActuel.filter((m) => m.numero !== numero));
  await addClasseToIndex(prof, cible);

  // 3) Nettoyage de l'ancien emplacement.
  for (const col of COLLECTIONS_ELEVE) {
    try { await deleteDoc(doc(db, col, studentDocId(prof, classeActuelle, numero))); } catch (e) {}
  }
  return cible;
}

// Côté élève, au lancement : si le prof l'a déplacé (groupe classe, changement de classe), son
// profil local pointe encore vers l'ancienne classe. On le retrouve dans les listes du prof et on
// recale classe + numéro. Lectures strictes : hors ligne ou en cas d'erreur, profil inchangé.
// Renvoie null uniquement si la lecture a réussi et que l'élève n'existe plus nulle part (classe
// effacée en fin d'année, élève retiré) : l'appli redemande alors l'identification.
export async function resynchroniserProfil(profil) {
  if (!profil || profil.type !== "eleve" || !profil.prof || !profil.numero) return profil;
  try {
    const lireMapping = async (c) => {
      const snap = await getDoc(doc(db, "mapping", classeDocId(profil.prof, c)));
      return snap.exists() ? (snap.data().students || []) : [];
    };
    const actuel = await lireMapping(profil.classe);
    if (actuel.some((m) => m.numero === profil.numero)) return profil;
    const memeNom = (m) => slug(m.nom) === slug(profil.nom) && slug(m.prenom) === slug(profil.prenom);
    const idx = await getDoc(doc(db, "meta", `classes-${slug(profil.prof)}`));
    const classes = idx.exists() ? (idx.data().list || []) : [];
    let trouve = null;
    for (const c of classes) {
      const m = c === profil.classe ? actuel : await lireMapping(c);
      const parNumero = m.find((e) => e.numero === profil.numero && memeNom(e));
      if (parNumero) { trouve = { classe: c, eleve: parNumero }; break; }
      const parNom = m.find(memeNom);
      if (parNom && !trouve) trouve = { classe: c, eleve: parNom };
    }
    if (!trouve) return null;
    const next = { ...profil, classe: trouve.classe, numero: trouve.eleve.numero };
    await saveProfilStorage(next);
    return next;
  } catch (e) { return profil; }
}

// ---------- Import de liste de classe (Firestore, par prof + classe) ----------
//
// listeEleves : [{ nom, prenom, sexe? }] déjà filtrés sur UNE classe donnée.
// mode "ajouter" : met à jour les élèves déjà présents (recherchés par nom/prénom dans TOUTES
// les classes du prof, pas seulement celle du fichier — pour ne jamais dupliquer un élève déjà
// placé dans un groupe classe alors que le fichier l'indique sous sa classe d'origine) et ajoute
// les nouveaux avec un numéro généré et un PIN vide. mode "remplacer" : la classe ne contient
// plus que les élèves du fichier (les élèves reconnus gardent leur numéro/PIN, les autres sont
// retirés) — recherche limitée à cette classe, comme avant.
// Renvoie { mapping, conflits } : conflits liste les élèves retrouvés sous une classe différente
// de celle du fichier (laissés où ils sont, jamais déplacés automatiquement — utiliser
// deplacerEleveMapping pour les corriger manuellement si besoin).
export async function appliquerImportClasse(prof, classe, listeEleves, mode = "ajouter") {
  const mapping = await loadMapping(prof, classe);
  let next;
  const conflits = [];
  if (mode === "remplacer") {
    next = listeEleves.map((imp) => {
      const trouve = mapping.find(
        (m) => slug(m.nom) === slug(imp.nom) && slug(m.prenom) === slug(imp.prenom)
      );
      if (trouve) return { ...trouve, sexe: imp.sexe || trouve.sexe || null };
      return { numero: genNumero(mapping.map((m) => m.numero)), nom: imp.nom, prenom: imp.prenom, sexe: imp.sexe || null, pin: null };
    });
  } else {
    next = mapping.slice();
    for (const imp of listeEleves) {
      const idx = next.findIndex((m) => slug(m.nom) === slug(imp.nom) && slug(m.prenom) === slug(imp.prenom));
      if (idx !== -1) {
        if (imp.sexe && !next[idx].sexe) next[idx] = { ...next[idx], sexe: imp.sexe };
        continue;
      }
      const ailleurs = await trouverEleveParNomPartout(prof, imp.nom, imp.prenom, classe);
      if (ailleurs) {
        conflits.push({ nom: imp.nom, prenom: imp.prenom, classeExistante: ailleurs.classe, classeFichier: classe });
      } else {
        next.push({ numero: genNumero(next.map((m) => m.numero)), nom: imp.nom, prenom: imp.prenom, sexe: imp.sexe || null, pin: null });
      }
    }
  }
  await saveMapping(prof, classe, next);
  await addClasseToIndex(prof, classe);
  return { mapping: next, conflits };
}

// ---------- Code PIN personnel par élève (Firestore, dans le mapping) ----------

export async function definirPinEleve(prof, classe, numero, pin) {
  const mapping = await loadMapping(prof, classe);
  const next = mapping.map((m) => (m.numero === numero ? { ...m, pin } : m));
  await saveMapping(prof, classe, next);
}

export function verifierPinEleve(mapping, numero, pin) {
  const e = (mapping || []).find((m) => m.numero === numero);
  return !!e && e.pin === pin;
}

export async function modifierEleveMapping(prof, classe, numero, { nom, prenom, sexe }) {
  const mapping = await loadMapping(prof, classe);
  const next = mapping.map((m) =>
    m.numero === numero
      ? { ...m, nom: nom.trim(), prenom: prenom.trim(), sexe: sexe !== undefined ? (sexe || null) : m.sexe }
      : m
  );
  await saveMapping(prof, classe, next);
  return next;
}

// Retire un élève de la classe ET efface ses données (tests, séances, projet) : une fois retiré
// de la liste, elles n'étaient plus consultables par personne et restaient stockées pour rien.
export async function supprimerEleveMapping(prof, classe, numero) {
  const mapping = await loadMapping(prof, classe);
  const next = mapping.filter((m) => m.numero !== numero);
  await saveMapping(prof, classe, next);
  await resetEleve(prof, classe, numero);
  return next;
}

// Enregistre/relie un élève : réutilise son numéro existant si prof+classe
// sont inchangés, sinon en génère un nouveau et met à jour mapping + index.
export async function registerProfil(saisie, ancienProfil) {
  const reutiliser = ancienProfil && ancienProfil.classe === saisie.classe && ancienProfil.prof === saisie.prof && ancienProfil.numero;
  let numero = reutiliser ? ancienProfil.numero : null;
  const mapping = await loadMapping(saisie.prof, saisie.classe);
  if (!numero) {
    // Reconnexion après déconnexion (le profil local a été effacé) : si un
    // élève au même nom/prénom existe déjà dans cette classe, on retrouve
    // son numéro au lieu d'en créer un nouveau — sinon son historique, ses
    // séances et son projet seraient introuvables sous un numéro différent.
    const existantParNom = mapping.find((m) => slug(m.nom) === slug(saisie.nom) && slug(m.prenom) === slug(saisie.prenom));
    if (existantParNom) numero = existantParNom.numero;
  }
  if (!numero) numero = genNumero(mapping.map((m) => m.numero));
  const profilComplet = { ...saisie, numero };
  const existant = mapping.find((m) => m.numero === numero);
  if (existant) { existant.nom = saisie.nom; existant.prenom = saisie.prenom; }
  else mapping.push({ numero, nom: saisie.nom, prenom: saisie.prenom });
  await saveMapping(saisie.prof, saisie.classe, mapping);
  await addClasseToIndex(saisie.prof, saisie.classe);
  await saveProfilStorage(profilComplet);
  return profilComplet;
}

// ---------- Historique des tests de charge (R15-R20) ----------

export async function loadHistorique(profil) {
  try {
    const snap = await getDoc(doc(db, "historique", studentDocId(profil.prof, profil.classe, profil.numero)));
    return snap.exists() ? (snap.data().entries || []) : [];
  } catch (e) { return []; }
}
export async function saveHistorique(profil, entries) {
  try { await setDoc(doc(db, "historique", studentDocId(profil.prof, profil.classe, profil.numero)), { entries }); } catch (e) {}
}
export async function loadStudentHistoriqueByNumero(prof, classe, numero) {
  try {
    const snap = await getDoc(doc(db, "historique", studentDocId(prof, classe, numero)));
    return snap.exists() ? (snap.data().entries || []) : [];
  } catch (e) { return []; }
}

// ---------- Séances d'entraînement ----------

export async function loadSeances(profil) {
  try {
    const snap = await getDoc(doc(db, "seances", studentDocId(profil.prof, profil.classe, profil.numero)));
    return snap.exists() ? (snap.data().entries || []) : [];
  } catch (e) { return []; }
}
export async function saveSeances(profil, entries) {
  try { await setDoc(doc(db, "seances", studentDocId(profil.prof, profil.classe, profil.numero)), { entries }); } catch (e) {}
}
export async function loadStudentSeancesByNumero(prof, classe, numero) {
  try {
    const snap = await getDoc(doc(db, "seances", studentDocId(prof, classe, numero)));
    return snap.exists() ? (snap.data().entries || []) : [];
  } catch (e) { return []; }
}

// ---------- Projet individuel (mobiles/ateliers/justifications) ----------

export async function loadProjet(profil) {
  try {
    const snap = await getDoc(doc(db, "projets", studentDocId(profil.prof, profil.classe, profil.numero)));
    return snap.exists() ? snap.data().project : null;
  } catch (e) { return null; }
}
export async function saveProjet(profil, project) {
  try { await setDoc(doc(db, "projets", studentDocId(profil.prof, profil.classe, profil.numero)), { project }); } catch (e) {}
}
export async function loadStudentProjetByNumero(prof, classe, numero) {
  try {
    const snap = await getDoc(doc(db, "projets", studentDocId(prof, classe, numero)));
    return snap.exists() ? snap.data().project : null;
  } catch (e) { return null; }
}

// ---------- Réglages de notation d'une classe (Mode professeur) ----------
//
// Rangés dans la collection "meta" (déjà autorisée par les règles Firestore) :
//   meta/notation-{profSlug}-{classeSlug}
//   { seancesAttendues, ptsConnaissances, refHaut, refBas, connaissances, exclus, fige }

export const NOTATION_DEFAUT = {
  seancesAttendues: 7,
  ptsConnaissances: 0,
  refHaut: null,
  refBas: null,
  connaissances: {},
  exclus: [],
  fige: null,
};
function notationDocId(prof, classe) {
  return `notation-${classeDocId(prof, classe)}`;
}
export async function loadNotation(prof, classe) {
  try {
    const snap = await getDoc(doc(db, "meta", notationDocId(prof, classe)));
    return snap.exists() ? { ...NOTATION_DEFAUT, ...snap.data() } : { ...NOTATION_DEFAUT };
  } catch (e) { return { ...NOTATION_DEFAUT }; }
}
// Écriture stricte : l'appelant affiche un message si l'enregistrement échoue.
export async function saveNotation(prof, classe, reglages) {
  await setDoc(doc(db, "meta", notationDocId(prof, classe)), reglages);
}
async function supprimerNotation(prof, classe) {
  try { await deleteDoc(doc(db, "meta", notationDocId(prof, classe))); } catch (e) {}
}

// ---------- Réinitialisation (Mode professeur, scopée à SES classes) ----------

// Supprime toutes les données d'une classe (uniquement pour le professeur
// concerné) : mapping, historique et séances de chaque élève, puis retire
// la classe de l'index de ce professeur.
// Réinitialise uniquement les données d'un élève (tests, séances, projet),
// sans le retirer de la classe — utile pour un profil de démonstration
// permanent que le professeur remet à zéro avant de montrer l'appli.
export async function resetEleve(prof, classe, numero) {
  try { await deleteDoc(doc(db, "historique", studentDocId(prof, classe, numero))); } catch (e) {}
  try { await deleteDoc(doc(db, "seances", studentDocId(prof, classe, numero))); } catch (e) {}
  try { await deleteDoc(doc(db, "projets", studentDocId(prof, classe, numero))); } catch (e) {}
}

export async function resetClasse(prof, classe) {
  const mapping = await loadMapping(prof, classe);
  for (const eleve of mapping) {
    try { await deleteDoc(doc(db, "historique", studentDocId(prof, classe, eleve.numero))); } catch (e) {}
    try { await deleteDoc(doc(db, "seances", studentDocId(prof, classe, eleve.numero))); } catch (e) {}
    try { await deleteDoc(doc(db, "projets", studentDocId(prof, classe, eleve.numero))); } catch (e) {}
  }
  try { await deleteDoc(doc(db, "mapping", classeDocId(prof, classe))); } catch (e) {}
  await supprimerNotation(prof, classe);
  await removeClasseFromIndex(prof, classe);
}

// Supprime toutes les classes et données appartenant à CE professeur
// uniquement — n'affecte jamais les classes des autres professeurs.
export async function resetToutesLesDonnees(prof) {
  const classes = await loadClassesIndex(prof);
  for (const classe of classes) {
    await resetClasse(prof, classe);
  }
  try { await setDoc(doc(db, "meta", `classes-${slug(prof)}`), { list: [], groupes: [] }); } catch (e) {}
}

// ---------- Fin d'année (admin) ----------
//
// Lecture de tous les documents élèves (3 collections) en une fois, puis répartition par
// professeur et par classe. Les documents dont le numéro n'est plus dans la liste de la classe
// (élèves retirés avant la v1.6.0) sont rattachés à leur classe et effacés avec elle.

export async function listerDocsEleves() {
  const res = {};
  for (const col of COLLECTIONS_ELEVE) {
    const snap = await getDocs(collection(db, col)); // lève une erreur si la lecture échoue
    res[col] = snap.docs.map((d) => ({ id: d.id, nb: Array.isArray(d.data().entries) ? d.data().entries.length : 1 }));
  }
  return res;
}

function docsDeLaClasse(listing, prof, classe) {
  const prefixe = `${classeDocId(prof, classe)}-`;
  const garde = (d) => d.id.startsWith(prefixe) && /^\d+$/.test(d.id.slice(prefixe.length));
  const out = {};
  for (const col of COLLECTIONS_ELEVE) out[col] = (listing[col] || []).filter(garde);
  return out;
}

// Résumé par classe de l'espace d'un professeur : élèves, tests, séances, projets.
export async function analyserEspaceFinAnnee(prof, listing) {
  const snap = await getDoc(doc(db, "meta", `classes-${slug(prof)}`));
  const d = snap.exists() ? snap.data() : {};
  const groupes = d.groupes || [];
  const classes = d.list || [];
  const lignes = [];
  for (const classe of classes) {
    const m = await getDoc(doc(db, "mapping", classeDocId(prof, classe)));
    const docs = docsDeLaClasse(listing, prof, classe);
    lignes.push({
      nom: classe,
      estGroupe: groupes.includes(classe),
      nbEleves: m.exists() ? (m.data().students || []).length : 0,
      nbTests: docs.historique.reduce((a, x) => a + x.nb, 0),
      nbSeances: docs.seances.reduce((a, x) => a + x.nb, 0),
      nbProjets: docs.projets.length,
    });
  }
  return lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// Efface définitivement les classes choisies d'un professeur (liste + PIN, tests, séances, projets)
// et les retire de son index. N'affecte ni les accès, ni les autres classes, ni les autres profs.
export async function effacerClassesFinAnnee(prof, classes, listing) {
  let nbEleves = 0, nbDocs = 0, nbEchecs = 0;
  for (const classe of classes) {
    const docs = docsDeLaClasse(listing, prof, classe);
    try {
      const m = await getDoc(doc(db, "mapping", classeDocId(prof, classe)));
      if (m.exists()) nbEleves += (m.data().students || []).length;
    } catch (e) {}
    for (const col of COLLECTIONS_ELEVE) {
      for (const x of docs[col]) {
        try { await deleteDoc(doc(db, col, x.id)); nbDocs++; } catch (e) { nbEchecs++; }
      }
    }
    try { await deleteDoc(doc(db, "mapping", classeDocId(prof, classe))); } catch (e) { nbEchecs++; }
    await supprimerNotation(prof, classe);
    await removeClasseFromIndex(prof, classe);
  }
  return { nbEleves, nbDocs, nbEchecs };
}
