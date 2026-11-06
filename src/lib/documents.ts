import { Prisma, type DocumentKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getFinanceConfig } from "@/lib/platform-settings";

type Tx = Prisma.TransactionClient;

/**
 * Allocates the next number in a series. The INSERT ... ON CONFLICT ... RETURNING takes the row lock
 * for the rest of the transaction, so two issuers serialise and a rollback reuses the number. The
 * document insert must stay in this transaction; no network call belongs under the lock.
 */
export async function nextDocumentNumber(trx: Tx, key: string): Promise<number> {
  const rows = await trx.$queryRaw<{ next: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "next") VALUES (${key}, 2)
    ON CONFLICT ("key") DO UPDATE SET "next" = "DocumentSequence"."next" + 1
    RETURNING "next"
  `;
  return rows[0].next - 1;
}

/** Largest-remainder allocation, so the per-line VAT sums exactly to the order VAT. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const fractions = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (left > 0 && fractions.length > 0) {
    out[fractions[k % fractions.length].i] += 1;
    left -= 1;
    k += 1;
  }
  return out;
}

function seriesFor(kind: DocumentKind, countryCode: string | null, year: number) {
  return `${kind === "INVOICE" ? "INV" : "CN"}-${countryCode ?? "GL"}-${year}`;
}

function numberFor(kind: DocumentKind, countryCode: string | null, year: number, sequenceNo: number) {
  const body = `${countryCode ?? "GL"}-${year}-${String(sequenceNo).padStart(6, "0")}`;
  return kind === "INVOICE" ? body : `CN-${body}`;
}

export function documentNumber(kind: DocumentKind, countryCode: string | null, year: number, sequenceNo: number) {
  return numberFor(kind, countryCode, year, sequenceNo);
}

type SnapshotLine = {
  skuId: string;
  titleAr: string;
  titleEn: string;
  accessType: string;
  net: number;
  platformDiscount: number;
  vat: number;
  lineTotal: number;
  /** The local list price the buyer saw, when the sale was charged in AED. */
  displayPrice?: number | null;
  displayCurrency?: string | null;
};

/**
 * Issues the numbered document for a paid order, once. The document is a snapshot: a later course
 * rename, VAT change or account erasure cannot rewrite it. Idempotent on (orderId, kind).
 */
export async function issueDocument(orderId: string, kind: DocumentKind = "INVOICE") {
  const existing = await db.document.findUnique({ where: { orderId_kind: { orderId, kind } } });
  if (existing) return existing;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      beneficiary: { select: { name: true } },
      items: {
        include: {
          sku: {
            include: {
              course: { select: { titleAr: true, titleEn: true } },
              lesson: { select: { titleAr: true, titleEn: true } },
              liveSession: { select: { titleAr: true, titleEn: true } },
            },
          },
        },
      },
    },
  });
  if (!order || order.status !== "PAID") return null;

  const cfg = await getFinanceConfig();
  const countryCode = order.taxCountryCode;
  const country = countryCode
    ? await db.country.findUnique({ where: { code: countryCode }, select: { vatTrn: true } })
    : null;
  const issuedAt = new Date();
  const year = issuedAt.getUTCFullYear();
  const series = seriesFor(kind, countryCode, year);

  const lines: SnapshotLine[] = order.items.map((i) => {
    const name = i.sku.liveSession ?? i.sku.lesson ?? i.sku.course;
    return {
      skuId: i.skuId,
      titleAr: name?.titleAr ?? "",
      titleEn: name?.titleEn ?? "",
      accessType: i.sku.accessType,
      net: i.price - i.platformDiscount,
      platformDiscount: i.platformDiscount,
      vat: 0,
      lineTotal: 0,
      displayPrice: i.displayPrice,
      displayCurrency: i.displayCurrency,
    };
  });
  const vatShares = allocate(order.vat, lines.map((l) => l.net));
  lines.forEach((l, i) => {
    l.vat = vatShares[i];
    l.lineTotal = l.net + l.vat;
  });

  try {
    return await db.$transaction(async (trx) => {
      const sequenceNo = await nextDocumentNumber(trx, series);
      return trx.document.create({
        data: {
          kind,
          sequenceKey: series,
          sequenceNo,
          number: numberFor(kind, countryCode, year, sequenceNo),
          orderId,
          currency: order.currency,
          taxCountryCode: countryCode,
          sellerName: cfg.sellerLegalName ?? "Dhirwa (ذروة)",
          sellerAddress: cfg.sellerAddress,
          sellerTrn: country?.vatTrn ?? cfg.vatTrn,
          buyerName: order.user.name,
          buyerEmail: order.user.email,
          buyerPhone: order.user.phone,
          beneficiaryName: order.beneficiary?.name ?? null,
          subtotal: order.subtotal,
          discount: order.discount,
          platformDiscount: order.platformDiscount,
          vat: order.vat,
          vatRateBp: order.vatRateBp,
          total: order.total + order.vat,
          lines: lines as unknown as Prisma.InputJsonValue,
        },
      });
    });
  } catch (e) {
    // A concurrent issuer won the unique (orderId, kind); return its document rather than a second one.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.document.findUnique({ where: { orderId_kind: { orderId, kind } } });
    }
    throw e;
  }
}

/** A credit note mirrors the invoice with negative amounts and its own gapless series. */
export async function issueCreditNote(orderId: string) {
  const invoice = await db.document.findUnique({ where: { orderId_kind: { orderId, kind: "INVOICE" } } });
  if (!invoice) return null;
  const existing = await db.document.findUnique({ where: { orderId_kind: { orderId, kind: "CREDIT_NOTE" } } });
  if (existing) return existing;

  const issuedAt = new Date();
  const year = issuedAt.getUTCFullYear();
  const series = seriesFor("CREDIT_NOTE", invoice.taxCountryCode, year);
  const lines = (invoice.lines as unknown as SnapshotLine[]).map((l) => ({
    ...l,
    net: -l.net,
    platformDiscount: -l.platformDiscount,
    vat: -l.vat,
    lineTotal: -l.lineTotal,
  }));

  try {
    return await db.$transaction(async (trx) => {
      const sequenceNo = await nextDocumentNumber(trx, series);
      return trx.document.create({
        data: {
          kind: "CREDIT_NOTE",
          sequenceKey: series,
          sequenceNo,
          number: numberFor("CREDIT_NOTE", invoice.taxCountryCode, year, sequenceNo),
          orderId,
          creditsDocumentId: invoice.id,
          currency: invoice.currency,
          taxCountryCode: invoice.taxCountryCode,
          sellerName: invoice.sellerName,
          sellerAddress: invoice.sellerAddress,
          sellerTrn: invoice.sellerTrn,
          buyerName: invoice.buyerName,
          buyerEmail: invoice.buyerEmail,
          buyerPhone: invoice.buyerPhone,
          beneficiaryName: invoice.beneficiaryName,
          subtotal: -invoice.subtotal,
          discount: -invoice.discount,
          platformDiscount: -invoice.platformDiscount,
          vat: -invoice.vat,
          vatRateBp: invoice.vatRateBp,
          total: -invoice.total,
          lines: lines as unknown as Prisma.InputJsonValue,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.document.findUnique({ where: { orderId_kind: { orderId, kind: "CREDIT_NOTE" } } });
    }
    throw e;
  }
}
