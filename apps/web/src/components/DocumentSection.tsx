import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentSectionProps {
  organizationId: string;
  voucherId: string;
}

export function DocumentSection({ organizationId, voucherId }: DocumentSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", organizationId, voucherId],
    queryFn: () => api.getVoucherDocuments(organizationId, voucherId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(organizationId, voucherId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", organizationId, voucherId] });
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error: Error) => {
      setUploadError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => api.deleteDocument(organizationId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", organizationId, voucherId] });
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Filtypen stöds inte. Tillåtna: PDF, JPEG, PNG, WebP, HEIC");
      return;
    }

    if (file.size > MAX_SIZE) {
      setUploadError("Filen är för stor (max 10 MB)");
      return;
    }

    setUploadError(null);
    uploadMutation.mutate(file);
  }

  const documents = data?.data ?? [];

  return (
    <div className="mt-2">
      <h3>Bifogade dokument</h3>

      {isLoading && <div className="loading">Laddar dokument...</div>}

      {documents.length > 0 && (
        <ul className="document-list">
          {documents.map((doc) => (
            <li key={doc.id} className="document-item flex justify-between items-center">
              <a
                href={api.downloadDocumentUrl(organizationId, doc.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {doc.filename}
              </a>
              <span className="text-muted" style={{ fontSize: "0.85em", marginLeft: 8 }}>
                {formatFileSize(doc.size)}
              </span>
              <button
                className="danger small"
                style={{ marginLeft: 8 }}
                onClick={(e) => {
                  e.preventDefault();
                  deleteMutation.mutate(doc.id);
                }}
                disabled={deleteMutation.isPending}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {documents.length === 0 && !isLoading && (
        <p className="text-muted">Inga dokument bifogade.</p>
      )}

      <div className="mt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
          onChange={handleFileSelect}
          disabled={uploadMutation.isPending}
        />
        {uploadMutation.isPending && <span className="text-muted"> Laddar upp...</span>}
        {uploadError && <div className="error mt-1">{uploadError}</div>}
      </div>
    </div>
  );
}
