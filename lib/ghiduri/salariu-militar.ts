/**
 * Ghid: salariul (solda) militarului în proiectul legii salarizării (Anexa VI, apărare, ordine publică, siguranță națională).
 * Solda lunară = solda de funcție (coeficientul funcției × valoarea de referință, cap. I.1) + solda de grad (coeficientul gradului
 * × valoarea de referință, cap. I.2). Gradațiile (+3% la 3/6/…/21 de ani) majorează DOAR solda de funcție
 * (docs/verificare-calcule-2026-09-24.md: Anexa VI art. 2 alin. (2), art. 4 alin. (3), art. 6 alin. (4)). Gradul se deduce din
 * denumirea funcției cu `soldaGradPentruFunctie`, ca în calculator. Nu intră: sporurile și primele din Anexa VI, retenția de pensie,
 * indemnizațiile de comandă, regimurile speciale de vechime (rechemați).
 */
import { VARIANTE, VARIANTA_IMPLICITA, getVarianta, type Varianta } from "../variants";
import { getFunctii } from "../variants-data";
import { GRADATII_APARARE, aplicaGradatie, calcBrut, soldaGradByKey, soldaGradPentruFunctie, SAL_MIN_BRUT } from "../tax";
import { SITE_URL } from "../seo";
import type { Ghid } from "./tip";

const lei = (n: number) => n.toLocaleString("ro-RO");
const coef = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 4 });

/** gradele afișate: cheia soldei de grad (lib/tax.ts, SOLDA_GRAD_RULES) și denumirea scurtă din tabel */
const GRADE = [
  ["g56", "Soldat"],
  ["g52", "Caporal clasa I"],
  ["g51", "Sergent"],
  ["g49", "Plutonier"],
  ["g46", "Plutonier adjutant șef / maistru militar principal"],
  ["g45", "Sublocotenent"],
  ["g43", "Căpitan"],
  ["g42", "Maior"],
  ["g40", "Colonel"],
  ["g38", "General-maior"],
] as const;

interface RandGrad {
  cheie: string;
  nume: string;
  cMin: number;
  cMax: number;
  solda: number; // solda de grad, lei
  coefGrad: number;
}

/** pentru fiecare grad din tabel: cel mai mic și cel mai mare coeficient de funcție din Anexa VI (gradul din denumirea funcției) */
function randuriGrade(v: Varianta): RandGrad[] {
  const vi = getFunctii(v.id).filter((e) => e.anexa === "VI" && e.coeficient > 0);
  return GRADE.map(([cheie, nume]) => {
    const r = vi.filter((e) => soldaGradPentruFunctie(e.functie) === cheie);
    const g = soldaGradByKey(cheie, v.soldeGrad);
    if (r.length === 0 || !g) throw new Error(`ghid militar: fără rânduri sau fără soldă de grad pentru ${nume} (${v.id})`);
    const cs = r.map((e) => e.coeficient);
    return { cheie, nume, cMin: Math.min(...cs), cMax: Math.max(...cs), solda: Math.ceil(g.coef * v.valoareReferinta), coefGrad: g.coef };
  });
}

const functieG = (c: number, v: Varianta, g = 0) => aplicaGradatie(c * v.valoareReferinta, g, GRADATII_APARARE);
const brutNet = (c: number, v: Varianta, coefGrad: number, g = 0) => {
  const t = calcBrut({ salariuBaza: functieG(c, v, g), sporuri: [], valoareReferinta: v.valoareReferinta, soldaGradCoef: coefGrad });
  return { brut: t.salariuBrut, net: t.salariuNet };
};

export function ghid(): Ghid {
  const v = getVarianta(VARIANTA_IMPLICITA);
  const VR = v.valoareReferinta;
  const grade = randuriGrade(v);
  const byKey = (k: string) => grade.find((x) => x.cheie === k)!;
  const soldat = byKey("g56");
  const sergent = byKey("g51");
  const capitan = byKey("g43");
  const colonel = byKey("g40");
  const generalMaior = byKey("g38");

  const sol = brutNet(soldat.cMin, v, soldat.coefGrad);
  const col = brutNet(colonel.cMin, v, colonel.coefGrad);
  const colMax = brutNet(colonel.cMax, v, colonel.coefGrad);
  const gen = brutNet(generalMaior.cMin, v, generalMaior.coefGrad);
  if (!(sol.brut > 3000 && sol.brut < col.brut && col.brut < gen.brut)) throw new Error("ghid militar: cifre fără sens");

  const tabelGrade = grade
    .map((x) => {
      const jos = brutNet(x.cMin, v, x.coefGrad);
      const sus = brutNet(x.cMax, v, x.coefGrad);
      const interval = x.cMin === x.cMax ? coef(x.cMin) : `${coef(x.cMin)}–${coef(x.cMax)}`;
      const brut = jos.brut === sus.brut ? lei(jos.brut) : `${lei(jos.brut)}–${lei(sus.brut)}`;
      return `| ${x.nume} | ${interval} | ${coef(x.coefGrad)} (${lei(x.solda)} lei) | ${brut} | ${lei(jos.net)} |`;
    })
    .join("\n");

  // gradațiile: sergentul, funcția cu coeficientul cel mai mic, la 0, 3, 9, 15 și peste 21 de ani
  const PASI = [
    [0, "până la 3 ani"],
    [1, "3–6 ani"],
    [3, "9–12 ani"],
    [5, "15–18 ani"],
    [7, "peste 21 de ani"],
  ] as const;
  const tabelGradatii = PASI.map(([g, ani]) => {
    const t = brutNet(sergent.cMin, v, sergent.coefGrad, g);
    return `| ${ani} | ${g} | ${lei(functieG(sergent.cMin, v, g))} | ${lei(sergent.solda)} | ${lei(t.brut)} | ${lei(t.net)} |`;
  }).join("\n");
  const sergentG0 = brutNet(sergent.cMin, v, sergent.coefGrad, 0);
  const sergentG7 = brutNet(sergent.cMin, v, sergent.coefGrad, 7);

  // comparația între variante: soldat și colonel, la coeficientul minim al funcției
  const cmp = (nume: string, cheie: string) => {
    const celule = VARIANTE.map((x) => {
      const r = randuriGrade(x).find((y) => y.cheie === cheie)!;
      return `${lei(brutNet(r.cMin, x, r.coefGrad).brut)} (${coef(r.cMin)} + ${coef(r.coefGrad)})`;
    });
    return `| ${nume} | ${celule.join(" | ")} |`;
  };
  const comparatie = [cmp("Soldat", "g56"), cmp("Sergent", "g51"), cmp("Colonel", "g40")].join("\n");
  const subMinim = grade.filter((x) => functieG(x.cMin, v) < SAL_MIN_BRUT).length;

  const raspuns = `În proiectul legii salarizării din ${v.eticheta}, solda lunară a unui soldat ar fi de ${lei(sol.brut)} lei brut, iar a unui colonel, de la ${lei(col.brut)} lei brut, cu o valoare de referință de ${lei(VR)} lei. Solda înseamnă soldă de funcție plus soldă de grad. Proiectul nu a fost adoptat.`;

  const atentie = `> Atenție: legea nu a fost adoptată. Pe 26 august 2026 partidele au anunțat că nu au ajuns la consens și s-au angajat să adopte legea până la sfârșitul anului. Cifrele din acest ghid arată ce prevede proiectul, nu ce se plătește azi.`;

  const corp = `## Cât ar câștiga un militar pe noua lege?
În varianta din ${v.eticheta} a proiectului, solda lunară brută a unui soldat ar fi de ${lei(sol.brut)} lei, a unui sergent de la ${lei(sergentG0.brut)} lei, a unui căpitan de la ${lei(brutNet(capitan.cMin, v, capitan.coefGrad).brut)} lei, a unui colonel de la ${lei(col.brut)} lei, iar a unui general-maior de la ${lei(gen.brut)} lei. Netul calculat (fără sporuri) este de ${lei(sol.net)} lei la soldat și de ${lei(col.net)} lei la colonel, pe prima treaptă a funcției.

Militarii nu au „salariu de bază”, ci soldă lunară. Proiectul o compune din două părți: solda de funcție (coeficientul funcției din Anexa VI, cap. I.1, înmulțit cu valoarea de referință de ${lei(VR)} lei) și solda de grad (coeficientul gradului din cap. I.2, înmulțit cu aceeași valoare). Aceleași rânduri se aplică și polițiștilor și polițiștilor de penitenciare, pe gradele echivalente: denumirile din grilă le enumeră împreună.

${atentie}

## Cum se calculează solda: funcție plus grad
Solda de funcție depinde de ce post ocupi: grila are rânduri separate pentru funcții de execuție și de comandă, cu un coeficient minim și unul maxim, pe grade. Solda de grad depinde doar de gradul pe care îl ai și nu se schimbă cu funcția. Tabelul arată, pentru zece grade, intervalul coeficienților de funcție din grilă, solda de grad și solda lunară brută rezultată, de la cea mai mică la cea mai mare funcție de pe grad. Netul e calculat pentru cea mai mică funcție:

| Gradul | Coeficient de funcție | Coeficient soldă de grad (lei) | Soldă lunară brută (lei) | Net la minim (lei) |
|---|---|---|---|---|
${tabelGrade}

Pentru un grad cu un singur rând în grilă (soldat, caporal) intervalul se reduce la o valoare. Funcțiile exacte, pe studii și pe comandă sau execuție, sunt în [grila apărării și ordinii publice](/grila/aparare-ordine-publica); salariul tău, cu sporuri, îl calculezi în [calculator](/).

## Se adaugă gradații la soldă?
Da, dar altfel decât la civili. Militarii sunt exceptați de la gradațiile generale din art. 13 și au propriile gradații din Anexa VI: șapte trepte de câte +3%, la 3, 6, 9, 12, 15, 18 și 21 de ani servit. Ele majorează numai solda de funcție; solda de grad nu primește gradații. Exemplul de mai jos folosește un sergent la funcția cu cel mai mic coeficient (${coef(sergent.cMin)}):

| Vechime servită | Gradația | Soldă de funcție (lei) | Soldă de grad (lei) | Brut (lei) | Net (lei) |
|---|---|---|---|---|---|
${tabelGradatii}

Între începutul carierei și peste 21 de ani, aceeași funcție ar crește cu ${lei(sergentG7.brut - sergentG0.brut)} lei brut pe lună. Vechimea care contează este timpul servit ca militar; regimurile speciale (de exemplu cadrele rechemate) nu sunt modelate aici.

## Cum diferă cele trei variante ale proiectului?
Soldele de grad au fost recalibrate între variante: în varianta din 25 mai gradele mici aveau coeficienți mici (soldatul 0,10), iar din iulie grila începe de la 0,40 la soldat și ajunge la 1,10 la mareșal. Valoarea de referință e și ea diferită: ${VARIANTE.map((x) => `${lei(x.valoareReferinta)} lei (${x.eticheta})`).join(", ")}. Tabelul arată solda lunară brută, pe prima treaptă a funcției, cu suma coeficientului de funcție și a celui de grad în paranteză:

| Gradul | ${VARIANTE.map((x) => x.eticheta).join(" | ")} |
|---|---|---|---|
${comparatie}

Diferențele vin atât din coeficienții de funcție, cât și din cei de grad, așa că nu se pot reduce la o singură schimbare. Pentru o comparație între variante pe toate anexele, vezi [cele trei variante ale proiectului](/ghiduri/legea-salarizarii-2026-cele-trei-variante).

## Ce nu intră în aceste cifre?
Tabelele arată doar solda de funcție, solda de grad și gradațiile. Nu intră sporurile și primele specifice din Anexa VI (de exemplu pentru condiții periculoase, personal navigant sau scafandri), indemnizațiile de comandă și de curs, retenția pentru cei care pot ieși la pensie și sporurile generale. ${subMinim > 0 ? `${lei(subMinim)} dintre rândurile din tabel au solda de funcție sub salariul minim brut (${lei(SAL_MIN_BRUT)} lei); în acel caz se plătește salariul minim.` : `Niciun rând din tabel nu are solda de funcție sub salariul minim brut pe țară (${lei(SAL_MIN_BRUT)} lei).`} Contribuția individuală a militarilor la bugetul de stat este tot de 25%, ca CAS la civili, iar netul din tabele ține cont de ea. Nu publicăm solde pe legea în vigoare: nu avem grila actuală în date, deci nu comparăm proiectul cu ce se plătește azi și nu calculăm procente de creștere.

## Greșeli frecvente când citești solda militarilor
- **Citești doar coeficientul funcției:** fără solda de grad, suma e prea mică; proiectul le adună.
- **Aplici gradațiile și pe solda de grad:** cele șapte gradații de 3% se aplică numai soldei de funcție.
- **Folosești gradațiile civile:** militarii au trepte la 3 ani, nu la 3, 5, 10, 15 și 20 de ani.
- **Compari brutul cu netul:** cifrele din grilă sunt brute; netul depinde de reguli fiscale și de situația personală.
- **Confunzi proiectul cu legea:** nicio cifră de aici nu se aplică înainte ca legea să fie adoptată și promulgată.

${atentie}

Actualizat la 27 noiembrie 2026.`;

  return {
    slug: "salariu-militar",
    categorie: "Ghid",
    titlu: "Salariu militar pe noua lege: solda pe grade, cu gradații și net",
    titluMeta: "Salariu militar pe noua lege: solda pe grade, cu net",
    descriere: `Salariu militar în proiectul noii legi: de la ${lei(sol.brut)} lei brut (soldat) la ${lei(gen.brut)} lei (general-maior), soldă de funcție plus soldă de grad. Proiectul nu a fost adoptat.`,
    cuvantCheie: "salariu militar noua lege",
    raspuns,
    peScurt: [
      `Varianta din ${v.eticheta}: de la ${lei(sol.brut)} lei brut pe lună la soldat, la ${lei(col.brut)}–${lei(colMax.brut)} lei la colonel, după funcție.`,
      `Solda lunară = solda de funcție (coeficientul funcției × ${lei(VR)} lei) + solda de grad (coeficientul gradului × ${lei(VR)} lei).`,
      "Militarii au șapte gradații de +3%, la 3, 6, 9, 12, 15, 18 și 21 de ani; se aplică doar soldei de funcție.",
      "Aceleași rânduri se aplică polițiștilor și polițiștilor de penitenciare, pe gradele echivalente.",
      "Legea nu a fost adoptată; sporurile și primele din Anexa VI nu sunt incluse în tabele.",
    ],
    publicat: "2026-11-27",
    actualizat: "2026-11-27",
    corp,
    faq: [
      {
        q: "Cât ar câștiga un militar pe noua lege a salarizării?",
        a: `În varianta din ${v.eticheta}, de la ${lei(sol.brut)} lei brut pe lună la soldat până la ${lei(gen.brut)} lei la general-maior (prima treaptă a funcției), în funcție de grad și funcție. Proiectul nu a fost adoptat.`,
      },
      {
        q: "Cât ar fi solda unui soldat?",
        a: `${lei(sol.brut)} lei brut pe lună în varianta din ${v.eticheta}: solda de funcție de ${lei(functieG(soldat.cMin, v))} lei (${coef(soldat.cMin)} × ${lei(VR)}) plus solda de grad de ${lei(soldat.solda)} lei (${coef(soldat.coefGrad)} × ${lei(VR)}). Netul calculat, fără sporuri, este de ${lei(sol.net)} lei.`,
      },
      {
        q: "Ce este solda de grad?",
        a: "O parte a soldei lunare care depinde numai de gradul militar: coeficientul din capitolul I.2 al Anexei VI înmulțit cu valoarea de referință. Nu primește gradații și se adună la solda de funcție.",
      },
      {
        q: "Ce gradații au militarii?",
        a: "Șapte gradații de câte +3%, la 3, 6, 9, 12, 15, 18 și 21 de ani de vechime ca militar. Majorează doar solda de funcție, nu și solda de grad.",
      },
      {
        q: "Salariul polițiștilor se calculează la fel?",
        a: "Da, în proiect militarii, polițiștii și polițiștii de penitenciare sunt în aceeași anexă (VI), cu rânduri pe grade echivalente, iar solda se compune la fel.",
      },
      {
        q: "Se pot compara aceste cifre cu solda din prezent?",
        a: "Nu aici. Nu publicăm solde pe legea în vigoare și nu calculăm procente de creștere. Pentru cifra exactă de azi, singura sursă sigură este statul de plată.",
      },
    ],
    surse: [
      ...v.surse.map((s) => ({ titlu: s.titlu, url: s.url.startsWith("/") ? `${SITE_URL}${s.url}` : s.url })),
      { titlu: "România Transparentă: grila de salarizare, apărare și ordine publică (Anexa VI)", url: `${SITE_URL}/grila/aparare-ordine-publica` },
      { titlu: "Codul fiscal, Legea 227/2015 (Portal legislativ)", url: "https://legislatie.just.ro/Public/DetaliiDocument/171282", nota: "art. 77 (deducerea personală), art. 78 (impozitul), art. 156 (CASS)" },
    ],
    legaturi: [
      ["/grila/aparare-ordine-publica", "Grila completă a apărării și ordinii publice (Anexa VI)"],
      ["/", "Calculatorul: solda ta, cu sporuri și net"],
      ["/ghiduri/salarii-bugetari-2026", "Salarii bugetari 2026, pe domenii"],
    ],
  };
}
