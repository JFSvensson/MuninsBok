import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { parseAmountToOre } from "../utils/formatting";

export interface VoucherLineInput {
  accountNumber: string;
  debit: string;
  credit: string;
  description: string;
}

const createEmptyLine = (): VoucherLineInput => ({
  accountNumber: "",
  debit: "",
  credit: "",
  description: "",
});

interface UseVoucherFormOptions {
  organizationId: string;
  fiscalYearId: string;
  onSuccess?: () => void;
}

export function useVoucherForm({ organizationId, fiscalYearId, onSuccess }: UseVoucherFormOptions) {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<VoucherLineInput[]>([createEmptyLine(), createEmptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createVoucher>[1]) =>
      api.createVoucher(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateLine = useCallback((index: number, field: keyof VoucherLineInput, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine()]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
    const totalCredit = lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    return { totalDebit, totalCredit, isBalanced };
  }, [lines]);

  const submit = useCallback(() => {
    setError(null);

    const voucherLines = lines
      .filter((l) => l.accountNumber && (l.debit || l.credit))
      .map((l) => ({
        accountNumber: l.accountNumber,
        debit: parseAmountToOre(l.debit),
        credit: parseAmountToOre(l.credit),
        description: l.description || undefined,
      }));

    if (voucherLines.length < 2) {
      setError("Verifikatet måste ha minst två rader");
      return;
    }

    createMutation.mutate({
      fiscalYearId,
      date,
      description,
      lines: voucherLines,
    });
  }, [lines, fiscalYearId, date, description, createMutation]);

  const reset = useCallback(() => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setLines([createEmptyLine(), createEmptyLine()]);
    setError(null);
  }, []);

  const canSubmit = isBalanced && totalDebit > 0 && !createMutation.isPending;

  return {
    // Form state
    date,
    setDate,
    description,
    setDescription,
    lines,
    error,

    // Line operations
    updateLine,
    addLine,
    removeLine,

    // Computed values
    totalDebit,
    totalCredit,
    isBalanced,
    canSubmit,

    // Actions
    submit,
    reset,
    isPending: createMutation.isPending,
  };
}
