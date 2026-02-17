import { useState } from "react";

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateFilterProps {
  onFilter: (range: DateRange | undefined) => void;
}

export function DateFilter({ onFilter }: DateFilterProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      onFilter({ startDate, endDate });
    }
  };

  const handleClear = () => {
    setStartDate("");
    setEndDate("");
    onFilter(undefined);
  };

  return (
    <form onSubmit={handleApply} className="flex gap-1 items-center date-filter">
      <label style={{ fontSize: "0.9rem", whiteSpace: "nowrap" }}>Period:</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        style={{ width: "auto", flex: "none" }}
      />
      <span style={{ fontSize: "0.9rem" }}>–</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        style={{ width: "auto", flex: "none" }}
      />
      <button type="submit" className="secondary" disabled={!startDate || !endDate}>
        Filtrera
      </button>
      {(startDate || endDate) && (
        <button type="button" className="secondary" onClick={handleClear}>
          Rensa
        </button>
      )}
    </form>
  );
}
