import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate, oreToKronor } from "../utils/formatting";

export function VoucherList() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["vouchers", organization?.id, fiscalYear?.id],
    queryFn: () => api.getVouchers(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  const { data: gapsData } = useQuery({
    queryKey: ["voucher-gaps", organization?.id, fiscalYear?.id],
    queryFn: () => api.getVoucherGaps(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar verifikat...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const vouchers = data?.data ?? [];
  const gaps = gapsData?.data;

  if (vouchers.length === 0) {
    return (
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <h2>Verifikat</h2>
          <button onClick={() => navigate("/vouchers/new")}>+ Nytt verifikat</button>
        </div>
        <div className="empty">Inga verifikat ännu. Skapa ditt första verifikat!</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Verifikat</h2>
        <button onClick={() => navigate("/vouchers/new")}>+ Nytt verifikat</button>
      </div>

      {gaps && gaps.count > 0 && (
        <div className="warning mb-2" style={{
          padding: "0.75rem 1rem",
          backgroundColor: "#fff3e0",
          border: "1px solid #ffb74d",
          borderRadius: "4px",
        }}>
          <strong>⚠ Luckor i verifikatnumrering (BFL 5:6):</strong>{" "}
          {gaps.count <= 10
            ? `Nummer ${gaps.gaps.join(", ")} saknas.`
            : `${gaps.count} nummer saknas (${gaps.gaps.slice(0, 5).join(", ")}…).`
          }
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Nr</th>
            <th>Datum</th>
            <th>Beskrivning</th>
            <th className="text-right">Belopp</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((voucher) => {
            const totalOre = voucher.lines.reduce((sum, l) => sum + l.debit, 0);
            const isCorrected = !!voucher.correctedByVoucherId;
            const isCorrection = !!voucher.correctsVoucherId;
            return (
              <tr
                key={voucher.id}
                className={`clickable-row${isCorrected ? " corrected" : ""}`}
                onClick={() => navigate(`/vouchers/${voucher.id}`)}
              >
                <td>{voucher.number}</td>
                <td>{formatDate(voucher.date)}</td>
                <td>
                  {voucher.description}
                  {isCorrected && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: "0.75em" }}>Rättat</span>}
                  {isCorrection && <span className="badge badge-info" style={{ marginLeft: 6, fontSize: "0.75em" }}>Rättelse</span>}
                </td>
                <td className="text-right amount">
                  {formatAmount(oreToKronor(totalOre))} kr
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
