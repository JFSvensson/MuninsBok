import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate, oreToKronor } from "../utils/formatting";

export function VoucherList() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["vouchers", organization?.id, fiscalYear?.id, page, limit, search],
    queryFn: () =>
      api.getVouchers(organization!.id, fiscalYear!.id, {
        page,
        limit,
        search: search || undefined,
      }),
    enabled: !!organization && !!fiscalYear,
  });

  const { data: gapsData } = useQuery({
    queryKey: ["voucher-gaps", organization?.id, fiscalYear?.id],
    queryFn: () => api.getVoucherGaps(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  if (isLoading) {
    return <div className="loading">Laddar verifikat...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const vouchers = data?.data ?? [];
  const pagination = data?.pagination;
  const gaps = gapsData?.data;

  if (vouchers.length === 0 && !search) {
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

      <form onSubmit={handleSearch} className="flex gap-1 mb-2">
        <input
          type="text"
          placeholder="Sök verifikat (beskrivning eller nummer)…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="secondary">
          Sök
        </button>
        {search && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
          >
            Rensa
          </button>
        )}
      </form>

      {gaps && gaps.count > 0 && (
        <div
          className="warning mb-2"
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fff3e0",
            border: "1px solid #ffb74d",
            borderRadius: "4px",
          }}
        >
          <strong>⚠ Luckor i verifikatnumrering (BFL 5:6):</strong>{" "}
          {gaps.count <= 10
            ? `Nummer ${gaps.gaps.join(", ")} saknas.`
            : `${gaps.count} nummer saknas (${gaps.gaps.slice(0, 5).join(", ")}…).`}
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
                  {isCorrected && (
                    <span
                      className="badge badge-warning"
                      style={{ marginLeft: 6, fontSize: "0.75em" }}
                    >
                      Rättat
                    </span>
                  )}
                  {isCorrection && (
                    <span
                      className="badge badge-info"
                      style={{ marginLeft: 6, fontSize: "0.75em" }}
                    >
                      Rättelse
                    </span>
                  )}
                </td>
                <td className="text-right amount">{formatAmount(oreToKronor(totalOre))} kr</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center" style={{ marginTop: "1rem" }}>
          <span style={{ color: "#666", fontSize: "0.9rem" }}>
            Visar {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} av {pagination.total}
          </span>
          <div className="flex gap-1">
            <button
              className="secondary"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Föregående
            </button>
            <button
              className="secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Nästa →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
