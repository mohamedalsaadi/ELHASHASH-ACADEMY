import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/pricing-engine";

const A4: [number, number] = [595.28, 841.89];
const M = 48;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);
const RULE = rgb(0.8, 0.8, 0.8);

/** pdf-lib's standard fonts are WinAnsi; Arabic names have no glyphs there. The Arabic HTML page is the Arabic copy. */
function latin(value: string | null | undefined, fallback = "") {
  const text = (value ?? "").replace(/[^\x20-\x7E]/g, "").trim();
  return text || fallback;
}

function clip(value: string, max = 52) {
  return value.length > max ? `${value.slice(0, max - 1)}…`.replace("…", "...") : value;
}

type Line = { titleEn: string; accessType: string; net: number; vat: number; lineTotal: number };

export type ReceiptPdfInput = {
  number: string;
  kind: "INVOICE" | "CREDIT_NOTE";
  issuedAt: Date;
  sellerName: string;
  sellerAddress: string | null;
  sellerTrn: string | null;
  buyerName: string;
  beneficiaryName: string | null;
  currency: Currency;
  subtotal: number;
  discount: number;
  platformDiscount: number;
  vat: number;
  vatRateBp: number;
  total: number;
  lines: Line[];
};

export async function receiptPdf(d: ReceiptPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const money = (n: number) => latin(formatMoney(n, d.currency, "en"));
  let y = A4[1] - M;

  const text = (value: string, opts: { x?: number; size?: number; bold?: boolean; color?: typeof INK } = {}) => {
    page.drawText(latin(value), { x: opts.x ?? M, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: opts.color ?? INK });
  };
  const rule = () => {
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.5, color: RULE });
    y -= 16;
  };

  text(d.kind === "CREDIT_NOTE" ? "CREDIT NOTE" : d.vat > 0 ? "TAX INVOICE" : "RECEIPT", { size: 18, bold: true });
  y -= 26;
  text(`No. ${d.number}`, { size: 11, bold: true });
  y -= 15;
  text(`Issued ${d.issuedAt.toISOString().slice(0, 10)}`, { color: MUTED });
  y -= 26;

  text(latin(d.sellerName, "Dhirwa").replace(/\s*\(\s*\)\s*$/, "").trim() || "Dhirwa", { bold: true });
  y -= 14;
  if (d.sellerAddress) {
    text(d.sellerAddress, { color: MUTED });
    y -= 14;
  }
  if (d.sellerTrn) {
    text(`TRN: ${d.sellerTrn}`, { color: MUTED });
    y -= 14;
  }
  rule();

  text(`Buyer: ${latin(d.buyerName, "Customer")}`);
  y -= 14;
  if (d.beneficiaryName) {
    text(`Student: ${latin(d.beneficiaryName, "Student")}`);
    y -= 14;
  }
  rule();

  text("Description", { bold: true });
  text("Net", { bold: true, x: 360 });
  text("VAT", { bold: true, x: 445 });
  text("Total", { bold: true, x: 505 });
  y -= 15;
  rule();

  const shown = d.lines.slice(0, 18);
  for (const line of shown) {
    text(clip(`${latin(line.titleEn, "Course")} (${line.accessType})`, 44), { size: 9 });
    text(money(line.net), { size: 9, x: 360 });
    text(money(line.vat), { size: 9, x: 445 });
    text(money(line.lineTotal), { size: 9, x: 505 });
    y -= 13;
  }
  if (d.lines.length > shown.length) {
    text(`... and ${d.lines.length - shown.length} more lines`, { size: 9, color: MUTED });
    y -= 13;
  }
  rule();

  const row = (label: string, value: string, isBold = false) => {
    text(label, { x: 320, bold: isBold });
    text(value, { x: 505, bold: isBold });
    y -= 13;
  };
  row("Subtotal", money(d.subtotal));
  if (d.discount) row("Discount", `-${money(d.discount)}`);
  if (d.platformDiscount) row("Referral discount", `-${money(d.platformDiscount)}`);
  if (d.vat) row(`VAT (${d.vatRateBp / 100}%)`, money(d.vat));
  y -= 4;
  row("Paid", money(d.total), true);
  y -= 18;
  text("Thank you. This document is valid without a stamp.", { size: 9, color: MUTED });

  return pdf.save();
}

export type StatementPdfInput = {
  number: string;
  period: string;
  currency: Currency;
  teacherName: string;
  salesCount: number;
  refundCount: number;
  gross: number;
  vat: number;
  net: number;
  platformFee: number;
  platformDiscount: number;
  corporateTax: number;
  instructorNet: number;
  instructorPayout: number;
};

export async function statementPdf(d: StatementPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const money = (n: number) => latin(formatMoney(n, d.currency, "en"));
  let y = A4[1] - M;

  const text = (value: string, opts: { x?: number; size?: number; bold?: boolean; color?: typeof INK } = {}) => {
    page.drawText(latin(value), { x: opts.x ?? M, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: opts.color ?? INK });
  };
  const row = (label: string, value: string, isBold = false) => {
    text(label, { bold: isBold });
    text(value, { x: 505, bold: isBold });
    y -= 16;
  };

  text("MONTHLY STATEMENT", { size: 18, bold: true });
  y -= 26;
  text(`Statement ${d.number}`, { size: 11, bold: true });
  y -= 15;
  text(`Period ${d.period} · ${d.currency}`, { color: MUTED });
  y -= 15;
  text(`Teacher: ${latin(d.teacherName, "Teacher")}`);
  y -= 26;

  row("Sales", String(d.salesCount));
  row("Refunds", String(d.refundCount));
  row("Gross paid by buyers", money(d.gross));
  row("VAT collected", money(d.vat));
  row("Net sales", money(d.net));
  row("Platform fee", money(d.platformFee));
  row("Platform-funded discounts", money(d.platformDiscount));
  row("Corporate-tax contribution", money(d.corporateTax));
  row("Your share before contribution", money(d.instructorNet));
  y -= 4;
  row("Your payout", money(d.instructorPayout), true);
  y -= 18;
  text("Figures come from the immutable ledger. A credit note is a separate negative row.", { size: 9, color: MUTED });

  return pdf.save();
}

export type TaxPdfRow = {
  period: string;
  countryCode: string;
  currency: Currency;
  salesNetStandard: number;
  vatOutput: number;
  salesNetZero: number;
  creditNotesVat: number;
  netVatDue: number;
};

export async function taxReportPdf(period: string, rows: TaxPdfRow[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = A4[1] - M;
  const text = (value: string, opts: { x?: number; size?: number; bold?: boolean; color?: typeof INK } = {}) => {
    page.drawText(latin(value), { x: opts.x ?? M, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: opts.color ?? INK });
  };
  const money = (n: number, c: Currency) => latin(formatMoney(n, c, "en"));

  text("TAX DECLARATION", { size: 18, bold: true });
  y -= 26;
  text(`Period ${period}`, { size: 11, bold: true });
  y -= 15;
  text("VAT201-style summary from the ledger. Amounts are never converted between currencies.", { size: 9, color: MUTED });
  y -= 26;
  text("Market", { bold: true });
  text("Currency", { bold: true, x: 90 });
  text("Standard sales", { bold: true, x: 160 });
  text("Output VAT", { bold: true, x: 260 });
  text("Zero sales", { bold: true, x: 350 });
  text("Credit VAT", { bold: true, x: 430 });
  text("Net VAT due", { bold: true, x: 505 });
  y -= 15;
  page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.5, color: RULE });
  y -= 16;

  for (const r of rows) {
    text(r.countryCode);
    text(r.currency, { x: 90 });
    text(money(r.salesNetStandard, r.currency), { x: 160 });
    text(money(r.vatOutput, r.currency), { x: 260 });
    text(money(r.salesNetZero, r.currency), { x: 350 });
    text(money(r.creditNotesVat, r.currency), { x: 430 });
    text(money(r.netVatDue, r.currency), { x: 505, bold: true });
    y -= 14;
  }
  y -= 10;
  text("Input tax is zero: platform costs are not recorded in this database.", { size: 9, color: MUTED });
  return pdf.save();
}
