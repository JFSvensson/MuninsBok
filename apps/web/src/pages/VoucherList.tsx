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

  if (isLoading) {
    return <div className="loading">Laddar verifikat...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const vouchers = data?.data ?? [];

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
            return (
              <tr
                key={voucher.id}
                className="clickable-row"
                onClick={() => navigate(`/vouchers/${voucher.id}`)}
              >
                <td>{voucher.number}</td>
                <td>{formatDate(voucher.date)}</td>
                <td>{voucher.description}</td>
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
