import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, type DocumentMeta, type ReceiptOcrAnalysis } from "../api";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const OCR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatOreAmount(ore: number | undefined): string {
  if (ore == null) return "-";
  return `${(ore / 100).toFixed(2)} kr`;
}

function isOcrSupportedDocument(doc: DocumentMeta): boolean {
  return OCR_ALLOWED_TYPES.includes(doc.mimeType);
}

function getOcrErrorMessage(error: Error): string {
  if (error instanceof ApiError && error.code === "OCR_PDF_DISABLED") {
    return "PDF-OCR ar avstangt pa servern. Behorig admin kan aktivera OCR_ENABLE_PDF=true i API-miljon.";
  }
  return error.message;
}

interface DocumentSectionProps {
  organizationId: string;
  voucherId: string;
}

export function DocumentSection({ organizationId, voucherId }: DocumentSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrAnalysis, setOcrAnalysis] = useState<ReceiptOcrAnalysis | null>(null);
  const [ocrDocumentName, setOcrDocumentName] = useState<string | null>(null);
  const [activeOcrDocumentId, setActiveOcrDocumentId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", organizationId, voucherId],
    queryFn: () => api.getVoucherDocuments(organizationId, voucherId),
  });

  const { data: ocrStatusData } = useQuery({
    queryKey: ["receipt-ocr-status", organizationId],
    queryFn: () => api.getReceiptOcrStatus(organizationId),
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

  const analyzeOcrMutation = useMutation({
    mutationFn: (document: DocumentMeta) =>
      api.analyzeUploadedDocumentReceipt(organizationId, document.id),
    onMutate: (document) => {
      setActiveOcrDocumentId(document.id);
      setOcrError(null);
    },
    onSuccess: (result, document) => {
      setOcrAnalysis(result.data);
      setOcrDocumentName(document.filename);
      setOcrError(null);
    },
    onError: (error: Error) => {
      setOcrError(getOcrErrorMessage(error));
    },
    onSettled: () => {
      setActiveOcrDocumentId(null);
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
  const ocrStatus = ocrStatusData?.data;
  const pdfStatusLabel = ocrStatus == null ? "okand" : ocrStatus.pdfEnabled ? "aktiv" : "inaktiv";

  return (
    <div className="mt-2">
      <h3>Bifogade dokument</h3>
      <p className="text-muted" style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
        PDF-OCR: {pdfStatusLabel}
      </p>

      {isLoading && <div className="loading">Laddar dokument...</div>}

      {documents.length > 0 && (
        <ul className="document-list">
          {documents.map((doc) => (
            <li key={doc.id} className="document-item flex justify-between items-center">
              <div className="flex items-center gap-1" style={{ minWidth: 0, flexWrap: "wrap" }}>
                <a
                  href={api.downloadDocumentUrl(organizationId, doc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {doc.filename}
                </a>
                <span className="text-muted" style={{ fontSize: "0.85em" }}>
                  {formatFileSize(doc.size)}
                </span>
              </div>

              <div className="flex items-center gap-1" style={{ marginLeft: 8, flexWrap: "wrap" }}>
                {isOcrSupportedDocument(doc) && (
                  <button
                    type="button"
                    className="secondary small"
                    onClick={(e) => {
                      e.preventDefault();
                      analyzeOcrMutation.mutate(doc);
                    }}
                    disabled={analyzeOcrMutation.isPending}
                  >
                    {analyzeOcrMutation.isPending && activeOcrDocumentId === doc.id
                      ? "Tolkar..."
                      : "Tolka"}
                  </button>
                )}
                <button
                  className="danger small"
                  onClick={(e) => {
                    e.preventDefault();
                    deleteMutation.mutate(doc.id);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {ocrError && <div className="error mt-1">{ocrError}</div>}

      {ocrAnalysis && (
        <div className="info-box mt-1" style={{ marginBottom: 0 }}>
          <div className="flex justify-between items-center" style={{ gap: 8, flexWrap: "wrap" }}>
            <strong>OCR-resultat: {ocrDocumentName ?? ocrAnalysis.sourceFilename}</strong>
            <button
              type="button"
              className="secondary small"
              onClick={() => {
                setOcrAnalysis(null);
                setOcrDocumentName(null);
                setOcrError(null);
              }}
            >
              Stang
            </button>
          </div>

          <div className="flex gap-2 mt-1" style={{ flexWrap: "wrap" }}>
            <div>
              <strong>Butik/leverantor:</strong> {ocrAnalysis.merchantName ?? "-"}
            </div>
            <div>
              <strong>Datum:</strong> {ocrAnalysis.transactionDate ?? "-"}
            </div>
            <div>
              <strong>Total:</strong> {formatOreAmount(ocrAnalysis.totalAmountOre)}
            </div>
            <div>
              <strong>Moms:</strong> {formatOreAmount(ocrAnalysis.vatAmountOre)}
            </div>
            <div>
              <strong>OCR-sakerhet:</strong> {ocrAnalysis.confidence}%
            </div>
          </div>

          <div className="mt-1">
            <strong>Foreslagen beskrivning:</strong> {ocrAnalysis.suggestedDescription}
          </div>

          {ocrAnalysis.warnings.length > 0 && (
            <div className="mt-1">
              {ocrAnalysis.warnings.map((warning) => (
                <div key={warning} className="text-muted">
                  {warning}
                </div>
              ))}
            </div>
          )}

          <details className="mt-1">
            <summary>Visa utlasa text</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginTop: "0.75rem",
                fontSize: "0.9rem",
              }}
            >
              {ocrAnalysis.extractedText}
            </pre>
          </details>
        </div>
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
