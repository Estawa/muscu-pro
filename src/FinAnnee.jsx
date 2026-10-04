import React, { useEffect, useState } from "react";
import { Trash2, AlertTriangle, CheckCircle2, RotateCcw, Users } from "lucide-react";
import { listerDocsEleves, analyserEspaceFinAnnee, effacerClassesFinAnnee } from "./storage.js";

// Classes conservées (non cochées) par défaut : la classe de démonstration du prof.
const CONSERVER_PAR_DEFAUT = ["PROF"];

// Remise à zéro de fin d'année (admin) — même modèle que Course de Durée Pro : efface, pour les
// classes cochées, la liste des élèves et leurs PIN, leurs tests de charge, leurs séances et leurs
// projets, dans mon espace et/ou celui de chaque collègue. Les accès (codes des profs) sont
// conservés ; les ateliers personnalisés sont propres à chaque téléphone et ne sont pas concernés.
export default function FinAnnee({ acces }) {
  const espaces = [
    { id: acces.nomAdmin, nom: `${acces.nomAdmin} (moi)` },
    ...(acces.collegues || []).map((c) => ({ id: c.nom, nom: c.nom })),
  ];
  const [etat, setEtat] = useState({}); // prof → { chargement, erreur, classes }
  const [coches, setCoches] = useState({}); // prof → Set des classes à effacer
  const [erreurGlobale, setErreurGlobale] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState(null);

  async function charger() {
    setResultats(null);
    setErreurGlobale("");
    const initial = {};
    espaces.forEach((e) => { initial[e.id] = { chargement: true }; });
    setEtat(initial);
    let listing;
    try {
      listing = await listerDocsEleves();
    } catch (e) {
      setErreurGlobale(`Lecture de la base impossible (${e.message || "erreur réseau"}). Rien ne sera effacé.`);
      setEtat({});
      return;
    }
    await Promise.all(
      espaces.map(async (esp) => {
        try {
          const classes = await analyserEspaceFinAnnee(esp.id, listing);
          setEtat((p) => ({ ...p, [esp.id]: { classes } }));
          setCoches((p) => ({
            ...p,
            [esp.id]: new Set(classes.map((c) => c.nom).filter((n) => !CONSERVER_PAR_DEFAUT.includes((n || "").toUpperCase()))),
          }));
        } catch (e) {
          setEtat((p) => ({ ...p, [esp.id]: { erreur: e.message || "Lecture impossible" } }));
        }
      })
    );
  }
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function basculer(espId, classe) {
    setCoches((p) => {
      const s = new Set(p[espId] || []);
      s.has(classe) ? s.delete(classe) : s.add(classe);
      return { ...p, [espId]: s };
    });
  }

  const total = espaces.reduce(
    (acc, esp) => {
      const st = etat[esp.id];
      if (!st?.classes) return acc;
      st.classes.filter((c) => coches[esp.id]?.has(c.nom)).forEach((c) => {
        acc.classes += 1;
        acc.eleves += c.nbEleves;
        acc.tests += c.nbTests;
        acc.seances += c.nbSeances;
      });
      return acc;
    },
    { classes: 0, eleves: 0, tests: 0, seances: 0 }
  );
  const rienAEffacer = total.classes === 0;
  const chargementEnCours = espaces.some((e) => etat[e.id]?.chargement);
  const confirmationOk = confirmation.trim().toUpperCase() === "EFFACER";

  async function lancer() {
    if (!confirmationOk || rienAEffacer) return;
    setEnCours(true);
    const res = [];
    let listing;
    try {
      // Relecture juste avant d'effacer, pour inclure ce qui a été enregistré entre-temps.
      listing = await listerDocsEleves();
    } catch (e) {
      setResultats([{ nom: "Base", erreur: e.message || "lecture impossible" }]);
      setEnCours(false);
      return;
    }
    for (const esp of espaces) {
      const classes = Array.from(coches[esp.id] || []);
      if (!etat[esp.id]?.classes || classes.length === 0) continue;
      try {
        res.push({ nom: esp.nom, ...(await effacerClassesFinAnnee(esp.id, classes, listing)), nbClasses: classes.length });
      } catch (e) {
        res.push({ nom: esp.nom, erreur: e.message || "Échec" });
      }
    }
    setResultats(res);
    setConfirmation("");
    setEnCours(false);
  }

  return (
    <section className="mt-8 border-t border-neutral-200 pt-6 pb-6">
      <h3 className="text-xs font-bold tracking-widest text-rose-600 uppercase mb-2 flex items-center gap-1.5">
        <Trash2 size={14} /> Fin d'année : effacer les données élèves
      </h3>
      <p className="text-xs text-neutral-600 leading-relaxed mb-2">
        Efface, pour les classes et groupes cochés : la liste des élèves et leurs codes PIN, leurs tests de charge (R15-R20),
        leurs séances et leurs projets. Les classes effacées disparaissent de la liste.{" "}
        <strong>Les accès (codes des collègues) sont conservés.</strong>
      </p>
      <p className="text-xs text-neutral-600 leading-relaxed mb-4">
        Pense à relever ce dont tu as besoin pour les notes avant : l'effacement est définitif. Les classes non cochées
        (par défaut ta classe PROF) restent intactes.
      </p>

      <div className="flex justify-end mb-2">
        <button onClick={charger} className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
          <RotateCcw size={12} className={chargementEnCours ? "animate-spin" : ""} /> Relire
        </button>
      </div>

      {erreurGlobale && <p className="text-xs text-rose-600 mb-3">{erreurGlobale}</p>}

      <div className="space-y-3">
        {espaces.map((esp) => {
          const st = etat[esp.id] || {};
          return (
            <div key={esp.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-sm font-bold text-neutral-900 mb-2">{esp.nom}</p>
              {st.chargement && <p className="text-xs text-neutral-500">Lecture…</p>}
              {st.erreur && <p className="text-xs text-rose-600">Lecture impossible ({st.erreur}) : rien ne sera effacé dans cet espace.</p>}
              {st.classes && st.classes.length === 0 && <p className="text-xs text-neutral-500">Aucune classe.</p>}
              {st.classes && st.classes.length > 0 && (
                <div className="space-y-1">
                  {st.classes.map((c) => {
                    const coche = !!coches[esp.id]?.has(c.nom);
                    return (
                      <label key={c.nom} className="flex items-center gap-2.5 cursor-pointer py-1">
                        <input type="checkbox" checked={coche} onChange={() => basculer(esp.id, c.nom)} className="w-4 h-4 shrink-0 accent-rose-500" />
                        <span className={`text-sm flex-1 min-w-0 ${coche ? "text-rose-600 font-semibold" : "text-neutral-900"}`}>
                          {c.nom || "(sans nom)"}
                          {c.estGroupe && <Users size={11} className="inline ml-1 -mt-0.5 text-neutral-400" />}
                          {!coche && <span className="text-[11px] text-neutral-500 font-normal"> · conservée</span>}
                        </span>
                        <span className="text-[10px] text-neutral-500 shrink-0 text-right">
                          {c.nbEleves} él. · {c.nbTests} tests · {c.nbSeances} séances
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!resultats && (
        <div className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 space-y-3">
          <p className="text-xs text-neutral-700 flex items-start gap-1.5">
            <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <span>
              Seront effacés : {total.classes} classe{total.classes > 1 ? "s" : ""}/groupe{total.classes > 1 ? "s" : ""},{" "}
              {total.eleves} élève{total.eleves > 1 ? "s" : ""}, {total.tests} test{total.tests > 1 ? "s" : ""} de charge,{" "}
              {total.seances} séance{total.seances > 1 ? "s" : ""}, et les projets associés.
            </span>
          </p>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Tape EFFACER pour confirmer"
            className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            onClick={lancer}
            disabled={enCours || chargementEnCours || rienAEffacer || !confirmationOk || !!erreurGlobale}
            className="w-full bg-rose-500 disabled:opacity-40 text-neutral-50 text-sm font-bold py-3 rounded-xl"
          >
            {enCours ? "Effacement en cours…" : "Effacer définitivement"}
          </button>
        </div>
      )}

      {resultats && (
        <div className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 space-y-1.5">
          {resultats.length === 0 && <p className="text-xs text-neutral-600">Rien n'a été effacé.</p>}
          {resultats.map((r) => (
            <p key={r.nom} className={`text-xs flex items-start gap-1.5 ${r.erreur || r.nbEchecs ? "text-rose-600" : "text-neutral-700"}`}>
              {r.erreur || r.nbEchecs
                ? <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                : <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />}
              <span>
                <strong>{r.nom}</strong> :{" "}
                {r.erreur
                  ? `échec (${r.erreur}), rien effacé`
                  : `${r.nbClasses} classe(s), ${r.nbEleves} élève(s) et ${r.nbDocs} fiche(s) de données effacés${r.nbEchecs ? ` — ${r.nbEchecs} suppression(s) en échec, relance l'opération` : ""}`}
              </span>
            </p>
          ))}
          <button onClick={charger} className="text-xs font-bold text-neutral-800 pt-1">Vérifier ce qu'il reste</button>
        </div>
      )}
    </section>
  );
}
