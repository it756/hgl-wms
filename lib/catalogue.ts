export interface CatalogueProduct {
  id: string;
  name: string;
  sku: string;
  uom: string;
  unit_cost: number | null;
  stock_quantity: number;
}

export interface CataloguePage {
  items: CatalogueProduct[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchCataloguePage(
  search: string,
  cursor: string | null,
  signal: AbortSignal,
): Promise<CataloguePage> {
  const params = new URLSearchParams({ search, limit: "50" });
  if (cursor) params.set("cursor", cursor);
  const token = localStorage.getItem("access_token") ?? "";
  const response = await fetch(`/api/bu/catalogue?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "Could not load the product catalogue.");
  }
  return response.json();
}
