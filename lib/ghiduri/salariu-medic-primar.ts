/**
 * Ghid: salariul medicului specialist și al medicului primar în proiectul legii salarizării (Anexa II, cap. I,
 * unități sanitare). Rândurile se potrivesc între variante pe cod (21.00201003.01.1 = specialist,
 * 21.00201001.01.1 = primar); în 20 august gradul e în câmpul `grad` („Medic *1)”), înainte în denumire. Nota *1)
 * (se aplică și medicilor dentiști) și nota 1 (gradația 0, art. 13) sunt verificate în
 * public/sources/Proiect-COEFICIENTI-1-8-20-august-2026.xlsx (foaia „II CI 2”), ca în ghidul medicului rezident.
 */
import { VARIANTE, VARIANTA_IMPLICITA, getVarianta, type Varianta } from "../variants";
import { getFunctii, type CoefEntry } from "../variants-data";
import { aplicaGradatie, calcBrut, GRADATII, SAL_MIN_BRUT } from "../tax";
import { SITE_URL } from "../seo";
import type { Ghid } from "./tip";

const lei = (n: number) => n.toLocaleString("ro-RO");
const coef = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 6 });

const COD_SPECIALIST = "21.00201003.01.1";
const COD_PRIMAR = "21.00201001.01.1";
const rand = (id: Varianta["id"], cod: string): CoefEntry | undefined =>
  getFunctii(id).find((e) => e.anexa === "II" && e.capitol === "CI 2" && e.cod === cod && e.coeficient > 0);

const baza = (c: number, v: Varianta, g = 0) => aplicaGradatie(c * v.valoareReferinta, g);
const net = (brut: number, v: Varianta) => calcBrut({ salariuBaza: brut, sporuri: [], valoareReferinta: v.valoareReferinta }).salariuNet;

export function ghid(): Ghid {
  const v = getVarianta(VARIANTA_IMPLICITA);
  const spec = rand(v.id, COD_SPECIALIST);
  const primar = rand(v.id, COD_PRIMAR);
  if (!spec || !primar) throw new Error(`ghid medic primar: lipsesc rândurile de medic specialist/primar în ${v.id}`);
  if (primar.coeficient <= spec.coeficient) throw new Error("ghid medic primar: primarul nu are coeficient mai mare decât specialistul");

  const bS = baza(spec.coeficient, v);
  const bP = baza(primar.coeficient, v);
  const nS = net(bS, v);
  const nP = net(bP, v);
  const gMax = GRADATII.length - 1;
  const diferenta = bP - bS;
  const procent = Math.round((primar.coeficient / spec.coeficient - 1) * 100);

  const tabelFunctii = [
    ["Medic specialist", spec, bS, nS],
    ["Medic primar", primar, bP, nP],
  ]
    .map(([nume, e, b, n]) => `| ${nume as string} | ${coef((e as CoefEntry).coeficient)} | ${lei(b as number)} | ${lei(n as number)} |`)
    .join("\n");

  const grad = GRADATII.map((g) => {
    const s = baza(spec.coeficient, v, g.nivel);
    const p = baza(primar.coeficient, v, g.nivel);
    return `| ${g.nivel} | ${g.numeRange} | ${g.cota ? `+${g.cota.toLocaleString("ro-RO")}%` : "—"} | ${lei(s)} | ${lei(p)} | ${lei(net(p, v))} |`;
  }).join("\n");

  // comparația între variante, pe cod
  const comparatie = ([["Medic specialist", COD_SPECIALIST], ["Medic primar", COD_PRIMAR]] as const)
    .map(([nume, cod]) => {
      const cel = VARIANTE.map((x) => {
        const r = rand(x.id, cod);
        return r ? `${lei(baza(r.coeficient, x))} (${coef(r.coeficient)} × ${lei(x.valoareReferinta)})` : "—";
      });
      return `| ${nume} | ${cel.join(" | ")} |`;
    })
    .join("\n");
  const idx = VARIANTE.findIndex((x) => x.id === v.id);
  const ant = idx > 0 ? VARIANTE[idx - 1]! : null;
  const rAntS = ant ? rand(ant.id, COD_SPECIALIST) : undefined;
  const rAntP = ant ? rand(ant.id, COD_PRIMAR) : undefined;
  const frazaVariante =
    ant && rAntS && rAntP
      ? `Coeficienții ${rAntS.coeficient === spec.coeficient && rAntP.coeficient === primar.coeficient ? "au rămas aceiași" : "s-au schimbat"} față de varianta din ${ant.eticheta}, dar valoarea de referință ${ant.valoareReferinta === v.valoareReferinta ? `a rămas ${lei(v.valoareReferinta)} lei` : `a trecut de la ${lei(ant.valoareReferinta)} la ${lei(v.valoareReferinta)} lei`}. Rezultatul: salariul de bază al unui medic specialist ${baza(rAntS.coeficient, ant) === bS ? "e același" : `${bS < baza(rAntS.coeficient, ant) ? "scade" : "crește"} de la ${lei(baza(rAntS.coeficient, ant))} la ${lei(bS)} lei`}, iar al unui medic primar ${baza(rAntP.coeficient, ant) === bP ? "e același" : `${bP < baza(rAntP.coeficient, ant) ? "scade" : "crește"} de la ${lei(baza(rAntP.coeficient, ant))} la ${lei(bP)} lei`}.`
      : "";

  const pragDeducere = SAL_MIN_BRUT + 2000;
  const raspuns = `În proiectul legii salarizării din ${v.eticheta}, un medic specialist ar avea salariul de bază de ${lei(bS)} lei brut (${lei(nS)} lei net), iar un medic primar ${lei(bP)} lei brut (${lei(nP)} lei net), la gradația 0, fără gărzi și sporuri, într-un spital de categoria a II-a. Proiectul nu a fost adoptat.`;

  const corp = `## Cât ar fi salariul unui medic primar pe noua lege?
Un medic primar ar avea un salariu de bază de **${lei(bP)} lei brut pe lună** în varianta din ${v.eticheta} a proiectului, adică ${lei(nP)} lei net fără sporuri și fără persoane în întreținere. Suma vine din coeficientul ${coef(primar.coeficient)} înmulțit cu valoarea de referință de ${lei(v.valoareReferinta)} lei (${v.articolValoareReferinta}), cu rotunjire în sus la leu (art. 10 alin. (4) din proiect).

Un medic specialist ar avea ${lei(bS)} lei brut, cu coeficientul ${coef(spec.coeficient)}. Diferența dintre cele două grade este de ${lei(diferenta)} lei brut pe lună, adică ${procent}% în plus pentru gradul de primar. Cifrele sunt la gradația 0, fără gărzi, fără sporuri și fără gradațiile din vechimea în muncă.

## Unde stau medicul specialist și medicul primar în grilă?
Medicii sunt în Anexa II a proiectului (familia ocupațională „Sănătate și asistență socială”), capitolul I, la personalul de specialitate medico-sanitar din unitățile sanitare. Gradul profesional (specialist sau primar) alege rândul din grilă. Nota *1) de sub grilă precizează că aceiași coeficienți se aplică și medicilor dentiști; în variantele din 25 mai și 17 iulie, medicii dentiști aveau rânduri separate, cu aceiași coeficienți.

**Important:** în varianta din 20 august, coeficienții din grilă sunt cei pentru unitățile sanitare de **categoria a II-a**. Proiectul împarte unitățile în 6 categorii și adaugă factori de multiplicare pe grupe de personal (minimum 8%, 6%, 4% și 2%), stabiliți anual prin hotărâre de guvern. Până la acea hotărâre, salariul unui medic dintr-un spital de altă categorie nu poate fi calculat: cifrele de aici sunt pentru categoria a II-a.

## Cât câștigă un medic specialist și un medic primar, comparat?
Salariul de bază la gradația 0 și netul, varianta din ${v.eticheta}:

| Funcția | Coeficient | Salariu de bază (lei) | Net (lei) |
${tabelFunctii}

Netul din tabel folosește regulile fiscale de azi: 25% CAS, 10% CASS și 10% impozit pe venit, fără persoane în întreținere. Ambele salarii sunt peste salariul minim brut de ${lei(SAL_MIN_BRUT)} lei și peste pragul de ${lei(pragDeducere)} lei până la care se acordă deducerea personală (art. 77 din Codul fiscal), deci netul nu depinde de persoanele în întreținere.

## Cât contează vechimea în muncă?
Nota 1 de sub grilă spune că acești coeficienți sunt pentru gradația 0, iar salariile pentru gradațiile 1–5 se obțin prin majorare potrivit art. 13 din proiect. Gradația vine din vechimea în muncă, nu din gradul de specialist sau primar: +7,5% după 3 ani, apoi câte +5%, +5%, +2,5% și +2,5%.

| Gradația | Vechime în muncă | Creștere | Specialist, brut (lei) | Primar, brut (lei) | Primar, net (lei) |
${grad}

Cu gradația maximă, un medic specialist ar ajunge la ${lei(baza(spec.coeficient, v, gMax))} lei brut, iar un medic primar la ${lei(baza(primar.coeficient, v, gMax))} lei brut. Gradul (specialist sau primar) schimbă coeficientul din grilă; vechimea în muncă adaugă gradația peste el. Sunt două lucruri diferite și se cumulează.

## Ce s-a schimbat între cele trei variante ale proiectului?
Ministerul Muncii a publicat trei variante: ${VARIANTE.map((x) => `${x.eticheta} (valoarea de referință ${lei(x.valoareReferinta)} lei)`).join(", ")}. Salariul de bază la gradația 0, cu coeficientul și valoarea de referință în paranteză:

| Funcția | ${VARIANTE.map((x) => x.eticheta).join(" | ")} |
${comparatie}

Rândurile sunt potrivite între variante după codul funcției din grilă. ${frazaVariante}

## Ce se adaugă peste salariul de bază?
Gărzile și sporurile specifice sănătății sunt în Anexa II, capitolul II. Gărzile pentru completarea normei se plătesc la tariful orar al salariului de bază, iar gărzile peste norma legală se fac prin contract separat. Pe lângă ele: munca în trei ture (10%, în afara plafonului), orele din weekend și de sărbători (+10% din tariful orar), sporurile pentru condiții de muncă și sporul pentru radiații, pe categorii. Le poți adăuga pe cele pe care le ai în [calculator](/), cu orele tale de gardă.

Plafonul de 20% al sporurilor se calculează pe ordonatorul principal de credite, nu pe fiecare angajat (art. 21 alin. (2)). Dacă salariul pe legea nouă ar ieși mai mic decât cel de acum, proiectul prevede o diferență salarială tranzitorie (${v.articolDiferentaTranzitorie} în varianta din ${v.eticheta}), raportată la salariul din ${v.referintaDiferentaTranzitorie}. Salariile plătite azi în spitale, pe Legea 153/2017, sunt pe [romaniatransparenta.eu/registre/spitale/salarii](https://romaniatransparenta.eu/registre/spitale/salarii). Pentru medicii aflați la început de drum, vezi [ghidul medicului rezident](/ghiduri/salariu-medic-rezident).

> Atenție: legea nu a fost adoptată. Pe 26 august 2026 partidele au anunțat că nu au ajuns la consens și s-au angajat să adopte legea până la sfârșitul anului. Cifrele de mai sus arată ce prevede proiectul, nu salariile în vigoare.`;

  return {
    slug: "salariu-medic-primar",
    categorie: "Ghid",
    titlu: "Salariu medic primar și medic specialist pe noua lege: cât ar fi",
    titluMeta: "Salariu medic primar pe noua lege: cât ar fi, cu net",
    descriere: `Salariul medicului primar în proiectul din ${v.eticheta}: ${lei(bP)} lei brut, față de ${lei(bS)} lei la medicul specialist, cu net, gradații și variante.`,
    cuvantCheie: "salariu medic primar",
    raspuns,
    peScurt: [
      `Medic primar: ${lei(bP)} lei brut, ${lei(nP)} lei net, fără gărzi și sporuri.`,
      `Medic specialist: ${lei(bS)} lei brut, ${lei(nS)} lei net; primarul are ${procent}% în plus.`,
      `Cu gradația maximă (vechime în muncă): specialist ${lei(baza(spec.coeficient, v, gMax))} lei, primar ${lei(baza(primar.coeficient, v, gMax))} lei brut.`,
      `Coeficienții din ${v.eticheta} sunt pentru spitalele de categoria a II-a; celelalte categorii depind de o hotărâre de guvern.`,
      `Valoarea de referință din ${v.eticheta}: ${lei(v.valoareReferinta)} lei (${v.articolValoareReferinta}).`,
    ],
    publicat: "2026-11-13",
    actualizat: "2026-11-13",
    corp,
    faq: [
      {
        q: "Cât ar câștiga un medic primar pe noua lege?",
        a: `În varianta din ${v.eticheta}, ${lei(bP)} lei brut pe lună (${lei(nP)} lei net) la gradația 0, fără gărzi și sporuri, într-un spital de categoria a II-a. Proiectul nu a fost adoptat.`,
      },
      {
        q: "Cât ar câștiga un medic specialist?",
        a: `În aceeași variantă, ${lei(bS)} lei brut pe lună (${lei(nS)} lei net) la gradația 0. Medicul primar are ${lei(diferenta)} lei mai mult pe lună, din coeficientul mai mare al gradului.`,
      },
      {
        q: "Medicii dentiști au aceeași grilă?",
        a: `Da. În varianta din ${v.eticheta}, nota *1) de sub grilă spune că rândurile de medic se aplică și medicilor dentiști. În variantele din 25 mai și 17 iulie aveau rânduri separate, cu aceiași coeficienți.`,
      },
      {
        q: "Se pot calcula salariile medicilor din spitalele de altă categorie?",
        a: "Nu încă. Coeficienții din varianta din 20 august sunt pentru unitățile de categoria a II-a. Cele 6 categorii și factorii de multiplicare pe grupe se stabilesc prin hotărâre de guvern, care nu există.",
      },
      {
        q: "De când s-ar aplica noile salarii pentru medici?",
        a: `Nu încă. Proiectul nu a fost adoptat. Varianta din ${v.eticheta} prevede intrarea în vigoare pe ${v.intrareInVigoareText} (${v.articolIntrareInVigoare}), dar doar dacă legea e votată și promulgată.`,
      },
      {
        q: "Gărzile intră în salariul din tabel?",
        a: "Nu. Tabelele arată salariul de bază din grilă. Gărzile se plătesc separat, la tariful orar al salariului de bază, după regulile din Anexa II; în calculator le poți adăuga cu orele tale.",
      },
    ],
    surse: [
      ...v.surse.map((s) => ({ titlu: s.titlu, url: s.url.startsWith("/") ? `${SITE_URL}${s.url}` : s.url })),
      { titlu: "Anexa II, capitolul II: reglementări specifice sănătății (docx, copie locală)", url: `${SITE_URL}/sources/ANEXA-II-Cap-II-REGLEMENTARI-specifice-varianta-20-mai-2026.docx` },
      { titlu: "Codul fiscal, Legea 227/2015 (Portal legislativ)", url: "https://legislatie.just.ro/Public/DetaliiDocument/171282", nota: "art. 77 (deducerea personală), art. 78 (impozitul), art. 138 (CAS), art. 156 (CASS)" },
    ],
    legaturi: [
      ["/grila/sanatate-asistenta-sociala", "Grila completă a sănătății (Anexa II)"],
      ["/", "Calculatorul: salariul tău, cu gradație, gărzi, sporuri și net"],
      ["/ghiduri/salariu-medic-rezident", "Cât ar câștiga un medic rezident pe noua lege"],
    ],
  };
}
