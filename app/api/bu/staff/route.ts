import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const DISABLED_MESSAGE =
  "This endpoint is disabled. Submit staff creation requests via /api/bu/staff-requests.";

async function disabled(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}

// BU staff management is intentionally disabled. Use /api/bu/staff-requests.
export async function GET(req: Request) {
  return disabled(req);
}

export async function PATCH(req: Request) {
  return disabled(req);
}

export async function POST(req: Request) {
  return disabled(req);
}
