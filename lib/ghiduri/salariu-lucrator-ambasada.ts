/**
 * Ghid: salariu lucrător la ambasada României = ce prevede proiectul legii salarizării (Anexa IV, art. 4–6) pentru
 * personalul trimis în misiune permanentă în străinătate. Coeficienții vin din FUNCTII_DIPLOMATIE_MISIUNE (lib/tax.ts,
 * verificați cu textul Anexei IV cap. III din varianta din 25 mai, public/sources). Baza de calcul pe țară se stabilește
 * prin HG și nu e publicată: salariul în valută NU se calculează aici. În lei calculăm doar funcțiile de la centrala MAE
 * (getFunctii, anexa IV).
 */
import { VARIANTA_IMPLICITA, getVarianta } from "../variants";
import { getFunctii } from "../variants-data";
import { aplicaGradatie, FUNCTII_DIPLOMATIE_MISIUNE } from "../tax";
import { SITE_URL } from "../seo";
import type { Ghid } from "./tip";

const lei = (n: number) => n.toLocaleString("ro-RO");
const coefTxt = (c: number) => c.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STUDII: Record<string, string> = { S: "superioare", M: "medii", G: "generale", "M; G": "medii sau generale" };

export function ghid(): Ghid {
  const v = getVarianta(VARIANTA_IMPLICITA);
  const VR = v.valoareReferinta;
  const F = FUNCTII_DIPLOMATIE_MISIUNE;
  const dupa = (re: RegExp) => {
    const r = F.filter((f) => re.test(f.functie));
    if (r.length === 0) throw new Error(`ambasadă: nicio funcție pentru ${re}`);
    return r;
  };
  const amb = F.find((f) => f.nr === 2);
  const sofer = dupa(/^Șofer I,/)[0]!;
  const ingrijitor = F.find((f) => f.nr === 24);
  const portar = F.find((f) => f.nr === 23);
  const contabil = F.find((f) => f.nr === 17);
  const secIII = F.find((f) => f.nr === 12);
  if (!amb || !ingrijitor || !portar || !contabil || !secIII || F.length !== 24) throw new Error("ambasadă: nomenclator incomplet");
  const rapAmbIngrijitor = Math.round((amb.coeficient / ingrijitor.coeficient) * 10) / 10;

  const alese = [1, 5, 7, 12, 15, 17, 21, 22, 23, 24].map((nr) => {
    const f = F.find((x) => x.nr === nr);
    if (!f) throw new Error(`ambasadă: lipsește funcția ${nr}`);
    return f;
  });
  const scurt = (t: string) => t.split(", ").slice(0, 3).join(", ");
  const tabelValuta = alese.map((f) => `| ${f.nr}. ${scurt(f.functie)} | ${STUDII[f.studii]} | ${coefTxt(f.coeficient)} |`).join("\n");

  // centrala MAE (Anexa IV, capitolele I și II), în lei: referent relații/comunicații/protecție, curier diplomatic
  const centrala = getFunctii(v.id)
    .filter((e) => e.anexa === "IV" && e.coeficient > 0 && /^Referent rela/i.test(e.functie) && /curier diplomatic I\b/.test(e.functie))
    .sort((a, b) => b.coeficient - a.coeficient);
  if (centrala.length < 3) throw new Error("ambasadă: prea puține rânduri la centrala MAE");
  const tabelCentrala = centrala
    .map((e) => `| Referent relații / comunicații / protecție, curier diplomatic I | ${e.studii} | ${coefTxt(e.coeficient)} | ${lei(aplicaGradatie(e.coeficient * VR, 0))} |`)
    .join("\n");
  const cMin = Math.min(...centrala.map((e) => aplicaGradatie(e.coeficient * VR, 0)));
  const cMax = Math.max(...centrala.map((e) => aplicaGradatie(e.coeficient * VR, 0)));

  const raspuns = `Un lucrător la o ambasadă a României ar avea în proiectul noii legi (Anexa IV) un salariu net în valută, egal cu coeficientul funcției înmulțit cu baza de calcul a țării. Coeficienții sunt de la ${coefTxt(ingrijitor.coeficient)} (îngrijitor) la ${coefTxt(F[0]!.coeficient)} (ambasador-șef de misiune), dar baza pe țară nu e publicată, deci suma nu se poate calcula. Legea nu a fost adoptată.`;

  const corp = `## Cum se calculează salariul unui lucrător la ambasadă?
Proiectul legii salarizării (Anexa IV, capitolul III, art. 4) stabilește salariul lunar în valută pe funcții, ținând seama de costul vieții și de condițiile de viață și de muncă din țara misiunii. Formula e simplă: salariul lunar net în valută = coeficientul de ierarhizare al funcției × baza de calcul a țării respective. Baza de calcul pentru coeficientul 1,00 se stabilește, pentru fiecare țară, printr-o hotărâre a Guvernului (art. 4 alin. (3)).

${"> Atenție: legea nu a fost adoptată. Pe 26 august 2026 partidele au anunțat că nu au ajuns la consens și s-au angajat să adopte legea până la sfârșitul anului. Cifrele din acest ghid sunt calcule din proiect, nu salarii garantate."}

Salariul în valută e prevăzut în cuantum net: contribuțiile și impozitul nu se mai scad din el, ca în cazul salariilor în lei. Alte drepturi în valută și în lei ale personalului în misiune (art. 5) urmează să fie stabilite printr-un act normativ separat, la nivel de lege, în 60 de zile de la intrarea în vigoare a legii, deci nu intră în coeficient.

## Cât sunt coeficienții pe funcții la o ambasadă?
Nomenclatorul din art. 6 are 24 de poziții, de la ambasador-șef de misiune până la îngrijitor. Tabelul arată zece dintre ele, cu nivelul studiilor cerut și coeficientul de ierarhizare:

| Funcția de încadrare la misiune | Studii | Coeficient |
|---|---|---|
${tabelValuta}

Ambasadorul de carieră (${coefTxt(amb.coeficient)}) are un coeficient de ${rapAmbIngrijitor.toLocaleString("ro-RO")} ori mai mare decât îngrijitorul (${coefTxt(ingrijitor.coeficient)}); pe aceeași bază de calcul, diferența dintre salarii ar fi aceeași. Șoferul I are ${coefTxt(sofer.coeficient)}, portarul ${coefTxt(portar.coeficient)}, contabilul ${coefTxt(contabil.coeficient)}. Nomenclatorul complet, cu toate cele 24 de funcții, se vede în [calculatorul pentru misiuni în străinătate](/diplomatie).

## De ce nu putem spune câți euro sau dolari ar câștiga?
Pentru că baza de calcul pe țară nu există încă. Ea se stabilește prin hotărâre a Guvernului, iar proiectul nu spune nicio sumă. Orice cifră în euro sau în dolari pentru un anumit post ar fi inventată, așa că acest ghid nu dă niciuna. Calculatorul de pe site te lasă să introduci o valoare estimativă proprie, doar ca să vezi cum funcționează formula; rezultatul nu e un salariu din proiect.

## Ce înseamnă clasa I și clasa a II-a?
Nota 1 din nomenclator spune că încadrarea în clasa I a funcției se face pentru personalul care a mai fost trimis cel puțin un an în misiune permanentă în străinătate, în aceeași funcție sau într-una cu cel puțin același coeficient. După intrarea în vigoare a legii, cine trece în altă funcție în timpul misiunii se încadrează pe noua funcție la clasa a II-a. Nomenclatorul trece clasa în funcție, cu coeficienți diferiți: de exemplu, consilierul diplomatic sau economic clasa I are ${coefTxt(F[4]!.coeficient)}, iar cel de clasa a II-a ${coefTxt(F[5]!.coeficient)}.

## Se pot comasa funcțiile la o misiune mică?
Da. Nota 2 prevede că la misiunile unde nu se justifică funcții distincte, acestea pot fi comasate, iar salariul funcției persoanei numite se stabilește ținând seama de sarcinile preponderente, de pregătirea profesională și de vechimea în specialitate.

## Cum e diferit salariul la centrala MAE, în București?
Personalul de la centrala Ministerului Afacerilor Externe nu primește salariu în valută: pentru el se aplică grila obișnuită din Anexa IV, capitolele I și II, în lei. Salariul de bază = coeficientul funcției × valoarea de referință (${lei(VR)} lei în varianta din ${v.eticheta}), rotunjit în sus la leu. Pentru funcția de referent relații / comunicații / protecție sau curier diplomatic I, în funcție de nivelul studiilor, gradația 0:

| Funcția | Studii (codul din grilă) | Coeficient | Salariu de bază (lei brut) |
|---|---|---|---|
${tabelCentrala}

Intervalul e de la ${lei(cMin)} la ${lei(cMax)} lei brut pe lună. Regulile de calcul, pe larg, sunt în [ghidul despre salariul de bază](/ghiduri/cum-se-calculeaza-salariul-de-baza), iar calculul pe funcția ta îl faci în [calculatorul de salarii](/).

## Ce salarii se plătesc acum, în 2026?
Până la adoptarea unei legi noi, salariile se plătesc pe legea în vigoare. Acest ghid nu publică salarii pe legea actuală și nu le compară cu proiectul, pentru că nu avem în date grila în vigoare. Pentru cifra exactă a unui post, contează decizia de încadrare.

## Greșeli frecvente când citești salariile de la ambasade
- **Iei coeficientul drept sumă:** coeficientul se înmulțește cu baza țării; singur nu e un salariu.
- **Aplici lei unde e valută:** în misiune salariul e în valută, net; în lei e doar la centrala MAE.
- **Uiți de celelalte drepturi:** cele din art. 5 se stabilesc separat și nu sunt incluse în coeficient.
- **Confunzi proiectul cu legea:** nicio dată de intrare în vigoare din proiect nu se aplică până nu e adoptat și promulgat.

Pe aceeași temă, vezi și panorama din [ghidul despre salariile bugetarilor](/ghiduri/salarii-bugetari-2026) și diferențele dintre texte în [ghidul despre cele trei variante](/ghiduri/legea-salarizarii-2026-cele-trei-variante). Grila întreagă a Anexei IV, diplomație, e la [grila Anexei IV](/grila/diplomatie).

> Atenție: legea nu a fost adoptată. Pe 26 august 2026 partidele au anunțat că nu au ajuns la consens și s-au angajat să adopte legea până la sfârșitul anului. Salariile de mai sus sunt calcule din proiect, nu salarii garantate.

Actualizat la 10 noiembrie 2026.`;

  return {
    slug: "salariu-lucrator-ambasada",
    categorie: "Ghid",
    titlu: "Salariu lucrător la ambasada României: cum se calculează pe noua lege",
    titluMeta: "Salariu lucrător ambasada României pe noua lege: coeficienți",
    descriere: `Salariu lucrător la ambasadă în proiectul noii legi: coeficienți de la ${coefTxt(ingrijitor.coeficient)} la ${coefTxt(F[0]!.coeficient)}, în valută net; baza pe țară nu e publicată. Neadoptat.`,
    cuvantCheie: "salariu lucrator ambasada romaniei",
    raspuns,
    peScurt: [
      "În misiune, salariul e în valută, net: coeficientul funcției × baza de calcul a țării (Anexa IV, art. 4).",
      `Nomenclatorul are 24 de funcții, cu coeficienți de la ${coefTxt(ingrijitor.coeficient)} (îngrijitor) la ${coefTxt(F[0]!.coeficient)} (ambasador-șef de misiune).`,
      "Baza pe țară se stabilește prin HG și nu e publicată: suma în euro sau dolari nu se poate calcula.",
      `La centrala MAE salariul e în lei: referenții din tabel au între ${lei(cMin)} și ${lei(cMax)} lei brut, varianta din ${v.eticheta}.`,
      "Legea nu a fost adoptată.",
    ],
    publicat: "2026-11-10",
    actualizat: "2026-11-10",
    corp,
    faq: [
      {
        q: "Cât câștigă un lucrător la o ambasadă a României?",
        a: "Proiectul noii legi nu spune o sumă: salariul net în valută = coeficientul funcției × baza de calcul a țării, iar baza se stabilește prin hotărâre a Guvernului, nepublicată. Legea nu a fost adoptată.",
      },
      {
        q: "Salariul de la ambasadă e brut sau net?",
        a: "Net, în valută: art. 4 alin. (2) din Anexa IV prevede salariul lunar în cuantum net. Contribuțiile și impozitul nu se scad din el ca la salariile în lei.",
      },
      {
        q: "Ce coeficient are un șofer sau un portar la o misiune?",
        a: `Șoferul I are ${coefTxt(sofer.coeficient)}, portarul ${coefTxt(portar.coeficient)} și îngrijitorul ${coefTxt(ingrijitor.coeficient)}, în nomenclatorul din art. 6 al proiectului.`,
      },
      {
        q: "Ce înseamnă clasa I și clasa a II-a la misiune?",
        a: "Clasa I se acordă personalului trimis cel puțin un an în misiune în aceeași funcție sau într-una cu același coeficient; cine trece în altă funcție în misiune intră la clasa a II-a (nota 1).",
      },
      {
        q: "Personalul de la centrala MAE are salariu în valută?",
        a: "Nu. La centrala din București se aplică grila în lei din Anexa IV, capitolele I și II; calculul se face în calculatorul principal.",
      },
    ],
    surse: [
      ...v.surse.map((s) => ({ titlu: s.titlu, url: s.url.startsWith("/") ? `https://romaniatransparenta.eu/registre/salarii${s.url}` : s.url })),
      {
        titlu: "MMFTSS: Anexa IV, capitolul III, reglementări specifice personalului din diplomație (varianta din 25 mai 2026)",
        url: `${SITE_URL}/sources/Anexa-IV-cap-III-Reglementari-specifice-personal-diplomatie-20-mai-2026.docx`,
        nota: "art. 4–6 și notele nomenclatorului pentru personalul în misiune permanentă",
      },
      { titlu: "România Transparentă: calculator salariu misiune permanentă în străinătate", url: `${SITE_URL}/diplomatie` },
    ],
    legaturi: [
      ["/diplomatie", "Calculator salariu misiune în străinătate"],
      ["/", "Calculatorul de salarii pentru bugetari"],
      ["/ghiduri/salarii-bugetari-2026", "Salarii bugetari 2026, pe domenii"],
      ["/ghiduri/cum-se-calculeaza-salariul-de-baza", "Cum se calculează salariul de bază"],
    ],
  };
}
