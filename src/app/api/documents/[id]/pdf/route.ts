import { auth } from "@/auth";
import { db } from "@/lib/db";
import { documentPrefix, putDocument, streamBlob } from "@/lib/blob";
import { receiptPdf } from "@/lib/pdf/documents";
import type { Currency } from "@/lib/pricing-engine";

type SnapshotLine = { titleEn: string; accessType: string; net: number; vat: number; lineTotal: number };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    include: { order: { select: { userId: true, beneficiaryId: true } } },
  });
  if (!doc) return new Response(null, { status: 404 });
  const allowed =
    doc.order.userId === session.user.id || doc.order.beneficiaryId === session.user.id || session.user.role === "ADMIN";
  if (!allowed) return new Response(null, { status: 404 });

  if (doc.pdfKey) {
    const stored = await streamBlob(doc.pdfKey, "application/pdf", "private, no-store");
    if (stored.status === 200) {
      const headers = new Headers(stored.headers);
      headers.set("Content-Disposition", `attachment; filename="${doc.number}.pdf"`);
      return new Response(stored.body, { status: 200, headers });
    }
  }

  const bytes = await receiptPdf({
    number: doc.number,
    kind: doc.kind,
    issuedAt: doc.issuedAt,
    sellerName: doc.sellerName,
    sellerAddress: doc.sellerAddress,
    sellerTrn: doc.sellerTrn,
    buyerName: doc.buyerName,
    beneficiaryName: doc.beneficiaryName,
    currency: doc.currency as Currency,
    subtotal: doc.subtotal,
    discount: doc.discount,
    platformDiscount: doc.platformDiscount,
    vat: doc.vat,
    vatRateBp: doc.vatRateBp,
    total: doc.total,
    lines: doc.lines as unknown as SnapshotLine[],
  });

  const key = documentPrefix(doc.id);
  const stored = await putDocument(key, bytes).catch(() => false);
  await db.document
    .update({
      where: { id },
      data: { pdfKey: stored ? key : null, pdfStatus: stored ? "READY" : "FAILED", pdfAttempts: { increment: 1 } },
    })
    .catch(() => {});

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
