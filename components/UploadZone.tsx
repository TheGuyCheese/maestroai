"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_MB = 20;

export default function UploadZone() {
  const { dispatch } = useApp();
  const router = useRouter();
  const [isDragging, setIsDragging]   = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [fileBase64, setFileBase64]   = useState<string>("");
  const [fileMime, setFileMime]       = useState<string>("");
  const [error, setError]             = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);

  const processFile = useCallback((f: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError("Please upload a JPG, PNG, WebP, or PDF file.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB}MB.`);
      return;
    }
    setFile(f);
    setFileMime(f.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Store base64 locally — we'll dispatch it only when the user clicks Analyse
      // so we can RESET first and guarantee a clean slate
      setFileBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  }, [processFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) processFile(picked);
  };

  const handleAnalyse = () => {
    if (!file || !fileBase64) return;
    setIsLoading(true);

    // Always start from a completely clean state — no leftover chat, analyses,
    // sessionId, or teaching content from any previous upload.
    dispatch({ type: "RESET" });
    dispatch({ type: "SET_FILE", file, base64: fileBase64, mimeType: fileMime });
    dispatch({ type: "START_PIPELINE" });
    router.push("/pipeline");
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-6">
      {/* Drop Zone */}
      <label
        className={`upload-glow relative w-full h-80 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4
          ${isDragging
            ? "border-primary-container bg-surface-container scale-[1.01]"
            : file
            ? "border-primary-container/80 bg-surface-container/80"
            : "border-primary-container/40 bg-surface-container/60"
          }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="sr-only"
          onChange={onInputChange}
        />

        {/* Ambient glow blob */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary-container/10 rounded-full blur-3xl" />
        </div>

        {file ? (
          /* File selected state */
          <div className="relative z-10 flex flex-col items-center gap-3 animate-fadeIn">
            <div className="w-14 h-14 rounded-xl bg-primary-container/20 border border-primary-container/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-container text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>
                {file.type === "application/pdf" ? "picture_as_pdf" : "image"}
              </span>
            </div>
            <p className="font-inter font-semibold text-on-surface text-base">{file.name}</p>
            <p className="font-inter text-label-md text-on-surface-variant">
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
            </p>
          </div>
        ) : (
          /* Empty / drag state */
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border transition-all
              ${isDragging
                ? "bg-primary-container/30 border-primary-container"
                : "bg-surface-container-high border-outline-variant"
              }`}>
              <span className="material-symbols-outlined text-3xl text-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}>
                upload_file
              </span>
            </div>
            <div className="text-center">
              <p className="font-inter font-semibold text-on-surface text-base">
                {isDragging ? "Drop it here" : "Drag & drop your sheet music"}
              </p>
              <p className="font-inter text-label-md text-on-surface-variant mt-1">
                or click to browse · JPG, PNG, PDF up to {MAX_SIZE_MB}MB
              </p>
            </div>
            {/* Accepted formats chips */}
            <div className="flex gap-2 mt-1">
              {["JPG", "PNG", "PDF"].map((fmt) => (
                <span key={fmt}
                  className="px-3 py-1 rounded-full border border-outline-variant/30 text-on-surface-variant font-inter text-label-sm uppercase tracking-wider">
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        )}
      </label>

      {/* Error */}
      {error && (
        <p className="flex items-center gap-2 text-error text-label-md font-inter animate-fadeIn">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={handleAnalyse}
        disabled={!file || isLoading}
        className={`w-full max-w-xs py-4 rounded-xl font-inter font-semibold text-base transition-all
          ${file && !isLoading
            ? "bg-primary-container text-[#0a0a0a] hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] active:scale-[0.98]"
            : "bg-surface-container text-on-surface-variant cursor-not-allowed"
          }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg animate-spin">autorenew</span>
            Starting analysis…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            Analyse Sheet
          </span>
        )}
      </button>
    </div>
  );
}
