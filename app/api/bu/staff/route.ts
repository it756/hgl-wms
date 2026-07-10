import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const DISABLED_MESSAGE =
  "This endpoint is disabled. Submit staff management requests via /api/bu/staff-requests.";

async function returnDisabledResponse(req: Request) {
  // Keep auth guard so disabled endpoints retain the same 401 behavior for unauthenticated callers.
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}

// BU staff management is intentionally disabled. Use /api/bu/staff-requests.
export async function GET(req: Request) {
  return returnDisabledResponse(req);
}

export async function PATCH(req: Request) {
  return returnDisabledResponse(req);
}

export async function POST(req: Request) {
  return returnDisabledResponse(req);
}
