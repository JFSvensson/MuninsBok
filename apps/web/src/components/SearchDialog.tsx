import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { api } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";
import styles from "./SearchDialog.module.css";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: "Tillgång",
  LIABILITY: "Skuld",
  EQUITY: "Eget kapital",
  REVENUE: "Intäkt",
  EXPENSE: "Kostnad",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { organization, fiscalYear } = useOrganization();

  const { data, isFetching } = useQuery({
    queryKey: ["search", organization?.id, fiscalYear?.id, query],
    queryFn: () => api.search(defined(organization).id, defined(fiscalYear).id, query),
    enabled: open && !!organization && !!fiscalYear && query.trim().length >= 2,
    staleTime: 30_000,
  });

  const results = data?.data;

  // Build flat list of navigable items
  const items: { type: "voucher" | "account"; id: string; label: string }[] = [];
  if (results) {
    for (const v of results.vouchers) {
      items.push({ type: "voucher", id: v.id, label: `V${v.number}` });
    }
    for (const a of results.accounts) {
      items.push({ type: "account", id: a.number, label: a.number });
    }
  }

  const navigateToItem = useCallback(
    (item: { type: "voucher" | "account"; id: string }) => {
      if (item.type === "voucher") {
        navigate(`/vouchers/${item.id}`);
      } else {
        navigate(`/reports/account-analysis?account=${item.id}`);
      }
      onClose();
    },
    [navigate, onClose],
  );

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items[activeIndex]) {
        e.preventDefault();
        navigateToItem(items[activeIndex]);
      }
    },
    [items, activeIndex, onClose, navigateToItem],
  );

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-label="Sök">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className={styles.inputRow}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Sök verifikat, konton..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Sökterm"
          />
          {isFetching && <span aria-label="Söker">⏳</span>}
        </div>

        <div className={styles.results}>
          {query.trim().length < 2 ? (
            <div className={styles.empty}>Skriv minst 2 tecken för att söka</div>
          ) : results && results.totalHits === 0 ? (
            <div className={styles.empty}>Inga träffar för &quot;{query}&quot;</div>
          ) : results ? (
            <>
              {results.vouchers.length > 0 && (
                <>
                  <div className={styles.groupLabel}>Verifikat ({results.vouchers.length})</div>
                  {results.vouchers.map((v, i) => (
                    <div
                      key={v.id}
                      className={styles.resultItem}
                      data-active={activeIndex === i}
                      onClick={() => navigateToItem({ type: "voucher", id: v.id })}
                    >
                      <div className={styles.resultMain}>
                        <div className={styles.resultTitle}>
                          #{v.number} — {v.description}
                        </div>
                        <div className={styles.resultMeta}>
                          {formatDate(v.date)} · {formatAmount(v.amount)} kr
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {results.accounts.length > 0 && (
                <>
                  <div className={styles.groupLabel}>Konton ({results.accounts.length})</div>
                  {results.accounts.map((a, i) => {
                    const idx = results.vouchers.length + i;
                    return (
                      <div
                        key={a.number}
                        className={styles.resultItem}
                        data-active={activeIndex === idx}
                        onClick={() => navigateToItem({ type: "account", id: a.number })}
                      >
                        <div className={styles.resultMain}>
                          <div className={styles.resultTitle}>
                            {a.number} — {a.name}
                          </div>
                        </div>
                        <span className={styles.badge}>
                          {ACCOUNT_TYPE_LABELS[a.type] ?? a.type}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          ) : null}
        </div>

        <div className={styles.hint}>
          <span className={styles.kbd}>↑↓</span> navigera
          <span className={styles.kbd}>↵</span> öppna
          <span className={styles.kbd}>esc</span> stäng
        </div>
      </div>
    </div>
  );
}
