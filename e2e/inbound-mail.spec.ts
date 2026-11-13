// Mail to the support address becomes a ticket: the signed webhook creates it once, refuses a bad signature, and ignores noise.
import { createHmac } from "node:crypto";
import { test, expect } from "./fixtures";
import { sql } from "./db";

const SECRET = Buffer.from("e2e-inbound-secret");
const sign = (id: string, ts: number, body: string) => "v1," + createHmac("sha256", SECRET).update(`${id}.${ts}.${body}`).digest("base64");
const event = (emailId: string, over: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "email.received", data: { email_id: emailId, from: "Sara Ali <sara.inbound@example.test>", to: ["support@dhirwa.ae"], subject: "Cannot open my lesson", text: "I paid yesterday but the lesson stays locked for me.", ...over } });

test("a signed inbound email becomes one ticket, a retry changes nothing, and a bad signature is refused", async ({ request }, info) => {
  const emailId = `e2e-${info.project.name}-${Date.now()}`;
  const body = event(emailId);
  const ts = Math.floor(Date.now() / 1000);
  const headers = { "svix-id": `msg_${emailId}`, "svix-timestamp": String(ts), "svix-signature": sign(`msg_${emailId}`, ts, body), "content-type": "application/json" };
  const id = `inb_${emailId}`;
  try {
    expect((await request.post("/api/webhooks/resend-inbound", { data: body, headers: { ...headers, "svix-signature": "v1,AAAA" } })).status()).toBe(401);

    const first = await request.post("/api/webhooks/resend-inbound", { data: body, headers });
    expect(first.status()).toBe(200);
    const rows = await sql<{ email: string; name: string; message: string; status: string }>(`SELECT email, name, message, status::text FROM "SupportTicket" WHERE id = $1`, [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "sara.inbound@example.test", name: "Sara Ali", status: "OPEN" });
    expect(rows[0].message).toContain("Cannot open my lesson");

    const again = await (await request.post("/api/webhooks/resend-inbound", { data: body, headers })).json();
    expect(again.ignored).toBe("duplicate");
    expect(await sql(`SELECT id FROM "SupportTicket" WHERE id = $1`, [id])).toHaveLength(1);
  } finally {
    await sql(`DELETE FROM "SupportTicket" WHERE id = $1`, [id]);
    await sql(`DELETE FROM "Notification" WHERE "dedupeKey" LIKE $1`, [`ticket:${id}:%`]);
  }
});

test("mail that is not a customer message is ignored", async ({ request }, info) => {
  const emailId = `e2e-noise-${info.project.name}-${Date.now()}`;
  const body = event(emailId, { to: ["dmarc@dhirwa.ae"], from: "noreply-dmarc-support@google.com" });
  const ts = Math.floor(Date.now() / 1000);
  const res = await request.post("/api/webhooks/resend-inbound", { data: body, headers: { "svix-id": `msg_${emailId}`, "svix-timestamp": String(ts), "svix-signature": sign(`msg_${emailId}`, ts, body), "content-type": "application/json" } });
  expect((await res.json()).ignored).toBe("filtered");
  expect(await sql(`SELECT id FROM "SupportTicket" WHERE id = $1`, [`inb_${emailId}`])).toHaveLength(0);
});
