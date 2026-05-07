const PAGE_MARKER_PATTERNS = [
  /page\s+\d+(\s+of\s+\d+)?/i,
  /generated\s+on/i,
  /digitally\s+signed/i,
  /court\s+of/i,
  /high\s+court/i,
  /sessions\s+court/i,
  /police\s+station/i,
];

function normalizeLineForComparison(line: string): string {
  return line
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^\p{L}\p{N}\s#:/()-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHeaderFooter(line: string, occurrences: number): boolean {
  const normalized = normalizeLineForComparison(line);
  if (!normalized || occurrences < 2) {
    return false;
  }

  if (normalized.length <= 4) {
    return true;
  }

  return PAGE_MARKER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isParagraphBreak(line: string): boolean {
  return line.trim().length === 0;
}

function isHeadingLike(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) {
    return false;
  }

  if (/^(section|u\/s|under section|facts of the case|brief facts|order|prayer|offence|offense|charges?)\b/i.test(trimmed)) {
    return true;
  }

  const alpha = trimmed.replace(/[^A-Za-z]/g, "");
  return alpha.length > 0 && alpha === alpha.toUpperCase();
}

function needsSpaceJoin(current: string, next: string): boolean {
  if (!current) {
    return false;
  }

  if (/-$/.test(current)) {
    return false;
  }

  if (/[.:;!?]"?$/.test(current)) {
    return true;
  }

  if (/[,)]$/.test(current)) {
    return true;
  }

  return !/[(/]$/.test(current) && !/^[,.;:)]/.test(next);
}

function repairOcrSpacing(line: string): string {
  return line
    .replace(/[ \t]+/g, " ")
    .replace(/\b([A-Z])\s+(?=[A-Z]\b)/g, "$1")
    .replace(/([a-z])\s+([,.;:!?])/g, "$1$2")
    .replace(/\bU\s*\/\s*S\b/gi, "U/S")
    .replace(/\bI\s*P\s*C\b/gi, "IPC")
    .replace(/\bB\s*N\s*S\b/gi, "BNS")
    .replace(/\bC\s*R\s*P\s*C\b/gi, "CrPC")
    .replace(/\bB\s*N\s*S\s*S\b/gi, "BNSS")
    .trim();
}

export function cleanPdfText(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\t/g, " ");

  const rawLines = normalized.split("\n").map((line) => repairOcrSpacing(line));
  const frequency = new Map<string, number>();

  for (const line of rawLines) {
    const key = normalizeLineForComparison(line);
    if (!key || key.length > 160) {
      continue;
    }
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }

  const filteredLines = rawLines.filter((line) => {
    const key = normalizeLineForComparison(line);
    return !isLikelyHeaderFooter(line, frequency.get(key) ?? 0);
  });

  const paragraphs: string[] = [];
  let current = "";

  for (const line of filteredLines) {
    if (isParagraphBreak(line)) {
      if (current.trim()) {
        paragraphs.push(current.trim());
        current = "";
      }
      continue;
    }

    if (isHeadingLike(line)) {
      if (current.trim()) {
        paragraphs.push(current.trim());
        current = "";
      }
      paragraphs.push(line.trim());
      continue;
    }

    if (!current) {
      current = line.trim();
      continue;
    }

    if (/-$/.test(current)) {
      current = `${current.slice(0, -1)}${line.trimStart()}`;
      continue;
    }

    current = needsSpaceJoin(current, line)
      ? `${current} ${line.trim()}`
      : `${current}\n${line.trim()}`;
  }

  if (current.trim()) {
    paragraphs.push(current.trim());
  }

  return paragraphs
    .map((paragraph) => paragraph.replace(/[ ]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
