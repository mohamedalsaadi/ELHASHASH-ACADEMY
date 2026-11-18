// The course page as an email: the same sections in the same order, every action a link, and no site header or footer.
// Used by the course invite (src/lib/course-invite.ts). Hex is allowed here: email clients cannot read CSS variables.
import { createTranslator } from "next-intl";
import { onSale } from "@/lib/catalog";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { courseZone, formatDate, formatMoney, formatWhen } from "@/lib/format";
import { formatRate } from "@/lib/fx";
import { canCharge } from "@/lib/gateway";
import { liveApprovedOn } from "@/lib/live";
import { appUrl, esc } from "@/lib/mail";
import { lecturesIn, planValue } from "@/lib/plans";
import { aedPriceOf, cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const C = { ink: "#0E1A2B", paper: "#F4F7FB", card: "#FFFFFF", hair: "#DCE3EC", muted: "#4D5B72", raised: "#E9EEF5", gold: "#E8B04B", up: "#0F6B3B" };

/** Lessons listed in the email before the rest are summed up with a link to the page; a long course would pass Gmail's size limit. */
const LESSON_CAP = 60;

type T = (key: string, values?: Record<string, string | number>) => string;
const translator = (locale: "ar" | "en", namespace: string) => createTranslator({ locale, messages: (locale === "ar" ? ar : en) as never, namespace } as never) as unknown as T;

/** Everything the email shows, loaded once for a whole batch of recipients. */
export async function loadCourseEmailData(courseId: string, now = new Date()) {
  const course = await db.course.findUnique({
    where: { id: courseId, published: true },
    include: {
      grade: { include: { country: true } },
      liveSessions: { where: { cancelledAt: null, startsAt: { gt: new Date(now.getTime() - 5 * 3_600_000) } }, orderBy: { startsAt: "asc" }, include: { sku: true } },
      instructor: { select: { id: true, name: true, photoUrl: true, liveApproved: true } },
      units: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, include: { skus: { where: onSale(now) } } } } },
      skus: { where: { ...onSale(now), lessonId: null, liveSessionId: null }, orderBy: { price: "asc" } },
    },
  });
  if (!course) return null;
  const currency = course.grade?.country.currency ?? "AED";
  const fx = currency !== "AED" ? await db.fxRate.findUnique({ where: { currency }, select: { aedPerUnit: true } }) : null;
  return { course, fxRate: fx ? Number(fx.aedPerUnit) : null, now };
}
export type CourseEmailData = NonNullable<Awaited<ReturnType<typeof loadCourseEmailData>>>;

const button = (href: string, label: string, primary = true) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;${primary ? `background:${C.ink};color:#FFFFFF;` : `background:${C.card};color:${C.ink};border:1px solid ${C.ink};`}">${esc(label)}</a>`;
const card = (inner: string, extra = "") => `<div style="background:${C.card};border:1px solid ${C.hair};border-radius:16px;padding:16px;margin:0 0 12px;${extra}">${inner}</div>`;
const h2 = (text: string) => `<h2 style="margin:28px 0 12px;font-size:20px">${esc(text)}</h2>`;
const small = (text: string) => `<div style="color:${C.muted};font-size:12px;line-height:1.6">${esc(text)}</div>`;

/**
 * The course page as a visitor who holds nothing sees it: the cover, title and a Subscribe button, the units with their
 * lessons (the first unit's free lessons open, the rest can be rented), the teacher, upcoming live sessions and the plans.
 * Every price is the stored price and every button goes to the real page or checkout.
 */
export function renderCourseEmail(data: CourseEmailData, locale: "ar" | "en", opts: { intro?: string; unsubscribe: string }): string {
  const { course, fxRate, now } = data;
  const isAr = locale === "ar";
  const t = translator(locale, "catalog");
  const tp = translator(locale, "catalog.plans");
  const tl = translator(locale, "live");
  const base = `${appUrl()}/${locale}`;
  const courseUrl = `${base}/courses/${course.slug}`;
  const buy = (skuId: string) => `${base}/checkout?sku=${encodeURIComponent(skuId)}`;
  const zone = courseZone(course);
  const money = (n: number, cur: Parameters<typeof formatMoney>[1]) => formatMoney(n, cur, locale);
  const aedNote = (s: Parameters<typeof aedPriceOf>[0] & { currency: Parameters<typeof formatMoney>[1] }) => {
    const aed = aedPriceOf(s, now);
    if (aed == null || !canCharge("AED")) return t("paySoon");
    return aed !== effectivePrice(s, now) ? t("chargedInAed", { price: money(aed, "AED") }) : "";
  };

  const single = cheapestSku(course.units.flatMap((u) => u.lessons.flatMap((l) => l.skus)), now);
  const singlePrice = single ? effectivePrice(single, now) : null;
  const months = course.skus.filter((s) => s.accessType === "MONTHLY").sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
  const terms = course.skus.filter((s) => s.accessType === "SEMESTER").sort((a, b) => (a.term ?? 0) - (b.term ?? 0));
  const others = course.skus.filter((s) => s.accessType !== "MONTHLY" && s.accessType !== "SEMESTER");
  const buyFrom = cheapestSku(single ? [...course.skus, single] : course.skus, now);
  const freeLesson = course.units.find((u) => u.isFree)?.lessons[0] ?? null;
  const paidLessons = course.units.filter((u) => !u.isFree).flatMap((u) => u.lessons).length;

  // The cheapest plan per lecture earns "Best value", as on the page: computed, never asserted.
  const perLecture = (s: NonNullable<typeof single>) => effectivePrice(s, now) / Math.max(1, lecturesIn(course.units, s));
  const best = [
    { kind: "SINGLE", sku: single },
    { kind: "MONTHLY", sku: months[0] },
    { kind: "SEMESTER", sku: terms[0] },
  ]
    .filter((o): o is { kind: string; sku: NonNullable<typeof single> } => Boolean(o.sku))
    .sort((a, b) => perLecture(a.sku) - perLecture(b.sku))[0]?.kind;

  const title = pick(isAr, course.titleAr, course.titleEn);
  const headline = pick(isAr, course.headlineAr, course.headlineEn);
  const desc = pick(isAr, course.descAr, course.descEn);
  const out: string[] = [];

  if (opts.intro) out.push(`<p style="margin:0 0 16px;line-height:1.8">${esc(opts.intro)}</p>`);

  // Header: cover, grade, title, headline, description, and the buy buttons.
  if (course.coverKey) out.push(`<img src="${esc(`${appUrl()}/api/covers/${course.id}?v=${course.coverKey.split("/").pop()}`)}" alt="" width="608" style="display:block;width:100%;height:auto;border-radius:12px;margin:0 0 16px">`);
  out.push(small(course.grade ? pick(isAr, course.grade.nameAr, course.grade.nameEn) : t("skill")));
  out.push(`<h1 style="margin:4px 0 8px;font-size:28px;line-height:1.25">${esc(title)}</h1>`);
  if (headline) out.push(`<p style="margin:0 0 8px;font-size:17px;font-weight:600;line-height:1.6">${esc(headline)}</p>`);
  if (desc) out.push(`<p style="margin:0 0 16px;color:${C.muted};line-height:1.8">${esc(desc)}</p>`);
  if (buyFrom) {
    out.push(
      `<p style="margin:0 0 8px">${button(`${courseUrl}#packages`, t("subscribe"))}${freeLesson ? ` &nbsp; ${button(`${courseUrl}/lessons/${freeLesson.id}`, t("tryFree"), false)}` : ""}</p>`,
      `<p style="margin:0 0 4px"><span style="color:${C.muted};font-size:13px">${esc(t("from"))}</span> <strong style="font-size:20px">${esc(money(effectivePrice(buyFrom, now), buyFrom.currency))}</strong></p>`,
    );
    const note = aedNote(buyFrom);
    if (note) out.push(small(note));
  }
  const currency = course.grade?.country.currency ?? "AED";
  if (currency !== "AED") {
    out.push(`<div style="background:${C.raised};border-radius:12px;padding:12px;margin:16px 0 0;color:${C.muted};font-size:13px;line-height:1.7">${esc(fxRate != null ? t("conversionNoticeRate", { currency, rate: formatRate(fxRate, locale) }) : t("conversionNotice", { currency }))}</div>`);
  }

  // Units and lessons. The cap keeps a long course inside one email; the rest is a link away.
  out.push(h2(t("units")));
  if (course.units.length === 0) out.push(small(t("noUnits")));
  let listed = 0;
  course.units.forEach((u, i) => {
    const rows: string[] = [];
    for (const l of u.lessons) {
      if (listed >= LESSON_CAP) break;
      listed += 1;
      const rent = u.isFree ? null : cheapestSku(l.skus, now);
      const name = esc(pick(isAr, l.titleAr, l.titleEn));
      const sub = esc(u.isFree ? `${t(`kind.${l.kind}`)} · ${t("freeLesson")}` : t(`kind.${l.kind}`));
      const action = u.isFree
        ? `<a href="${esc(`${courseUrl}/lessons/${l.id}`)}" style="color:${C.ink}">${esc(t("freeLesson"))}</a>`
        : rent
          ? `${button(buy(rent.id), `${t("rent")} · ${money(effectivePrice(rent, now), rent.currency)}`, false)}`
          : `<span style="color:${C.muted}">${esc(t("liveSubscribers"))}</span>`;
      rows.push(
        `<tr><td style="padding:8px 0;border-top:1px solid ${C.hair}">${u.isFree ? `<a href="${esc(`${courseUrl}/lessons/${l.id}`)}" style="color:${C.ink};text-decoration:none;font-weight:600">${name}</a>` : `<span style="font-weight:600">${name}</span>`}<br><span style="color:${C.muted};font-size:12px">${sub}</span></td><td style="padding:8px 0 8px 12px;border-top:1px solid ${C.hair};text-align:${isAr ? "left" : "right"};white-space:nowrap">${action}</td></tr>`,
      );
    }
    const hidden = u.lessons.length - rows.length;
    out.push(
      card(
        `<div style="font-weight:700;font-size:16px;margin:0 0 8px">${i + 1}. ${esc(pick(isAr, u.titleAr, u.titleEn))}${u.isFree ? ` <span style="background:${C.gold};color:${C.ink};border-radius:999px;padding:2px 10px;font-size:12px">${esc(t("freeUnit"))}</span>` : ""}</div>` +
          small(t("unitCount", { done: 0, total: u.lessons.length })) +
          (rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:14px">${rows.join("")}</table>` : "") +
          (hidden > 0 && rows.length ? `<p style="margin:8px 0 0;font-size:13px"><a href="${esc(`${courseUrl}#units`)}" style="color:${C.ink}">+${hidden} · ${esc(t("units"))}</a></p>` : ""),
      ),
    );
  });

  // Teacher.
  out.push(h2(t("aboutTeacher")));
  out.push(
    card(
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${course.instructor.photoUrl ? `<td style="padding:0 0 0 14px"><img src="${esc(`${appUrl()}/api/avatars/${course.instructor.id}`)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover"></td>` : ""}<td><a href="${esc(`${base}/teachers/${course.instructor.id}`)}" style="color:${C.ink};font-weight:700;font-size:17px;text-decoration:none">${esc(course.instructor.name)}</a></td></tr></table>`,
    ),
  );

  // Live sessions, only for a teacher an admin approved for them.
  const live = liveApprovedOn(course) ? course.liveSessions.filter((l) => l.startsAt.getTime() + l.durationMin * 60_000 > now.getTime()) : [];
  if (live.length > 0) {
    out.push(h2(t("live")));
    for (const l of live) {
      const seat = l.sku?.active && (!l.sku.saleTo || l.sku.saleTo > now) ? l.sku : null;
      const minutes = Math.max(1, Math.round((l.startsAt.getTime() - now.getTime()) / 60_000));
      const soon = minutes <= 60 ? ` · ${tl("startsSoon", { minutes })}` : "";
      out.push(
        card(
          `<div style="font-weight:700">${esc(pick(isAr, l.titleAr, l.titleEn))}</div>` +
            small(formatWhen(l.startsAt, zone, locale) + soon) +
            `<p style="margin:10px 0 0">${seat ? button(buy(seat.id), `${t("liveSeat")} · ${money(effectivePrice(seat, now), seat.currency)}`, false) : `<span style="color:${C.muted}">${esc(t("liveSubscribers"))}</span>`}</p>` +
            (seat && aedNote(seat) ? small(aedNote(seat)) : ""),
        ),
      );
    }
  }

  // Plans: what each includes, then each way to buy it with its price per lecture and saving.
  const offer = (s: (typeof course.skus)[number], label?: string) => {
    const price = effectivePrice(s, now);
    const v = planValue(price, lecturesIn(course.units, s), singlePrice);
    const pct = discountPercent(s, now);
    const notes = [
      v ? tp("perLecture", { price: money(v.perLecture, s.currency) }) : "",
      v?.savePct && v.savePct > 0 ? tp("save", { pct: v.savePct }) : "",
      pct !== null ? t("percentOff", { pct }) : "",
      aedNote(s),
    ].filter(Boolean);
    return (
      `<div style="border-top:1px solid ${C.hair};padding-top:10px;margin-top:10px">${label ? `<div style="font-weight:600;font-size:14px">${esc(label)}</div>` : ""}` +
      `<div><strong style="font-size:22px">${esc(money(price, s.currency))}</strong>${pct !== null ? ` <s style="color:${C.muted};font-size:13px">${esc(money(s.price, s.currency))}</s>` : ""}</div>` +
      notes.map(small).join("") +
      `<p style="margin:8px 0 0">${button(buy(s.id), t("subscribe"), best === s.accessType)}</p></div>`
    );
  };
  const plan = (kind: string, name: string, lines: { on: boolean; text: string }[], offers: string) =>
    card(
      `<div style="font-weight:700;font-size:18px">${esc(name)}${best === kind ? ` <span style="background:${C.gold};color:${C.ink};border-radius:999px;padding:2px 10px;font-size:12px">${esc(tp("bestValue"))}</span>` : ""}</div>` +
        `<ul style="margin:8px 0 0;padding:0;list-style:none;font-size:14px;line-height:1.9">${lines.map((l) => `<li style="color:${l.on ? C.ink : C.muted}">${l.on ? "✓" : "–"} ${esc(l.text)}</li>`).join("")}</ul>` +
        offers,
      best === kind ? `border:2px solid ${C.ink};` : "",
    );
  if (single || months.length > 0 || terms.length > 0) {
    out.push(`<a id="packages"></a>`, h2(tp("title")));
    if (single) {
      out.push(
        plan(
          "SINGLE",
          tp("SINGLE"),
          [
            { on: true, text: tp("singleIncl", { days: single.accessDays ?? 0 }) },
            { on: false, text: tp("liveNo") },
            { on: false, text: tp("askNo") },
          ],
          `<div style="border-top:1px solid ${C.hair};padding-top:10px;margin-top:10px"><strong style="font-size:22px">${esc(money(singlePrice ?? 0, single.currency))}</strong>${paidLessons > 0 ? `<p style="margin:8px 0 0"><a href="${esc(`${courseUrl}#units`)}" style="color:${C.ink};font-weight:600">${esc(tp("pickLecture"))}</a></p>` : ""}</div>`,
        ),
      );
    }
    if (months.length > 0) {
      out.push(
        plan(
          "MONTHLY",
          tp("MONTHLY"),
          [
            { on: true, text: tp("monthIncl", { count: lecturesIn(course.units, months[0]), days: months[0].accessDays ?? 30 }) },
            { on: false, text: tp("liveNo") },
            { on: true, text: tp("askYes") },
          ],
          months.map((s) => offer(s, s.month ? tp("monthN", { n: s.month }) : undefined)).join(""),
        ),
      );
    }
    if (terms.length > 0) {
      out.push(
        plan(
          "SEMESTER",
          tp("SEMESTER"),
          [
            { on: true, text: paidLessons === 0 ? tp("wholeCourseIncl") : tp("semesterIncl", { count: lecturesIn(course.units, terms[0]) }) },
            { on: true, text: tp("liveYes") },
            { on: true, text: tp("askYes") },
          ],
          terms.map((s) => offer(s, s.term ? tp("termN", { n: s.term }) : undefined)).join(""),
        ),
      );
    }
  } else if (others.length === 0) {
    out.push(h2(tp("title")), small(t("noPackages")));
  }

  if (others.length > 0) {
    out.push(h2(tp("other")));
    for (const s of others) {
      const pct = discountPercent(s, now);
      out.push(
        card(
          `<div style="font-weight:700">${esc(t(`access.${s.accessType}`, { days: s.accessDays ?? 0 }))}</div>` +
            (s.accessEndsAt ? small(t("until", { date: formatDate(s.accessEndsAt, zone, locale) })) : "") +
            `<div style="margin-top:6px"><strong style="font-size:20px">${esc(money(effectivePrice(s, now), s.currency))}</strong>${pct !== null ? ` <s style="color:${C.muted};font-size:13px">${esc(money(s.price, s.currency))}</s>` : ""}</div>` +
            (aedNote(s) ? small(aedNote(s)) : "") +
            `<p style="margin:8px 0 0">${button(buy(s.id), t("subscribe"), false)}</p>`,
        ),
      );
    }
  }

  // The one link optional mail must carry. The site header and footer banners are deliberately left out.
  out.push(`<p style="margin:28px 0 0;text-align:center;font-size:12px"><a href="${esc(opts.unsubscribe)}" style="color:${C.muted}">${isAr ? "إيقاف الرسائل الاختيارية" : "Turn off optional emails"}</a></p>`);

  return `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}" lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${C.paper};font-family:Tahoma,Arial,sans-serif;color:${C.ink}"><div style="max-width:640px;margin:0 auto;padding:20px 16px">${out.join("")}</div></body></html>`;
}
