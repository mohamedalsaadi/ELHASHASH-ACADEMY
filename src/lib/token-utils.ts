import { createHash, randomBytes, randomInt } from "node:crypto";

/** Only the hash is stored, so a leaked database cannot be used to reset passwords. */
export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export const newToken = () => randomBytes(32).toString("base64url");

/** Six digits, leading zeros kept, for linking a parent to a student. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
