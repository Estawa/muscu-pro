import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, RotateCcw, Download, Lock, Unlock, Info } from "lucide-react";
import {
  loadStudentHistoriqueByNumero, loadStudentSeancesByNumero, loadStudentProjetByNumero,
  loadNotation, saveNotation,
} from "./storage.js";
import { bilanCycle, calculerNotesClasse, statsNotes, BAREMES_CONNAISSANCES, arrondi1 } from "./analyse.js";

// ---------------------------------------------------------------------------
// Notes de cycle — tableau de classe (Mode professeur, v1.7.0)
//
//  - score brut /100 de chaque élève (conformité, régulation, progression, assiduité)
//  - ajustement par deux élèves de référence choisis par le prof (notes de suivi /20)
//  - note de connaissances optionnelle (barème 0, 1, 2, 3, 4, 5, 6 ou 8 pts) :
//    la note de suivi est ramenée sur (20 − barème) puis la note de connaissances s'ajoute
//  - arrondi au dixième, possibilité de figer les notes, export CSV
// ---------------------------------------------------------------------------

const fmt = (x) => (x === null || x === undefined || Number.isNaN(x) ? "—" : String(arrondi1(x)).replace(".", ","));
const pct = (x) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}`);
const parseNote = (v) => {
  const n = parseFloat(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

export default function NotationClasse({ prof, classe, mapping, onFermer }) {
  const [chargement, setChargement] = useState(true);
  const [donnees, setDonnees] = useState({}); // numero -> { tests, seances, projet }
  const [reglages, setReglages] = useState(null);
  const [etatSauvegarde, setEtatSauvegarde] = useState(""); // "" | "en-cours" | "ok" | "erreur"
  const [brouillons, setBrouillons] = useState({}); // saisies en cours (connaissances, notes de référence)
  const premierChargement = useRef(true);

  const charger = async () => {
    setChargement(true);
    const r = await loadNotation(prof, classe);
    const entrees = await Promise.all(mapping.map(async (e) => {
      const [tests, seances, projet] = await Promise.all([
        loadStudentHistoriqueByNumero(prof, classe, e.numero),
        loadStudentSeancesByNumero(prof, classe, e.numero),
        loadStudentProjetByNumero(prof, classe, e.numero),
      ]);
      return [e.numero, { tests, seances, projet }];
    }));
    premierChargement.current = true;
    setReglages(r);
    setDonnees(Object.fromEntries(entrees));
    setChargement(false);
  };

  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [prof, classe]);

  // Enregistrement automatique des réglages (petit délai pour regrouper les saisies).
  useEffect(() => {
    if (!reglages) return;
    if (premierChargement.current) { premierChargement.current = false; return; }
    setEtatSauvegarde("en-cours");
    const t = setTimeout(async () => {
      try { await saveNotation(prof, classe, reglages); setEtatSauvegarde("ok"); }
      catch (e) { setEtatSauvegarde("erreur"); }
    }, 600);
    return () => clearTimeout(t);
  }, [reglages, prof, classe]);

  const eleves = useMemo(() => mapping.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr")), [mapping]);

  const bilans = useMemo(() => {
    if (!reglages) return {};
    const out = {};
    for (const e of eleves) {
      const d = donnees[e.numero];
      if (!d) continue;
      out[e.numero] = bilanCycle(d.seances || [], { project: d.projet || { mobiles: {}, ateliers: [] }, tests: d.tests || [] }, reglages.seancesAttendues);
    }
    return out;
  }, [donnees, reglages?.seancesAttendues, eleves]);

  const calcul = useMemo(() => {
    if (!reglages) return null;
    const liste = eleves.filter((e) => bilans[e.numero]).map((e) => ({ numero: e.numero, brut: bilans[e.numero].brut }));
    return calculerNotesClasse(liste, reglages);
  }, [bilans, reglages, eleves]);

  if (chargement || !reglages || !calcul) {
    return (
      <Overlay onFermer={onFermer} classe={classe}>
        <p className="text-sm text-neutral-500">Chargement des données de la classe…</p>
      </Overlay>
    );
  }

  const fige = reglages.fige;
  const X = reglages.ptsConnaissances || 0;
  const partSuivi = 20 - X;
  const lignesAffichees = fige ? fige.lignes : calcul.lignes;
  const ligneDe = Object.fromEntries(lignesAffichees.map((l) => [l.numero, l]));
  const stats = statsNotes(lignesAffichees);
  const nomDe = (num) => { const e = eleves.find((x) => x.numero === num); return e ? `${e.prenom} ${e.nom}` : "?"; };
  const maj = (patch) => setReglages((r) => ({ ...r, ...patch }));

  const setRef = (cle, champ, valeur) => {
    setReglages((r) => {
      const actuel = r[cle] || { numero: null, note: cle === "refHaut" ? 16 : 8 };
      const next = { ...actuel, [champ]: valeur };
      return { ...r, [cle]: next.numero ? next : null };
    });
  };

  const validerNoteRef = (cle) => {
    const k = `${cle}-note`;
    if (brouillons[k] === undefined) return;
    const n = parseNote(brouillons[k]);
    if (n !== null) setRef(cle, "note", Math.max(0, Math.min(20, arrondi1(n))));
    setBrouillons((b) => { const { [k]: _, ...reste } = b; return reste; });
  };

  const validerConnaissances = (numero) => {
    const k = `c-${numero}`;
    if (brouillons[k] === undefined) return;
    const v = brouillons[k];
    setReglages((r) => {
      const c = { ...(r.connaissances || {}) };
      const n = parseNote(v);
      if (String(v).trim() === "" || n === null) delete c[numero];
      else c[numero] = Math.max(0, Math.min(X, n)) / X;
      return { ...r, connaissances: c };
    });
    setBrouillons((b) => { const { [k]: _, ...reste } = b; return reste; });
  };

  const basculerExclu = (numero) => {
    setReglages((r) => {
      const ex = new Set(r.exclus || []);
      if (ex.has(numero)) ex.delete(numero); else ex.add(numero);
      return { ...r, exclus: [...ex] };
    });
  };

  const figer = () => {
    const lignes = calcul.lignes.map((l) => ({ ...l, composantes: bilans[l.numero]?.composantes || null, nbSeances: bilans[l.numero]?.nbSeances || 0 }));
    maj({ fige: { date: new Date().toLocaleDateString("fr-FR"), lignes, X, partSuivi } });
  };

  const exporterCSV = () => {
    const Xe = fige ? fige.X : X;
    const pe = fige ? fige.partSuivi : partSuivi;
    const entetes = ["Nom", "Prénom", "Séances", "Conformité %", "Régulation %", "Progression %", "Assiduité %", "Score brut /100", "Suivi /20", `Suivi /${pe}`];
    if (Xe > 0) entetes.push(`Connaissances /${Xe}`);
    entetes.push("Note /20");
    const nb = (x) => (x === null || x === undefined ? "" : String(arrondi1(x)).replace(".", ","));
    const lignesCSV = eleves.map((e) => {
      const l = ligneDe[e.numero];
      const b = bilans[e.numero];
      const comp = (fige && l?.composantes) || b?.composantes || {};
      if (!l || l.exclu) return [e.nom, e.prenom, b?.nbSeances ?? "", "", "", "", "", "", "", "", ...(Xe > 0 ? [""] : []), "Exclu"];
      const pc = (x) => (x === null || x === undefined ? "" : Math.round(x * 100));
      return [
        e.nom, e.prenom, (fige ? l.nbSeances : b?.nbSeances) ?? "",
        pc(comp.conformite), pc(comp.regulation), pc(comp.progression), pc(comp.assiduite),
        nb(l.brut), nb(l.suivi20), nb(l.suiviPart),
        ...(Xe > 0 ? [nb(l.connaissances)] : []),
        nb(l.finale),
      ];
    });
    const echap = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = "﻿" + [entetes, ...lignesCSV].map((r) => r.map(echap).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-muscu-${classe.replace(/[^a-z0-9-]+/gi, "_")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const elevesNotables = eleves.filter((e) => !(reglages.exclus || []).includes(e.numero));
  const refHaut = reglages.refHaut, refBas = reglages.refBas;

  return (
    <Overlay onFermer={onFermer} classe={classe} etat={etatSauvegarde}>
      {/* ---------------- Réglages ---------------- */}
      <div className={`bg-white border border-neutral-200 rounded-2xl p-4 space-y-4 ${fige ? "opacity-60 pointer-events-none" : ""}`}>
        <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Réglages de la notation</p>

        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-neutral-700">Séances attendues sur le cycle</label>
          <input type="number" min={1} max={30} value={reglages.seancesAttendues}
            onChange={(e) => maj({ seancesAttendues: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-20 bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-sm text-center" />
        </div>

        <div>
          <p className="text-xs text-neutral-700 mb-1.5">Note de connaissances (points sur 20)</p>
          <div className="flex flex-wrap gap-1.5">
            {BAREMES_CONNAISSANCES.map((b) => (
              <button key={b} onClick={() => maj({ ptsConnaissances: b })}
                className={`w-10 py-1.5 rounded-lg text-xs font-bold border ${X === b ? "bg-orange-500 text-neutral-50 border-orange-500" : "bg-white text-neutral-600 border-neutral-200"}`}>
                {b}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">
            {X === 0 ? "Pas de note de connaissances : la note sur 20 est entièrement la note de suivi de cycle."
              : `Note sur 20 = suivi de cycle sur ${partSuivi} + connaissances sur ${X} (à saisir dans le tableau).`}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-neutral-700">Élèves de référence (notes de suivi sur 20)</p>
          {[{ cle: "refHaut", label: "Référence haute", ref: refHaut }, { cle: "refBas", label: "Référence basse", ref: refBas }].map(({ cle, label, ref }) => (
            <div key={cle} className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-neutral-600 w-28">{label}</span>
              <select value={ref?.numero || ""} onChange={(e) => setRef(cle, "numero", e.target.value ? Number(e.target.value) : null)}
                className="flex-1 min-w-[10rem] bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-xs">
                <option value="">— choisir un élève —</option>
                {elevesNotables.map((e) => (
                  <option key={e.numero} value={e.numero}>{e.prenom} {e.nom} (brut {fmt(bilans[e.numero]?.brut)})</option>
                ))}
              </select>
              <span className="flex items-center gap-1 text-xs text-neutral-600">
                <input
                  value={brouillons[`${cle}-note`] ?? (ref ? fmt(ref.note) : "")}
                  disabled={!ref}
                  onChange={(e) => setBrouillons((b) => ({ ...b, [`${cle}-note`]: e.target.value }))}
                  onBlur={() => validerNoteRef(cle)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  inputMode="decimal"
                  className="w-16 bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-sm text-center disabled:bg-neutral-100" />
                /20
              </span>
            </div>
          ))}
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Le score brut de la référence haute reçoit sa note, celui de la référence basse la sienne ; les autres élèves sont placés
            proportionnellement entre les deux (sans pouvoir dépasser ces deux notes). Sans références, la note de suivi = score brut ÷ 5.
            {X > 0 && ` La note de suivi est ensuite ramenée sur ${partSuivi}.`}
          </p>
          {calcul.avertissement && <p className="text-[11px] font-semibold text-rose-600">{calcul.avertissement}</p>}
          {calcul.mode === "ajuste" && !calcul.avertissement && (
            <p className="text-[11px] text-emerald-700">Ajustement actif : {nomDe(refHaut.numero)} = {fmt(refHaut.note)}/20 · {nomDe(refBas.numero)} = {fmt(refBas.note)}/20.</p>
          )}
        </div>
      </div>

      {/* ---------------- Actions ---------------- */}
      <div className="flex flex-wrap gap-2">
        {fige ? (
          <button onClick={() => maj({ fige: null })} className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 bg-white border border-neutral-300 rounded-xl px-3 py-2">
            <Unlock size={13} /> Notes figées le {fige.date} — défiger
          </button>
        ) : (
          <button onClick={figer} className="flex items-center gap-1.5 text-xs font-bold text-neutral-50 bg-neutral-800 rounded-xl px-3 py-2">
            <Lock size={13} /> Figer les notes
          </button>
        )}
        <button onClick={exporterCSV} className="flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
          <Download size={13} /> Export CSV (Excel / Pronote)
        </button>
        <button onClick={charger} className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 rounded-xl px-3 py-2">
          <RotateCcw size={13} /> Actualiser
        </button>
        {stats && (
          <span className="ml-auto self-center text-xs text-neutral-600">
            Moyenne <b>{fmt(stats.moyenne)}</b> · min {fmt(stats.min)} · max {fmt(stats.max)} ({stats.nb} élèves)
          </span>
        )}
      </div>
      {fige && (
        <p className="text-[11px] text-neutral-500 flex gap-1.5"><Info size={13} className="shrink-0" /> Les notes ne bougent plus, même si de nouvelles séances sont saisies. Défige pour modifier les réglages ou les notes de connaissances.</p>
      )}

      {/* ---------------- Tableau ---------------- */}
      <div className="overflow-x-auto border border-neutral-200 rounded-2xl">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-[10px] uppercase text-neutral-500">
            <tr>
              <th className="sticky left-0 bg-neutral-50 text-left px-3 py-2 font-bold">Élève</th>
              <th className="px-2 py-2 font-bold">Séances</th>
              <th className="px-2 py-2 font-bold" title="Conformité au projet (40 %)">Conf. %</th>
              <th className="px-2 py-2 font-bold" title="Régulation (25 %)">Régul. %</th>
              <th className="px-2 py-2 font-bold" title="Progression (20 %)">Progr. %</th>
              <th className="px-2 py-2 font-bold" title="Assiduité du carnet (15 %)">Assid. %</th>
              <th className="px-2 py-2 font-bold">Brut /100</th>
              <th className="px-2 py-2 font-bold">Suivi /20</th>
              {(fige ? fige.X : X) > 0 && <th className="px-2 py-2 font-bold">Suivi /{fige ? fige.partSuivi : partSuivi}</th>}
              {(fige ? fige.X : X) > 0 && <th className="px-2 py-2 font-bold">Conn. /{fige ? fige.X : X}</th>}
              <th className="px-2 py-2 font-bold text-orange-700">Note /20</th>
              <th className="px-2 py-2 font-bold" title="Exclure de la notation (dispensé, inapte…)">Exclu</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map((e) => {
              const l = ligneDe[e.numero];
              const b = bilans[e.numero];
              const comp = (fige && l?.composantes) || b?.composantes || {};
              const exclu = (reglages.exclus || []).includes(e.numero);
              const estHaut = refHaut?.numero === e.numero, estBas = refBas?.numero === e.numero;
              const Xa = fige ? fige.X : X;
              return (
                <tr key={e.numero} className={`border-t border-neutral-100 ${exclu ? "text-neutral-400" : "text-neutral-700"}`}>
                  <td className="sticky left-0 bg-white px-3 py-1.5 whitespace-nowrap font-semibold text-neutral-900">
                    {e.nom} {e.prenom}
                    {estHaut && <span className="ml-1 text-[9px] font-black text-emerald-700" title="Référence haute">▲ réf.</span>}
                    {estBas && <span className="ml-1 text-[9px] font-black text-rose-600" title="Référence basse">▼ réf.</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center">{(fige && l ? l.nbSeances : b?.nbSeances) ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center">{pct(comp.conformite)}</td>
                  <td className="px-2 py-1.5 text-center">{pct(comp.regulation)}</td>
                  <td className="px-2 py-1.5 text-center">{pct(comp.progression)}</td>
                  <td className="px-2 py-1.5 text-center">{pct(comp.assiduite)}</td>
                  <td className="px-2 py-1.5 text-center">{l && !l.exclu ? fmt(l.brut) : "—"}</td>
                  <td className="px-2 py-1.5 text-center">{l && !l.exclu ? fmt(l.suivi20) : "—"}</td>
                  {Xa > 0 && <td className="px-2 py-1.5 text-center">{l && !l.exclu ? fmt(l.suiviPart) : "—"}</td>}
                  {Xa > 0 && (
                    <td className="px-2 py-1.5 text-center">
                      {exclu ? "—" : fige ? fmt(l?.connaissances) : (
                        <input
                          value={brouillons[`c-${e.numero}`] ?? (reglages.connaissances?.[e.numero] !== undefined ? fmt(reglages.connaissances[e.numero] * X) : "")}
                          onChange={(ev) => setBrouillons((bb) => ({ ...bb, [`c-${e.numero}`]: ev.target.value }))}
                          onBlur={() => validerConnaissances(e.numero)}
                          onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                          inputMode="decimal" placeholder="—"
                          className="w-14 bg-white border border-neutral-200 rounded-md px-1.5 py-1 text-xs text-center" />
                      )}
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center font-black text-orange-600">
                    {l && !l.exclu ? <>{fmt(l.finale)}{l.connaissancesManquante && <span className="text-rose-500" title="Note de connaissances non saisie (comptée 0)">*</span>}</> : exclu ? "Exclu" : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={exclu} disabled={!!fige} onChange={() => basculerExclu(e.numero)} className="accent-orange-500" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lignesAffichees.some((l) => l.connaissancesManquante) && (
        <p className="text-[11px] text-rose-600">* note de connaissances non encore saisie (comptée 0 dans la note sur 20).</p>
      )}
      <p className="text-[11px] text-neutral-500 leading-relaxed">
        Score brut = conformité au projet 40 % · régulation 25 % · progression 20 % · assiduité du carnet 15 %.
        Une composante impossible à calculer (par exemple aucun ressenti ↑/↓ renseigné) est écartée et son poids reporté sur les autres.
        Ces notes ne sont jamais visibles par les élèves.
      </p>
    </Overlay>
  );
}

function Overlay({ children, onFermer, classe, etat }) {
  return (
    <div className="fixed inset-0 z-50 bg-neutral-100 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-neutral-100/95 backdrop-blur flex items-center justify-between">
          <div>
            <p className="text-lg font-black uppercase tracking-tight text-neutral-950">Notes de cycle — {classe}</p>
            <p className="text-[11px] text-neutral-500">
              {etat === "en-cours" ? "Enregistrement…" : etat === "ok" ? "Réglages enregistrés" : etat === "erreur" ? "⚠ Échec de l'enregistrement (connexion ?)" : "Muscu Pro · Mode professeur"}
            </p>
          </div>
          <button onClick={onFermer} className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
            <X size={18} className="text-neutral-600" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
