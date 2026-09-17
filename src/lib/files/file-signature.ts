/**
 * Tipo real de un archivo según sus primeros bytes.
 *
 * No se confía en el nombre ni en el tipo que declara el navegador: los dos los elige
 * quien sube el archivo. Un `.png` puede ser cualquier cosa adentro; estos bytes
 * iniciales, no.
 */

export type DetectedFileType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  const b = bytes;

  // JPEG: FF D8 FF
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.length > 8 && PNG.every((valor, i) => b[i] === valor)) {
    return "image/png";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }

  if (b.length > PDF.length && PDF.every((valor, i) => b[i] === valor)) {
    return "application/pdf";
  }

  return null;
}

export const FILE_EXTENSIONS: Record<DetectedFileType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
