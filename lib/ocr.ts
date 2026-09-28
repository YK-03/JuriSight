import sharp from "sharp";
import { createWorker } from "tesseract.js";

type OcrResult = {
  text: string;
  pageCount: number;
};

const OCR_LANGUAGES = "eng+hin";

type PdfObject = {
  id: number;
  body: string;
  start: number;
  end: number;
};

function parsePdfObjects(buffer: Buffer): Map<number, PdfObject> {
  const text = buffer.toString("latin1");
  const objects = new Map<number, PdfObject>();

  const regex =
    /(?:^|\n)(\d+)\s+0\s+obj\s*\n([\s\S]*?)\nendobj\b/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const id = Number(match[1]);
    const body = match[2];

    objects.set(id, {
      id,
      body,
      start: match.index,
      end: regex.lastIndex,
    });
  }

  return objects;
}

function getPageObjectIds(objects: Map<number, PdfObject>): number[] {
  const pages: number[] = [];

  for (const object of objects.values()) {
    if (/\/Type\s*\/Page\b/.test(object.body)) {
      pages.push(object.id);
    }
  }

  pages.sort((a, b) => a - b);

  return pages;
}

function getReference(body: string, key: string): number | null {
  const regex = new RegExp(
    `/${key}\\s+(\\d+)\\s+0\\s+R`
  );

  const match = body.match(regex);

  return match ? Number(match[1]) : null;
}

function getImageObjectIds(
  objects: Map<number, PdfObject>,
  pageObjectId: number
): number[] {
  const page = objects.get(pageObjectId);

  if (!page) {
    throw new Error(
      `Could not find page object ${pageObjectId}`
    );
  }

  const resourcesId = getReference(page.body, "Resources");

  if (resourcesId === null) {
    throw new Error(
      `Could not find Resources for page ${pageObjectId}`
    );
  }

  const resources = objects.get(resourcesId);

  if (!resources) {
    throw new Error(
      `Could not find Resources object ${resourcesId}`
    );
  }

  const imageIds: number[] = [];

  /*
   * Resource dictionaries contain entries such as:
   *
   * /Image1 4 0 R
   * /Image2 5 0 R
   *
   * Some of these image references are shared between pages.
   */
  const imageRegex =
    /\/Image\d+\s+(\d+)\s+0\s+R/g;

  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(resources.body)) !== null) {
    imageIds.push(Number(match[1]));
  }

  return imageIds;
}

function extractJpegFromObject(
  buffer: Buffer,
  object: PdfObject
): Buffer | null {
  /*
   * JPEG images use /DCTDecode.
   */
  if (!/\/Filter\s*\/DCTDecode\b/.test(object.body)) {
    return null;
  }

  const objectStart =
    object.start;

  const streamRelative =
    object.body.indexOf("stream");

  if (streamRelative === -1) {
    return null;
  }

  /*
   * Locate the actual JPEG SOI marker after "stream".
   */
  const searchStart =
    objectStart +
    object.body.indexOf("stream");

  const soi = buffer.indexOf(
    Buffer.from([0xff, 0xd8]),
    searchStart
  );

  if (soi === -1 || soi >= object.end) {
    return null;
  }

  const eoi = buffer.indexOf(
    Buffer.from([0xff, 0xd9]),
    soi + 2
  );

  if (eoi === -1 || eoi >= object.end) {
    return null;
  }

  return buffer.subarray(soi, eoi + 2);
}

async function buildPage(
  strips: Buffer[]
): Promise<Buffer> {
  if (strips.length === 0) {
    throw new Error(
      "Cannot build OCR page: no JPEG strips found"
    );
  }

  /*
   * Every strip in this PDF is 2305 pixels wide and
   * approximately 37 pixels high.
   *
   * We nevertheless read dimensions dynamically.
   */

  const metadata = await sharp(strips[0]).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(
      "Could not determine JPEG strip dimensions"
    );
  }

  const width = metadata.width;

  /*
   * JPEG strips can theoretically have different heights,
   * so calculate the total height rather than assuming 37.
   */
  const metas = await Promise.all(
    strips.map((strip) => sharp(strip).metadata())
  );

  const totalHeight = metas.reduce(
    (sum, meta) =>
      sum + (meta.height ?? metadata.height!),
    0
  );

  const composites: sharp.OverlayOptions[] = [];

  let top = 0;

  for (let i = 0; i < strips.length; i++) {
    const height =
      metas[i].height ?? metadata.height;

    composites.push({
      input: strips[i],
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
    .png()
    .toBuffer();
}

export async function ocrScannedPdf(
  buffer: Buffer
): Promise<OcrResult> {
  console.log("[OCR] Parsing PDF objects...");

  const objects = parsePdfObjects(buffer);

  console.log(
    `[OCR] Parsed ${objects.size} PDF objects`
  );

  const pageObjectIds =
    getPageObjectIds(objects);

  if (pageObjectIds.length === 0) {
    throw new Error(
      "Could not find any PDF page objects"
    );
  }

  console.log(
    `[OCR] PDF pages found: ${pageObjectIds.length}`
  );

  const pages: Buffer[][] = [];

  for (
    let pageIndex = 0;
    pageIndex < pageObjectIds.length;
    pageIndex++
  ) {
    const pageObjectId =
      pageObjectIds[pageIndex];

    console.log(
      `[OCR] Mapping page ${pageIndex + 1}: object ${pageObjectId}`
    );

    const imageObjectIds =
      getImageObjectIds(
        objects,
        pageObjectId
      );

    console.log(
      `[OCR] Page ${pageIndex + 1}: ${imageObjectIds.length} image references`
    );

    const pageImages: Buffer[] = [];

    for (const imageObjectId of imageObjectIds) {
      const imageObject =
        objects.get(imageObjectId);

      if (!imageObject) {
        console.warn(
          `[OCR] Missing image object ${imageObjectId}`
        );
        continue;
      }

      const jpeg =
        extractJpegFromObject(
          buffer,
          imageObject
        );

      if (jpeg) {
        pageImages.push(jpeg);
      }
    }

    if (pageImages.length === 0) {
      throw new Error(
        `No JPEG images found for page ${pageIndex + 1}`
      );
    }

    console.log(
      `[OCR] Page ${pageIndex + 1}: ${pageImages.length} JPEG strips extracted`
    );

    pages.push(pageImages);
  }

  console.log(
    `[OCR] Successfully mapped ${pages.length} pages`
  );

  console.log("[OCR] Starting Tesseract...");

  const worker =
    await createWorker(OCR_LANGUAGES);

  try {
    const pageTexts: string[] = [];

    for (
      let i = 0;
      i < pages.length;
      i++
    ) {
      console.log(
        `\n[OCR] Processing page ${i + 1}/${pages.length}...`
      );

      const pageImage =
        await buildPage(pages[i]);

      /*
       * Save reconstructed pages temporarily when debugging.
       * This lets us visually verify that the strip ordering
       * is correct before blaming Tesseract.
       */
      const debugPath =
        `ocr-page-${i + 1}.png`;

      const fs =
        await import("fs/promises");

      await fs.writeFile(
        debugPath,
        pageImage
      );

      console.log(
        `[OCR] Reconstructed page saved: ${debugPath}`
      );

      const result =
        await worker.recognize(
          pageImage
        );

      pageTexts.push(
        result.data.text
      );

      console.log(
        `[OCR] Page ${i + 1} complete: ${result.data.text.length} characters`
      );
    }

    return {
      text: pageTexts.join(
        "\n\n================ PAGE BREAK ================\n\n"
      ),
      pageCount: pages.length,
    };
  } finally {
    await worker.terminate();
  }
}