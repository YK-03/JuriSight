import pdfParse from "pdf-parse";

export async function parsePdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text?.trim() ?? "";
}