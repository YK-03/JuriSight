import sharp from "sharp";
import { createWorker } from "tesseract.js";

type OcrResult = {
  text: string;
  pageCount: number;
};

type PdfObject = {
  id: number;
  offset: number;
  body: string;
};

const OCR_LANGUAGES = "eng+hin";

/**
 * Parse the traditional PDF xref table and map:
 *
 *   object ID -> byte offset
 *
 * We use these offsets instead of searching the raw PDF text because
 * JPEG streams can contain byte sequences that look like PDF objects.
 */
function parseXref(buffer: Buffer): Map<number, number> {
  const pdfText = buffer.toString("latin1");

  const xrefPos = pdfText.lastIndexOf("\nxref");

  if (xrefPos === -1) {
    throw new Error("Could not find PDF xref table");
  }

  const trailerPos = pdfText.indexOf("trailer", xrefPos);

  if (trailerPos === -1) {
    throw new Error("Could not find PDF trailer");
  }

  const xrefText = pdfText.slice(xrefPos + 5, trailerPos);

  const offsets = new Map<number, number>();

  const lines = xrefText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let index = 0;

  while (index < lines.length) {
    const headerMatch = lines[index].match(/^(\d+)\s+(\d+)$/);

    if (!headerMatch) {
      index += 1;
      continue;
    }

    const startObjectId = Number(headerMatch[1]);
    const objectCount = Number(headerMatch[2]);

    index += 1;

    for (
      let objectIndex = 0;
      objectIndex < objectCount && index < lines.length;
      objectIndex += 1, index += 1
    ) {
      const entryMatch = lines[index].match(
        /^(\d{10})\s+\d+\s+([nf])/
      );

      if (!entryMatch) {
        continue;
      }

      if (entryMatch[2] === "n") {
        offsets.set(
          startObjectId + objectIndex,
          Number(entryMatch[1])
        );
      }
    }
  }

  return offsets;
}

/**
 * Read one PDF object using the offset supplied by the xref table.
 */
function readObject(
  buffer: Buffer,
  offsets: Map<number, number>,
  objectId: number
): PdfObject {
  const offset = offsets.get(objectId);

  if (offset === undefined) {
    throw new Error(`No xref entry for object ${objectId}`);
  }

  const pdfText = buffer.toString("latin1");

  const endObjectIndex = pdfText.indexOf(
    "\nendobj",
    offset
  );

  if (endObjectIndex === -1) {
    throw new Error(
      `Could not find endobj for object ${objectId}`
    );
  }

  const endOffset = endObjectIndex + "\nendobj".length;

  return {
    id: objectId,
    offset,
    body: pdfText.slice(offset, endOffset),
  };
}

/**
 * Find every actual PDF /Page object using the xref table.
 *
 * IMPORTANT:
 * We do NOT search the entire raw PDF with a regex.
 * Binary JPEG streams can contain text that looks like PDF objects.
 */
function getPageObjectIds(
  buffer: Buffer,
  offsets: Map<number, number>
): number[] {
  const pageObjectIds: number[] = [];

  for (const objectId of offsets.keys()) {
    try {
      const object = readObject(
        buffer,
        offsets,
        objectId
      );

      if (/\/Type\s*\/Page\b/.test(object.body)) {
        pageObjectIds.push(objectId);
      }
    } catch {
      // Ignore malformed or unreadable PDF objects.
    }
  }

  if (pageObjectIds.length === 0) {
    throw new Error("Could not find PDF page objects");
  }

  console.log(
    "[OCR] PDF page objects:",
    pageObjectIds
  );

  return pageObjectIds;
}

/**
 * Get JPEG XObject references belonging to one PDF page.
 *
 * The page object and Resources object are both resolved
 * through the xref table.
 */
function getPageImageObjectIds(
  buffer: Buffer,
  offsets: Map<number, number>,
  pageObjectId: number
): number[] {
  const pageObject = readObject(
    buffer,
    offsets,
    pageObjectId
  ).body;

  const resourcesMatch = pageObject.match(
    /\/Resources\s+(\d+)\s+0\s+R/
  );

  if (!resourcesMatch) {
    throw new Error(
      `Could not find Resources for page object ${pageObjectId}`
    );
  }

  const resourcesId = Number(resourcesMatch[1]);

  const resourcesObject = readObject(
    buffer,
    offsets,
    resourcesId
  ).body;

  const imageIds: number[] = [];

  const imageRegex =
    /\/Image\d+\s+(\d+)\s+0\s+R/g;

  let imageMatch: RegExpExecArray | null;

  while (
    (imageMatch = imageRegex.exec(resourcesObject)) !== null
  ) {
    imageIds.push(Number(imageMatch[1]));
  }

  console.log(
    `[OCR] Page ${pageObjectId}: Resources ${resourcesId}, images ${imageIds.length}`
  );

  return imageIds;
}

/**
 * Extract the JPEG stream from a PDF image object.
 */
function extractJpegFromObject(
  buffer: Buffer,
  offsets: Map<number, number>,
  objectId: number
): Buffer {
  const object = readObject(
    buffer,
    offsets,
    objectId
  );

  if (!/\/Filter\s*\/DCTDecode/.test(object.body)) {
    throw new Error(
      `Object ${objectId} is not a JPEG image`
    );
  }

  const streamMarker = object.body.indexOf("stream");

  if (streamMarker === -1) {
    throw new Error(
      `No stream found for image ${objectId}`
    );
  }

  let jpegStart =
    object.offset +
    streamMarker +
    "stream".length;

  // Skip the newline immediately following "stream".
  if (
    buffer[jpegStart] === 0x0d &&
    buffer[jpegStart + 1] === 0x0a
  ) {
    jpegStart += 2;
  } else if (
    buffer[jpegStart] === 0x0a ||
    buffer[jpegStart] === 0x0d
  ) {
    jpegStart += 1;
  }

  const jpegEnd = buffer.indexOf(
    Buffer.from([0xff, 0xd9]),
    jpegStart
  );

  if (jpegEnd === -1) {
    throw new Error(
      `JPEG end marker not found for image ${objectId}`
    );
  }

  return buffer.subarray(
    jpegStart,
    jpegEnd + 2
  );
}

/**
 * Reconstruct a complete page from its horizontal JPEG strips.
 */
async function buildPage(
  buffer: Buffer,
  offsets: Map<number, number>,
  imageObjectIds: number[]
): Promise<Buffer> {
  if (imageObjectIds.length === 0) {
    throw new Error(
      "Cannot build page: no JPEG strips found"
    );
  }

  const strips = imageObjectIds.map((objectId) =>
    extractJpegFromObject(
      buffer,
      offsets,
      objectId
    )
  );

  const metadata = await Promise.all(
    strips.map((strip) => sharp(strip).metadata())
  );

  const width = metadata[0]?.width;

  if (!width) {
    throw new Error(
      "Could not determine strip width"
    );
  }

  const totalHeight = metadata.reduce(
    (sum, item) => sum + (item.height ?? 0),
    0
  );

  if (!totalHeight) {
    throw new Error(
      "Could not determine page height"
    );
  }

  const composites: sharp.OverlayOptions[] = [];

  let top = 0;

  for (let index = 0; index < strips.length; index += 1) {
    const height = metadata[index]?.height ?? 0;

    composites.push({
      input: strips[index],
      left: 0,
      top,
    });

    top += height;
  }

  return sharp({
    create: {
      width,
      height: totalHeight,
      channels: 3,
      background: {
        r: 255,
        g: 255,
        b: 255,
      },
    },
  })
    .composite(composites)
    .resize({
      width: width * 2,
      height: totalHeight * 2,
      kernel: sharp.kernel.lanczos3,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export async function ocrScannedPdf(
  buffer: Buffer
): Promise<OcrResult> {
  const offsets = parseXref(buffer);

  const pageObjectIds = getPageObjectIds(
    buffer,
    offsets
  );

  console.log(
    `[OCR] PDF pages found: ${pageObjectIds.length}`
  );

  const pages = pageObjectIds.map((pageObjectId) =>
    getPageImageObjectIds(
      buffer,
      offsets,
      pageObjectId
    )
  );

  console.log(
    `[OCR] Image distribution: [${pages
      .map((page) => page.length)
      .join(", ")}]`
  );

  const totalImages = pages.reduce(
    (sum, page) => sum + page.length,
    0
  );

  console.log(
    `[OCR] Total page images: ${totalImages}`
  );

  if (pages.some((page) => page.length === 0)) {
    throw new Error(
      "One or more PDF pages contain no JPEG images"
    );
  }

  const worker = await createWorker(
    OCR_LANGUAGES
  );

  try {
    const pageTexts: string[] = [];

    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = index + 1;
      const imageCount = pages[index].length;

      console.log(
        `\n[OCR] Processing page ${pageNumber}/${pages.length} (${imageCount} strips)`
      );

      const pageImage = await buildPage(
        buffer,
        offsets,
        pages[index]
      );

      console.log(
        `[OCR] Page ${pageNumber} reconstructed`
      );

      const result = await worker.recognize(
        pageImage
      );

      pageTexts.push(result.data.text);

      console.log(
        `[OCR] Page ${pageNumber} complete: ${result.data.text.length} chars`
      );
    }

    return {
      text: pageTexts.join("\n\n"),
      pageCount: pages.length,
    };
  } finally {
    await worker.terminate();
  }
}