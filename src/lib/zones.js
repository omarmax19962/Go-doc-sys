/* zones.js — the single registry of service zones.
 * ZONES / ZONE_AR / zoneMatch were lifted verbatim from App.jsx so the pickers keep
 * working unchanged; ZONE_GEO + GOVERNORATES power the coverage map.
 * To launch a new area: add it to ZONES, ZONE_AR and ZONE_GEO below — the pickers
 * and the map pick it up automatically (no other file needs to change). */

export const ZONES = [
  // Cairo — central & east
  "Downtown (Wast El Balad)","Garden City","Zamalek","Maadi","Old Maadi","New Maadi","Degla","Manial","Sayeda Zeinab","Abdeen",
  "Nasr City","Heliopolis (Masr El Gedida)","Roxy","Korba","Sheraton","Almaza","Ain Shams","El Marg","Matareya","Hadayek El Kobba",
  "Abbassia","Ghamra","Shubra","Rod El Farag","Helwan","El Maasara","Tora","Mokattam","Manshiyat Naser","Zawya El Hamra",
  // New Cairo & east expansions
  "New Cairo (Tagamoa)","1st Settlement","3rd Settlement","5th Settlement","Rehab","Madinaty","Shorouk","Obour","Badr City","Future City",
  // Giza
  "Dokki","Mohandessin","Agouza","Giza Square","Haram (Pyramids)","Faisal","Omraneya","Bein El Sarayat","Imbaba","Warraq",
  "Boulak El Dakrour","Sheikh Zayed","6th October","Hadayek El Ahram","Smart Village","Dreamland","Beverly Hills",
  // Qalyubia (north)
  "Shubra El Kheima","Banha","Qalyub","Khanka","Obour (Qalyubia)",
  "Other / outside Greater Cairo",
];
// Arabic names for every zone so the coverage-zone pickers can be searched in
// either language. Keys must match the English ZONES values exactly.
export const ZONE_AR = {
  "Downtown (Wast El Balad)":"وسط البلد","Garden City":"جاردن سيتي","Zamalek":"الزمالك","Maadi":"المعادي","Old Maadi":"المعادي القديمة","New Maadi":"المعادي الجديدة","Degla":"دجلة","Manial":"المنيل","Sayeda Zeinab":"السيدة زينب","Abdeen":"عابدين",
  "Nasr City":"مدينة نصر","Heliopolis (Masr El Gedida)":"مصر الجديدة / هليوبوليس","Roxy":"روكسي","Korba":"الكوربة","Sheraton":"شيراتون","Almaza":"الماظة","Ain Shams":"عين شمس","El Marg":"المرج","Matareya":"المطرية","Hadayek El Kobba":"حدائق القبة",
  "Abbassia":"العباسية","Ghamra":"غمرة","Shubra":"شبرا","Rod El Farag":"روض الفرج","Helwan":"حلوان","El Maasara":"المعصرة","Tora":"طرة","Mokattam":"المقطم","Manshiyat Naser":"منشية ناصر","Zawya El Hamra":"الزاوية الحمراء",
  "New Cairo (Tagamoa)":"القاهرة الجديدة / التجمع","1st Settlement":"التجمع الأول","3rd Settlement":"التجمع الثالث","5th Settlement":"التجمع الخامس","Rehab":"الرحاب","Madinaty":"مدينتي","Shorouk":"الشروق","Obour":"العبور","Badr City":"مدينة بدر","Future City":"مدينة المستقبل",
  "Dokki":"الدقي","Mohandessin":"المهندسين","Agouza":"العجوزة","Giza Square":"ميدان الجيزة","Haram (Pyramids)":"الهرم","Faisal":"فيصل","Omraneya":"العمرانية","Bein El Sarayat":"بين السرايات","Imbaba":"إمبابة","Warraq":"الوراق",
  "Boulak El Dakrour":"بولاق الدكرور","Sheikh Zayed":"الشيخ زايد","6th October":"السادس من أكتوبر / 6 أكتوبر","Hadayek El Ahram":"حدائق الأهرام","Smart Village":"القرية الذكية","Dreamland":"دريم لاند","Beverly Hills":"بيفرلي هيلز",
  "Shubra El Kheima":"شبرا الخيمة","Banha":"بنها","Qalyub":"قليوب","Khanka":"الخانكة","Obour (Qalyubia)":"العبور (القليوبية)",
  "Other / outside Greater Cairo":"أخرى / خارج القاهرة الكبرى",
};
// True if zone `z` matches free-text `q` in English (label) or Arabic (ZONE_AR).
export const zoneMatch = (z, q) => { const s = (q||"").trim().toLowerCase(); if (!s) return true; return z.toLowerCase().includes(s) || (ZONE_AR[z]||"").toLowerCase().includes(s); };

/* Approximate centroids (WGS84) + governorate for every mappable zone.
 * "Other / outside Greater Cairo" is deliberately absent — it has no location, so
 * the map reports it as "unmapped" instead of pinning it somewhere false. */
const G = (lat, lng, gov) => ({ lat, lng, gov });
export const ZONE_GEO = {
  // Cairo governorate — central & east
  "Downtown (Wast El Balad)": G(30.0444, 31.2357, "Cairo"), "Garden City": G(30.0360, 31.2308, "Cairo"),
  "Zamalek": G(30.0609, 31.2193, "Cairo"), "Maadi": G(29.9602, 31.2597, "Cairo"),
  "Old Maadi": G(29.9690, 31.2500, "Cairo"), "New Maadi": G(29.9480, 31.2750, "Cairo"),
  "Degla": G(29.9740, 31.2790, "Cairo"), "Manial": G(30.0210, 31.2250, "Cairo"),
  "Sayeda Zeinab": G(30.0290, 31.2350, "Cairo"), "Abdeen": G(30.0420, 31.2480, "Cairo"),
  "Nasr City": G(30.0560, 31.3300, "Cairo"), "Heliopolis (Masr El Gedida)": G(30.0900, 31.3200, "Cairo"),
  "Roxy": G(30.0920, 31.3250, "Cairo"), "Korba": G(30.0870, 31.3290, "Cairo"),
  "Sheraton": G(30.1170, 31.3800, "Cairo"), "Almaza": G(30.1060, 31.3500, "Cairo"),
  "Ain Shams": G(30.1300, 31.3200, "Cairo"), "El Marg": G(30.1500, 31.3400, "Cairo"),
  "Matareya": G(30.1210, 31.3100, "Cairo"), "Hadayek El Kobba": G(30.0890, 31.2810, "Cairo"),
  "Abbassia": G(30.0720, 31.2800, "Cairo"), "Ghamra": G(30.0700, 31.2650, "Cairo"),
  "Shubra": G(30.1100, 31.2450, "Cairo"), "Rod El Farag": G(30.1020, 31.2330, "Cairo"),
  "Helwan": G(29.8500, 31.3340, "Cairo"), "El Maasara": G(29.8970, 31.2970, "Cairo"),
  "Tora": G(29.9280, 31.2870, "Cairo"), "Mokattam": G(30.0200, 31.3000, "Cairo"),
  "Manshiyat Naser": G(30.0400, 31.2850, "Cairo"), "Zawya El Hamra": G(30.1090, 31.2600, "Cairo"),
  // New Cairo & east expansions (Cairo governorate; Obour is Qalyubia)
  "New Cairo (Tagamoa)": G(30.0300, 31.4700, "Cairo"), "1st Settlement": G(30.0250, 31.4300, "Cairo"),
  "3rd Settlement": G(30.0270, 31.4500, "Cairo"), "5th Settlement": G(30.0150, 31.4750, "Cairo"),
  "Rehab": G(30.0620, 31.4900, "Cairo"), "Madinaty": G(30.1000, 31.6500, "Cairo"),
  "Shorouk": G(30.1200, 31.6000, "Cairo"), "Obour": G(30.2300, 31.4800, "Qalyubia"),
  "Badr City": G(30.1500, 31.7400, "Cairo"), "Future City": G(30.0000, 31.6200, "Cairo"),
  // Giza governorate
  "Dokki": G(30.0380, 31.2000, "Giza"), "Mohandessin": G(30.0580, 31.2000, "Giza"),
  "Agouza": G(30.0610, 31.2090, "Giza"), "Giza Square": G(30.0130, 31.2090, "Giza"),
  "Haram (Pyramids)": G(29.9870, 31.1620, "Giza"), "Faisal": G(29.9900, 31.1850, "Giza"),
  "Omraneya": G(30.0000, 31.1800, "Giza"), "Bein El Sarayat": G(30.0230, 31.2150, "Giza"),
  "Imbaba": G(30.0770, 31.2100, "Giza"), "Warraq": G(30.1060, 31.2090, "Giza"),
  "Boulak El Dakrour": G(30.0300, 31.1650, "Giza"), "Sheikh Zayed": G(30.0200, 30.9700, "Giza"),
  "6th October": G(29.9300, 30.9200, "Giza"), "Hadayek El Ahram": G(29.9700, 31.1100, "Giza"),
  "Smart Village": G(30.0720, 31.0170, "Giza"), "Dreamland": G(29.9650, 30.9700, "Giza"),
  "Beverly Hills": G(30.0300, 30.9600, "Giza"),
  // Qalyubia governorate
  "Shubra El Kheima": G(30.1286, 31.2422, "Qalyubia"), "Banha": G(30.4660, 31.1850, "Qalyubia"),
  "Qalyub": G(30.1790, 31.2060, "Qalyubia"), "Khanka": G(30.2080, 31.3660, "Qalyubia"),
  "Obour (Qalyubia)": G(30.2000, 31.4700, "Qalyubia"),
};

/* All 27 Egyptian governorates (centroid ≈ capital). Used by the map's Egypt view to
 * show where Go Doc has zones configured and where it has none yet. */
export const GOVERNORATES = [
  { id: "Cairo", ar: "القاهرة", lat: 30.0444, lng: 31.2357 },
  { id: "Giza", ar: "الجيزة", lat: 30.0131, lng: 31.2089 },
  { id: "Qalyubia", ar: "القليوبية", lat: 30.1786, lng: 31.2050 },
  { id: "Alexandria", ar: "الإسكندرية", lat: 31.2001, lng: 29.9187 },
  { id: "Port Said", ar: "بورسعيد", lat: 31.2653, lng: 32.3019 },
  { id: "Suez", ar: "السويس", lat: 29.9668, lng: 32.5498 },
  { id: "Damietta", ar: "دمياط", lat: 31.4165, lng: 31.8133 },
  { id: "Dakahlia", ar: "الدقهلية", lat: 31.0409, lng: 31.3785 },
  { id: "Sharqia", ar: "الشرقية", lat: 30.5877, lng: 31.5020 },
  { id: "Gharbia", ar: "الغربية", lat: 30.7865, lng: 31.0004 },
  { id: "Monufia", ar: "المنوفية", lat: 30.5972, lng: 30.9876 },
  { id: "Kafr El Sheikh", ar: "كفر الشيخ", lat: 31.1107, lng: 30.9388 },
  { id: "Beheira", ar: "البحيرة", lat: 31.0341, lng: 30.4682 },
  { id: "Ismailia", ar: "الإسماعيلية", lat: 30.5965, lng: 32.2715 },
  { id: "North Sinai", ar: "شمال سيناء", lat: 31.1320, lng: 33.8030 },
  { id: "South Sinai", ar: "جنوب سيناء", lat: 28.2400, lng: 33.6200 },
  { id: "Fayoum", ar: "الفيوم", lat: 29.3084, lng: 30.8428 },
  { id: "Beni Suef", ar: "بني سويف", lat: 29.0661, lng: 31.0994 },
  { id: "Minya", ar: "المنيا", lat: 28.1099, lng: 30.7503 },
  { id: "Asyut", ar: "أسيوط", lat: 27.1809, lng: 31.1837 },
  { id: "Sohag", ar: "سوهاج", lat: 26.5569, lng: 31.6948 },
  { id: "Qena", ar: "قنا", lat: 26.1551, lng: 32.7160 },
  { id: "Luxor", ar: "الأقصر", lat: 25.6872, lng: 32.6396 },
  { id: "Aswan", ar: "أسوان", lat: 24.0889, lng: 32.8998 },
  { id: "Red Sea", ar: "البحر الأحمر", lat: 27.2579, lng: 33.8116 },
  { id: "New Valley", ar: "الوادي الجديد", lat: 25.4500, lng: 30.5500 },
  { id: "Matrouh", ar: "مطروح", lat: 31.3543, lng: 27.2373 },
];

/* Best-effort: map free text (e.g. the public booking form's "Area / address", which
 * is typed freely in Arabic or English) onto a registered zone. Longest matching
 * name wins so "New Maadi" beats "Maadi". Returns null when nothing matches. */
export function zoneFromText(text) {
  const s = (text || "").toLowerCase();
  if (!s.trim()) return null;
  let best = null, bestLen = 0;
  const consider = (zone, name) => {
    const n = (name || "").toLowerCase();
    if (n.length > bestLen && n.length >= 3 && s.includes(n)) { best = zone; bestLen = n.length; }
  };
  for (const z of ZONES) {
    consider(z, z.replace(/\s*\(.*\)\s*/, ""));   // "Haram (Pyramids)" -> "Haram"
    consider(z, z);
    for (const part of (ZONE_AR[z] || "").split("/")) consider(z, part.trim());
  }
  return best;
}
