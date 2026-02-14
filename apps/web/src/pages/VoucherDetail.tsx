import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate, oreToKronor } from "../utils/formatting";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function VoucherDetail() {
  const { voucherId } = useParams<{ voucherId: string }>();
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["voucher", organization?.id, voucherId],
    queryFn: () => api.getVoucher(organization!.id, voucherId!),
    enabled: !!organization && !!voucherId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteVoucher(organization!.id, voucherId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers", organization?.id, fiscalYear?.id] });
      navigate("/vouchers");
    },
  });

  if (isLoading) return <div className="loading">Laddar verifikat...</div>;
  if (error) return <div className="error">Fel: {(error as Error).message}</div>;

  const voucher = data?.data;
  if (!voucher) return <div className="error">Verifikatet hittades inte.</div>;

  const totalDebit = voucher.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = voucher.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Verifikat #{voucher.number}</h2>
        <div className="flex gap-1">
          <button className="secondary" onClick={() => navigate("/vouchers")}>
            ← Tillbaka
          </button>
          <button className="danger" onClick={() => setShowDelete(true)}>
            Radera
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <div>
          <strong>Datum:</strong> {formatDate(voucher.date)}
        </div>
        <div>
          <strong>Beskrivning:</strong> {voucher.description}
        </div>
        <div>
          <strong>Skapad:</strong> {formatDate(voucher.createdAt)}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Konto</th>
            <th>Beskrivning</th>
            <th className="text-right">Debet</th>
            <th className="text-right">Kredit</th>
          </tr>
        </thead>
        <tbody>
          {voucher.lines.map((line) => (
            <tr key={line.id}>
              <td><strong>{line.accountNumber}</strong></td>
              <td>{line.description ?? ""}</td>
              <td className="text-right amount">
                {line.debit > 0 ? `${formatAmount(oreToKronor(line.debit))} kr` : ""}
              </td>
              <td className="text-right amount">
                {line.credit > 0 ? `${formatAmount(oreToKronor(line.credit))} kr` : ""}
              </td>
            </tr>
          ))}
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={2}>Summa</td>
            <td className="text-right amount">{formatAmount(oreToKronor(totalDebit))} kr</td>
            <td className="text-right amount">{formatAmount(oreToKronor(totalCredit))} kr</td>
          </tr>
        </tbody>
      </table>

      <ConfirmDialog
        open={showDelete}
        title="Radera verifikat"
        message={`Vill du verkligen radera verifikat #${voucher.number}? Detta kan inte ångras.`}
        confirmLabel="Radera"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
