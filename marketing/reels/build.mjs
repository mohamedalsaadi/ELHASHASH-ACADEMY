// Generates the three Dhirwa reels (HyperFrames projects) from one set of scene definitions.
//   node build.mjs      -> writes a/ b/ c/ (index.html + assets/fonts)
// Brand values come from DESIGN.md / src/app/tokens.css. Caption times are ESTIMATES until the Gulf voiceover exists:
// when the voice file is added, re-time `cap` to its transcript (npx hyperframes transcribe).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const GROUND = "#F5F5F7", INK = "#1D1D1F", MUTED = "#636366", HAIR = "#E2E2E6", GOLD = "#E8B04B", SURFACE = "#FFFFFF";
const RIDGES = ["M4 43C16 39 24 17 32 15C40 17 48 39 60 43", "M14 43C22 39 27 25 32 23.5C37 25 42 39 50 43", "M24 43C28 40 30 32.5 32 31.5C34 32.5 36 40 40 43"];

// What Dhirwa is, said and shown in every fast reel: the headline, then who it is for and who teaches.
const WHAT = [{ text: "دروس تقوية أونلاين", cue: "دروس" }, { text: "لطلاب الثانوية", cue: "لطلاب" }, { text: "مع مدرّسين", cue: "مع مدرّسين" }];

const versions = {
  a: {
    label: "الطالب",
    duration: 31,
    voice: "voice/a-alignment.json",
    music: true,
    scenes: [
      { type: "hook", at: 0, dur: 1.73, lines: ["نهائي الرياضيات", "على الباب!"], gold: 1, lineAt: [0, 0.5] },
      { type: "hook", at: 1.73, dur: 2.57, lines: ["وللحين تقول باجر؟", "لا لا لا!"], gold: 1, lineAt: [0.05, 1.55] },
      { type: "intro", at: 4.3, dur: 3.46 },
      { type: "video", at: 7.76, dur: 4.66 },
      { type: "quiz", at: 12.42, dur: 2.74 },
      { type: "timer", at: 15.16, dur: 2.09 },
      { type: "number", at: 17.25, dur: 2.03, label: "مستواك", from: 62, to: 81, count: 1.3 },
      { type: "parent", at: 19.28, dur: 2.56 },
      { type: "bubbles", at: 21.84, dur: 2.0, items: [{ who: "me", text: "علقت؟" }, { who: "teacher", text: "اسأل مدرّسك على طول" }] },
      { type: "packages", at: 23.84, dur: 3.01 },
      { type: "end", at: 26.85, dur: 4.15 },
    ],
  },
  // B and C are timed by `cue`: a scene (or a line, or a bubble) starts when the voice says that phrase.
  b: {
    label: "ولي الأمر",
    duration: 25.4,
    voice: "voice/b-alignment.json",
    music: true,
    scenes: [
      { type: "hook", cue: "تبي", lines: ["وين مستوى ولدك", "في الرياضيات؟"], gold: 1, lineCue: ["تبي", "في الرياضيات"] },
      { type: "intro", cue: "تعرّف" },
      { type: "video", cue: "دروس فيديو" },
      { type: "quiz", cue: "وبعد كل درس" },
      { type: "timer", cue: "واختبارات" },
      { type: "parent", cue: "وإنت تشوف", title: "تقدّم ولدك" },
      { type: "bubbles", cue: "بدون ما", items: [{ who: "parent", text: "خلّصت دروسك؟" }, { who: "me", text: "كله عندك بالأرقام!" }] },
      { type: "packages", cue: "اختار باقة" },
      { type: "end", cue: "ذروة…" },
    ],
  },
  c: {
    label: "حوار مرح",
    duration: 32.2,
    voice: "voice/c-alignment.json",
    music: true,
    dialogue: true,
    scenes: [
      {
        type: "bubbles", cue: "قاعد", big: true,
        items: [{ who: "parent", text: "قاعد تذاكر؟!", cue: "قاعد" }, { who: "me", text: "إيه! أراجع رياضيات للنهائي", cue: "إيه!" }, { who: "parent", text: "من متى إنت تذاكر؟", cue: "من متى" }],
      },
      { type: "intro", cue: "من يوم", kicker: "من يوم سجّلت في" },
      { type: "video", cue: "دروس فيديو" },
      { type: "quiz", cue: "وبعد كل درس" },
      { type: "bubbles", cue: "وأقدر", big: true, items: [{ who: "parent", text: "وأقدر أشوف تقدّمك؟", cue: "وأقدر" }] },
      { type: "parent", cue: "أكيد يبه", title: "تقدّمي بالأرقام" },
      {
        type: "bubbles", cue: "زين والله", big: true,
        items: [{ who: "parent", text: "زين والله! وإذا ما فهمت شي؟", cue: "زين والله" }, { who: "me", text: "أسأل مدرّسي على طول", cue: "أسأل مدرّسي" }],
      },
      { type: "end", cue: "ذروة…" },
    ],
  },
  // D, E, F: short and fast. The kinetic type is the caption, so there is no caption bar; cuts are hard.
  d: {
    label: "تحدّي ٥ ثواني",
    duration: 15.7,
    voice: "voice/d-alignment.json",
    music: true, musicVol: 0.3, fast: true,
    scenes: [
      { type: "slam", dark: true, lines: ["سؤال سريع!"], dot: true },
      { type: "quiz", cue: "مشتقة", pick: false },
      { type: "countdown", cue: "عندك", dark: true },
      { type: "quiz", cue: "صح!", pick: 0.1, still: true },
      { type: "slam", cue: "تبي", lines: ["تبي أسئلة", "مثل هذي؟"], lineCue: ["تبي", "مثل"], size: 150 },
      { type: "slam", cue: "بعد كل", dark: true, lines: ["بعد كل درس"], dot: true },
      { type: "what", cue: "ذروة:", items: WHAT },
      { type: "end", cue: "كل درس خطوة" },
    ],
  },
  e: {
    label: "قبل / بعد",
    duration: 18.9,
    voice: "voice/e-alignment.json",
    music: true, musicVol: 0.3, fast: true,
    scenes: [
      { type: "slam", dark: true, kicker: "قبل", lines: ["بعدين…", "بكرة…", "ما فهمت!"], lineCue: ["قبل", "بكرة", "ما فهمت"], size: 150, strike: true },
      { type: "intro", cue: "بعد ذروة", kicker: "بعد" },
      { type: "what", cue: "دروس تقوية", items: WHAT, noHead: true },
      { type: "slam", cue: "درس.", lines: ["درس"], dot: true },
      { type: "slam", cue: "سؤال.", dark: true, lines: ["سؤال"], dot: true },
      { type: "slam", cue: "اختبار.", lines: ["اختبار"], dot: true },
      { type: "number", cue: "وتشوف", label: "مستواك", from: 62, to: 81, count: 1.2 },
      { type: "end", cue: "كل درس خطوة" },
    ],
  },
  f: {
    label: "رسالة لولي الأمر",
    duration: 14,
    voice: "voice/f-alignment.json",
    music: true, musicVol: 0.3, fast: true,
    scenes: [
      { type: "slam", dark: true, lines: ["يا أبو محمد!"], size: 170 },
      {
        type: "notify", cue: "ولدك",
        items: [{ text: "خلّص درس اليوم", cue: "ولدك" }, { text: "حلّ أسئلة الدرس", cue: "وحلّ" }, { text: `آخر اختبار: <span dir="ltr">81 / 100</span>`, cue: "ونتيجته" }],
      },
      { type: "slam", cue: "بدون", dark: true, lines: ["بدون ما تسأله!"], size: 170, dot: true },
      { type: "what", cue: "ذروة:", items: WHAT },
      { type: "end", cue: "كل درس خطوة" },
    ],
  },
  // A2, B2, C2: the first three scripts, audited, in the D/E/F style at medium length.
  a2: {
    label: "الطالب (متوسط)",
    duration: 28.8,
    voice: "voice/a2-alignment.json",
    music: true, musicVol: 0.3, fast: true,
    scenes: [
      { type: "slam", dark: true, lines: ["نهائي الرياضيات", "على الباب!"], lineCue: ["نهائي", "على الباب"], size: 150 },
      { type: "slam", cue: "وللحين", lines: ["وللحين تقول", "بكرة؟"], lineCue: ["وللحين", "بكرة"], size: 160 },
      { type: "slam", cue: "لا لا", dark: true, lines: ["لا لا لا!"], strike: true },
      { type: "what", cue: "ذروة:", items: WHAT },
      { type: "video", cue: "يشرحون" },
      { type: "quiz", cue: "بعد كل درس" },
      { type: "timer", cue: "واختبارات" },
      { type: "number", cue: "تشوف", label: "مستواك", from: 62, to: 81, count: 1.2 },
      { type: "parent", cue: "وولي" },
      { type: "bubbles", cue: "علقت", big: true, items: [{ who: "me", text: "علقت؟", cue: "علقت" }, { who: "teacher", text: "اسأل مدرّسك على طول!", cue: "اسأل" }] },
      { type: "packages", cue: "اختار" },
      { type: "end", cue: "كل درس خطوة" },
    ],
  },
  b2: {
    label: "ولي الأمر (متوسط)",
    duration: 21.5,
    voice: "voice/b2-alignment.json",
    music: true, musicVol: 0.3, fast: true,
    scenes: [
      { type: "slam", dark: true, lines: ["وين مستوى ولدك", "في الرياضيات؟", "قبل النهائي؟"], lineCue: ["تبي", "في الرياضيات", "قبل"], size: 130 },
      { type: "what", cue: "ذروة:", items: WHAT },
      { type: "quiz", cue: "بعد كل" },
      { type: "timer", cue: "واختبارات" },
      { type: "parent", cue: "وإنت", title: "تقدّم ولدك" },
      { type: "slam", cue: "بدون", dark: true, lines: ["بدون ما تسأله", "ألف مرة!"], lineCue: ["بدون", "ألف"], size: 150, dot: true },
      { type: "packages", cue: "اختار" },
      { type: "slam", cue: "وريّح", lines: ["وريّح بالك"], size: 180, dot: true },
      { type: "end", cue: "كل درس خطوة" },
    ],
  },
  c2: {
    label: "حوار مرح (متوسط)",
    duration: 33.6,
    voice: "voice/c2-alignment.json",
    music: true, musicVol: 0.3, fast: true, dialogue: true,
    scenes: [
      {
        type: "bubbles", cue: "قاعد", big: true,
        items: [{ who: "parent", text: "قاعد تذاكر؟!", cue: "قاعد" }, { who: "me", text: "إيه! أراجع رياضيات للنهائي", cue: "إيه!" }, { who: "parent", text: "من متى إنت تذاكر؟", cue: "من متى" }],
      },
      { type: "slam", cue: "من يوم", dark: true, lines: ["من يوم سجّلت", "في ذروة!"], lineCue: ["من يوم", "في ذروة"], size: 150, dot: true },
      { type: "video", cue: "دروس فيديو" },
      { type: "quiz", cue: "وبعد كل" },
      { type: "bubbles", cue: "وأقدر", big: true, items: [{ who: "parent", text: "وأقدر أشوف تقدّمك؟", cue: "وأقدر" }] },
      { type: "parent", cue: "أكيد يبه", title: "تقدّمي بالأرقام" },
      {
        type: "bubbles", cue: "زين والله", big: true,
        items: [{ who: "parent", text: "زين والله! وإذا ما فهمت شي؟", cue: "زين والله" }, { who: "me", text: "أسأل مدرّسي على طول", cue: "أسأل مدرّسي" }],
      },
      { type: "what", cue: "ذروة:", items: WHAT },
      { type: "end", cue: "كل درس خطوة" },
    ],
  },
};

/** Turns `cue` phrases into start times from the voice's character timings, in order, then fills in each scene's length. */
function resolveCues(v) {
  if (!v.voice || !v.scenes.some((s) => s.cue)) return;
  const a = JSON.parse(readFileSync(v.voice, "utf8")).alignment;
  const text = a.characters.join("");
  let from = 0;
  const at = (phrase) => {
    const i = text.indexOf(phrase, from);
    if (i < 0) throw new Error(`cue not found in the voice: ${phrase}`);
    from = i;
    return +a.character_start_times_seconds[i].toFixed(2);
  };
  for (const s of v.scenes) {
    s.at = s.cue === v.scenes[0].cue && s === v.scenes[0] ? 0 : at(s.cue);
    // The cut lands a beat before the word, so the picture is there when it is said.
    if (s.at > 0) s.at = +Math.max(0, s.at - 0.08).toFixed(2);
    const back = from;
    if (s.lineCue) s.lineAt = s.lineCue.map((p, j) => (j === 0 ? 0 : +Math.max(0, (from = back, at(p)) - s.at).toFixed(2)));
    if (s.items?.some((b) => b.cue)) s.itemAt = s.items.map((b) => +Math.max(0.05, (from = back, at(b.cue)) - s.at).toFixed(2));
    from = back;
  }
  v.scenes.forEach((s, i) => {
    s.dur = +((v.scenes[i + 1]?.at ?? v.duration) - s.at).toFixed(2);
  });
}

const words = (t, cls) => t.split(" ").map((w) => `<span class="w ${cls ?? ""}">${w}</span>`).join(" ");
const mark = (id, size) => `<svg id="${id}" viewBox="0 0 64 48" width="${size}" height="${size * 0.75}" fill="none"><g stroke="${INK}" stroke-width="3.2" stroke-linecap="round">${RIDGES.map((d, i) => `<path class="${id}-r" pathLength="1" d="${d}"/>`).join("")}</g><circle id="${id}-dot" cx="32" cy="6.5" r="3.6" fill="${GOLD}"/></svg>`;

// Lengths of the generated effects in sfx/, in seconds.
const SFX_LEN = { whoosh: 0.6, pop: 0.48, tick: 0.48, riser: 1.6 };

function capsFromVoice(file, cutoff = Infinity, merge = true) {
  const { alignment: a } = JSON.parse(readFileSync(file, "utf8"));
  const groups = [];
  let cur = { t: "", s: null, e: 0 };
  let tag = false; // [excited] and similar voice tags are not spoken and carry no timing worth showing
  a.characters.forEach((c, i) => {
    if (c === "[") tag = true;
    if (cur.s === null && c.trim() && !tag) cur.s = a.character_start_times_seconds[i];
    if (c === "]") tag = false;
    cur.t += c;
    cur.e = a.character_end_times_seconds[i];
    if (/[،.؟!…]/.test(c)) {
      groups.push(cur);
      cur = { t: "", s: null, e: 0 };
    }
  });
  if (cur.t.trim()) groups.push(cur);
  const merged = [];
  for (const g of groups.filter((g) => g.s !== null && g.s < cutoff)) {
    const prev = merged[merged.length - 1];
    // In a dialogue every line is one speaker's, so short lines are not merged across speakers.
    // A group that is only punctuation ("!" after "إنت؟") always joins the one before it.
    const bare = !/[\p{L}\p{N}]/u.test(g.t.replace(/\[[^\]]*\]/g, ""));
    if (prev && (bare || (merge && prev.t.trim().split(/\s+/).length < 3))) Object.assign(prev, { t: prev.t + g.t, e: g.e });
    else merged.push({ ...g });
  }
  return merged.map((g, i) => {
    const next = merged[i + 1]?.s ?? g.e + 0.4;
    const text = g.t.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().replace(/[،.…]+$/, "");
    return [Math.max(0.1, +g.s.toFixed(2)), +Math.min(next, g.e + 0.6, cutoff).toFixed(2), text];
  });
}

function build(key, v) {
  resolveCues(v);
  // The end card already shows the tagline, so no caption sits on it.
  v.cap = v.voice && !v.fast ? capsFromVoice(v.voice, v.scenes.find((x) => x.type === "end").at, !v.dialogue) : [];
  // Bubbles, headlines and the intro already put the spoken words on screen: a caption under them only repeats them.
  const wordy = v.scenes.filter((x) => x.type === "bubbles" || x.type === "hook" || x.type === "intro");
  v.cap = v.cap.filter(([a]) => !wordy.some((x) => a >= x.at - 0.1 && a < x.at + x.dur));
  const DURATION = v.duration ?? 18;
  let html = "";
  let js = "";
  const sfx = [];
  v.scenes.forEach((s, i) => {
    const id = `s${i}`;
    const end = s.at + s.dur;
    const T = s.at;
    html += `\n    <section id="${id}" class="clip scene${s.dark ? " dark" : ""}" data-start="${s.at}" data-duration="${s.dur}" data-track-index="1"><div class="drift">`;
    if (s.type === "hook") {
      html += `<div class="stack">${s.lines.map((l, j) => `<h1 id="${id}-l${j}" class="big ${j === s.gold ? "gold" : ""}">${words(l)}</h1>`).join("")}<i id="${id}-bar" class="bar"></i></div>`;
      s.lines.forEach((_, j) => {
        const first = s.at === 0 && j === 0; // frame 0 is the thumbnail: the first line is already there
        js += `tl.fromTo("#${id}-l${j} .w",{y:${first ? 30 : 70},opacity:${first ? 1 : 0}},{y:0,opacity:1,duration:0.4,ease:"power4.out",stagger:0.07},${T + (s.lineAt ? s.lineAt[j] : 0.15 + j * 0.8)});\n`;
      });
      js += `tl.fromTo("#${id}-bar",{scaleX:0},{scaleX:1,duration:0.4,ease:"power3.out"},${T + (s.lineAt ? s.lineAt.at(-1) + 0.2 : 0.9)});\n`;
    } else if (s.type === "list") {
      html += `<div class="card"><div class="ctitle">${s.title}</div>${s.rows.map((r, j) => `<div id="${id}-r${j}" class="row"><b id="${id}-t${j}" class="tick"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path id="${id}-p${j}" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></b><span>${r}</span></div>`).join("")}</div>`;
      js += `tl.fromTo("#${id} .card",{y:60,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power4.out"},${T + 0.1});\n`;
      s.rows.forEach((_, j) => {
        const at = T + 0.6 + j * 0.7;
        js += `tl.fromTo("#${id}-r${j}",{x:50,opacity:0},{x:0,opacity:1,duration:0.35,ease:"power3.out"},${at});\n`;
        js += `tl.fromTo("#${id}-p${j}",{strokeDashoffset:1,strokeDasharray:1},{strokeDashoffset:0,duration:0.3,ease:"power2.out"},${at + 0.25});\n`;
        js += `tl.fromTo("#${id}-t${j}",{backgroundColor:"${SURFACE}"},{backgroundColor:"${GOLD}",duration:0.2,ease:"power2.out"},${at + 0.3});\n`;
      });
    } else if (s.type === "number") {
      html += `<div class="card center"><div class="ctitle">${s.label}</div><div id="${id}-n" class="num">${s.from}</div><div class="denom"><span dir="ltr">/ 100</span></div><div class="meter"><i id="${id}-m"></i></div><span class="sample">مثال توضيحي</span></div>`;
      js += `tl.fromTo("#${id} .card",{y:60,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power4.out"},${T + 0.1});\n`;
      js += `{const o={v:${s.from}};tl.to(o,{v:${s.to},duration:${s.count ?? 2.2},ease:"power2.out",onUpdate:()=>{document.getElementById("${id}-n").textContent=Math.round(o.v)}},${T + (s.count ? 0.35 : 0.7)});}\n`;
      js += `tl.fromTo("#${id}-m",{scaleX:${s.from / 100}},{scaleX:${s.to / 100},duration:${s.count ?? 2.2},ease:"power2.out"},${T + (s.count ? 0.35 : 0.7)});\n`;
    } else if (s.type === "bubbles") {
      html += `<div class="chat ${s.big ? "bigchat" : ""}">${s.items.map((b, j) => `<div id="${id}-b${j}" class="bub ${b.who}">${b.text}</div>`).join("")}</div>`;
      const gap = (s.dur - 0.5) / s.items.length;
      s.items.forEach((_, j) => {
        const t = T + (s.itemAt ? s.itemAt[j] : 0.2 + j * gap);
        if (v.music) sfx.push(["pop", t, 0.55]);
        js += `tl.fromTo("#${id}-b${j}",{y:40,opacity:${s.at === 0 && j === 0 ? 1 : 0},scale:0.92},{y:0,opacity:1,scale:1,duration:0.35,ease:"power4.out"},${t});\n`;
      });
    } else if (s.type === "intro") {
      html += `<div class="end intro">${mark(`${id}m`, 300)}<div id="${id}-k" class="kicker">${s.kicker ?? "تعرّف على"}</div><div id="${id}-wm" class="wm">ذروة</div>${v.fast ? "" : `<div id="${id}-sub" class="sub">منصّة دراسة لطلاب الثانوية في الخليج</div>`}</div>`;
      js += `tl.fromTo(".${id}m-r",{strokeDashoffset:1,strokeDasharray:1},{strokeDashoffset:0,duration:0.5,ease:"power2.out",stagger:0.08},${T + 0.05});\n`;
      js += `tl.fromTo("#${id}m-dot",{scale:0,transformOrigin:"32px 6.5px"},{scale:1,duration:0.3,ease:"power4.out"},${T + 0.5});\n`;
      js += `tl.fromTo("#${id}-k",{y:30,opacity:0},{y:0,opacity:1,duration:0.35,ease:"power4.out"},${T + 0.1});\n`;
      js += `tl.fromTo("#${id}-wm",{scale:0.8,opacity:0},{scale:1,opacity:1,duration:0.45,ease:"power4.out"},${T + 0.45});\n`;
      if (!v.fast) js += `tl.fromTo("#${id}-sub",{y:30,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + Math.min(1.3, s.dur * 0.4)});\n`;
    } else if (s.type === "video") {
      html += `<div class="card"><div class="ctitle">درس فيديو</div><div class="player"><b id="${id}-play" class="play"><svg viewBox="0 0 24 24" width="70" height="70"><path d="M8 5.5v13l11-6.5z" fill="${INK}"/></svg></b><div class="pbar"><i id="${id}-pb"></i></div></div><div class="steps">${[1, 2, 3].map((n, j) => `<span id="${id}-st${j}" class="step">خطوة <span dir="ltr">${n}</span></span>`).join("")}</div></div>`;
      js += `tl.fromTo("#${id} .card",{y:80,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + 0.05});\n`;
      js += `tl.fromTo("#${id}-play",{scale:1},{scale:0.85,duration:0.12,ease:"power2.in",yoyo:true,repeat:1},${T + 0.7});\n`;
      js += `tl.fromTo("#${id}-pb",{scaleX:0.02},{scaleX:0.7,duration:${(s.dur - 1).toFixed(2)},ease:"none"},${T + 0.8});\n`;
      [0, 1, 2].forEach((j) => {
        js += `tl.fromTo("#${id}-st${j}",{y:30,opacity:0},{y:0,opacity:1,duration:0.3,ease:"power4.out"},${T + Math.min(2.4, s.dur * 0.35) + j * Math.min(0.4, s.dur * 0.12)});\n`;
        sfx.push(["pop", T + Math.min(2.4, s.dur * 0.35) + j * Math.min(0.4, s.dur * 0.12), 0.5]);
      });
    } else if (s.type === "quiz") {
      html += `<div class="card"><div class="ctitle">سؤال تدريبي</div><div class="qp" dir="ltr">f(x) = x² &nbsp;→&nbsp; f′(x) = ?</div>${["x", "2x", "x²"].map((c, j) => `<div id="${id}-c${j}" class="choice" dir="ltr">${c}</div>`).join("")}</div>`;
      if (!s.still) {
        js += `tl.fromTo("#${id} .card",{y:80,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + 0.05});\n`;
        [0, 1, 2].forEach((j) => {
          js += `tl.fromTo("#${id}-c${j}",{x:-40,opacity:0},{x:0,opacity:1,duration:0.25,ease:"power3.out"},${T + 0.35 + j * 0.12});\n`;
        });
      }
      if (s.pick !== false) {
        const p = T + (s.pick ?? Math.min(1.3, s.dur * 0.5));
        js += `tl.fromTo("#${id}-c1",{backgroundColor:"${SURFACE}",scale:1},{backgroundColor:"${GOLD}",scale:1.04,duration:0.2,ease:"power3.out"},${p});\n`;
        sfx.push(["tick", p, 0.7]);
      }
    } else if (s.type === "timer") {
      html += `<div class="card center"><div class="ctitle">اختبار بوقت، مثل النهائي</div><div id="${id}-n" class="num clock" dir="ltr">45:00</div><div class="meter"><i id="${id}-m"></i></div><span class="sample">مثال توضيحي</span></div>`;
      js += `tl.fromTo("#${id} .card",{y:80,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + 0.05});\n`;
      js += `{const o={v:2700};tl.to(o,{v:2697,duration:${(s.dur - 0.4).toFixed(2)},ease:"none",onUpdate:()=>{const v=Math.ceil(o.v);document.getElementById("${id}-n").textContent=String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0")}},${T + 0.3});}\n`;
      js += `tl.fromTo("#${id}-m",{scaleX:1},{scaleX:0.93,duration:${(s.dur - 0.4).toFixed(2)},ease:"none"},${T + 0.3});\n`;
    } else if (s.type === "parent") {
      html += `<div class="card"><div class="ctitle">${s.title ?? "ولي أمرك يتابع"}</div><div class="prow"><span>الدروس المكتملة</span><b dir="ltr">12 / 20</b></div><div class="meter"><i id="${id}-m1"></i></div><div class="prow"><span>آخر اختبار</span><b dir="ltr">81 / 100</b></div><div class="meter"><i id="${id}-m2"></i></div><span class="sample">مثال توضيحي</span></div>`;
      js += `tl.fromTo("#${id} .card",{y:80,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + 0.05});\n`;
      js += `tl.fromTo("#${id}-m1",{scaleX:0},{scaleX:0.6,duration:0.8,ease:"power3.out"},${T + 0.5});\n`;
      js += `tl.fromTo("#${id}-m2",{scaleX:0},{scaleX:0.81,duration:0.8,ease:"power3.out"},${T + 0.8});\n`;
    } else if (s.type === "packages") {
      html += `<div class="card center"><div class="ctitle">اختار باقتك</div><div class="pills"><span id="${id}-p0" class="pill">شهر</span><span id="${id}-p1" class="pill">فصل</span></div><div id="${id}-go" class="go">ابدأ اليوم</div></div>`;
      js += `tl.fromTo("#${id} .card",{y:80,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + 0.05});\n`;
      // In a short slot the beats squeeze so the button is up for most of the scene.
      const [p0, p1, go] = [Math.min(0.6, s.dur * 0.2), Math.min(1.2, s.dur * 0.35), Math.min(1.85, s.dur * 0.5)].map((x) => T + x);
      js += `tl.fromTo("#${id}-p0",{backgroundColor:"${SURFACE}"},{backgroundColor:"${GOLD}",duration:0.15},${p0});\n`;
      js += `tl.to("#${id}-p0",{backgroundColor:"${SURFACE}",duration:0.15},${p1});\n`;
      js += `tl.fromTo("#${id}-p1",{backgroundColor:"${SURFACE}"},{backgroundColor:"${GOLD}",duration:0.15},${p1});\n`;
      js += `tl.fromTo("#${id}-go",{scale:0.6,opacity:0},{scale:1,opacity:1,duration:0.35,ease:"power4.out"},${go});\n`;
      sfx.push(["pop", p0, 0.5], ["pop", p1, 0.5], ["tick", go, 0.7]);
    } else if (s.type === "slam") {
      // Big words that land with the voice; a struck line is the excuse being crossed out.
      html += `<div class="slam">${s.kicker ? `<div id="${id}-k" class="skick">${s.kicker}</div>` : ""}${s.lines.map((l, j) => `<div id="${id}-l${j}" class="ln" style="font-size:${s.size ?? 200}px">${words(l)}${s.strike ? `<i id="${id}-x${j}" class="strk"></i>` : ""}</div>`).join("")}${s.dot ? `<i id="${id}-dot" class="gdot"></i>` : ""}</div>`;
      s.lines.forEach((_, j) => {
        const t = T + (s.lineAt ? s.lineAt[j] : 0.02);
        const first = s.at === 0 && j === 0;
        js += `tl.fromTo("#${id}-l${j} .w",{y:${first ? 0 : 90},opacity:${first ? 1 : 0}},{y:0,opacity:1,duration:0.28,ease:"power4.out",stagger:0.06},${t});\n`;
        if (s.strike) {
          js += `tl.fromTo("#${id}-x${j}",{scaleX:0},{scaleX:1,duration:0.2,ease:"power3.out"},${t + 0.45});\n`;
          js += `tl.to("#${id}-l${j} .w",{opacity:0.4,duration:0.2},${t + 0.45});\n`;
          sfx.push(["tick", t + 0.45, 0.5]);
        }
      });
      if (s.kicker) js += `tl.fromTo("#${id}-k",{opacity:${s.at === 0 ? 1 : 0}},{opacity:1,duration:0.2},${T});\n`;
      if (s.dot) {
        js += `tl.fromTo("#${id}-dot",{scale:0},{scale:1,duration:0.25,ease:"power4.out"},${T + Math.min(0.3, s.dur * 0.4)});\n`;
        sfx.push(["pop", T + Math.min(0.3, s.dur * 0.4), 0.5]);
      }
    } else if (s.type === "countdown") {
      html += `<div class="cd"><svg viewBox="0 0 100 100" width="620" height="620"><circle cx="50" cy="50" r="44" stroke="#3A3A3C" stroke-width="5" fill="none"/><circle id="${id}-ring" cx="50" cy="50" r="44" stroke="${GOLD}" stroke-width="5" fill="none" pathLength="1" stroke-dasharray="1" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><b id="${id}-n" class="cdn">5</b><div class="cdl">ثواني</div></div>`;
      const run = s.dur - 0.15;
      js += `{const o={v:5};tl.to(o,{v:0.01,duration:${run.toFixed(2)},ease:"none",onUpdate:()=>{document.getElementById("${id}-n").textContent=Math.ceil(o.v)}},${T});}\n`;
      js += `tl.fromTo("#${id}-ring",{strokeDashoffset:0},{strokeDashoffset:1,duration:${run.toFixed(2)},ease:"none"},${T});\n`;
      for (let k = 1; k < 5; k++) sfx.push(["tick", T + (run * k) / 5, 0.45]);
    } else if (s.type === "notify") {
      html += `<div class="feed">${s.items.map((n, j) => `<div id="${id}-n${j}" class="note"><div class="nh">${mark(`${id}m${j}`, 64)}<b>ذروة</b><span>الآن</span></div><div class="nt">${n.text}</div></div>`).join("")}<span class="sample">مثال توضيحي</span></div>`;
      s.items.forEach((_, j) => {
        const t = T + (s.itemAt ? s.itemAt[j] : 0.1 + j * 0.8);
        js += `tl.fromTo("#${id}-n${j}",{y:-60,opacity:0},{y:0,opacity:1,duration:0.3,ease:"power4.out"},${t});\n`;
        sfx.push(["pop", t, 0.55]);
      });
    } else if (s.type === "what") {
      html += `<div class="what">${s.noHead ? "" : `<div class="whead">${mark(`${id}m`, 170)}<b class="wwm">ذروة</b></div>`}${s.items.map((n, j) => `<div id="${id}-i${j}" class="${j ? "wchip" : "wmain"}">${n.text}</div>`).join("")}</div>`;
      if (!s.noHead) {
        js += `tl.fromTo(".${id}m-r",{strokeDashoffset:1,strokeDasharray:1},{strokeDashoffset:0,duration:0.4,ease:"power2.out",stagger:0.06},${T});\n`;
        js += `tl.fromTo("#${id}m-dot",{scale:0,transformOrigin:"32px 6.5px"},{scale:1,duration:0.25,ease:"power4.out"},${T + 0.35});\n`;
      }
      s.items.forEach((_, j) => {
        const t = T + (s.itemAt ? s.itemAt[j] : 0.1 + j * 0.6);
        js += `tl.fromTo("#${id}-i${j}",{y:60,opacity:0},{y:0,opacity:1,duration:0.3,ease:"power4.out"},${t});\n`;
        sfx.push(["pop", t, 0.5]);
      });
    } else if (s.type === "end") {
      if (v.fast) js += `tl.fromTo("#${id}-what",{y:30,opacity:0},{y:0,opacity:1,duration:0.4,ease:"power4.out"},${T + 0.85});\n`;
      html +=`<div class="end">${mark(`${id}m`, 360)}<div id="${id}-wm" class="wm">ذروة</div>${v.fast ? `<div id="${id}-what" class="ewhat">دروس تقوية أونلاين لطلاب الثانوية</div>` : ""}<div id="${id}-tag" class="tag">كل درس خطوة نحو الذروة</div><div id="${id}-url" class="url">dhirwa.ae</div></div>`;
      js += `tl.fromTo(".${id}m-r",{strokeDashoffset:1,strokeDasharray:1},{strokeDashoffset:0,duration:0.7,ease:"power2.out",stagger:0.12},${T + 0.1});\n`;
      js += `tl.fromTo("#${id}m-dot",{scale:0,transformOrigin:"32px 6.5px"},{scale:1,duration:0.35,ease:"power4.out"},${T + 0.85});\n`;
      js += `tl.fromTo("#${id}-wm",{y:30,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power4.out"},${T + 0.7});\n`;
      js += `tl.fromTo("#${id}-tag",{y:30,opacity:0},{y:0,opacity:1,duration:0.45,ease:"power4.out"},${T + 1.0});\n`;
      js += `tl.fromTo("#${id}-url",{opacity:0},{opacity:1,duration:0.4,ease:"power2.out"},${T + 1.4});\n`;
    }
    html += `</div></section>`;
    // A punch-in on every cut, then a slow drift: attention without bounce.
    js += `tl.fromTo("#${id} .drift",{scale:1.07,transformOrigin:"50% 40%"},{scale:1,duration:0.35,ease:"power4.out"},${T});\n`;
    js += `tl.to("#${id} .drift",{scale:1.03,duration:${Math.max(0.1, s.dur - 0.35).toFixed(2)},ease:"none"},${T + 0.35});\n`;
    if (i > 0 && v.music) sfx.push([s.type === "end" ? "riser" : "whoosh", Math.max(0, T - (s.type === "end" ? 0.9 : 0.12)), s.type === "end" ? 0.6 : 0.45]);
    // Each scene leaves cleanly just before its slot ends.
    if (s.type !== "end" && !v.fast) js += `tl.to("#${id}",{opacity:0,duration:0.18,ease:"power2.in"},${end - 0.2});\n`;
  });

  const caps = v.cap
    .map(([a, b, t], i) => `\n    <div id="c${i}" class="clip cap" data-start="${a}" data-duration="${(b - a).toFixed(2)}" data-track-index="3">${t}</div>`)
    .join("");
  const capJs = v.cap
    .map(([a, b], i) => `tl.fromTo("#c${i}",{y:24,opacity:0},{y:0,opacity:1,duration:0.2,ease:"power3.out"},${a});\ntl.to("#c${i}",{opacity:0,duration:0.12,ease:"power2.in"},${b - 0.12});\ntl.set("#c${i}",{opacity:0},${b});`)
    .join("\n");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
@font-face{font-family:"Reem Kufi";src:url("assets/fonts/reem-kufi-700.woff2") format("woff2");font-weight:700}
@font-face{font-family:"Plex AR";src:url("assets/fonts/plex-ar-700.woff2") format("woff2");font-weight:700}
@font-face{font-family:"Plex AR";src:url("assets/fonts/plex-ar-500.woff2") format("woff2");font-weight:500}
@font-face{font-family:"Plex AR";src:url("assets/fonts/plex-lat-700.woff2") format("woff2");font-weight:700;unicode-range:U+0000-00FF}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:${GROUND}}
#root{position:absolute;inset:0;background:${GROUND};font-family:"Plex AR",sans-serif;color:${INK}}
.scene,.drift{position:absolute;inset:0}
.stack{position:absolute;inset:0 90px;top:330px;display:flex;flex-direction:column;align-items:center;gap:26px;text-align:center}
.big{font-size:132px;line-height:1.25;font-weight:700;display:flex;flex-wrap:wrap;justify-content:center;gap:0 28px}
.w{display:inline-block}
.gold .w{color:${INK}}
.bar{display:block;width:420px;height:16px;border-radius:8px;background:${GOLD};transform-origin:100% 50%;margin-top:30px}
.card{position:absolute;left:90px;right:90px;top:290px;background:${SURFACE};border:2px solid ${HAIR};border-radius:44px;padding:60px 56px}
.card.center{text-align:center;top:300px;padding:44px 56px}
.ctitle{font-size:60px;font-weight:700;color:${MUTED};margin-bottom:36px}
.row{display:flex;align-items:center;gap:30px;font-size:68px;font-weight:700;padding:26px 0;border-top:2px solid ${HAIR}}
.row:first-of-type{border-top:0}
.tick{display:flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:42px;border:3px solid ${INK};background:${SURFACE};flex:none}
.num{font-size:230px;line-height:1.05;font-weight:700;font-variant-numeric:tabular-nums}
.denom{font-size:60px;color:${MUTED};font-weight:500;margin-top:-10px}
.meter{height:30px;border-radius:15px;background:${HAIR};margin:44px 0 30px;overflow:hidden}
.meter i{display:block;height:100%;width:100%;background:${GOLD};border-radius:15px;transform-origin:100% 50%}
.sample{display:inline-block;font-size:34px;font-weight:500;color:${MUTED};border:2px solid ${HAIR};border-radius:30px;padding:6px 26px}
.chat{position:absolute;left:90px;right:90px;top:420px;display:flex;flex-direction:column;gap:34px}
.bigchat{top:330px}
.bub{font-size:72px;font-weight:700;line-height:1.3;padding:34px 46px;border-radius:44px;max-width:82%}
.bub.me{align-self:flex-start;background:${INK};color:${GROUND};border-bottom-right-radius:12px}
.bub.parent,.bub.teacher{align-self:flex-end;background:${SURFACE};border:2px solid ${HAIR};border-bottom-left-radius:12px}
.bub.teacher{border-color:${GOLD};border-width:4px}
.end{position:absolute;inset:0;top:300px;display:flex;flex-direction:column;align-items:center;gap:26px}
.wm{font-family:"Reem Kufi",sans-serif;font-size:210px;font-weight:700;line-height:1.1}
.tag{font-size:60px;font-weight:700;color:${MUTED}}
.url{font-size:64px;font-weight:700;margin-top:30px;direction:ltr}
.intro{top:340px}
.kicker{font-size:64px;font-weight:700;color:${MUTED}}
.sub{font-size:56px;font-weight:700;text-align:center;padding:0 90px;line-height:1.35}
.player{position:relative;aspect-ratio:16/9;border-radius:28px;background:${INK};display:flex;align-items:center;justify-content:center;overflow:hidden}
.play{width:150px;height:150px;border-radius:75px;background:${GROUND};display:flex;align-items:center;justify-content:center;padding-inline-end:10px}
.pbar{position:absolute;left:0;right:0;bottom:0;height:14px;background:#3A3A3C}
.pbar i{display:block;height:100%;background:${GOLD};transform-origin:100% 50%}
.steps{display:flex;gap:20px;margin-top:34px}
.step{font-size:46px;font-weight:700;border:2px solid ${HAIR};border-radius:40px;padding:8px 30px}
.vsub{font-size:54px;font-weight:700;margin-top:30px}
.qp{font-size:76px;font-weight:700;text-align:center;margin-bottom:30px}
.choice{font-size:66px;font-weight:700;text-align:center;border:3px solid ${HAIR};border-radius:30px;padding:10px;margin-top:16px;background:${SURFACE}}
.clock{font-size:230px}
.prow{display:flex;justify-content:space-between;align-items:baseline;font-size:58px;font-weight:700;margin-top:26px}
.prow b{font-size:62px}
.card .meter{margin:20px 0 10px}
.pills{display:flex;gap:30px;justify-content:center;margin:10px 0 50px}
.pill{font-size:84px;font-weight:700;border:3px solid ${INK};border-radius:60px;padding:14px 70px;background:${SURFACE}}
.go{display:inline-block;font-size:70px;font-weight:700;background:${INK};color:${GROUND};border-radius:60px;padding:22px 80px}
.scene.dark{background:${INK};color:${GROUND}}
.slam{position:absolute;left:80px;right:80px;top:420px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.skick{font-size:72px;font-weight:700;color:${MUTED};margin-bottom:20px}
.dark .skick{color:#AEAEB2}
.ln{position:relative;font-weight:700;line-height:1.2;display:flex;flex-wrap:wrap;justify-content:center;gap:0 34px}
.strk{position:absolute;inset-inline:-20px;top:52%;height:16px;border-radius:8px;background:${GOLD};transform-origin:100% 50%}
.gdot{display:block;width:56px;height:56px;border-radius:28px;background:${GOLD};margin-top:40px}
.cd{position:absolute;inset:0;top:330px;display:flex;flex-direction:column;align-items:center}
.cdn{position:absolute;top:120px;width:620px;text-align:center;font-size:330px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}
.cdl{font-size:72px;font-weight:700;color:#AEAEB2;margin-top:30px}
.feed{position:absolute;left:70px;right:70px;top:300px;display:flex;flex-direction:column;gap:30px;align-items:center}
.note{align-self:stretch;background:${SURFACE};border:2px solid ${HAIR};border-radius:44px;padding:30px 44px}
.nh{display:flex;align-items:center;gap:18px;font-size:40px;font-weight:500;color:${MUTED}}
.nh b{font-family:"Reem Kufi",sans-serif;font-size:46px;color:${INK}}
.nh span{margin-inline-start:auto}
.nt{font-size:66px;font-weight:700;margin-top:12px}
.what{position:absolute;left:80px;right:80px;top:360px;display:flex;flex-direction:column;align-items:center;gap:34px;text-align:center}
.whead{display:flex;align-items:center;gap:26px;margin-bottom:20px}
.wwm{font-family:"Reem Kufi",sans-serif;font-size:150px;font-weight:700;line-height:1}
.wmain{font-size:120px;font-weight:700;line-height:1.2}
.wchip{font-size:72px;font-weight:700;border:3px solid ${INK};border-radius:60px;padding:12px 56px;background:${SURFACE}}
.ewhat{font-size:66px;font-weight:700;margin-top:-6px}
.cap{position:absolute;left:90px;right:90px;top:1185px;text-align:center;font-size:62px;font-weight:700;line-height:1.3;opacity:0}
.cap::first-line{color:${INK}}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="1080" data-height="1920">${html}${caps}${v.voice ? `
    <audio id="voice" class="clip" src="assets/voice.mp3" data-start="0" data-track-index="5" data-volume="1"></audio>` : ""}${v.music ? `\n    <audio id="music" class="clip" src="assets/music.mp3" data-start="0" data-track-index="6" data-volume="${v.musicVol ?? 0.22}" data-fade-out="1.2"></audio>` : ""}${sfx.map(([f, t, vol], k) => `\n    <audio id="fx${k}" class="clip" src="assets/sfx/${f}.mp3" data-start="${t.toFixed(2)}" data-duration="${SFX_LEN[f]}" data-track-index="${7 + (k % 3)}" data-volume="${vol}"></audio>`).join("")}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${js}
${capJs}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
`;
}

for (const [key, v] of Object.entries(versions)) {
  mkdirSync(`${key}/assets`, { recursive: true });
  cpSync("fonts", `${key}/assets/fonts`, { recursive: true });
  if (v.music) cpSync("sfx", `${key}/assets/sfx`, { recursive: true, filter: (f) => !f.endsWith("loop.mp3") });
  writeFileSync(`${key}/index.html`, build(key, v));
  writeFileSync(`${key}/hyperframes.json`, JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2));
  writeFileSync(`${key}/meta.json`, JSON.stringify({ name: `dhirwa-reel-${key}`, title: v.label }, null, 2));
  console.log("wrote", key);
}
