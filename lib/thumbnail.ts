"use client";

/**
 * Creates a small compressed JPEG thumbnail from a base64-encoded image.
 * Runs entirely in the browser using Canvas — no server round-trip.
 *
 * Returns the base64 data string only (no "data:image/jpeg;base64," prefix),
 * or null if the mimeType is not a renderable image (e.g. application/pdf).
 * Suitable for storing directly in Postgres (< 30 KB at default settings).
 */
export async function createThumbnail(
  base64: string,
  mimeType: string,
  maxSize = 400,
  quality = 0.5
): Promise<string | null> {
  // PDFs and other non-image types can't be drawn into <img> — skip gracefully
  if (!mimeType.startsWith("image/")) return null;
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Keep aspect ratio, cap at maxSize on the longest side
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width  * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);

      // Always output as JPEG for consistent small size
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]); // strip the "data:image/jpeg;base64," prefix
    };

    img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}
