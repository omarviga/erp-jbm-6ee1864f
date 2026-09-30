const MAX_PAGES = 5;
const IMAGE_SCALE = 1.5;

export async function pdfToBase64Images(file: File): Promise<string[]> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pagesToProcess = Math.min(pdf.numPages, MAX_PAGES);
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: IMAGE_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    images.push(dataUrl.split(",")[1]);
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}