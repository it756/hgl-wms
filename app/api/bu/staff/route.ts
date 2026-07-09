import { NextResponse } from "next/server";

const DISABLED_MESSAGE =
  "BU managers cannot view, edit, or create staff directly. Submit a staff creation request instead.";

function disabled() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}

// BU staff management is intentionally disabled. Use /api/bu/staff-requests.
export async function GET() {
  return disabled();
}

export async function PATCH() {
  return disabled();
}

export async function POST() {
  return disabled();
}
