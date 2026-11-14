import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  isStaff: vi.fn(),
  grants: vi.fn(),
  assignmentFile: vi.fn(),
  submissionFile: vi.fn(),
  parentLink: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@vercel/blob", () => ({ get: h.get }));
vi.mock("@/lib/staff", () => ({ isCourseStaffDb: h.isStaff }));
vi.mock("@/lib/catalog", () => ({ grantsFor: h.grants }));
vi.mock("@/lib/db", () => ({
  db: {
    assignmentFile: { findUnique: h.assignmentFile },
    submissionFile: { findUnique: h.submissionFile },
    parentLink: { findFirst: h.parentLink },
  },
}));

import { GET } from "./route";

const call = (kind: string, id = "f1") => GET(new Request(`https://dhirwa.ae/api/files/${kind}/${id}`), { params: Promise.resolve({ kind, id }) });
const as = (id: string, role = "STUDENT") => h.auth.mockResolvedValue({ user: { id, role } });

const file = { pathname: "p/x.pdf", downloadName: "x.pdf", contentType: "application/pdf" };
const submission = { ...file, submission: { studentId: "owner", assignment: { courseId: "c1" } } };
const assignment = { ...file, assignment: { courseId: "c1", lesson: null } };
const plan = { accessType: "PLAN", lessonId: null, liveSessionId: null, term: null, month: null, startsAt: new Date(Date.now() - 86_400_000), endsAt: null };
const rental = { ...plan, lessonId: "l1" };

beforeEach(() => {
  vi.resetAllMocks();
  h.isStaff.mockResolvedValue(false);
  h.grants.mockResolvedValue([]);
  h.parentLink.mockResolvedValue(null);
  h.get.mockResolvedValue({ statusCode: 200, stream: new Response("data").body });
});

describe("/api/files", () => {
  it("answers 404 to a signed-out request", async () => {
    h.auth.mockResolvedValue(null);
    expect((await call("submission")).status).toBe(404);
    expect(h.get).not.toHaveBeenCalled();
  });

  it("answers 404 to an unknown kind without reading the blob", async () => {
    as("owner");
    expect((await call("secret")).status).toBe(404);
    expect(h.get).not.toHaveBeenCalled();
  });

  describe("submission files", () => {
    beforeEach(() => h.submissionFile.mockResolvedValue(submission));

    it("lets the student who handed them in read them", async () => {
      as("owner");
      expect((await call("submission")).status).toBe(200);
    });

    it("refuses another student", async () => {
      as("other");
      expect((await call("submission")).status).toBe(404);
      expect(h.get).not.toHaveBeenCalled();
    });

    it("lets course staff read them", async () => {
      as("teacher", "INSTRUCTOR");
      h.isStaff.mockResolvedValue(true);
      expect((await call("submission")).status).toBe(200);
    });

    it("lets a linked parent read them and refuses an unlinked one", async () => {
      as("parent", "PARENT");
      h.parentLink.mockResolvedValue({ id: "link" });
      expect((await call("submission")).status).toBe(200);
      h.parentLink.mockResolvedValue(null);
      expect((await call("submission")).status).toBe(404);
    });
  });

  describe("assignment files", () => {
    beforeEach(() => h.assignmentFile.mockResolvedValue(assignment));

    it("opens for a student whose plan is running", async () => {
      as("student");
      h.grants.mockResolvedValue([plan]);
      expect((await call("assignment")).status).toBe(200);
    });

    it("stays closed for a student without a plan, or with only a lesson rental", async () => {
      as("student");
      expect((await call("assignment")).status).toBe(404);
      h.grants.mockResolvedValue([rental]);
      expect((await call("assignment")).status).toBe(404);
      expect(h.get).not.toHaveBeenCalled();
    });

    it("opens for course staff", async () => {
      as("teacher", "INSTRUCTOR");
      h.isStaff.mockResolvedValue(true);
      expect((await call("assignment")).status).toBe(200);
    });
  });
});
