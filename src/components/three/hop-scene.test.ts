import { describe, expect, it } from "vitest";
import { RIDGES, SUMMIT } from "../../app/brand-svg";
import { createHop, HALVES } from "./hop-scene";

// Just enough of an SVG element for the scene: attributes and an inline style.
const el = () => {
  const a: Record<string, string> = {};
  return { style: {} as Record<string, string>, setAttribute: (k: string, v: string) => (a[k] = v), a };
};
function fake() {
  const paths = HALVES.map(el), dot = el(), ring = el();
  const svg = { querySelectorAll: () => paths, querySelector: (s: string) => (s === "[data-dot]" ? dot : ring) };
  return { svg: svg as unknown as SVGSVGElement, paths, dot };
}

describe("hop intro", () => {
  it("ends on the brand mark exactly", () => {
    const { svg, paths, dot } = fake();
    createHop(svg, false).render(4.5);
    expect(Number(dot.a.cx)).toBe(SUMMIT.cx);
    expect(Number(dot.a.cy)).toBeCloseTo(SUMMIT.cy, 3);
    expect(Number(dot.a.rx)).toBeCloseTo(SUMMIT.r, 3);
    expect(paths.every((p) => p.style.strokeDashoffset === "0")).toBe(true);
    // The two halves of each ridge, from the peak out, are the ridge's own curve.
    RIDGES.forEach((d, i) => expect(d).toContain(paths[i * 2 + 1].a.d.slice(paths[i * 2 + 1].a.d.indexOf("C"))));
  });

  it("hops from the start side and lands on the outer ridge, in both directions", () => {
    for (const rtl of [false, true]) {
      const { svg, dot } = fake();
      const hop = createHop(svg, rtl);
      hop.render(1.4);
      expect(Number(dot.a.cx) < 32).toBe(!rtl);
      hop.render(1.8);
      expect(Number(dot.a.cy)).toBeLessThan(10); // in the air, above the peak
      hop.render(2.16);
      expect(Number(dot.a.cx)).toBe(32);
    }
  });
});
