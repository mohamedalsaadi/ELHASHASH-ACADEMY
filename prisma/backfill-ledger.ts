// Backfills SALE ledger rows for orders paid before the ledger existed.
// Dry run by default; pass --apply to write. Run: npx tsx prisma/backfill-ledger.ts [--apply]
//
// Rows are written with platformShareBp = 0 and no VAT, so historical earnings match the old
// gross model exactly. Refunded orders are skipped: their money was already returned.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const FILS = new Set(["KWD", "BHD", "OMR"]);
const money = (minor: number, currency: string) => (minor / (FILS.has(currency) ? 1000 : 100)).toFixed(2);

async function main() {
  const orders = await db.order.findMany({
    where: { status: "PAID", items: { some: { ledger: { none: { kind: "SALE" } } } } },
    select: {
      id: true,
      currency: true,
      items: {
        select: {
          id: true,
          price: true,
          ledger: { where: { kind: "SALE" }, select: { id: true }, take: 1 },
          sku: { select: { courseId: true, course: { select: { instructorId: true, subjectId: true, gradeId: true } } } },
        },
      },
    },
  });

  let lines = 0;
  const totals = new Map<string, number>();
  for (const o of orders) {
    for (const i of o.items) {
      if (i.ledger.length) continue;
      lines++;
      totals.set(o.currency, (totals.get(o.currency) ?? 0) + i.price);
    }
  }

  console.log(`${orders.length} paid orders, ${lines} lines to backfill`);
  for (const [currency, minor] of totals) console.log(`  ${currency} ${money(minor, currency)}`);

  if (!APPLY) {
    console.log("dry run; pass --apply to write");
    return;
  }

  let written = 0;
  for (const o of orders) {
    const data = o.items
      .filter((i) => !i.ledger.length)
      .map((i) => ({
        kind: "SALE" as const,
        orderId: o.id,
        orderItemId: i.id,
        instructorId: i.sku.course.instructorId,
        courseId: i.sku.courseId,
        subjectId: i.sku.course.subjectId,
        gradeId: i.sku.course.gradeId,
        currency: o.currency,
        gross: i.price,
        vat: 0,
        net: i.price,
        platformFee: 0,
        instructorNet: i.price,
        vatRateBp: 0,
        platformShareBp: 0,
      }));
    if (!data.length) continue;
    const { count } = await db.ledgerEntry.createMany({ data, skipDuplicates: true });
    written += count;
  }
  console.log(`wrote ${written} rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
