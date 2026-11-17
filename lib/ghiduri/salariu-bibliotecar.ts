/**
 * Ghid: salariul bibliotecarului în proiectul legii salarizării. Sursa: Anexa III (cultură), capitolul II,
 * „personalul din sistemul bibliotecilor publice”, două grupe: 1. biblioteci naționale sau de importanță națională
 * (cod 32.00201…), 2. alte biblioteci (cod 32.00202…). Verificat în foaia „III CII” din
 * public/sources/Proiect-COEFICIENTI-1-8-20-august-2026.xlsx; nota 2 de acolo: coeficienții de execuție sunt la
 * gradația 0, gradațiile 1–5 vin din art. 13. Rândurile se potrivesc între variante pe cod. În Anexa I (învățământ
 * și cercetare, cap. CI 4-5-6) există un rând „Bibliotecar” separat (cod 11.00601…), folosit doar ca trimitere.
 */
import { VARIANTE, VARIANTA_IMPLICITA, getVarianta, type Varianta } from "../variants";
import { getFunctii, type CoefEntry } from "../variants-data";
import { aplicaGradatie, calcBrut, GRADATII, SAL_MIN_BRUT } from "../tax";
import { SITE_URL } from "../seo";
import type { Ghid } from "./tip";

const lei = (n: number) => n.toLocaleString("ro-RO");
const coef = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 6 });

/** nivel de studii → codul rândului „debutant” (naționale, alte biblioteci) și codurile treptelor, de la cea mai înaltă la debutant */
const NIVELE = [
  { studii: "S", nume: "studii superioare (S)", nat: ["32.00201001.10.1", "32.00201001.10.2", "32.00201001.10.3", "32.00201001.10.4"], alt: ["32.00202001.10.1", "32.00202001.10.2", "32.00202001.10.3", "32.00202001.10.4"] },
  { studii: "SSD", nume: "studii superioare de scurtă durată (SSD)", nat: ["32.00201002.07.1", "32.00201002.07.2", "32.00201002.07.3", "32.00201002.07.4"], alt: ["32.00202002.07.1", "32.00202002.07.2", "32.00202002.07.3", "32.00202002.07.4"] },
  { studii: "PL", nume: "studii postliceale (PL)", nat: ["32.00201003.03.1", "32.00201003.03.2", "32.00201003.03.3", "32.00201003.03.4"], alt: ["32.00202003.03.1", "32.00202003.03.2", "32.00202003.03.3", "32.00202003.03.4"] },
  { studii: "M", nume: "studii medii (M)", nat: ["32.00201004.07.1", "32.00201004.07.2", "32.00201004.07.3", "32.00201004.07.4"], alt: ["32.00202004.07.1", "32.00202004.07.2", "32.00202004.07.3", "32.00202004.07.4"] },
] as const;

const rand = (id: Varianta["id"], cod: string): CoefEntry | undefined =>
  getFunctii(id).find((e) => e.anexa === "III" && e.capitol === "CII" && e.cod === cod && e.coeficient > 0);

const baza = (c: number, v: Varianta, g = 0) => aplicaGradatie(c * v.valoareReferinta, g);
const net = (brut: number, v: Varianta) => calcBrut({ salariuBaza: brut, sporuri: [], valoareReferinta: v.valoareReferinta }).salariuNet;

export function ghid(): Ghid {
  const v = getVarianta(VARIANTA_IMPLICITA);
  const need = (cod: string) => {
    const r = rand(v.id, cod);
    if (!r) throw new Error(`ghid bibliotecar: lipsește rândul ${cod} în ${v.id}`);
    return r;
  };
  // treaptele fiecărui nivel, în ordinea codurilor (I A / I / II / debutant); tabelele afișează treapta din grilă
  const tabel = (lista: "nat" | "alt") =>
    NIVELE.flatMap((n) =>
      n[lista].map((cod) => {
        const r = need(cod);
        const b = baza(r.coeficient, v);
        return `| ${n.studii} | ${r.vechime || r.grad} | ${coef(r.coeficient)} | ${lei(b)} | ${lei(net(b, v))} |`;
      }),
    ).join("\n");

  const deb = need("32.00202001.10.4"); // superior, debutant, alte biblioteci
  const debNat = need("32.00201001.10.4");
  const sus = need("32.00202001.10.1"); // superior, treapta cea mai înaltă, alte biblioteci
  const susNat = need("32.00201001.10.1");
  const pl = need("32.00202003.03.4"); // postliceal debutant, alte biblioteci
  const m = need("32.00202004.07.4"); // studii medii debutant, alte biblioteci
  const bDeb = baza(deb.coeficient, v);
  const bDebNat = baza(debNat.coeficient, v);
  const bSus = baza(sus.coeficient, v);
  const bSusNat = baza(susNat.coeficient, v);
  const bPl = baza(pl.coeficient, v);
  const bM = baza(m.coeficient, v);
  const nDeb = net(bDeb, v);
  const gMax = GRADATII.length - 1;
  if (bDeb < SAL_MIN_BRUT || bM < SAL_MIN_BRUT) throw new Error("ghid bibliotecar: un salariu de bază sub salariul minim, textul ar trebui schimbat");

  const grad = GRADATII.map((g) => {
    const d = baza(deb.coeficient, v, g.nivel);
    const s = baza(sus.coeficient, v, g.nivel);
    return `| ${g.nivel} | ${g.numeRange} | ${g.cota ? `+${g.cota.toLocaleString("ro-RO")}%` : "—"} | ${lei(d)} | ${lei(s)} | ${lei(net(s, v))} |`;
  }).join("\n");

  // comparația între variante, pe cod: debutant cu studii superioare și treapta cea mai înaltă, la alte biblioteci
  const cmp = ([["Superior, debutant", "32.00202001.10.4"], ["Superior, treapta cea mai înaltă", "32.00202001.10.1"], ["Studii medii, debutant", "32.00202004.07.4"]] as const)
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
  const rAnt = ant ? rand(ant.id, "32.00202001.10.4") : undefined;
  const frazaVariante =
    ant && rAnt
      ? `La rândul „superior, debutant”, coeficientul ${rAnt.coeficient === deb.coeficient ? "a rămas același" : "s-a schimbat"} față de varianta din ${ant.eticheta}, iar valoarea de referință ${ant.valoareReferinta === v.valoareReferinta ? `a rămas ${lei(v.valoareReferinta)} lei` : `a trecut de la ${lei(ant.valoareReferinta)} la ${lei(v.valoareReferinta)} lei`}. Salariul de bază la acest rând ${baza(rAnt.coeficient, ant) === bDeb ? "e același" : `${bDeb < baza(rAnt.coeficient, ant) ? "scade" : "crește"} de la ${lei(baza(rAnt.coeficient, ant))} la ${lei(bDeb)} lei`}.`
      : "";

  // rândul din Anexa I, doar ca trimitere
  const anexaI = getFunctii(v.id).find((e) => e.anexa === "I" && e.cod === "11.00601001.02.4" && e.coeficient > 0);
  const bAnexaI = anexaI ? baza(anexaI.coeficient, v) : null;

  const pragDeducere = SAL_MIN_BRUT + 2000;
  const raspuns = `În proiectul legii salarizării din ${v.eticheta}, un bibliotecar cu studii superioare, debutant, la o bibliotecă publică din categoria „alte biblioteci”, ar avea salariul de bază de ${lei(bDeb)} lei brut (${lei(nDeb)} lei net), la gradația 0 și fără sporuri. Cu studii medii, debutant: ${lei(bM)} lei brut. Proiectul nu a fost adoptat.`;

  const corp = `## Cât ar câștiga un bibliotecar pe noua lege?
Un bibliotecar cu studii superioare, la început de carieră, ar avea **${lei(bDeb)} lei brut pe lună** în varianta din ${v.eticheta} a proiectului, adică ${lei(nDeb)} lei net, fără sporuri și fără persoane în întreținere. Suma vine din coeficientul ${coef(deb.coeficient)} înmulțit cu valoarea de referință de ${lei(v.valoareReferinta)} lei (${v.articolValoareReferinta}), cu rotunjire în sus la leu (art. 10 alin. (4) din proiect).

Cu treapta cea mai înaltă pentru studii superioare, salariul de bază ar fi de ${lei(bSus)} lei brut (coeficientul ${coef(sus.coeficient)}). Un bibliotecar cu studii postliceale, debutant, ar avea ${lei(bPl)} lei brut, iar unul cu studii medii ${lei(bM)} lei brut. Toate cifrele sunt la gradația 0, fără gradațiile din vechimea în muncă.

## Unde sunt bibliotecarii în grila proiectului?
Bibliotecile publice sunt în Anexa III a proiectului (familia ocupațională „Cultură”), capitolul II, „personalul din sistemul bibliotecilor publice din România”. Capitolul are două grupe, cu coeficienți diferiți: 1. bibliotecile naționale sau de importanță națională, plus Biblioteca Academiei Române și Institutul Național de Cercetare și Formare în Cultură; 2. celelalte biblioteci. Rândul tău depinde de grupa în care se află biblioteca la care lucrezi, de nivelul studiilor și de gradul sau treapta profesională.

Aceeași funcție apare și în Anexa I (învățământ și cercetare)${bAnexaI !== null && anexaI ? `, cu alți coeficienți: de exemplu ${lei(bAnexaI)} lei brut pentru funcția de bibliotecar cu studii superioare, debutant (coeficientul ${coef(anexaI.coeficient)})` : ""}. Rândul din Anexa I se aplică în unitățile din acea anexă, nu în bibliotecile publice din Anexa III.

## Cât ar fi salariul pe grupe de biblioteci, studii și trepte?
Salariul de bază la gradația 0 și netul pentru fiecare treaptă, în varianta din ${v.eticheta}. Primul tabel este pentru „alte biblioteci”, al doilea pentru bibliotecile naționale sau de importanță națională.

### Alte biblioteci

| Studii | Gradul / treapta | Coeficient | Salariu de bază (lei) | Net (lei) |
${tabel("alt")}

### Biblioteci naționale sau de importanță națională

| Studii | Gradul / treapta | Coeficient | Salariu de bază (lei) | Net (lei) |
${tabel("nat")}

Pentru studii superioare, debutant, o bibliotecă națională sau de importanță națională ar plăti ${lei(bDebNat)} lei brut față de ${lei(bDeb)} lei la „alte biblioteci”, iar la treapta cea mai înaltă ${lei(bSusNat)} lei față de ${lei(bSus)} lei. Netul din tabele folosește regulile fiscale de azi: 25% CAS, 10% CASS și 10% impozit pe venit, fără persoane în întreținere. Toate salariile din tabele sunt peste salariul minim brut de ${lei(SAL_MIN_BRUT)} lei și peste pragul de ${lei(pragDeducere)} lei până la care se acordă deducerea personală (art. 77 din Codul fiscal), deci netul nu depinde de persoanele în întreținere.

## Cât contează vechimea în muncă?
Nota 2 din capitolul II spune că acești coeficienți sunt pentru gradația 0, iar salariile pentru gradațiile 1–5 se obțin prin majorarea lor potrivit art. 13 din proiect. Gradația vine din vechimea în muncă, nu din gradul sau treapta profesională: +7,5% după 3 ani, apoi câte +5%, +5%, +2,5% și +2,5%, aplicate succesiv.

Exemplu pentru „alte biblioteci”, cu studii superioare:

| Gradația | Vechime în muncă | Creștere | Debutant, brut (lei) | Treapta cea mai înaltă, brut (lei) | Treapta cea mai înaltă, net (lei) |
${grad}

Cu gradația maximă, un bibliotecar debutant ar ajunge la ${lei(baza(deb.coeficient, v, gMax))} lei brut, iar unul la treapta cea mai înaltă la ${lei(baza(sus.coeficient, v, gMax))} lei brut. Treapta profesională alege rândul din grilă; vechimea în muncă adaugă gradația peste el. Sunt două lucruri diferite și se cumulează.

## Ce s-a schimbat între cele trei variante ale proiectului?
Ministerul Muncii a publicat trei variante: ${VARIANTE.map((x) => `${x.eticheta} (valoarea de referință ${lei(x.valoareReferinta)} lei)`).join(", ")}. Salariul de bază la gradația 0 pentru trei rânduri din grupa „alte biblioteci”, cu coeficientul și valoarea de referință în paranteză:

| Funcția | ${VARIANTE.map((x) => x.eticheta).join(" | ")} |
${cmp}

Rândurile sunt potrivite între variante după codul funcției din grilă. ${frazaVariante}

## Ce se adaugă peste salariul de bază?
Tabelele arată doar salariul de bază din grilă. Sporurile se adaugă separat; pe cele din calculator le poți introduce în [calculator](/), cu procentul și condiția fiecăruia. Plafonul de 20% al sporurilor se calculează pe ordonatorul principal de credite, nu pe fiecare angajat (art. 21 alin. (2)). Dacă salariul pe legea nouă ar ieși mai mic decât cel de acum, proiectul prevede o diferență salarială tranzitorie (${v.articolDiferentaTranzitorie} în varianta din ${v.eticheta}), raportată la salariul din ${v.referintaDiferentaTranzitorie}.

Regulile specifice personalului din cultură sunt într-un capitol separat al Anexei III, a cărui copie locală e la sursele de mai jos. Pentru funcțiile din muzee și teatre, vezi [grila culturii](/grila/cultura).

> Atenție: legea nu a fost adoptată. Pe 26 august 2026 partidele au anunțat că nu au ajuns la consens și s-au angajat să adopte legea până la sfârșitul anului. Cifrele de mai sus arată ce prevede proiectul, nu salariile în vigoare.`;

  return {
    slug: "salariu-bibliotecar",
    categorie: "Ghid",
    titlu: "Salariu bibliotecar pe noua lege: cât ar fi, cu net și calculator",
    titluMeta: "Salariu bibliotecar pe noua lege: cât ar fi, cu net",
    descriere: `Salariul bibliotecarului în proiectul din ${v.eticheta}: de la ${lei(bM)} lei brut (studii medii) la ${lei(bSusNat)} lei brut, pe grupe de biblioteci și trepte.`,
    cuvantCheie: "salariu bibliotecar",
    raspuns,
    peScurt: [
      `Studii superioare, debutant, „alte biblioteci”: ${lei(bDeb)} lei brut, ${lei(nDeb)} lei net, fără sporuri.`,
      `Treapta cea mai înaltă, studii superioare: ${lei(bSus)} lei brut la „alte biblioteci”, ${lei(bSusNat)} lei la bibliotecile naționale.`,
      `Studii postliceale, debutant: ${lei(bPl)} lei brut; studii medii, debutant: ${lei(bM)} lei brut.`,
      `Cu gradația maximă (vechime în muncă), un debutant cu studii superioare ar avea ${lei(baza(deb.coeficient, v, gMax))} lei brut.`,
      `Valoarea de referință din ${v.eticheta}: ${lei(v.valoareReferinta)} lei (${v.articolValoareReferinta}).`,
    ],
    publicat: "2026-11-17",
    actualizat: "2026-11-17",
    corp,
    faq: [
      {
        q: "Cât ar câștiga un bibliotecar pe noua lege?",
        a: `În varianta din ${v.eticheta}, un bibliotecar cu studii superioare, debutant, la „alte biblioteci”, ar avea ${lei(bDeb)} lei brut pe lună (${lei(nDeb)} lei net) la gradația 0, fără sporuri. Proiectul nu a fost adoptat.`,
      },
      {
        q: "Cât câștigă un bibliotecar cu studii medii?",
        a: `În aceeași variantă, ${lei(bM)} lei brut pe lună la treapta debutant, la gradația 0, în grupa „alte biblioteci”. Treptele mai înalte au coeficienți mai mari; cifrele pe trepte sunt în tabelul din ghid.`,
      },
      {
        q: "Care e diferența dintre bibliotecile naționale și „alte biblioteci”?",
        a: "Capitolul II al Anexei III are două grupe de coeficienți. Grupa 1 cuprinde bibliotecile naționale sau de importanță națională, Biblioteca Academiei Române și Institutul Național de Cercetare și Formare în Cultură; grupa 2, celelalte biblioteci. Coeficienții din grupa 1 sunt mai mari.",
      },
      {
        q: "Gradația se adaugă la salariul din tabel?",
        a: "Da. Coeficienții din tabel sunt la gradația 0, iar gradațiile 1–5 se obțin prin majorarea lor conform art. 13 din proiect, după vechimea în muncă: +7,5% după 3 ani, apoi +5%, +5%, +2,5% și +2,5%.",
      },
      {
        q: "De când s-ar aplica noile salarii?",
        a: `Nu încă. Proiectul nu a fost adoptat. Varianta din ${v.eticheta} prevede intrarea în vigoare pe ${v.intrareInVigoareText} (${v.articolIntrareInVigoare}), dar doar dacă legea e votată și promulgată.`,
      },
    ],
    surse: [
      ...v.surse.map((s) => ({ titlu: s.titlu, url: s.url.startsWith("/") ? `${SITE_URL}${s.url}` : s.url })),
      { titlu: "Anexa III, capitolul VI: reglementări specifice personalului din cultură (docx, copie locală)", url: `${SITE_URL}/sources/Anexa-III-cap-VI-20-mai-2026-Reglementari-specifice-personalului-din-cultura.docx` },
      { titlu: "Codul fiscal, Legea 227/2015 (Portal legislativ)", url: "https://legislatie.just.ro/Public/DetaliiDocument/171282", nota: "art. 77 (deducerea personală), art. 78 (impozitul), art. 138 (CAS), art. 156 (CASS)" },
    ],
    legaturi: [
      ["/grila/cultura", "Grila culturii (Anexa III): biblioteci, muzee, teatre"],
      ["/", "Calculatorul: salariul tău, cu gradație, sporuri și net"],
      ["/ghiduri/salarii-bugetari-2026", "Salarii bugetari 2026 pe noua lege, pe domenii"],
    ],
  };
}
