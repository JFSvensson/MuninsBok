import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate, oreToKronor } from "../utils/formatting";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DocumentSection } from "../components/DocumentSection";

export function VoucherDetail() {
  const { voucherId } = useParams<{ voucherId: string }>();
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCorrect, setShowCorrect] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["voucher", organization?.id, voucherId],
    queryFn: () => api.getVoucher(organization!.id, voucherId!),
    enabled: !!organization && !!voucherId,
  });

  const correctMutation = useMutation({
    mutationFn: () => api.correctVoucher(organization!.id, voucherId!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers", organization?.id, fiscalYear?.id] });
      queryClient.invalidateQueries({ queryKey: ["voucher", organization?.id, voucherId] });
      navigate(`/vouchers/${result.data.id}`);
    },
  });

  if (isLoading) return <div className="loading">Laddar verifikat...</div>;
  if (error) return <div className="error">Fel: {(error as Error).message}</div>;

  const voucher = data?.data;
  if (!voucher) return <div className="error">Verifikatet hittades inte.</div>;

  const totalDebit = voucher.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = voucher.lines.reduce((sum, l) => sum + l.credit, 0);
  const isCorrected = !!voucher.correctedByVoucherId;
  const isCorrection = !!voucher.correctsVoucherId;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>
          Verifikat #{voucher.number}
          {isCorrected && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Rättat</span>}
          {isCorrection && <span className="badge badge-info" style={{ marginLeft: 8 }}>Rättelseverifikat</span>}
        </h2>
        <div className="flex gap-1">
          <button className="secondary" onClick={() => navigate("/vouchers")}>
            ← Tillbaka
          </button>
          {!isCorrected && !isCorrection && (
            <button className="danger" onClick={() => setShowCorrect(true)}>
              Rätta
            </button>
          )}
        </div>
      </div>

      {isCorrected && (
        <div className="info-box mb-2">
          Detta verifikat har rättats.
          <Link to={`/vouchers/${voucher.correctedByVoucherId}`}> Visa rättelseverifikat →</Link>
        </div>
      )}
      {isCorrection && (
        <div className="info-box mb-2">
          Detta är en rättelse av verifikat.
          <Link to={`/vouchers/${voucher.correctsVoucherId}`}> Visa originalverifikat →</Link>
        </div>
      )}

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

      <DocumentSection organizationId={organization!.id} voucherId={voucher.id} />

      {/* Help text about corrections */}
      {!isCorrected && !isCorrection && (
        <details className="correction-help mt-1">
          <summary>Om rättelse av verifikat</summary>
          <p>
            Enligt bokföringslagen (BFL) får ett bokfört verifikat inte raderas eller ändras i
            efterhand. Istället skapas ett <strong>rättelseverifikat</strong> som innehåller
            omvända belopp — debet blir kredit och tvärtom. Originalverifikatet markeras då som
            rättat och det nya rättelseverifikatet länkas till det.
          </p>
          <p>
            Båda verifikaten finns kvar i bokföringen och kan granskas vid revision. Om du vill
            bokföra korrekta belopp efter rättelsen skapar du ett nytt verifikat med rätt värden.
          </p>
        </details>
      )}

      <ConfirmDialog
        open={showCorrect}
        title="Rätta verifikat"
        message={`Vill du skapa ett rättelseverifikat för verifikat #${voucher.number}? Ett nytt verifikat med omvända belopp skapas.`}
        confirmLabel="Skapa rättelse"
        onConfirm={() => correctMutation.mutate()}
        onCancel={() => setShowCorrect(false)}
        isPending={correctMutation.isPending}
      />
    </div>
  );
}
