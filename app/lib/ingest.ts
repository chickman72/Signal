import path from "path";
import { pathToFileURL } from "url";
import OpenAI from "openai";
import { parseOffice } from "officeparser";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

async function ensurePdfPolyfills() {
  if (typeof globalThis.DOMMatrix !== "undefined") return;

  try {
    const mod = await import("@thednp/dommatrix");
    const DOMMatrixCtor = (mod as { default?: unknown }).default;
    if (DOMMatrixCtor) {
      (globalThis as any).DOMMatrix = DOMMatrixCtor;
      return;
    }
  } catch {
    // Fall through to a minimal shim.
  }

  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

export async function extractText(file: File): Promise<string> {
  await ensurePdfPolyfills();
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name || "").toLowerCase();
  const mimeType = file.type || "";

  const isDocx =
    extension === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isPptx =
    extension === ".pptx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  if (isDocx || isPptx) {
    const parsed = await parseOffice(buffer, {
      outputErrorToConsole: false,
      newlineDelimiter: "\n",
    });
    return typeof parsed === "string" ? parsed : String(parsed ?? "");
  }

  const { PDFParse } = await import("pdf-parse");
  const workerPath = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  PDFParse.setWorker(pathToFileURL(workerPath).toString());

  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  return parsed.text ?? "";
}

export function chunkText(text: string, size: number = 800): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > size) {
      if (current) chunks.push(current.trim());
      current = word;
    } else {
      current += ` ${word}`;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function getEmbeddings(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned.");
  return embedding;
}
