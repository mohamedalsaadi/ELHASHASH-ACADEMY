// Accounts that exist only in the throwaway e2e database (see e2e/seed.ts).
export const PASSWORD = "e2e-pass-1234";

export const PERSONAS = {
  admin: { name: "E2E Admin", phone: "0500000001", role: "ADMIN" },
  teacherEg: { name: "E2E Teacher Egypt", phone: "0500000002", role: "INSTRUCTOR" },
  teacherAe: { name: "E2E Teacher UAE", phone: "0500000003", role: "INSTRUCTOR" },
  studentEg: { name: "E2E Student Egypt", phone: "0500000004", role: "STUDENT" },
  studentAe: { name: "E2E Student UAE", phone: "0500000005", role: "STUDENT" },
  parent: { name: "E2E Parent", phone: "0500000006", role: "PARENT" },
} as const;

export type Persona = keyof typeof PERSONAS;
