import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";
import type { CatalogueProduct } from "../../../../lib/catalogue";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CatalogueCursor {
  version: 1;
  sbuId: string;
  search: string;
  name: string;
  id: string;
}

function decodeCursor(value: string, sbuId: string, search: string): CatalogueCursor | null {
  if (value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const cursor: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof cursor !== "object" ||
      cursor === null ||
      !("version" in cursor && cursor.version === 1) ||
      !("sbuId" in cursor && cursor.sbuId === sbuId) ||
      !("search" in cursor && cursor.search === search) ||
      !("name" in cursor && typeof cursor.name === "string") ||
      !("id" in cursor && typeof cursor.id === "string" && UUID.test(cursor.id))
    ) {
      return null;
    }
    return { version: 1, sbuId, search, name: cursor.name, id: cursor.id };
  } catch {
    return null;
  }
}

/** Database-filtered catalogue, ordered by (name, id), including zero-stock products. */
export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.user_metadata.role;
    const privileged = ["WAREHOUSE_MANAGER", "FINANCE_MANAGER", "ADMIN"].includes(role);
    const scoped = ["BU_MANAGER", "UNIT_STAFF"].includes(role);
    if (!privileged && !scoped) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = new URL(req.url).searchParams;
    const sbuId: unknown = scoped ? user.user_metadata.sbu_id : params.get("sbu_id");
    if (typeof sbuId !== "string" || !UUID.test(sbuId)) {
      return NextResponse.json(
        {
          error: scoped
            ? "Your account has no valid SBU assignment."
            : "A valid sbu_id is required.",
        },
        { status: scoped ? 422 : 400 },
      );
    }

    const search = (params.get("search") ?? "").trim();
    const limitParam = params.get("limit") ?? "50";
    if (search.length > 100 || !/^\d+$/.test(limitParam)) {
      return NextResponse.json({ error: "Invalid search or page size." }, { status: 400 });
    }
    const limit = Number(limitParam);
    if (limit < 1 || limit > 100) {
      return NextResponse.json({ error: "limit must be between 1 and 100." }, { status: 400 });
    }
    const cursorParam = params.get("cursor");
    const cursor = cursorParam === null ? null : decodeCursor(cursorParam, sbuId, search);
    if (cursorParam !== null && !cursor) {
      return NextResponse.json(
        { error: "Invalid catalogue cursor. Restart your search." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("search_sbu_catalogue", {
      p_sbu_id: sbuId,
      p_search: search,
      p_after_name: cursor?.name ?? null,
      p_after_id: cursor?.id ?? null,
      p_limit: limit + 1,
    });
    if (error) {
      console.error("bu/catalogue query error:", error);
      return NextResponse.json(
        { error: "Could not load the product catalogue. Please retry." },
        { status: 500 },
      );
    }

    const rows: CatalogueProduct[] = data ?? [];
    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = items.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              version: 1,
              sbuId,
              search,
              name: last.name,
              id: last.id,
            } satisfies CatalogueCursor),
          ).toString("base64url")
        : null;
    return NextResponse.json(
      { items, nextCursor, hasMore },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    console.error("bu/catalogue request failed:", error);
    return NextResponse.json(
      { error: "Could not load the product catalogue. Please retry." },
      { status: 500 },
    );
  }
}
