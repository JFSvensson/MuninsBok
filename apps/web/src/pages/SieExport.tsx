import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decodeSieFile } from "@muninsbok/core";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";

export function SieExport() {
  const { organization, fiscalYear } = useOrganization();
  const queryClient = useQueryClient();
  const [importResult, setImportResult] = useState<{
    vouchersImported: number;
    accountsImported: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (content: string) => api.importSie(organization!.id, fiscalYear!.id, content),
    onSuccess: (data) => {
      setImportResult(data.data);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      setImportResult(null);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const content = decodeSieFile(new Uint8Array(buffer));
    importMutation.mutate(content);
  };

  const handleExport = () => {
    const url = api.exportSie(organization!.id, fiscalYear!.id);
    window.open(url, "_blank");
  };

  return (
    <div className="card">
      <h2>SIE Import/Export</h2>

      <p className="mb-2">
        SIE är ett standardformat för att utbyta bokföringsdata mellan olika program.
      </p>

      {error && <div className="error">{error}</div>}

      {importResult && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#e8f5e9",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          Import lyckades! {importResult.vouchersImported} verifikat och{" "}
          {importResult.accountsImported} konton importerades.
        </div>
      )}

      <div className="flex gap-2">
        <div className="card" style={{ flex: 1 }}>
          <h3>Exportera</h3>
          <p className="mb-2">
            Ladda ner bokföringen som en SIE4-fil för att använda i andra program eller för
            revision.
          </p>
          <button onClick={handleExport}>Ladda ner SIE-fil</button>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <h3>Importera</h3>
          <p className="mb-2">Importera verifikat från en SIE-fil. Appen stöder SIE4-format.</p>
          <input
            type="file"
            accept=".se,.sie,.si"
            onChange={handleFileUpload}
            disabled={importMutation.isPending}
          />
          {importMutation.isPending && <p>Importerar...</p>}
        </div>
      </div>
    </div>
  );
}
