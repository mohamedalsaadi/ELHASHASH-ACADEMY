import { expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...all, [path]: value } : { ...all, ...flatten(value, path) };
  }, {});
}

// Names only: Arabic plural branches hold words inside braces, which are not placeholders.
const names = (text: string) =>
  [...text.matchAll(/\{([a-zA-Z_]+)[,}]|<\/?([a-zA-Z_]+)>/g)].map((m) => m[1] ?? m[2]).filter((v, i, all) => all.indexOf(v) === i).sort();

const arabic = flatten(ar);
const english = flatten(en);

it("gives both locales the same keys", () => {
  expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort());
});

it("gives every string the same placeholders and tags in both locales", () => {
  const mismatched = Object.keys(english).filter((key) => names(english[key]).join() !== names(arabic[key] ?? "").join());
  expect(mismatched).toEqual([]);
});
