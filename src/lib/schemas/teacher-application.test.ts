import { describe, expect, it } from "vitest";
import { teacherApplicationInput } from "./teacher-application";

const ok = {
  name: "Mona Ali",
  email: "Mona@Example.com",
  phone: "0501234567",
  password: "longenough1",
  subjectsNote: "Physics, grades 11 and 12",
  countryIds: ["c1"],
};

describe("teacher application input", () => {
  it("accepts a complete application and lowercases the email", () => {
    const d = teacherApplicationInput.parse(ok);
    expect(d.email).toBe("mona@example.com");
    expect(d.locale).toBe("ar");
  });

  it("needs at least one country and a real phone", () => {
    expect(teacherApplicationInput.safeParse({ ...ok, countryIds: [] }).success).toBe(false);
    expect(teacherApplicationInput.safeParse({ ...ok, phone: "12345" }).success).toBe(false);
  });

  it("needs a password of 8 or more characters", () => {
    expect(teacherApplicationInput.safeParse({ ...ok, password: "short" }).success).toBe(false);
  });
});
