import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export type Seller = { name: string | null; address: string | null; licence: string | null };

async function load(): Promise<Seller> {
  const row = await db.platformSetting.findUnique({
    where: { id: "singleton" },
    select: { sellerLegalName: true, sellerAddress: true, sellerLicenceNo: true },
  });
  return {
    name: row?.sellerLegalName?.trim() || null,
    address: row?.sellerAddress?.trim() || null,
    licence: row?.sellerLicenceNo?.trim() || null,
  };
}

/** Who sells here, as the owner entered it in the admin settings. Nothing is shown until a field is filled: never a placeholder. */
export const getSeller = process.env.NODE_ENV === "production" ? unstable_cache(load, ["seller-identity"], { revalidate: 300 }) : load;

/** One sentence naming the operator, for the policy pages. Renders nothing while the settings are empty. */
export async function SellerLine({ locale }: { locale: string }) {
  const { name, address, licence } = await getSeller();
  if (!name && !address && !licence) return null;
  const ar = locale === "ar";
  const who = [name, address].filter(Boolean).join(ar ? "، " : ", ");
  const parts = [
    who && (ar ? `الجهة المشغّلة: ${who}.` : `Operated by ${who}.`),
    licence && (ar ? `رقم الرخصة التجارية: ${licence}.` : `Trade licence no. ${licence}.`),
  ].filter(Boolean);
  return <p>{parts.join(" ")}</p>;
}
