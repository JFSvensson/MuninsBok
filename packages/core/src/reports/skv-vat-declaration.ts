import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * SKV Momsdeklaration (Skattedeklaration moms, blankett SKV 4700)
 *
 * Maps bookkeeping data from BAS 2024 accounts to the official Swedish
 * Tax Agency (Skatteverket) VAT declaration boxes.
 *
 * All amounts are in öre internally; the API layer converts to whole kronor
 * (standard for SKV declarations).
 *
 * Account mapping (BAS 2024 simplified):
 *   2610 → Utgående moms 25%  (ruta 10)
 *   2620 → Utgående moms 12%  (ruta 11)
 *   2630 → Utgående moms 6%   (ruta 12)
 *   2640 → Ingående moms      (ruta 48)
 *
 * Tax bases (ruta 05) are back-calculated from VAT amounts:
 *   2610 / 0.25 + 2620 / 0.12 + 2630 / 0.06
 */

// ── SKV box definitions ─────────────────────────────────────

/** A single box (ruta) on the SKV declaration form. */
export interface SkVatBox {
  /** Box number as shown on the SKV form (e.g. 5, 10, 48) */
  readonly box: number;
  /** Swedish label from the SKV form */
  readonly label: string;
  /** Amount in öre (positive = tax to pay / reported base) */
  readonly amount: number;
}

/** Complete SKV momsdeklaration mapped to form boxes. */
export interface SkVatDeclaration {
  // ── A. Momspliktig försäljning / underlag ──
  /** Ruta 05 – Momspliktig försäljning som inte ingår i ruta 06, 07 eller 08 */
  readonly ruta05: number;
  /** Ruta 06 – Momspliktiga uttag */
  readonly ruta06: number;
  /** Ruta 07 – Beskattningsunderlag vid vinstmarginalbeskattning */
  readonly ruta07: number;
  /** Ruta 08 – Hyresinkomster vid frivillig skattskyldighet */
  readonly ruta08: number;

  // ── B. Utgående moms ──
  /** Ruta 10 – Utgående moms 25 % */
  readonly ruta10: number;
  /** Ruta 11 – Utgående moms 12 % */
  readonly ruta11: number;
  /** Ruta 12 – Utgående moms 6 % */
  readonly ruta12: number;

  // ── C. Moms vid inköp / EU-handel ──
  /** Ruta 20 – Inköp av varor från annat EU-land */
  readonly ruta20: number;
  /** Ruta 21 – Inköp av tjänster från annat EU-land (huvudregeln) */
  readonly ruta21: number;
  /** Ruta 22 – Inköp av varor i Sverige som köparen är skattskyldig för */
  readonly ruta22: number;
  /** Ruta 23 – Inköp av tjänster i Sverige som köparen är skattskyldig för */
  readonly ruta23: number;
  /** Ruta 24 – Övriga inköp av tjänster utanför EU */
  readonly ruta24: number;
  /** Ruta 30 – Moms på varuinköp från annat EU-land */
  readonly ruta30: number;
  /** Ruta 31 – Moms på tjänsteinköp från annat EU-land */
  readonly ruta31: number;
  /** Ruta 32 – Moms på inköp av varor, omvänd skattskyldighet */
  readonly ruta32: number;
  /** Ruta 33 – Moms på inköp av tjänster, omvänd skattskyldighet */
  readonly ruta33: number;

  // ── D. Momsfri försäljning m.m. ──
  /** Ruta 35 – Försäljning av varor till annat EU-land */
  readonly ruta35: number;
  /** Ruta 36 – Försäljning av varor utanför EU */
  readonly ruta36: number;
  /** Ruta 37 – Mellanmans inköp av varor vid trepartshandel */
  readonly ruta37: number;
  /** Ruta 38 – Mellanmans försäljning av varor vid trepartshandel */
  readonly ruta38: number;
  /** Ruta 39 – Försäljning av tjänster till näringsidkare i annat EU-land */
  readonly ruta39: number;
  /** Ruta 40 – Övrig momsfri försäljning */
  readonly ruta40: number;
  /** Ruta 41 – Momspliktiga inköp vid import */
  readonly ruta41: number;
  /** Ruta 42 – Beskattningsunderlag vid import */
  readonly ruta42: number;

  // ── E. Moms på import ──
  /** Ruta 50 – Moms på import */
  readonly ruta50: number;

  // ── F. Ingående moms ──
  /** Ruta 48 – Ingående moms att dra av */
  readonly ruta48: number;

  // ── G. Resultat ──
  /** Ruta 49 – Moms att betala eller få tillbaka */
  readonly ruta49: number;

  /** When the declaration was generated */
  readonly generatedAt: Date;

  /** Structured list of all non-zero boxes for rendering */
  readonly boxes: readonly SkVatBox[];
}

// ── Account constants ───────────────────────────────────────

const ACCOUNT_OUTPUT_VAT_25 = "2610";
const ACCOUNT_OUTPUT_VAT_12 = "2620";
const ACCOUNT_OUTPUT_VAT_6 = "2630";
const ACCOUNT_INPUT_VAT = "2640";

// ── Helpers ─────────────────────────────────────────────────

/**
 * Aggregate the *credit balance* (credit − debit) for each account across
 * all voucher lines.  Returns a Map of accountNumber → net credit balance
 * in öre.
 */
function aggregateBalances(vouchers: readonly Voucher[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const v of vouchers) {
    for (const line of v.lines) {
      const prev = balances.get(line.accountNumber) ?? 0;
      balances.set(line.accountNumber, prev + line.credit - line.debit);
    }
  }
  return balances;
}

/**
 * Get credit balance for an account (output VAT accounts have natural
 * credit balance — positive means tax to report).
 */
function creditBalance(balances: Map<string, number>, account: string): number {
  return Math.max(0, balances.get(account) ?? 0);
}

/**
 * Get debit balance for an account (input VAT has natural debit balance).
 */
function debitBalance(balances: Map<string, number>, account: string): number {
  const raw = balances.get(account) ?? 0;
  return Math.max(0, -raw); // debit balance is stored as negative credit
}

/**
 * Back-calculate the tax base from a VAT amount and rate.
 * Returns 0 if vatAmount is 0.
 *
 * Example: 2500 öre VAT at 25% → 10000 öre tax base
 */
function taxBase(vatAmount: number, rate: number): number {
  if (vatAmount === 0) return 0;
  return Math.round(vatAmount / rate);
}

// ── Main calculator ─────────────────────────────────────────

/**
 * Calculate the SKV momsdeklaration (VAT declaration) from vouchers and
 * accounts.
 *
 * Currently auto-populates boxes for domestic sales with standard VAT
 * rates (25 %, 12 %, 6 %) and input VAT deductions.  EU trade and
 * special scenarios (boxes 06–08, 20–24, 30–42, 50) default to 0 and
 * can be shown as optional fields in the UI for manual override.
 *
 * @param vouchers - All vouchers for the period
 * @param _accounts - Account list (reserved for future account-type logic)
 * @returns Complete SkVatDeclaration with all boxes
 */
export function calculateSkVatDeclaration(
  vouchers: readonly Voucher[],
  _accounts: readonly Account[],
): SkVatDeclaration {
  const balances = aggregateBalances(vouchers);

  // ── Output VAT (ruta 10–12) ──
  const ruta10 = creditBalance(balances, ACCOUNT_OUTPUT_VAT_25);
  const ruta11 = creditBalance(balances, ACCOUNT_OUTPUT_VAT_12);
  const ruta12 = creditBalance(balances, ACCOUNT_OUTPUT_VAT_6);

  // ── Tax base (ruta 05) — back-calculated from VAT amounts ──
  const ruta05 = taxBase(ruta10, 0.25) + taxBase(ruta11, 0.12) + taxBase(ruta12, 0.06);

  // ── Input VAT (ruta 48) ──
  const ruta48 = debitBalance(balances, ACCOUNT_INPUT_VAT);

  // ── EU / special boxes — default 0 for simplified bookkeeping ──
  const ruta06 = 0;
  const ruta07 = 0;
  const ruta08 = 0;
  const ruta20 = 0;
  const ruta21 = 0;
  const ruta22 = 0;
  const ruta23 = 0;
  const ruta24 = 0;
  const ruta30 = 0;
  const ruta31 = 0;
  const ruta32 = 0;
  const ruta33 = 0;
  const ruta35 = 0;
  const ruta36 = 0;
  const ruta37 = 0;
  const ruta38 = 0;
  const ruta39 = 0;
  const ruta40 = 0;
  const ruta41 = 0;
  const ruta42 = 0;
  const ruta50 = 0;

  // ── Result (ruta 49) ──
  // SKV formula: 10 + 11 + 12 + 30 + 31 + 32 + 33 + 50 − 48
  const ruta49 = ruta10 + ruta11 + ruta12 + ruta30 + ruta31 + ruta32 + ruta33 + ruta50 - ruta48;

  // ── Build structured box list ──
  const allBoxes: [number, string, number][] = [
    [5, "Momspliktig försäljning som inte ingår i ruta 06, 07 eller 08", ruta05],
    [6, "Momspliktiga uttag", ruta06],
    [7, "Beskattningsunderlag vid vinstmarginalbeskattning", ruta07],
    [8, "Hyresinkomster vid frivillig skattskyldighet", ruta08],
    [10, "Utgående moms 25 %", ruta10],
    [11, "Utgående moms 12 %", ruta11],
    [12, "Utgående moms 6 %", ruta12],
    [20, "Inköp av varor från annat EU-land", ruta20],
    [21, "Inköp av tjänster från annat EU-land enligt huvudregeln", ruta21],
    [22, "Inköp av varor i Sverige som köparen är skattskyldig för", ruta22],
    [23, "Inköp av tjänster i Sverige som köparen är skattskyldig för", ruta23],
    [24, "Övriga inköp av tjänster som förvärvats från utlandet", ruta24],
    [30, "Moms på varuinköp från annat EU-land", ruta30],
    [31, "Moms på tjänsteinköp från annat EU-land", ruta31],
    [32, "Moms på inköp av varor, omvänd skattskyldighet", ruta32],
    [33, "Moms på inköp av tjänster, omvänd skattskyldighet", ruta33],
    [35, "Försäljning av varor till annat EU-land", ruta35],
    [36, "Försäljning av varor utanför EU", ruta36],
    [37, "Mellanmans inköp av varor vid trepartshandel", ruta37],
    [38, "Mellanmans försäljning av varor vid trepartshandel", ruta38],
    [39, "Försäljning av tjänster till näringsidkare i annat EU-land", ruta39],
    [40, "Övrig momsfri försäljning", ruta40],
    [41, "Momspliktiga inköp vid import", ruta41],
    [42, "Beskattningsunderlag vid import", ruta42],
    [48, "Ingående moms att dra av", ruta48],
    [49, "Moms att betala eller få tillbaka", ruta49],
    [50, "Moms på import", ruta50],
  ];

  const boxes: SkVatBox[] = allBoxes
    .filter(([, , amount]) => amount !== 0)
    .map(([box, label, amount]) => ({ box, label, amount }));

  return {
    ruta05,
    ruta06,
    ruta07,
    ruta08,
    ruta10,
    ruta11,
    ruta12,
    ruta20,
    ruta21,
    ruta22,
    ruta23,
    ruta24,
    ruta30,
    ruta31,
    ruta32,
    ruta33,
    ruta35,
    ruta36,
    ruta37,
    ruta38,
    ruta39,
    ruta40,
    ruta41,
    ruta42,
    ruta48,
    ruta49,
    ruta50,
    generatedAt: new Date(),
    boxes,
  };
}
