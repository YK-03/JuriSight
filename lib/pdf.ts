import pdfParse from "pdf-parse";

export interface ParsedPdfDetails {
  text: string;
  numpages: number;
}

export async function parsePdfDetails(buffer: Buffer): Promise<ParsedPdfDetails> {
  const data = await pdfParse(buffer);
  return {
    text: data.text ?? "",
    numpages: data.numpages ?? 0,
  };
}

export async function parsePdfText(buffer: Buffer): Promise<string> {
  const details = await parsePdfDetails(buffer);
  return details.text;
}
