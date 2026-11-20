import { describe, expect, it } from "vitest";
import { isForeignError } from "./client-log";

const ORIGIN = "https://dhirwa.ae";

describe("isForeignError", () => {
  it("drops errors from injected wallet, Firefox iOS and in-app browser scripts", () => {
    expect(isForeignError("TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')", "", ORIGIN)).toBe(true);
    expect(isForeignError("ReferenceError: Can't find variable: __firefox__", "", ORIGIN)).toBe(true);
    expect(isForeignError("Uncaught Error: Error invoking postMessage: Java object is gone", "", ORIGIN)).toBe(true);
  });

  it("drops errors thrown by scripts from another origin", () => {
    expect(isForeignError("TypeError: x is null", "https://cdn.example.com/widget.js", ORIGIN)).toBe(true);
  });

  it("keeps our own errors", () => {
    expect(isForeignError("TypeError: Cannot read properties of null (reading 'id')", `${ORIGIN}/_next/static/chunks/app.js`, ORIGIN)).toBe(false);
    expect(isForeignError("ChunkLoadError: Loading chunk 3689 failed.", undefined, ORIGIN)).toBe(false);
  });
});
