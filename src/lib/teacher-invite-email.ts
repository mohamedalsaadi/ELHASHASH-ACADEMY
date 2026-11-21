// The invitation an admin emails to teachers who are not on Dhirwa yet. It points to /teach, where they apply and the
// owner approves them. Every claim is something the platform does today: the share comes from the finance settings, the
// rest (own price, direct publish, discount codes, analytics, monthly bank transfer) is built. Hex is allowed here only:
// email clients cannot read CSS variables. Colours are the live brand tokens, gold as the only accent.
import { appUrl, esc } from "@/lib/mail";

export type InviteLocale = "ar" | "en";

const C = { ground: "#F5F5F7", card: "#FFFFFF", ink: "#1D1D1F", muted: "#636366", hair: "#E2E2E6", gold: "#E8B04B", dark: "#1C1C1E" };
const FONT = `'Readex Pro','IBM Plex Sans Arabic',Tahoma,Arial,sans-serif`;
/** The example price in the illustrative box, in AED. */
const EXAMPLE_PRICE = 300;

/** Teacher's share of a sale, in whole percent, from the platform's share in basis points. */
export const teacherSharePercent = (platformShareBp: number) => Math.round((10_000 - platformShareBp) / 100);

type Copy = {
  subject: string; pre: string; tag: string; kicker: string; h1: string; sub: (p: number) => string; hello: string; intro: string;
  why: string; perks: (p: number) => [string, string][]; exLabel: string; ex1: string; ex2: (earn: number, p: number) => string; ex3: string;
  how: string; steps: string[]; cta: string; ctaSub: string; note: string; stop: string;
};

const COPY: Record<InviteLocale, Copy> = {
  ar: {
    subject: "دعوة للتدريس على ذروة: سعر دورتك بيدك",
    pre: "اجمع طلابك في مكان واحد لدروسك واختباراتك، وتابع أداء كل طالب.",
    tag: "دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين",
    kicker: "دعوة خاصة للمعلمين",
    h1: "طلابك يستحقون مكانًا واحدًا لدروسك واختباراتك",
    sub: (p) => `ذروة منصة عربية تجمع شرحك وأسئلتك واختباراتك ومتابعة طلابك، وتدفع لك ${p}% من كل دورة تُباع.`,
    hello: "أهلاً بك أستاذنا الفاضل،",
    intro:
      "نحن «ذروة»: دروس تقوية أونلاين لطلاب الثانوية، مع مدرّسين. يشتري الطالب دورة من معلمه، ويتعلّم بدروس فيديو، ويجيب عن أسئلة بعد كل درس، ويختبر نفسه باختبارات بوقت، ويسأل معلمه مباشرة، ويتابع وليّ الأمر تقدّمه بالأرقام. نبدأ بالإمارات وعُمان، ونضيف دولًا أخرى لاحقًا.",
    why: "ما الذي ستكسبه معنا",
    perks: (p) => [
      [`${p}% من كل دورة`, "تُحسب من سعر الدورة قبل الضريبة. يصلك كشف حساب شهري، ويُحوَّل المبلغ إلى حسابك البنكي في العاشر من الشهر بعد اعتمادك للكشف."],
      ["سعر دورتك بيدك", "أنت تحدّد السعر وتنشر دورتك مباشرة، دون انتظار موافقة."],
      ["أحضر طلابك إلى مكان واحد", "شارك رابط دورتك مع طلابك الحاليين، وأنشئ لهم كود خصم خاصًا بدورتك. فيجد الطالب شرحك وأسئلتك واختباراته في مكان واحد، بدل أن تتفرّق المواد بين تطبيقات ومجموعات."],
      ["اعرف من يحتاج إليك", "أسئلة الطلاب في مكان واحد، وتحليل لأداء كل طالب، وتنبيه حين لا يفتح طالب أي درس لمدة سبعة أيام."],
      ["أدوات التدريس جاهزة", "اختبارات بوقت، وبنك أسئلة، وواجبات، وحصص مباشرة بعد اعتماد فريقنا لحسابك."],
      ["صفحة عامة باسمك", "تظهر سيرتك وخبرتك لطلابك وأولياء أمورهم من صفحة دورتك."],
    ],
    exLabel: "مثال توضيحي",
    ex1: `دورة بسعر ${EXAMPLE_PRICE} درهم`,
    ex2: (earn, p) => `يصل إليك ${earn} دراهم (${p}%) عن كل طالب يشتريها`,
    ex3: "قبل أي كود خصم تمنحه من نصيبك.",
    how: "كيف تبدأ",
    steps: ["قدّم طلبك من الرابط أدناه.", "نراجع طلبك ونفعّل حسابك.", "أنشئ دورتك، وحدّد سعرها، وانشرها، ثم شارك رابطها مع طلابك."],
    cta: "قدّم طلبك الآن",
    ctaSub: "نراجع كل طلب ونردّ عليك بالبريد الإلكتروني.",
    note: "إن كنت تعمل في مدرسة، فتأكد من عقدك ومن الأنظمة المعمول بها في الدولة بشأن الدروس الخصوصية قبل التسجيل.",
    stop: "لإيقاف الدعوات، ردّ على هذه الرسالة بكلمة «إيقاف».",
  },
  en: {
    subject: "An invitation to teach on Dhirwa: you set the price",
    pre: "Bring your students to one place for your lessons and exams, and see how each one is doing.",
    tag: "Online tutoring for secondary students, with real teachers",
    kicker: "A private invitation for teachers",
    h1: "Your students deserve one place for your lessons and exams",
    sub: (p) => `Dhirwa is an Arabic platform that brings your teaching, questions, exams and student follow-up together, and pays you ${p}% of every course sold.`,
    hello: "Dear teacher,",
    intro:
      "We are Dhirwa: online tutoring for secondary students, with real teachers. A student buys a course from their teacher, learns from video lessons, answers questions after each lesson, tests themselves in timed exams and asks the teacher directly, while the parent follows progress in numbers. We start with the UAE and Oman, and add more countries later.",
    why: "What you gain with us",
    perks: (p) => [
      [`${p}% of every course`, "Calculated on the course price before VAT. You get a monthly statement, and the amount is sent to your bank account on the 10th of the month after you acknowledge it."],
      ["You set the price", "You choose the price and publish your course directly, with no approval step."],
      ["Bring your students to one place", "Share your course link with your current students and create a discount code just for your course. They find your teaching, questions and exams in one place, instead of materials scattered across apps and groups."],
      ["Know who needs you", "Student questions in one inbox, performance analytics for each student, and an alert when a student has opened no lesson for seven days."],
      ["Teaching tools ready", "Timed exams, a question bank, homework, and live sessions once our team approves your account for them."],
      ["A public page in your name", "Your bio and experience appear to students and parents from your course page."],
    ],
    exLabel: "Illustrative example",
    ex1: `A course priced at ${EXAMPLE_PRICE} AED`,
    ex2: (earn, p) => `You receive ${earn} AED (${p}%) for every student who buys it`,
    ex3: "before any discount code you give from your share.",
    how: "How to start",
    steps: ["Apply with the link below.", "We review your application and activate your account.", "Create your course, set its price, publish it, then share its link with your students."],
    cta: "Apply now",
    ctaSub: "We review every application and reply by email.",
    note: "If you work at a school, check your contract and the rules that apply in your country about private tuition before you register.",
    stop: 'To stop receiving invitations, reply to this email with the word "stop".',
  },
};

export const teacherInviteSubject = (locale: InviteLocale) => COPY[locale].subject;

/** Keeps "70%" in reading order inside a right-to-left line. */
const num = (locale: InviteLocale, s: string) => (locale === "ar" ? `<span dir="ltr">${s}</span>` : s);

/**
 * Direction is set on the body and on a wrapper div as well as on <html>: Gmail and Outlook drop attributes on <html> and
 * <body>, and the wrapper is what every block inherits (the same fix as the course invite, src/lib/course-email.ts).
 */
export function renderTeacherInviteEmail(locale: InviteLocale, opts: { sharePercent: number }): string {
  const c = COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const al = locale === "ar" ? "right" : "left";
  const p = opts.sharePercent;
  const earn = Math.round((EXAMPLE_PRICE * p) / 100);
  const pct = (s: string) => esc(s).replace(`${p}%`, num(locale, `${p}%`));
  const brand = locale === "ar" ? "ذروة" : "Dhirwa";
  const url = `${appUrl()}/${locale}/teach`;

  const perks = c
    .perks(p)
    .map(
      ([t, d]) =>
        `<tr><td style="padding:0 0 14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.hair};border-radius:14px"><tr><td style="padding:16px 18px;text-align:${al}"><div style="font-size:16px;font-weight:700;color:${C.ink};margin:0 0 4px 0"><span style="color:${C.gold}">&#9679;</span>&nbsp;${pct(t)}</div><div style="font-size:14.5px;line-height:1.75;color:${C.muted}">${esc(d)}</div></td></tr></table></td></tr>`,
    )
    .join("");
  const steps = c.steps
    .map(
      (s, i) =>
        `<tr><td style="padding:0 0 10px 0;text-align:${al};font-size:15px;line-height:1.7;color:${C.ink}"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:13px;background:${C.ink};color:${C.card};font-size:13px;font-weight:700">${i + 1}</span>&nbsp; ${esc(s)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html dir="${dir}" lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body dir="${dir}" style="margin:0;padding:0;background:${C.ground};font-family:${FONT};direction:${dir};text-align:${al}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.pre)}</div>
<div dir="${dir}" lang="${locale}" style="background:${C.ground};padding:24px 12px;direction:${dir};text-align:${al}">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
<tr><td style="padding:0 0 14px 0;text-align:center"><span style="font-size:30px;font-weight:700;color:${C.ink}">${brand}</span><span style="color:${C.gold};font-size:30px">&#8226;</span><div style="font-size:12.5px;color:${C.muted};margin-top:2px">${esc(c.tag)}</div></td></tr>
<tr><td style="background:${C.dark};border-radius:20px 20px 0 0;padding:36px 28px 32px 28px;text-align:${al}">
 <div style="font-size:12.5px;font-weight:700;letter-spacing:.04em;color:${C.gold};margin:0 0 12px 0">${esc(c.kicker)}</div>
 <div style="font-size:27px;line-height:1.45;font-weight:700;color:#FFFFFF;margin:0 0 14px 0">${esc(c.h1)}</div>
 <div style="font-size:15.5px;line-height:1.8;color:#D1D1D6">${pct(c.sub(p))}</div></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.hair};border-top:0;border-radius:0 0 20px 20px;padding:28px 24px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
 <tr><td style="text-align:${al};font-size:15.5px;line-height:1.9;color:${C.ink};padding:0 0 22px 0"><b>${esc(c.hello)}</b><br>${esc(c.intro)}</td></tr>
 <tr><td style="text-align:${al};font-size:19px;font-weight:700;color:${C.ink};padding:0 0 12px 0">${esc(c.why)}</td></tr>
 ${perks}
 <tr><td style="padding:6px 0 22px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground};border-radius:14px"><tr><td style="padding:16px 18px;text-align:${al}">
  <div style="font-size:12px;font-weight:700;color:${C.muted};margin:0 0 6px 0">${esc(c.exLabel)}</div>
  <div style="font-size:15px;color:${C.ink};line-height:1.7">${esc(c.ex1)}<br><span style="font-size:19px;font-weight:700"><span style="border-bottom:3px solid ${C.gold}">${pct(c.ex2(earn, p))}</span></span><br><span style="font-size:13px;color:${C.muted}">${esc(c.ex3)}</span></div></td></tr></table></td></tr>
 <tr><td style="text-align:${al};font-size:19px;font-weight:700;color:${C.ink};padding:0 0 12px 0">${esc(c.how)}</td></tr>
 ${steps}
 <tr><td align="center" style="padding:20px 0 6px 0"><a href="${esc(url)}" style="display:inline-block;background:${C.gold};color:${C.ink};font-weight:700;font-size:17px;text-decoration:none;padding:15px 38px;border-radius:999px">${esc(c.cta)}</a><div style="font-size:12.5px;color:${C.muted};margin-top:10px">${esc(c.ctaSub)}</div></td></tr>
 <tr><td style="text-align:${al};font-size:12.5px;line-height:1.7;color:${C.muted};padding:18px 0 0 0;border-top:1px solid ${C.hair}">${esc(c.note)}</td></tr>
 </table></td></tr>
<tr><td style="padding:16px 8px 0 8px;text-align:center;font-size:12px;line-height:1.7;color:${C.muted}">${brand} &middot; <a href="https://dhirwa.ae" style="color:${C.muted}">dhirwa.ae</a><br>${esc(c.stop)}</td></tr>
</table></div></body></html>`;
}
