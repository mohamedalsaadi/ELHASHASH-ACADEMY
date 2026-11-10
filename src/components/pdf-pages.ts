// Turns a PDF or a picture into JPEG pages in the browser, one callback per page. Shared by the lesson PDF uploader and the question uploader.

const WIDTH = 1400; // reads well on a phone and keeps a page near 300 KB

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.82));

/** Draws each page of a PDF at 1400 px wide. `stage` names the step so a failure can say where it stopped. */
export async function eachPdfPage(file: File, onPage: (jpeg: Blob, n: number, total: number) => Promise<void>, stage: (s: string) => void) {
  stage("load");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  stage("read");
  // Font and character-map data is served from /pdfjs so a PDF that does not embed its fonts still draws its text.
  const doc = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
  }).promise;
  if (doc.numPages > 400) throw new Error("more than 400 pages");
  for (let n = 1; n <= doc.numPages; n++) {
    stage(`page ${n} draw`);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    stage(`page ${n} upload`);
    await onPage(await toJpeg(canvas), n, doc.numPages);
  }
}

/** A photo as one JPEG, scaled down to 1400 px wide so a phone picture stays under the 5 MB page limit. */
export async function imageToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return toJpeg(canvas);
}
