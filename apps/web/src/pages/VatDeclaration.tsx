import { api } from "../api";
import type { SkVatDeclarationResponse } from "../api";
import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { useReportQuery } from "../hooks/useReportQuery";
import { toCsv, downloadCsv } from "../utils/csv";

// ── SKV box layout (section → boxes) ────────────────────────

interface BoxDef {
  readonly box: number;
  readonly label: string;
  readonly key: keyof SkVatDeclarationResponse;
}

interface SectionDef {
  readonly title: string;
  readonly boxes: readonly BoxDef[];
}

const SECTIONS: readonly SectionDef[] = [
  {
    title: "A. Momspliktig försäljning eller uttag (exkl. moms)",
    boxes: [
      {
        box: 5,
        label: "Momspliktig försäljning som inte ingår i ruta 06, 07 eller 08",
        key: "ruta05",
      },
      { box: 6, label: "Momspliktiga uttag", key: "ruta06" },
      { box: 7, label: "Beskattningsunderlag vid vinstmarginalbeskattning", key: "ruta07" },
      { box: 8, label: "Hyresinkomster vid frivillig skattskyldighet", key: "ruta08" },
    ],
  },
  {
    title: "B. Utgående moms",
    boxes: [
      { box: 10, label: "Utgående moms 25 %", key: "ruta10" },
      { box: 11, label: "Utgående moms 12 %", key: "ruta11" },
      { box: 12, label: "Utgående moms 6 %", key: "ruta12" },
    ],
  },
  {
    title: "C. Inköp med omvänd skattskyldighet / EU-handel",
    boxes: [
      { box: 20, label: "Inköp av varor från annat EU-land", key: "ruta20" },
      {
        box: 21,
        label: "Inköp av tjänster från annat EU-land enligt huvudregeln",
        key: "ruta21",
      },
      {
        box: 22,
        label: "Inköp av varor i Sverige som köparen är skattskyldig för",
        key: "ruta22",
      },
      {
        box: 23,
        label: "Inköp av tjänster i Sverige som köparen är skattskyldig för",
        key: "ruta23",
      },
      { box: 24, label: "Övriga inköp av tjänster utanför EU", key: "ruta24" },
      { box: 30, label: "Moms på varuinköp från annat EU-land", key: "ruta30" },
      { box: 31, label: "Moms på tjänsteinköp från annat EU-land", key: "ruta31" },
      { box: 32, label: "Moms på inköp av varor, omvänd skattskyldighet", key: "ruta32" },
      { box: 33, label: "Moms på inköp av tjänster, omvänd skattskyldighet", key: "ruta33" },
    ],
  },
  {
    title: "D. Momsfri försäljning m.m.",
    boxes: [
      { box: 35, label: "Försäljning av varor till annat EU-land", key: "ruta35" },
      { box: 36, label: "Försäljning av varor utanför EU", key: "ruta36" },
      { box: 37, label: "Mellanmans inköp av varor vid trepartshandel", key: "ruta37" },
      { box: 38, label: "Mellanmans försäljning av varor vid trepartshandel", key: "ruta38" },
      {
        box: 39,
        label: "Försäljning av tjänster till näringsidkare i annat EU-land",
        key: "ruta39",
      },
      { box: 40, label: "Övrig momsfri försäljning", key: "ruta40" },
    ],
  },
  {
    title: "E. Moms vid import",
    boxes: [
      { box: 41, label: "Momspliktiga inköp vid import", key: "ruta41" },
      { box: 42, label: "Beskattningsunderlag vid import", key: "ruta42" },
      { box: 50, label: "Moms på import", key: "ruta50" },
    ],
  },
  {
    title: "F. Ingående moms",
    boxes: [{ box: 48, label: "Ingående moms att dra av", key: "ruta48" }],
  },
];

// ── Format helpers ──────────────────────────────────────────

function formatKr(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Component ───────────────────────────────────────────────

export function VatDeclaration() {
  const { data, isLoading, error, setDateRange } = useReportQuery(
    "vat-declaration",
    api.getVatDeclaration,
  );

  const decl = data?.data;

  const handleExportCsv = () => {
    if (!decl) return;
    const rows: string[][] = [];
    for (const section of SECTIONS) {
      rows.push([section.title, "", ""]);
      for (const boxDef of section.boxes) {
        const val = decl[boxDef.key] as number;
        rows.push([String(boxDef.box).padStart(2, "0"), boxDef.label, String(val)]);
      }
    }
    rows.push(["", "", ""]);
    rows.push(["49", "Moms att betala eller få tillbaka", String(decl.ruta49)]);
    const csv = toCsv(["Ruta", "Beskrivning", "Belopp (kr)"], rows);
    downloadCsv(csv, "momsdeklaration-skv4700.csv");
  };

  return (
    <ReportPageTemplate
      title="Momsdeklaration — SKV 4700"
      isLoading={isLoading}
      error={error}
      isEmpty={!decl}
      loadingText="Laddar momsdeklaration..."
      className="skv-declaration"
      titleExtra={
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: 0 }}>
          Skattedeklaration för moms. Belopp i hela kronor.
        </p>
      }
      actions={
        decl && (
          <>
            <button className="secondary" onClick={handleExportCsv}>
              Exportera CSV
            </button>
            <button className="secondary" onClick={() => window.print()}>
              Skriv ut
            </button>
          </>
        )
      }
      filters={<DateFilter onFilter={setDateRange} />}
    >
      {decl && (
        <>
          {/* ── Sections A–F ── */}
          {SECTIONS.map((section) => {
            const hasValues = section.boxes.some((b) => (decl[b.key] as number) !== 0);
            return (
              <div key={section.title} style={{ marginBottom: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    borderBottom: "1px solid #ddd",
                    paddingBottom: "0.25rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  {section.title}
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "3.5rem" }}>
                        Ruta
                      </th>
                      <th scope="col">Beskrivning</th>
                      <th scope="col" className="text-right" style={{ width: "8rem" }}>
                        Belopp (kr)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.boxes.map((boxDef) => {
                      const val = decl[boxDef.key] as number;
                      return (
                        <tr
                          key={boxDef.box}
                          style={{ color: val === 0 && hasValues ? "#aaa" : undefined }}
                        >
                          <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                            {String(boxDef.box).padStart(2, "0")}
                          </td>
                          <td>{boxDef.label}</td>
                          <td className="text-right amount" style={{ fontFamily: "monospace" }}>
                            {formatKr(val)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* ── G. Resultat (ruta 49) ── */}
          <div
            style={{
              borderTop: "2px solid var(--color-border-dark)",
              paddingTop: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            <table>
              <tbody>
                <tr style={{ fontWeight: "bold", fontSize: "1.05rem" }}>
                  <td style={{ width: "3.5rem", fontFamily: "monospace" }}>49</td>
                  <td>
                    {decl.ruta49 >= 0 ? "Moms att betala" : "Moms att få tillbaka (momsfordran)"}
                  </td>
                  <td
                    className="text-right amount"
                    style={{
                      width: "8rem",
                      fontFamily: "monospace",
                      color: decl.ruta49 >= 0 ? "#b91c1c" : "#15803d",
                    }}
                  >
                    {formatKr(Math.abs(decl.ruta49))} kr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </ReportPageTemplate>
  );
}
