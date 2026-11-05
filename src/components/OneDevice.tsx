import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { DEVICE_COOKIE } from "@/lib/device";

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="grid size-full place-items-center content-center gap-4 p-6 text-center text-ink-muted">{children}</div>;
}

export const secondaryButton =
  "btn btn-outline";

/**
 * One device per account for paid video, recorded or live. Returns the viewer's IP when this browser is the
 * account's device (claiming it if none is set), or the notice to show instead.
 */
export async function oneDevice(userId: string, path: string): Promise<{ ip: string } | { block: React.ReactNode }> {
  const t = await getTranslations("player");
  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!deviceId) return { block: <Notice>{t("reload")}</Notice> };

  const current = await db.deviceSession.findUnique({ where: { userId } });
  if (current && current.fingerprint !== deviceId) {
    async function watchHere() {
      "use server";
      const s = await auth();
      const device = (await cookies()).get(DEVICE_COOKIE)?.value;
      if (s?.user && device) await db.deviceSession.update({ where: { userId: s.user.id }, data: { fingerprint: device, lastSeenAt: new Date() } });
      redirect(path);
    }
    return {
      block: (
        <Notice>
          <p className="max-w-[45ch]">{t("otherDevice")}</p>
          <form action={watchHere}>
            <button className={secondaryButton}>{t("watchHere")}</button>
          </form>
        </Notice>
      ),
    };
  }

  const h = await headers();
  const ip = clientIp(h);
  const userAgent = h.get("user-agent")?.slice(0, 300);
  await db.deviceSession.upsert({
    where: { userId },
    create: { userId, fingerprint: deviceId, ip, userAgent },
    update: { lastSeenAt: new Date(), ip, userAgent },
  });
  return { ip };
}
