// Server-only: the API key never reaches the browser. Docs: https://docs.daily.co/reference/rest-api

const API = "https://api.daily.co/v1";
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daily ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export const roomName = (sessionId: string) => `eh-${sessionId}`;

/** Creates the private room for a session, closing 30 minutes after its end. Returns the room URL. */
export async function createRoom(sessionId: string, endsAt: Date): Promise<string> {
  const name = roomName(sessionId);
  const properties = { exp: unix(endsAt) + 30 * 60, eject_at_room_exp: true, enable_prejoin_ui: true, enable_chat: true, enable_knocking: false };
  try {
    return (await call<{ url: string }>("POST", "/rooms", { name, privacy: "private", properties })).url;
  } catch (e) {
    // Two first joins at once: the loser finds the room already made.
    return (await call<{ url: string }>("GET", `/rooms/${name}`).catch(() => Promise.reject(e))).url;
  }
}

export async function deleteRoom(sessionId: string) {
  await call("DELETE", `/rooms/${roomName(sessionId)}`);
}

/**
 * A meeting token for one person. Students may enter 10 minutes before the start and are removed at the end;
 * the teacher (owner) gets 30 minutes either side, screen sharing and the controls to mute or remove anyone.
 */
export async function meetingToken(o: { sessionId: string; userId: string; userName: string; startsAt: Date; endsAt: Date; owner: boolean }) {
  const lead = (o.owner ? 30 : 10) * 60;
  const { token } = await call<{ token: string }>("POST", "/meeting-tokens", {
    properties: {
      room_name: roomName(o.sessionId),
      user_id: o.userId.slice(0, 36),
      user_name: o.userName,
      is_owner: o.owner,
      nbf: unix(o.startsAt) - lead,
      exp: unix(o.endsAt) + (o.owner ? 30 * 60 : 0),
      eject_at_token_exp: !o.owner,
      enable_screenshare: o.owner,
      start_video_off: !o.owner,
      start_audio_off: !o.owner,
    },
  });
  return token;
}
