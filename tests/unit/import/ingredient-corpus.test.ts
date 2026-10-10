// Corpus of real ingredient lines (aniagotuje, taken verbatim 2026-10-10) with their expected parse.
// Bad import? Paste its lines here first, then fix the parser stage that owns the failure.
import { describe, it, expect } from 'vitest';
import { parseIngredientLines, type ParsedIngredient } from '@/lib/import/parse-ingredient';

interface Expected {
  name: string;
  amount: number | null;
  unit: string | null;
  optional?: true;
}

const e = (name: string, amount: number | null, unit: string | null, optional?: true): Expected =>
  optional ? { name, amount, unit, optional } : { name, amount, unit };
// Optional, amount-less item.
const o = (name: string): Expected => e(name, null, null, true);

type Row = readonly [raw: string, expected: Expected[]];

const CORPUS: Record<string, Row[]> = {
  'fasolka-po-bretonsku': [
    ['500 g fasoli suchej "Piękny Jaś"', [e('fasoli suchej', 500, 'g')]],
    ['woda do moczenia suchej fasoli + litr wody do gotowania fasoli', []],
    ['300 g boczku surowego wędzonego - bez skóry', [e('boczku surowego wędzonego', 300, 'g')]],
    ['400 g ulubionej kiełbasy - może być lekko podsuszana', [e('kiełbasy', 400, 'g')]],
    ['1 duża cebula - około 160 g', [e('cebula', 160, 'g')]],
    ['5 ząbków czosnku - około 25 g', [e('czosnku', 25, 'g')]],
    ['1500 g pomidorów świeżych (mogą być z puszki)', [e('pomidorów świeżych', 1500, 'g')]],
    ['30-40 g koncentratu pomidorowego', [e('koncentratu pomidorowego', 40, 'g')]],
    [
      'przyprawy: 3 ziarna ziela angielskiego, 2-3 liście laurowe, łyżka majeranku, 2 płaskie łyżeczki soli, po płaskiej łyżeczce pieprzu i słodkiej papryki wędzonej',
      [
        e('ziela angielskiego', 3, 'ziarno'),
        e('liście laurowe', 3, 'sztuki'),
        e('majeranku', 1, 'łyżka'),
        e('soli', 2, 'łyżeczka'),
        e('pieprzu', 1, 'łyżeczka'),
        e('słodkiej papryki wędzonej', 1, 'łyżeczka'),
      ],
    ],
  ],
  'zupa-dyniowa': [
    ['świeża dynia - np. piżmowa lub prowansalska 1 kg', [e('świeża dynia', 1, 'kg')]],
    ['ziemniaki 2 sztuki - 400 g', [e('ziemniaki', 400, 'g')]],
    ['cebula 1 sztuka - około 200 g', [e('cebula', 200, 'g')]],
    ['czosnek 2 ząbki', [e('czosnek', 2, 'ząbek')]],
    ['woda lub bulion warzywny 500 ml', [e('bulion warzywny', 500, 'ml')]],
    ['śmietanka 30 % 100 ml', [e('śmietanka 30 %', 100, 'ml')]],
    ['masło klarowane 2 łyżki - 40 g', [e('masło klarowane', 40, 'g')]],
    ['sól 1 płaska łyżeczka', [e('sól', 1, 'łyżeczka')]],
    [
      'pieprz i przyprawa curry po pół płaskiej łyżeczki',
      [e('pieprz', 0.5, 'łyżeczka'), e('przyprawa curry', 0.5, 'łyżeczka')],
    ],
  ],
  'salatka-gyros': [
    ['2 średnie piersi z kurczaka - około 800 g', [e('piersi z kurczaka', 800, 'g')]],
    ['2 łyżki oleju roślinnego do smażenia', [e('oleju roślinnego do smażenia', 2, 'łyżka')]],
    ['30 gramów przyprawy gyros*', [e('przyprawy gyros', 30, 'g')]],
    ['2 łyżki majonezu', [e('majonezu', 2, 'łyżka')]],
    ['4 łyżki jogurtu naturalnego', [e('jogurtu naturalnego', 4, 'łyżka')]],
    ['2 małe ząbki czosnku', [e('czosnku', 2, 'ząbek')]],
    ['3 łyżki soku z cytryny', [e('soku z cytryny', 3, 'łyżka')]],
    ['łyżka siekanego koperku', [e('siekanego koperku', 1, 'łyżka')]],
    ['duża puszka kukurydzy - 400 g', [e('kukurydzy', 400, 'g')]],
    ['150 g ogórków konserwowych', [e('ogórków konserwowych', 150, 'g')]],
    ['mała czerwona cebula - około 100 g', [e('czerwona cebula', 100, 'g')]],
    ['150 g sałaty lodowej lub pekińskiej', [e('sałaty lodowej', 150, 'g')]],
    ['150 g pomidorów koktajlowych', [e('pomidorów koktajlowych', 150, 'g')]],
    ['150 g ogórka świeżego', [e('ogórka świeżego', 150, 'g')]],
    ['duża papryka - około 300 g', [e('papryka', 300, 'g')]],
    ['4 łyżki ketchupu (można pominąć)', [e('ketchupu', 4, 'łyżka', true)]],
  ],
  'kapusta-na-cieplo-z-rydzami': [
    ['700 g kapusty kiszonej', [e('kapusty kiszonej', 700, 'g')]],
    ['400 g rydzy', [e('rydzy', 400, 'g')]],
    ['1 średnia cebula cukrowa', [e('cebula cukrowa', 1, 'sztuki')]],
    ['2 x 5 łyżek oleju np. z pestek winogron', [e('oleju', 10, 'łyżka')]],
    ['łyżka cukru', [e('cukru', 1, 'łyżka')]],
    ['łyżeczka pieprzu', [e('pieprzu', 1, 'łyżeczka')]],
    ['pół szklanki wody', []],
  ],
  'spaghetti-napoli': [
    ['300 g makaronu do spaghetti - waga przed ugotowaniem', [e('makaronu do spaghetti', 300, 'g')]],
    ['1200 g świeżych, mięsistych pomidorów - np. San Marzano', [e('świeżych, mięsistych pomidorów', 1200, 'g')]],
    ['2 ząbki czosnku - około 10 g', [e('czosnku', 10, 'g')]],
    ['3 łyżki ulubionej oliwy', [e('oliwy', 3, 'łyżka')]],
    ['spora garść świeżej bazylii', [e('świeżej bazylii', 1, 'garść')]],
    [
      'przyprawy: 1 płaska łyżeczka soli i 1/3 łyżeczki pieprzu',
      [e('soli', 1, 'łyżeczka'), e('pieprzu', 1 / 3, 'łyżeczka')],
    ],
    ['do podania ewentualnie: parmezan', [o('parmezan')]],
  ],
  'tortilla-z-kurczakiem': [
    ['mała pierś z kurczaka - 400 g', [e('pierś z kurczaka', 400, 'g')]],
    ['2 łyżki sosu sojowego', [e('sosu sojowego', 2, 'łyżka')]],
    ['łyżka oliwy', [e('oliwy', 1, 'łyżka')]],
    [
      'przyprawy: po pół łyżeczki słodkiej papryki i oregano; po sporej szczypcie pieprzu i chili',
      [
        e('słodkiej papryki', 0.5, 'łyżeczka'),
        e('oregano', 0.5, 'łyżeczka'),
        e('pieprzu', 1, 'szczypta'),
        e('chili', 1, 'szczypta'),
      ],
    ],
    ['4 większe placki tortilli pszennej', [e('placki tortilli pszennej', 4, 'sztuki')]],
    ['16 listków sałaty np. batawskiej', [e('listków sałaty', 16, 'sztuki')]],
    ['1 mała papryka - 150 g', [e('papryka', 150, 'g')]],
    ['8 plasterków żółtego sera - 140 g', [e('żółtego sera', 140, 'g')]],
    ['2 średnie ogórki gruntowe - 120 g', [e('ogórki gruntowe', 120, 'g')]],
    ['3 łyżki jogurtu naturalnego', [e('jogurtu naturalnego', 3, 'łyżka')]],
    ['2 łyżki majonezu', [e('majonezu', 2, 'łyżka')]],
    ['1 ząbek czosnku', [e('czosnku', 1, 'ząbek')]],
    ['łyżka soku z cytryny', [e('soku z cytryny', 1, 'łyżka')]],
    ['szczypta soli i pieprzu', [e('soli', 1, 'szczypta'), e('pieprzu', 1, 'szczypta')]],
  ],
  'makaron-z-zielonym-pesto-i-mozzarella': [
    ['pęczek bazylii - 60 gramów listków', [e('bazylii', 60, 'g')]],
    ['garść orzeszków piniowych - 50 g', [e('orzeszków piniowych', 50, 'g')]],
    ['kawałek sera parmezan - 50 g', [e('sera parmezan', 50, 'g')]],
    [
      'niecałe 1/3 szklanki oliwy extra virgin (z pierwszego tłoczenia) - około 75 ml',
      [e('oliwy extra virgin', 75, 'ml')],
    ],
    ['2 małe ząbki czosnku - do 8 g - można pominąć', [e('czosnku', 8, 'g', true)]],
    [
      'przyprawy: niecałe pół łyżeczki soli, 1/4 płaskiej łyżeczki pieprzu',
      [e('soli', 0.5, 'łyżeczka'), e('pieprzu', 0.25, 'łyżeczka')],
    ],
    ['200 g makaronu spaghetti - waga suchego makaronu', [e('makaronu spaghetti', 200, 'g')]],
    [
      'dodatki: oliwa, parmezan, świeże listki bazylii, pomidorki..',
      [o('oliwa'), o('parmezan'), o('świeże listki bazylii'), o('pomidorki')],
    ],
  ],
  risotto: [
    ['2 szklanki ryżu do risotto Arborio - 400 g', [e('ryżu do risotto Arborio', 400, 'g')]],
    ['2 szklanki bulionu drobiowego lub warzywnego - 500 ml', [e('bulionu drobiowego', 500, 'ml')]],
    ['pół szklanki białego wina wytrawnego - 125 ml', [e('białego wina wytrawnego', 125, 'ml')]],
    ['5 cebulek szalotek lub jedna duża cebula - 250 g', [e('cebulek szalotek', 250, 'g')]],
    ['50 g parmezanu lub innego sera typu parmezan', [e('parmezanu', 50, 'g')]],
    ['2 łyżki delikatnej oliwy', [e('delikatnej oliwy', 2, 'łyżka')]],
    ['4 łyżki masła', [e('masła', 4, 'łyżka')]],
    [
      'przyprawy i zioła: garść natki pietruszki, pół łyżeczki soli, spora szczypta pieprzu',
      [e('natki pietruszki', 1, 'garść'), e('soli', 0.5, 'łyżeczka'), e('pieprzu', 1, 'szczypta')],
    ],
  ],
  lazanki: [
    ['2 szklanki makaronu łazanki - 240 g - waga przed ugotowaniem', [e('makaronu łazanki', 240, 'g')]],
    ['pół długiego pętka lekko podwędzanej kiełbasy - 200 g', [e('lekko podwędzanej kiełbasy', 200, 'g')]],
    ['400 g kapusty kiszonej', [e('kapusty kiszonej', 400, 'g')]],
    ['2 średnie cebule - 280 g', [e('cebule', 280, 'g')]],
    ['4 pieczarki lub grzyby leśne - 150 g', [e('pieczarki', 150, 'g')]],
    ['10 łyżek oleju roślinnego do smażenia', [e('oleju roślinnego do smażenia', 10, 'łyżka')]],
    [
      'przyprawy i zioła: 2 listki laurowe, 3 ziarna ziela angielskiego, po pół łaskiej łyżeczki soli i pieprzu, szczypta kminku',
      [
        e('listki laurowe', 2, 'sztuki'),
        e('ziela angielskiego', 3, 'ziarno'),
        e('soli', 0.5, 'łyżeczka'),
        e('pieprzu', 0.5, 'łyżeczka'),
        e('kminku', 1, 'szczypta'),
      ],
    ],
  ],
  'extra-lines': [
    ['świeżo wyciśnięty sok z cytryny 1-2 łyżki', [e('świeżo wyciśnięty sok z cytryny', 2, 'łyżka')]],
    ['półtorej szklanki mąki', [e('mąki', 1.5, 'szklanka')]],
    ['półtora kg ziemniaków', [e('ziemniaków', 1.5, 'kg')]],
    ['jedna trzecia szklanki mleka', [e('mleka', 1 / 3, 'szklanka')]],
    ['dwie trzecie szklanki cukru', [e('cukru', 2 / 3, 'szklanka')]],
    ['trzy czwarte łyżeczki soli', [e('soli', 0.75, 'łyżeczka')]],
    ['½ łyżeczki cynamonu', [e('cynamonu', 0.5, 'łyżeczka')]],
    ['1 i 1/2 szklanki mleka', [e('mleka', 1.5, 'szklanka')]],
    ['1 1/2 łyżki miodu', [e('miodu', 1.5, 'łyżka')]],
  ],
};

const CASES = Object.entries(CORPUS).flatMap(([source, rows]) =>
  rows.map(([raw, expected]) => ({ source, raw, expected })),
);

describe('ingredient corpus', () => {
  it.each(CASES)('$source: $raw', ({ raw, expected }) => {
    // `optional` is added to ParsedIngredient by the implementation; read it structurally until then.
    const actual: (ParsedIngredient & { optional?: boolean })[] = parseIngredientLines(raw);
    expect(actual).toHaveLength(expected.length);
    expected.forEach((want, i) => {
      const got = actual[i];
      expect(got.name).toBe(want.name);
      expect(got.unit).toBe(want.unit);
      if (want.amount === null) expect(got.amount).toBeNull();
      else expect(got.amount).toBeCloseTo(want.amount, 5);
      expect(got.optional).toBe(want.optional);
    });
  });
});
