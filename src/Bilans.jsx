import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { REGLES_MOBILE, POIDS, arrondi1 } from "./analyse.js";

// ---------------------------------------------------------------------------
// Affichage des récapitulatifs d'atelier, des bilans de séance et du bilan de
// cycle (v1.7.0). Utilisé côté élève (onglet Séances) et côté professeur
// (fiche élève). Le bilan de cycle n'est affiché que dans le Mode professeur.
// ---------------------------------------------------------------------------

const RESSENTI_SYMB = { adaptee: "=", lourde: "↑", legere: "↓", adaptation: "~" };
const RESSENTI_LABEL = { adaptee: "adaptée", lourde: "trop lourde", legere: "trop légère", adaptation: "adaptation" };

const STATUTS = {
  conforme: { symb: "✓", label: "Conforme", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
  partiel: { symb: "≈", label: "Partiel", cls: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
  eloigne: { symb: "✗", label: "Éloigné", cls: "bg-rose-500/15 text-rose-700 border-rose-500/40" },
  "sans-objectif": { symb: "?", label: "Sans objectif", cls: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  cardio: { symb: "♥", label: "Cardio", cls: "bg-lime-500/15 text-lime-700 border-lime-500/40" },
};

const fmt = (x) => (x === null || x === undefined ? "—" : String(arrondi1(x)).replace(".", ","));
const signe = (x) => (x > 0 ? `+${fmt(x)}` : fmt(x));
const pct = (x) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);

function Critere({ ok, children }) {
  const cls = ok === null ? "text-neutral-400" : ok ? "text-emerald-700" : "text-rose-600";
  const s = ok === null ? "" : ok ? " ✓" : " ✗";
  return <span className={`${cls} whitespace-nowrap`}>{children}{s}</span>;
}

// Récapitulatif succinct d'un atelier (réalisé ↔ prévu par le projet).
export function RecapAtelier({ x }) {
  const st = STATUTS[x.statut];
  const a = x.realise;
  const regle = x.regle || (x.mobileId ? REGLES_MOBILE[x.mobileId] : null);
  return (
    <div className="py-1.5 border-t border-neutral-100 first:border-0">
      <div className="flex items-start gap-1.5">
        <span className={`shrink-0 text-[9px] font-black border rounded px-1 py-0.5 leading-none ${st.cls}`}>{st.symb}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-neutral-800 leading-tight">
            {x.atelier}
            {regle && <span className="font-normal text-neutral-500"> · {regle.label} visé</span>}
            {!x.dansProjet && <span className="ml-1 text-[9px] font-bold uppercase text-amber-700">hors projet</span>}
          </p>
          <p className="text-[10px] text-neutral-500 leading-snug">
            {a.nbSeries} série{a.nbSeries > 1 ? "s" : ""} × {fmt(a.repsMoyenne)} rép · {fmt(a.chargeMoyenne)} kg (moy.)
            {a.ressenti && ` · ressenti ${RESSENTI_SYMB[a.ressenti]}`}
          </p>
          {Array.isArray(a.series) && a.series.length > 0 && (
            <p className="text-[9px] text-neutral-400 leading-snug">Séries : {a.series.map((s) => `${fmt(s.charge)}×${fmt(s.reps)}`).join(" · ")}</p>
          )}
          {x.statut === "cardio" && <p className="text-[10px] text-neutral-500">Travail cardio : réalisé, non évalué en charge.</p>}
          {x.statut === "sans-objectif" && <p className="text-[10px] text-rose-600">Aucun mobile choisi pour cette zone dans le projet.</p>}
          {x.criteres && (
            <p className="text-[10px] flex flex-wrap gap-x-2.5 mt-0.5">
              <Critere ok={x.criteres.reps.ok}>Rép. {fmt(a.repsMoyenne)} ({regle.repsMin}-{regle.repsMax})</Critere>
              {x.cible
                ? <Critere ok={x.criteres.charge.ok}>Charge {fmt(a.chargeMoyenne)} kg (cible {fmt(x.cible)}{x.criteres.charge.depassee ? `, +${Math.round(x.criteres.charge.ecart * 100)} % rép. tenues` : ""})</Critere>
                : <Critere ok={null}>Charge : pas de test de référence</Critere>}
              <Critere ok={x.criteres.series.ok}>Séries {a.nbSeries}/{regle.seriesMin}</Critere>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Bilan d'ensemble d'une séance.
export function BilanSeance({ an }) {
  const s = an.seance;
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-2 space-y-1 text-[10px] text-neutral-600">
      <p className="text-[9px] uppercase tracking-wider font-bold text-neutral-500">Bilan de la séance</p>
      {an.nb.evalues > 0 ? (
        <p>
          <span className="font-semibold text-neutral-800">Conformité au projet : {pct(an.scoreConformite)}</span>
          {" "}— {an.nb.conforme} conforme{an.nb.conforme > 1 ? "s" : ""}, {an.nb.partiel} partiel{an.nb.partiel > 1 ? "s" : ""}, {an.nb.eloigne} éloigné{an.nb.eloigne > 1 ? "s" : ""} sur {an.nb.evalues}
        </p>
      ) : (
        <p className="font-semibold text-neutral-800">Aucun atelier évaluable (cardio uniquement).</p>
      )}
      {an.nonTravailles.length > 0 && <p>Projet non travaillé aujourd'hui : {an.nonTravailles.join(", ")}</p>}
      {an.horsProjet.length > 0 && <p>Hors projet : {an.horsProjet.join(", ")}</p>}
      <p>
        Tonnage {Number(s.tonnage || 0).toLocaleString("fr-FR")} kg
        {an.diffTonnageSeance !== null && ` (${an.diffTonnageSeance >= 0 ? "+" : ""}${an.diffTonnageSeance.toLocaleString("fr-FR")} kg / séance préc.)`}
        {s.duree ? ` · ${s.duree} min` : ""} · RPE {s.rpe} · {s.charge} UA
      </p>
      {an.evolutions.length > 0 && (
        <p>Évolution des charges : {an.evolutions.map((e) => `${e.atelier} ${e.diffCharge === 0 ? "=" : `${signe(e.diffCharge)} kg`}`).join(" · ")}</p>
      )}
      {an.regulations.length > 0 && (
        <div>
          <p>Régulation : {an.regulations.filter((r) => r.coherent).length}/{an.regulations.length} ajustement{an.regulations.length > 1 ? "s" : ""} cohérent{an.regulations.length > 1 ? "s" : ""}</p>
          {an.regulations.map((r, i) => (
            <p key={i} className={r.coherent ? "text-emerald-700" : "text-rose-600"}>
              · {r.atelier} : {RESSENTI_LABEL[r.ressentiAvant]} la dernière fois → {fmt(r.avant)} → {fmt(r.apres)} kg {r.coherent ? "✓" : "✗"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Une séance : en-tête cliquable, puis récap des ateliers et bilan.
export function SeanceAnalysee({ an, ouvertParDefaut = false }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const s = an.seance;
  const conf = an.scoreConformite;
  const badge = conf === null ? "text-neutral-400" : conf >= 0.75 ? "text-emerald-700" : conf >= 0.4 ? "text-amber-700" : "text-rose-600";
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs">
      <button onClick={() => setOuvert((v) => !v)} className="w-full flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-800">{s.date}</span>
        <span className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span>{s.tonnage} kg · RPE {s.rpe} · {s.charge} UA</span>
          <span className={`font-bold ${badge}`}>{conf === null ? "—" : pct(conf)}</span>
          <ChevronRight size={12} className={`transition ${ouvert ? "rotate-90" : ""}`} />
        </span>
      </button>
      {ouvert && (
        <div className="mt-1.5 space-y-2">
          {an.ateliers.length > 0 && <div>{an.ateliers.map((x, i) => <RecapAtelier key={i} x={x} />)}</div>}
          <BilanSeance an={an} />
        </div>
      )}
    </div>
  );
}

// Liste des séances analysées (la plus récente en premier, ouverte).
export function ListeSeancesAnalysees({ analyses }) {
  return (
    <div className="space-y-2">
      {analyses.slice().reverse().map((an, i) => (
        <SeanceAnalysee key={an.index} an={an} ouvertParDefaut={i === 0} />
      ))}
    </div>
  );
}

// Bilan de cycle (Mode professeur uniquement).
export function BilanCycle({ bilan, seancesAttendues }) {
  const c = bilan.composantes;
  const lignes = [
    { k: "conformite", label: "Conformité au projet", val: pct(c.conformite), detail: "moyenne des séances" },
    { k: "regulation", label: "Régulation", val: pct(c.regulation), detail: bilan.nbRegulations ? `${bilan.nbRegulationsCoherentes}/${bilan.nbRegulations} ajustements cohérents` : "aucun ressenti ↑/↓ à exploiter" },
    { k: "progression", label: "Progression", val: pct(c.progression), detail: bilan.progressions.length ? `charge sur ${bilan.progressions.length} atelier${bilan.progressions.length > 1 ? "s" : ""}` : "un atelier réussi 2 fois dans sa plage de rép. requis" },
    { k: "assiduite", label: "Assiduité du carnet", val: pct(c.assiduite), detail: `${bilan.nbSeances}/${seancesAttendues} séances` },
  ];
  return (
    <div className="bg-orange-500/5 border border-orange-500/30 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase font-bold text-orange-700">Bilan de cycle (visible par toi seul)</p>
        <p className="text-sm font-black text-orange-600">{fmt(bilan.brut)}<span className="text-[10px] font-semibold text-neutral-500">/100</span></p>
      </div>
      <div className="space-y-0.5">
        {lignes.map((l) => (
          <div key={l.k} className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-700">{l.label} <span className="text-neutral-400">({POIDS[l.k]} %)</span></span>
            <span className="text-neutral-500"><span className="text-neutral-400">{l.detail}</span> · <span className="font-bold text-neutral-800">{l.val}</span></span>
          </div>
        ))}
      </div>
      {bilan.progressions.length > 0 && (
        <p className="text-[9px] text-neutral-500 mt-1">
          {bilan.progressions.map((p) => `${p.atelier} ${p.gain >= 0 ? "+" : ""}${Math.round(p.gain * 100)} %`).join(" · ")}
        </p>
      )}
      <p className="text-[9px] text-neutral-400 mt-1">La note sur 20 se règle dans « Notes de cycle » (références, connaissances).</p>
    </div>
  );
}
