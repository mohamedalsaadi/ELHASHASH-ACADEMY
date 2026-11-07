import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { PUBLIC_CLIENT_NAMESPACES, STAFF_CLIENT_NAMESPACES, pickMessages } from "./client-messages";

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx$/.test(name)) yield path;
  }
}

describe("client message namespaces", () => {
  const allowed = new Set<string>([...PUBLIC_CLIENT_NAMESPACES, ...STAFF_CLIENT_NAMESPACES]);
  const used = new Map<string, string[]>();
  for (const file of sources(join(process.cwd(), "src"))) {
    const text = readFileSync(file, "utf8");
    if (!/^["']use client["']/m.test(text)) continue;
    for (const m of text.matchAll(/useTranslations\(\s*["']([A-Za-z]+)/g)) {
      used.set(m[1], [...(used.get(m[1]) ?? []), file]);
    }
    expect(text, `${file} reads every namespace`).not.toMatch(/useTranslations\(\s*\)|useMessages\(/);
  }

  it("lists every namespace a client component reads", () => {
    const missing = [...used.keys()].filter((ns) => !allowed.has(ns));
    expect(missing, `add to client-messages.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("only lists namespaces that exist", () => {
    expect([...allowed].filter((ns) => !(ns in en))).toEqual([]);
  });

  it("keeps the staff labels out of the public dictionary", () => {
    const publicSet = pickMessages(en, PUBLIC_CLIENT_NAMESPACES);
    expect(Object.keys(publicSet)).not.toContain("admin");
    expect(Object.keys(publicSet)).not.toContain("teacher");
  });
});
