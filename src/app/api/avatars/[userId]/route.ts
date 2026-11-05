import { streamBlob } from "@/lib/blob";
import { db } from "@/lib/db";

/** A teacher avatar is shown on their public profile, so it is served without a session. */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await db.user.findUnique({ where: { id: userId }, select: { photoUrl: true, photoType: true, role: true } });
  // Only staff can have a profile photo; never serve another role's face by id.
  if (!user?.photoUrl || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) return new Response(null, { status: 404 });
  return streamBlob(user.photoUrl, user.photoType ?? "image/jpeg", "public, max-age=3600");
}
