import React, { useEffect, useState } from "react";
import { UserPlus, X, Check } from "lucide-react";
import { loadMapping, deplacerEleveMapping } from "./storage.js";

// Ajout d'élèves déjà connus (venant d'autres classes ou groupes du prof) dans la classe/le groupe
// ouvert. Chaque élève choisi est DÉPLACÉ avec toutes ses données (PIN, tests, séances, projet) :
// il n'existe jamais en double, et se connecte désormais en choisissant ce groupe. Sa classe
// d'origine est mémorisée pour pouvoir l'y renvoyer en fin de cycle.
export default function AjoutDepuisClasses({ prof, classeCible, classes, groupes, onTermine, onFermer }) {
  const sources = (classes || []).filter((c) => c !== classeCible);
  const [source, setSource] = useState(sources[0] || "");
  const [eleves, setEleves] = useState({}); // classe → [élèves]
  const [choix, setChoix] = useState({}); // "classe|numero" → { classe, numero, nom, prenom }
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!source || eleves[source]) return;
    let annule = false;
    loadMapping(prof, source).then((m) => {
      if (!annule) setEleves((p) => ({ ...p, [source]: m.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr")) }));
    });
    return () => { annule = true; };
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const cle = (classe, numero) => `${classe}|${numero}`;
  const liste = eleves[source] || [];
  const nbChoisis = Object.keys(choix).length;
  const tousCoches = liste.length > 0 && liste.every((e) => choix[cle(source, e.numero)]);

  function basculer(e) {
    const k = cle(source, e.numero);
    setChoix((p) => {
      const n = { ...p };
      if (n[k]) delete n[k];
      else n[k] = { classe: source, numero: e.numero, nom: e.nom, prenom: e.prenom };
      return n;
    });
  }
  function toutBasculer() {
    setChoix((p) => {
      const n = { ...p };
      liste.forEach((e) => {
        const k = cle(source, e.numero);
        if (tousCoches) delete n[k];
        else n[k] = { classe: source, numero: e.numero, nom: e.nom, prenom: e.prenom };
      });
      return n;
    });
  }

  async function valider() {
    if (nbChoisis === 0) return;
    setEnCours(true);
    setErreur("");
    const echecs = [];
    let i = 0;
    for (const e of Object.values(choix)) {
      try {
        await deplacerEleveMapping(prof, e.classe, e.numero, classeCible, { origine: "definir" });
      } catch (err) {
        echecs.push(`${e.prenom} ${e.nom}`);
      }
      i++;
      setProgression(i);
    }
    setEnCours(false);
    if (echecs.length > 0) {
      setErreur(`Non ajouté(s), réessaie (connexion ?) : ${echecs.join(", ")}.`);
      setChoix({});
      setEleves({});
      await onTermine(false);
      return;
    }
    await onTermine(true);
  }

  return (
    <div className="bg-white border border-orange-500/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
          <UserPlus size={15} className="text-orange-600" /> Ajouter des élèves dans {classeCible}
        </p>
        <button onClick={onFermer} disabled={enCours} className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-500">
          <X size={15} />
        </button>
      </div>
      <p className="text-[11px] text-neutral-600 leading-relaxed">
        Les élèves choisis quittent leur classe actuelle pour rejoindre {classeCible} avec leur code PIN, leurs tests, leurs
        séances et leur projet. Leur classe d'origine est retenue pour pouvoir les y renvoyer en fin de cycle. Ils se
        connecteront désormais en choisissant « {classeCible} ».
      </p>

      {sources.length === 0 ? (
        <p className="text-xs text-neutral-500">Aucune autre classe : importe d'abord tes listes de classes.</p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {sources.map((c) => {
              const nbDansCetteClasse = Object.values(choix).filter((x) => x.classe === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setSource(c)}
                  className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border ${source === c ? "bg-orange-500 text-neutral-50 border-orange-500" : "border-neutral-200 text-neutral-600"}`}
                >
                  {c}{groupes.includes(c) ? " (groupe)" : ""}{nbDansCetteClasse > 0 ? ` · ${nbDansCetteClasse}` : ""}
                </button>
              );
            })}
          </div>

          {!eleves[source] && <p className="text-xs text-neutral-400">Chargement…</p>}
          {eleves[source] && liste.length === 0 && <p className="text-xs text-neutral-500">Aucun élève dans {source}.</p>}
          {liste.length > 0 && (
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              <button onClick={toutBasculer} className="text-[11px] font-bold text-orange-700 pb-1">
                {tousCoches ? "Tout décocher" : `Tout cocher (${liste.length})`}
              </button>
              {liste.map((e) => {
                const coche = !!choix[cle(source, e.numero)];
                return (
                  <label key={e.numero} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={coche} onChange={() => basculer(e)} className="w-4 h-4 shrink-0 accent-orange-500" />
                    <span className={`text-sm ${coche ? "font-bold text-neutral-900" : "text-neutral-700"}`}>
                      {e.nom} {e.prenom}
                    </span>
                    {e.classeOrigine && <span className="text-[10px] text-neutral-400">(origine {e.classeOrigine})</span>}
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}

      {erreur && <p className="text-xs text-rose-600">{erreur}</p>}

      <button
        onClick={valider}
        disabled={enCours || nbChoisis === 0}
        className="w-full flex items-center justify-center gap-1.5 bg-orange-500 disabled:opacity-40 text-neutral-50 text-sm font-bold rounded-xl py-2.5"
      >
        <Check size={14} />
        {enCours ? `Ajout en cours… ${progression}/${nbChoisis}` : `Ajouter ${nbChoisis} élève${nbChoisis > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
