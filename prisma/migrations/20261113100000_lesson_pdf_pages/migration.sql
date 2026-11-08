-- Lesson PDFs are shown as page images; this lists the stored page objects. Additive.
ALTER TABLE "Lesson" ADD COLUMN "pdfPages" TEXT[] DEFAULT ARRAY[]::TEXT[];
