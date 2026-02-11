import type { Account } from "../types/account.js";

/**
 * Förenklad BAS-kontoplan för småföretag och föreningar.
 * Baserad på BAS 2024, reducerad till ~100 vanliga konton.
 */

export const BAS_SIMPLIFIED: readonly Account[] = [
  // ============================================
  // KONTOKLASS 1 - TILLGÅNGAR
  // ============================================

  // 10 Immateriella anläggningstillgångar
  { number: "1010", name: "Balanserade utgifter", type: "ASSET", isVatAccount: false, isActive: true },

  // 11 Byggnader och mark
  { number: "1110", name: "Byggnader", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1130", name: "Mark", type: "ASSET", isVatAccount: false, isActive: true },

  // 12 Maskiner och inventarier
  { number: "1210", name: "Maskiner och andra tekniska anläggningar", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1220", name: "Inventarier och verktyg", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1230", name: "Datorer", type: "ASSET", isVatAccount: false, isActive: true },

  // 13 Finansiella anläggningstillgångar
  { number: "1310", name: "Andelar i koncernföretag", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1380", name: "Andra långfristiga fordringar", type: "ASSET", isVatAccount: false, isActive: true },

  // 14 Lager
  { number: "1400", name: "Lager", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1410", name: "Lager av råvaror", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1460", name: "Lager av handelsvaror", type: "ASSET", isVatAccount: false, isActive: true },

  // 15 Kundfordringar
  { number: "1510", name: "Kundfordringar", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1519", name: "Nedskrivning av kundfordringar", type: "ASSET", isVatAccount: false, isActive: true },

  // 16 Övriga kortfristiga fordringar
  { number: "1610", name: "Fordringar hos anställda", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1630", name: "Avräkning för skatter och avgifter", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1650", name: "Momsfordran", type: "ASSET", isVatAccount: true, isActive: true },

  // 17 Förutbetalda kostnader och upplupna intäkter
  { number: "1710", name: "Förutbetalda hyreskostnader", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1730", name: "Förutbetalda försäkringspremier", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1790", name: "Övriga förutbetalda kostnader", type: "ASSET", isVatAccount: false, isActive: true },

  // 18 Kortfristiga placeringar
  { number: "1810", name: "Andelar i börsnoterade företag", type: "ASSET", isVatAccount: false, isActive: true },

  // 19 Kassa och bank
  { number: "1910", name: "Kassa", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1920", name: "PlusGiro", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1930", name: "Företagskonto/checkräkning", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1940", name: "Sparkonto", type: "ASSET", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 2 - EGET KAPITAL OCH SKULDER
  // ============================================

  // 20 Eget kapital
  { number: "2010", name: "Eget kapital", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "2013", name: "Privata uttag", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "2018", name: "Egen insättning", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "2019", name: "Årets resultat", type: "EQUITY", isVatAccount: false, isActive: true },

  // 20 Eget kapital - Aktiebolag
  { number: "2081", name: "Aktiekapital", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "2086", name: "Reservfond", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "2091", name: "Balanserad vinst eller förlust", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "2099", name: "Årets resultat", type: "EQUITY", isVatAccount: false, isActive: true },

  // 23 Långfristiga skulder
  { number: "2310", name: "Skulder till kreditinstitut långfristiga", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2350", name: "Skulder till delägare långfristiga", type: "LIABILITY", isVatAccount: false, isActive: true },

  // 24 Kortfristiga skulder till kreditinstitut
  { number: "2410", name: "Skulder till kreditinstitut kortfristiga", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2420", name: "Förskott från kunder", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2440", name: "Leverantörsskulder", type: "LIABILITY", isVatAccount: false, isActive: true },

  // 25 Skatteskulder
  { number: "2510", name: "Skatteskulder", type: "LIABILITY", isVatAccount: false, isActive: true },

  // 26 Moms och särskilda punktskatter
  { number: "2610", name: "Utgående moms 25%", type: "LIABILITY", isVatAccount: true, isActive: true },
  { number: "2620", name: "Utgående moms 12%", type: "LIABILITY", isVatAccount: true, isActive: true },
  { number: "2630", name: "Utgående moms 6%", type: "LIABILITY", isVatAccount: true, isActive: true },
  { number: "2640", name: "Ingående moms", type: "LIABILITY", isVatAccount: true, isActive: true },
  { number: "2650", name: "Momsredovisningskonto", type: "LIABILITY", isVatAccount: true, isActive: true },

  // 27 Personalens skatter, avgifter och löneavdrag
  { number: "2710", name: "Personalskatt", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2730", name: "Arbetsgivaravgifter", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2731", name: "Avräkning lagstadgade sociala avgifter", type: "LIABILITY", isVatAccount: false, isActive: true },

  // 28 Övriga kortfristiga skulder
  { number: "2890", name: "Övriga kortfristiga skulder", type: "LIABILITY", isVatAccount: false, isActive: true },

  // 29 Upplupna kostnader och förutbetalda intäkter
  { number: "2910", name: "Upplupna löner", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2920", name: "Upplupna semesterlöner", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2940", name: "Upplupna sociala avgifter", type: "LIABILITY", isVatAccount: false, isActive: true },
  { number: "2990", name: "Övriga upplupna kostnader", type: "LIABILITY", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 3 - INTÄKTER
  // ============================================

  // 30-34 Huvudintäkter
  { number: "3000", name: "Försäljning inom Sverige", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3001", name: "Försäljning 25% moms", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3002", name: "Försäljning 12% moms", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3003", name: "Försäljning 6% moms", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3010", name: "Medlemsavgifter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3040", name: "Försäljning tjänster", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3100", name: "Försäljning varor", type: "REVENUE", isVatAccount: false, isActive: true },

  // 35-36 Fakturerade kostnader
  { number: "3500", name: "Fakturerade kostnader", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3540", name: "Fakturerat frakt", type: "REVENUE", isVatAccount: false, isActive: true },

  // 37 Intäktskorrigeringar
  { number: "3740", name: "Öres- och kronutjämning", type: "REVENUE", isVatAccount: false, isActive: true },

  // 38 Aktiverat arbete
  { number: "3800", name: "Aktiverat arbete för egen räkning", type: "REVENUE", isVatAccount: false, isActive: true },

  // 39 Övriga rörelseintäkter
  { number: "3910", name: "Hyresintäkter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3920", name: "Provisionsintäkter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3960", name: "Valutakursvinster", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3970", name: "Vinst vid avyttring av immateriella anläggningstillgångar", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3980", name: "Erhållna bidrag", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3990", name: "Övriga ersättningar och intäkter", type: "REVENUE", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 4 - INKÖP/VAROR
  // ============================================

  { number: "4000", name: "Inköp varor och material", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "4010", name: "Inköp material och varor", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "4100", name: "Inköp handelsvaror", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "4600", name: "Legoarbete och underentreprenader", type: "EXPENSE", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 5 - LOKALKOSTNADER
  // ============================================

  { number: "5010", name: "Lokalhyra", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "5020", name: "El för lokal", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "5030", name: "Värme för lokal", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "5060", name: "Städning och renhållning", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "5090", name: "Övriga lokalkostnader", type: "EXPENSE", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 6 - ÖVRIGA FÖRSÄLJNINGSKOSTNADER
  // ============================================

  // 60 Förbrukningsmaterial
  { number: "6010", name: "Kontorsmaterial", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6110", name: "Kontorsmateriel", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6150", name: "Förbrukningsinventarier", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 62 Telekommunikation
  { number: "6210", name: "Telekommunikation", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6211", name: "Telefon", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6212", name: "Mobiltelefon", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6230", name: "Datakommunikation", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 63 Försäkringar
  { number: "6310", name: "Företagsförsäkringar", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 64 Förvaltningskostnader
  { number: "6410", name: "Styrelsearvoden", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6420", name: "Revisionsarvoden", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6490", name: "Övriga förvaltningskostnader", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 65 Övriga externa tjänster
  { number: "6530", name: "Redovisningstjänster", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6540", name: "IT-tjänster", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6550", name: "Konsultarvoden", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6570", name: "Bankkostnader", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 68 Resekostnader
  { number: "6810", name: "Resekostnader", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6970", name: "Representation", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 69 Reklam
  { number: "6990", name: "Övriga externa kostnader", type: "EXPENSE", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 7 - PERSONAL
  // ============================================

  { number: "7010", name: "Löner till kollektivanställda", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7210", name: "Löner till tjänstemän", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7220", name: "Löner till företagsledare", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7310", name: "Kontanta extraersättningar", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7410", name: "Semesterlöner", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7510", name: "Arbetsgivaravgifter", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7519", name: "Arbetsgivaravgifter för semester", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7570", name: "Särskild löneskatt på pensionskostnader", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7610", name: "Utbildning", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "7690", name: "Övriga personalkostnader", type: "EXPENSE", isVatAccount: false, isActive: true },

  // ============================================
  // KONTOKLASS 8 - FINANSIELLA POSTER
  // ============================================

  // 83 Ränteintäkter
  { number: "8310", name: "Ränteintäkter från omsättningstillgångar", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "8314", name: "Skattefria ränteintäkter", type: "REVENUE", isVatAccount: false, isActive: true },

  // 84 Räntekostnader
  { number: "8410", name: "Räntekostnader för långfristiga skulder", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "8420", name: "Räntekostnader för kortfristiga skulder", type: "EXPENSE", isVatAccount: false, isActive: true },

  // 89 Skatter och årets resultat
  { number: "8910", name: "Skatt på årets resultat", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "8999", name: "Årets resultat", type: "EXPENSE", isVatAccount: false, isActive: true },
] as const;

/**
 * Get accounts for a specific type
 */
export function getAccountsByType(
  accounts: readonly Account[],
  type: Account["type"]
): Account[] {
  return accounts.filter((a) => a.type === type);
}

/**
 * Find an account by number
 */
export function getAccountByNumber(
  accounts: readonly Account[],
  number: string
): Account | undefined {
  return accounts.find((a) => a.number === number);
}

/**
 * Get all VAT accounts
 */
export function getVatAccounts(accounts: readonly Account[]): Account[] {
  return accounts.filter((a) => a.isVatAccount);
}
