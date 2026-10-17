import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  ELEMENTS, DEGRES_AFL2_GT, ROLES_AFL3_GT, DEGRES_PRO_AFLP3, DEGRES_PRO_AFLP5, REPARTITIONS,
  pointsRepartition, pointsFixes, plageFil, valeurs, calculerNoteBacMuscu, degreDepuisErreurs,
} from "./bacMuscu.js";

const fmt = (x) => (x === null || x === undefined || Number.isNaN(x) ? "—" : String(Math.round(x * 100) / 100).replace(".", ","));

function Degres({ valeur, onChange, descriptions, points, desactive }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4].map((d) => (
          <button key={d} type="button" disabled={desactive} title={descriptions?.[d - 1]} onClick={() => onChange(valeur === d ? null : d)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${valeur === d ? "bg-neutral-800 text-neutral-50 border-neutral-800" : "bg-white text-neutral-600 border-neutral-200"}`}>
            D{d}{points ? ` · ${points(d)}` : ""}
          </button>
        ))}
      </div>
      {valeur && descriptions && <p className="text-[11px] text-neutral-500 mt-1 leading-snug">{descriptions[valeur - 1]}</p>}
    </div>
  );
}

function Valeur({ valeur, liste, onChange, desactive }) {
  return (
    <select value={valeur ?? ""} disabled={desactive} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="mt-1.5 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs">
      <option value="">—</option>
      {liste.map((v) => <option key={v} value={v}>{fmt(v)}</option>)}
    </select>
  );
}

function Bloc({ titre, note, sur, children }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3">
      <div className="flex justify-between items-baseline gap-2 mb-1.5">
        <p className="text-[11px] font-bold text-neutral-700">{titre}</p>
        <span className="text-xs font-black text-neutral-900 whitespace-nowrap">{fmt(note)} / {sur}</span>
      </div>
      {children}
    </div>
  );
}

function Editeur({ typeBac, saisie, onMaj, desactive }) {
  const s = saisie || {};
  const gt = typeBac === "gt";
  const res = calculerNoteBacMuscu(typeBac, s);
  const [pa, pb] = pointsRepartition(s.repartition);
  return (
    <div className="space-y-2 pt-2">
      {ELEMENTS[gt ? "gt" : "pro"].map((el) => (
        <Bloc key={el.cle} titre={el.titre} note={res[el.cle]} sur={el.sur}>
          <Degres valeur={s[`${el.cle}Degre`]} descriptions={el.degres} desactive={desactive}
            points={(d) => el.plages[d].map(fmt).join("-")}
            onChange={(d) => onMaj({ [`${el.cle}Degre`]: d, [`${el.cle}Note`]: d ? el.plages[d][1] : null })} />
          {s[`${el.cle}Degre`] && (
            <Valeur valeur={s[`${el.cle}Note`]} liste={valeurs(el.plages[s[`${el.cle}Degre`]], el.pas)} desactive={desactive}
              onChange={(v) => onMaj({ [`${el.cle}Note`]: v })} />
          )}
        </Bloc>
      ))}

      <Bloc titre={`Fil de séquence — ${gt ? "AFL 2 + AFL 3" : "AFLP 3 + AFLP 5"}`} note={res.fil} sur={8}>
        <label className="flex items-center gap-2 text-[11px] text-neutral-600 mb-2">
          Répartition
          <select value={s.repartition || "4-4"} disabled={desactive}
            onChange={(e) => {
              const r = e.target.value;
              const [na, nb] = pointsRepartition(r);
              if (gt) onMaj({ repartition: r });
              else onMaj({
                repartition: r,
                aflp3Note: s.aflp3Degre ? plageFil(na, s.aflp3Degre)[1] : s.aflp3Note ?? null,
                aflp5Note: s.aflp5Degre ? plageFil(nb, s.aflp5Degre)[1] : s.aflp5Note ?? null,
              });
            }}
            className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs">
            {REPARTITIONS.map((r) => {
              const [a, b] = pointsRepartition(r);
              return <option key={r} value={r}>{gt ? `AFL 2 : ${a} — AFL 3 : ${b}` : `AFLP 3 : ${a} — AFLP 5 : ${b}`}</option>;
            })}
          </select>
        </label>
        {gt ? (
          <div className="space-y-2">
            <div>
              <p className="text-[11px] text-neutral-700 mb-1">AFL 2 — S'entraîner (carnet, engagement) · /{pa} · {fmt(res.afl2)}</p>
              <Degres valeur={s.afl2Degre} descriptions={DEGRES_AFL2_GT} desactive={desactive} points={(d) => fmt(pointsFixes(pa, d))} onChange={(d) => onMaj({ afl2Degre: d })} />
            </div>
            <div>
              <p className="text-[11px] text-neutral-700 mb-1">AFL 3 — Rôle choisi par l'élève · /{pb} · {fmt(res.afl3)}</p>
              <div className="flex gap-1 mb-1.5">
                {ROLES_AFL3_GT.map((r) => (
                  <button key={r.id} type="button" disabled={desactive} onClick={() => onMaj({ afl3Role: s.afl3Role === r.id ? null : r.id })}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${s.afl3Role === r.id ? "bg-orange-500 text-neutral-50 border-orange-500" : "bg-white text-neutral-600 border-neutral-200"}`}>
                    {r.libelle}
                  </button>
                ))}
              </div>
              {s.afl3Role && (
                <Degres valeur={s.afl3Degre} desactive={desactive} descriptions={ROLES_AFL3_GT.find((r) => r.id === s.afl3Role)?.degres}
                  points={(d) => fmt(pointsFixes(pb, d))} onChange={(d) => onMaj({ afl3Degre: d })} />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { cle: "aflp3", titre: "AFLP 3 — Retour réflexif, réguler sa charge", pts: pa, desc: DEGRES_PRO_AFLP3 },
              { cle: "aflp5", titre: "AFLP 5 — Motricité contrôlée et sécuritaire", pts: pb, desc: DEGRES_PRO_AFLP5 },
            ].map(({ cle, titre, pts, desc }) => (
              <div key={cle}>
                <p className="text-[11px] text-neutral-700 mb-1">{titre} · /{pts} · {fmt(s[`${cle}Note`])}</p>
                {cle === "aflp5" && (
                  <label className="flex items-center gap-2 text-[11px] text-neutral-500 mb-1">
                    Erreurs techniques relevées
                    <input type="number" min={0} max={20} value={s.erreursTechniques ?? ""} disabled={desactive}
                      onChange={(e) => {
                        const n = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0);
                        const d = degreDepuisErreurs(n);
                        onMaj({ erreursTechniques: n, ...(d ? { aflp5Degre: d, aflp5Note: plageFil(pb, d)[1] } : {}) });
                      }}
                      className="w-14 bg-white border border-neutral-200 rounded-md px-1.5 py-0.5 text-xs text-center" />
                    <span>(&gt;5 → D1 · 4-5 → D2 · 2-3 → D3 · 0-1 → D4)</span>
                  </label>
                )}
                <Degres valeur={s[`${cle}Degre`]} descriptions={desc} desactive={desactive}
                  points={(d) => plageFil(pts, d).map(fmt).join("-")}
                  onChange={(d) => onMaj({ [`${cle}Degre`]: d, [`${cle}Note`]: d ? plageFil(pts, d)[1] : null })} />
                {s[`${cle}Degre`] && (
                  <Valeur valeur={s[`${cle}Note`]} liste={valeurs(plageFil(pts, s[`${cle}Degre`]), 0.1)} desactive={desactive}
                    onChange={(v) => onMaj({ [`${cle}Note`]: v })} />
                )}
              </div>
            ))}
            <p className="text-[11px] text-neutral-500">Meilleur degré atteint au cours de la séquence, puis valeur dans la plage.</p>
          </div>
        )}
      </Bloc>
    </div>
  );
}

// typeBac : type de la classe. eleves : liste triée ; noteSuivi(numero) -> note de suivi /20 ;
// bac : { [numero]: saisie } ; retenue : { [numero]: "suivi" | "bac" } ; onMaj(numero, patch) ;
// onRetenue(numero, choix) ; exclus : numéros exclus ; desactive : notes figées.
export default function NoteBacMuscu({ typeBac, eleves, noteSuivi, bac, retenue, onMaj, onRetenue, exclus, desactive }) {
  const [ouvert, setOuvert] = useState(null);
  if (!typeBac) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Note du bac</p>
        <p className="text-xs text-neutral-600 mt-1">Choisis d'abord le type d'évaluation de la classe (Bac GT ou Bac Pro), sous le nom de la classe.</p>
      </div>
    );
  }
  const gt = typeBac === "gt";
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-2">
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Note du bac — {gt ? "Bac général et technologique" : "Bac professionnel"}</p>
        <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
          Protocole du lycée : {gt ? "AFL 1 /12 (élément 1 /8 + élément 2 /4) + AFL 2 et AFL 3 /8, points fixes." : "AFLP 1 /7 + AFLP 2 /5 + AFLP 3 et AFLP 5 /8, plages de points."}{" "}
          Tu choisis les degrés ; la note de suivi de cycle reste calculée comme avant. Coche ensuite la note que tu retiens pour chaque élève.
        </p>
      </div>
      <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
        {eleves.filter((e) => !(exclus || []).includes(e.numero)).map((e) => {
          const s = bac?.[e.numero] || {};
          const res = calculerNoteBacMuscu(typeBac, s);
          const suivi = noteSuivi(e.numero);
          const choix = retenue?.[e.numero] || null;
          const estOuvert = ouvert === e.numero;
          return (
            <div key={e.numero} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setOuvert(estOuvert ? null : e.numero)} className="flex-1 flex items-center gap-1.5 text-left">
                  {estOuvert ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                  <span className="text-xs font-semibold text-neutral-900">{e.nom} {e.prenom}</span>
                </button>
                <label className={`flex items-center gap-1 text-[11px] ${choix === "suivi" ? "font-black text-orange-600" : "text-neutral-600"}`}>
                  <input type="radio" name={`retenue-${e.numero}`} checked={choix === "suivi"} disabled={desactive || suivi == null} onChange={() => onRetenue(e.numero, "suivi")} className="accent-orange-500" />
                  Suivi {fmt(suivi)}
                </label>
                <label className={`flex items-center gap-1 text-[11px] ${choix === "bac" ? "font-black text-orange-600" : "text-neutral-600"}`}>
                  <input type="radio" name={`retenue-${e.numero}`} checked={choix === "bac"} disabled={desactive || res.total == null} onChange={() => onRetenue(e.numero, "bac")} className="accent-orange-500" />
                  Bac {fmt(res.total)}
                </label>
              </div>
              {estOuvert && (
                <>
                  <p className="text-[11px] text-neutral-500 mt-1">Bac : {fmt(res.fin)}/12 + {fmt(res.fil)}/8 = <b>{fmt(res.total)}/20</b></p>
                  <Editeur typeBac={typeBac} saisie={s} desactive={desactive} onMaj={(patch) => onMaj(e.numero, patch)} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { calculerNoteBacMuscu };
