/**
 * Ghid: salariul judecătorului și al procurorului în proiectul legii salarizării (Anexa V, justiție, cap. I A+B).
 * Rândurile se potrivesc între variante pe cod (51.001… = judecători, 51.002… = procurori); coeficienții magistraților
 * sunt aceiași în cele trei variante, diferă doar valoarea de referință. În Anexa V indemnizația de încadrare include
 * deja gradul, gradația și vechimea în funcție, deci gradațiile din art. 13 NU se mai adaugă (docs/verificare-calcule-2026-09-24.md,
 * aceeași excepție ca în calculator și în pagina /grila/justitie). Nu intră: sporurile, indemnizațiile de conducere
 * (doar menționate) și indemnizația de membru CSM (baza ei e marcată ca nereparată în documentul de verificare).
 */
import { VARIANTE, VARIANTA_IMPLICITA, getVarianta, type Varianta } from "../variants";
import { getFunctii, type CoefEntry } from "../variants-data";
import { aplicaGradatie, calcBrut, COEFICIENTI_CONDUCERE_JUSTITIE, SAL_MIN_BRUT } from "../tax";
import { SITE_URL } from "../seo";
import type { Ghid } from "./tip";

const lei = (n: number) => n.toLocaleString("ro-RO");
const coef = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 6 });

const baza = (c: number, v: Varianta) => aplicaGradatie(c * v.valoareReferinta, 0);
const net = (brut: number, v: Varianta) => calcBrut({ salariuBaza: brut, sporuri: [], valoareReferinta: v.valoareReferinta }).salariuNet;

/** rândurile unui cod-prefix din Anexa V, de la cea mai mare la cea mai mică vechime (coeficientul crește cu vechimea) */
const randuri = (id: Varianta["id"], prefix: string): CoefEntry[] =>
  getFunctii(id)
    .filter((e) => e.anexa === "V" && e.cod.startsWith(prefix) && e.coeficient > 0)
    .sort((a, b) => b.coeficient - a.coeficient);

const vechime = (e: CoefEntry) => e.vechime.replace(/^Baza\s+/i, "").trim().toLowerCase();

const INSTANTE = [
  { nume: "Judecător la Înalta Curte de Casație și Justiție", prefix: "51.00101001." },
  { nume: "Judecător la curtea de apel", prefix: "51.00101002." },
  { nume: "Judecător la tribunal", prefix: "51.00101003." },
  { nume: "Judecător la judecătorie", prefix: "51.00101004." },
  { nume: "Judecător stagiar", prefix: "51.00101005." },
] as const;

export function ghid(): Ghid {
  const v = getVarianta(VARIANTA_IMPLICITA);
  const VR = v.valoareReferinta;

  const inst = INSTANTE.map((x) => {
    const r = randuri(v.id, x.prefix);
    if (r.length < 2) throw new Error(`ghid judecător: prea puține rânduri pentru ${x.nume}`);
    const sus = r[0]!;
    const jos = r[r.length - 1]!;
    return { ...x, sus, jos, bSus: baza(sus.coeficient, v), bJos: baza(jos.coeficient, v) };
  });
  const [iccj, curte, tribunal, judecatorie, stagiar] = inst as [(typeof inst)[number], (typeof inst)[number], (typeof inst)[number], (typeof inst)[number], (typeof inst)[number]];

  const pJud = randuri(v.id, "51.00201004.");
  if (pJud.length < 2) throw new Error("ghid judecător: lipsesc rândurile procurorului la parchetul de pe lângă judecătorie");
  const jJud = randuri(v.id, "51.00101004.");
  const procSus = pJud[0]!;
  const procJos = pJud[pJud.length - 1]!;

  // tabelul pe vechime la judecătorie: judecător și procuror, pe același interval de vechime
  const tabelVechime = jJud
    .map((j) => {
      const p = pJud.find((x) => vechime(x) === vechime(j));
      const bj = baza(j.coeficient, v);
      return `| ${vechime(j)} | ${coef(j.coeficient)} | ${lei(bj)} | ${lei(net(bj, v))} | ${p ? lei(baza(p.coeficient, v)) : "—"} |`;
    })
    .join("\n");
  if (!jJud.every((j) => pJud.some((p) => vechime(p) === vechime(j)))) throw new Error("ghid judecător: vechimile judecătorului și procurorului nu se potrivesc");

  const tabelInstante = inst
    .map((x) => `| ${x.nume} | ${vechime(x.jos)}: ${lei(x.bJos)} | ${vechime(x.sus)}: ${lei(x.bSus)} | ${lei(net(x.bSus, v))} |`)
    .join("\n");

  // comparația între variante (același cod, aceiași coeficienți, altă valoare de referință)
  const COD_CMP = [
    ["Judecător stagiar, la început (0–3 ani)", "51.00101005.01.1"],
    ["Judecător la judecătorie, la început (0–3 ani)", "51.00101004.01.6"],
    ["Judecător la judecătorie, peste 20 de ani", "51.00101004.01.1"],
    ["Judecător la ÎCCJ, peste 20 de ani", "51.00101001.01.1"],
  ] as const;
  const comparatie = COD_CMP.map(([nume, cod]) => {
    const celule = VARIANTE.map((x) => {
      const r = getFunctii(x.id).find((e) => e.anexa === "V" && e.cod === cod && e.coeficient > 0);
      return r ? `${lei(baza(r.coeficient, x))} (${coef(r.coeficient)} × ${lei(x.valoareReferinta)})` : "—";
    });
    return `| ${nume} | ${celule.join(" | ")} |`;
  }).join("\n");

  const maxIccj = iccj.bSus;
  const prez = COEFICIENTI_CONDUCERE_JUSTITIE.find((c) => c.id === "iccj-pres");
  if (!prez) throw new Error("ghid judecător: lipsește coeficientul de conducere ÎCCJ");
  const bPrez = maxIccj + Math.ceil(prez.coef * VR);

  const subMinim = [...inst.map((x) => x.bJos), baza(procJos.coeficient, v)].filter((b) => b < SAL_MIN_BRUT).length;
  const diferentaProc = baza(jJud[0]!.coeficient, v) - baza(procSus.coeficient, v);

  const raspuns = `În proiectul legii salarizării din ${v.eticheta}, un judecător de judecătorie ar avea indemnizația de încadrare între ${lei(judecatorie.bJos)} lei brut, la început de carieră, și ${lei(judecatorie.bSus)} lei brut, după 20 de ani de vechime, calculată cu o valoare de referință de ${lei(VR)} lei. Judecătorii mai sus în ierarhie au mai mult. Proiectul nu a fost adoptat.`;

  const atentie = `> Atenție: legea nu a fost adoptată. Pe 26 august 2026 partidele au anunțat că nu au ajuns la consens și s-au angajat să adopte legea până la sfârșitul anului. Cifrele din acest ghid arată ce prevede proiectul, nu ce se plătește azi.`;

  const corp = `## Cât ar câștiga un judecător pe noua lege?
În varianta din ${v.eticheta} a proiectului, indemnizația de încadrare brută a unui judecător de judecătorie pornește de la ${lei(judecatorie.bJos)} lei pe lună și ajunge la ${lei(judecatorie.bSus)} lei la peste 20 de ani de vechime. La ultima treaptă, netul calculat (fără sporuri) este de ${lei(net(judecatorie.bSus, v))} lei. Un judecător stagiar pornește de la ${lei(stagiar.bJos)} lei brut, iar cel mai bine plătit rând din grilă, judecătorul la Înalta Curte de Casație și Justiție cu peste 20 de ani de vechime, are ${lei(iccj.bSus)} lei brut.

Pentru magistrați, grila Anexei V nu vorbește despre „salariu de bază”, ci despre indemnizația de încadrare lunară. Se calculează la fel: coeficientul de pe rând înmulțit cu valoarea de referință (${lei(VR)} lei), rotunjit în sus la leu.

${atentie}

## Cât ar câștiga un judecător, în funcție de instanță?
Instanța decide familia de rânduri, iar vechimea alege rândul în interiorul ei. Tabelul arată, pentru fiecare instanță, cea mai mică și cea mai mare indemnizație de încadrare din grilă, în lei brut pe lună, și netul calculat pentru cea mai mare:

| Funcția | Cea mai mică treaptă de vechime (lei brut) | Cea mai mare treaptă de vechime (lei brut) | Net la cea mai mare (lei) |
|---|---|---|---|
${tabelInstante}

Treptele de vechime nu sunt aceleași la toate instanțele: la curtea de apel grila începe de la ${vechime(curte.jos)}, la tribunal de la ${vechime(tribunal.jos)}, iar la judecătorie de la începutul carierei. Pentru fiecare funcție, grila din [calculator](/grila/justitie) arată rândurile exacte.

## Cum se schimbă indemnizația cu vechimea?
La judecătorie sunt șase trepte de vechime. Coeficientul crește de la ${coef(jJud[jJud.length - 1]!.coeficient)} la început până la ${coef(jJud[0]!.coeficient)} după 20 de ani. Iată rândurile, pentru judecător și pentru procurorul de la parchetul de pe lângă judecătorie, în lei brut pe lună:

| Vechime | Coeficient (judecător) | Judecător, brut (lei) | Judecător, net (lei) | Procuror, brut (lei) |
|---|---|---|---|---|
${tabelVechime}

Netul din tabel este calculat cu regulile fiscale din calculator, fără sporuri și fără deduceri personale suplimentare. Cifra din fluturaș poate fi alta.

## Se adaugă gradații peste indemnizația de încadrare?
Nu. În Anexa V, indemnizația de încadrare include deja gradul, gradația și vechimea în funcție, așa că gradațiile de vechime în muncă, cele care la alte anexe majorează salariul de bază în trepte, nu se mai adaugă. Vechimea contează tot, dar prin rândul grilei în care te afli, nu printr-un procent peste el. Calculatorul aplică aceeași excepție.

## Procurorii câștigă la fel ca judecătorii?
Aproape. Pe aceleași instanțe, rândurile procurorilor au coeficienți ușor mai mici: la parchetul de pe lângă judecătorie, procurorul are la peste 20 de ani ${lei(baza(procSus.coeficient, v))} lei brut, față de ${lei(baza(jJud[0]!.coeficient, v))} lei la judecător, adică ${lei(diferentaProc)} lei mai puțin. Procurorii de la Parchetul de pe lângă ÎCCJ, DNA și DIICOT au un rând propriu, cu coeficienți mai mari decât ai colegilor de la parchetele inferioare. Procurorul stagiar pornește de la ${lei(baza(randuri(v.id, "51.00201005.").pop()!.coeficient, v))} lei brut.

## Ce se adaugă pentru funcțiile de conducere?
Anexa V prevede un coeficient suplimentar pentru funcțiile de conducere din instanțe și parchete. Se adaugă la indemnizația maximă a judecătorului de la ÎCCJ, înmulțit cu valoarea de referință. Exemplu din calculator: la președintele ÎCCJ și procurorul general al Parchetului de pe lângă ÎCCJ, coeficientul suplimentar este ${coef(prez.coef)}, deci indemnizația ar fi ${lei(maxIccj)} + ${lei(Math.ceil(prez.coef * VR))} = ${lei(bPrez)} lei brut pe lună. Pentru restul funcțiilor de conducere (vicepreședinți, președinți de secție, procurori-șefi) alege funcția în [calculator](/), care aplică coeficientul fiecăreia.

## Cum diferă cele trei variante ale proiectului?
Coeficienții magistraților sunt aceiași în variantele din 25 mai, 17 iulie și 20 august 2026. Diferă doar valoarea de referință: ${VARIANTE.map((x) => `${lei(x.valoareReferinta)} lei (${x.eticheta})`).join(", ")}. Indemnizațiile scad deci în varianta din august, proporțional cu valoarea de referință:

| Funcția | ${VARIANTE.map((x) => x.eticheta).join(" | ")} |
|---|---|---|---|
${comparatie}

Rândurile care nu există cu același cod în una dintre variante (la 25 mai, treapta de început de la judecătorie nu are corespondent) apar cu „—”; pe ele nu comparăm.

## Ce nu intră în aceste cifre?
Tabelele arată doar indemnizația de încadrare din grilă. Nu intră sporurile din Anexa V (de exemplu majorarea pe durata delegării în penitenciar), indemnizația de membru al CSM și titlul științific de doctor. ${subMinim > 0 ? `${lei(subMinim)} dintre rândurile de început din tabele ies sub salariul minim brut (${lei(SAL_MIN_BRUT)} lei); în acel caz se plătește salariul minim.` : `Niciun rând din tabele nu iese sub salariul minim brut pe țară (${lei(SAL_MIN_BRUT)} lei).`} Nu publicăm indemnizații pe legea în vigoare: nu avem grila actuală în date, deci nu comparăm proiectul cu ce se plătește azi și nu calculăm procente de creștere.

## Greșeli frecvente când citești indemnizațiile magistraților
- **Adaugi gradații peste grilă:** la Anexa V vechimea e deja în rând; o a doua majorare dublează efectul.
- **Compari brutul cu netul:** cifrele din grilă sunt brute; netul depinde de reguli fiscale și de situația personală.
- **Iei treapta de început drept indemnizația unui magistrat cu vechime:** la judecătorie, între începutul carierei și 20 de ani de vechime sunt ${lei(judecatorie.bSus - judecatorie.bJos)} de lei brut pe lună.
- **Confunzi proiectul cu legea:** nicio cifră de aici nu se aplică înainte ca legea să fie adoptată și promulgată.

${atentie}

Actualizat la 24 noiembrie 2026.`;

  return {
    slug: "salariu-judecator",
    categorie: "Ghid",
    titlu: "Salariu judecător pe noua lege: cât ar fi, pe instanțe și vechime",
    titluMeta: "Salariu judecător pe noua lege, pe instanțe și vechime",
    descriere: `Salariu judecător în proiectul noii legi: de la ${lei(stagiar.bJos)} lei brut (stagiar) la ${lei(iccj.bSus)} lei (ÎCCJ), pe instanțe și vechime, cu net calculat. Proiectul nu a fost adoptat.`,
    cuvantCheie: "salariu judecator",
    raspuns,
    peScurt: [
      `Varianta din ${v.eticheta}: judecător de judecătorie între ${lei(judecatorie.bJos)} și ${lei(judecatorie.bSus)} lei brut pe lună, după vechime; la ÎCCJ, ${lei(iccj.bSus)} lei brut la peste 20 de ani.`,
      `Indemnizația de încadrare = coeficientul din Anexa V × valoarea de referință (${lei(VR)} lei), rotunjit în sus.`,
      "La Anexa V vechimea e inclusă în rândul grilei: gradațiile nu se mai adaugă peste indemnizație.",
      "Coeficienții magistraților sunt la fel în toate cele trei variante; se schimbă doar valoarea de referință.",
      "Legea nu a fost adoptată; sporurile și indemnizațiile de conducere nu sunt incluse în tabele.",
    ],
    publicat: "2026-11-24",
    actualizat: "2026-11-24",
    corp,
    faq: [
      {
        q: "Cât ar câștiga un judecător pe noua lege a salarizării?",
        a: `În varianta din ${v.eticheta}, un judecător de judecătorie ar avea între ${lei(judecatorie.bJos)} și ${lei(judecatorie.bSus)} lei brut pe lună, după vechime. Proiectul nu a fost adoptat.`,
      },
      {
        q: "Cât ar câștiga un judecător stagiar?",
        a: `La început de carieră, ${lei(stagiar.bJos)} lei brut pe lună în varianta din ${v.eticheta} (coeficient ${coef(stagiar.jos.coeficient)} × ${lei(VR)} lei), fără sporuri.`,
      },
      {
        q: "Cât ar câștiga un procuror?",
        a: `Aproape cât judecătorul, cu coeficienți ușor mai mici pe aceeași instanță. La parchetul de pe lângă judecătorie: de la ${lei(baza(procJos.coeficient, v))} la ${lei(baza(procSus.coeficient, v))} lei brut pe lună, în varianta din ${v.eticheta}.`,
      },
      {
        q: "Se adaugă gradații la indemnizația magistraților?",
        a: "Nu. În Anexa V, indemnizația de încadrare include deja gradul, gradația și vechimea în funcție, deci gradațiile de vechime în muncă nu se mai adaugă peste ea.",
      },
      {
        q: "Cât ar fi indemnizația președintelui ÎCCJ?",
        a: `În calculator, indemnizația maximă a judecătorului ÎCCJ (${lei(maxIccj)} lei) plus coeficientul suplimentar de conducere de ${coef(prez.coef)} × ${lei(VR)} lei, adică ${lei(bPrez)} lei brut pe lună în varianta din ${v.eticheta}.`,
      },
      {
        q: "Se pot compara aceste cifre cu salariile din prezent?",
        a: "Nu aici. Nu publicăm indemnizații pe legea în vigoare și nu calculăm procente de creștere. Pentru cifra exactă de azi, singura sursă sigură este decizia de salarizare a magistratului.",
      },
    ],
    surse: [
      ...v.surse.map((s) => ({ titlu: s.titlu, url: s.url.startsWith("/") ? `${SITE_URL}${s.url}` : s.url })),
      { titlu: "România Transparentă: grila de salarizare, justiție (Anexa V)", url: `${SITE_URL}/grila/justitie` },
      { titlu: "Codul fiscal, Legea 227/2015 (Portal legislativ)", url: "https://legislatie.just.ro/Public/DetaliiDocument/171282", nota: "art. 77 (deducerea personală), art. 78 (impozitul), art. 138 (CAS), art. 156 (CASS)" },
    ],
    legaturi: [
      ["/grila/justitie", "Grila completă a justiției (Anexa V)"],
      ["/", "Calculatorul: salariul tău, cu sporuri și net"],
      ["/ghiduri/salarii-bugetari-2026", "Salarii bugetari 2026, pe domenii"],
    ],
  };
}
