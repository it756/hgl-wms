import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CatalogueProductPicker from "../../components/CatalogueProductPicker";
import type { CatalogueProduct } from "../../lib/catalogue";

const product = (id: string, stock = 0): CatalogueProduct => ({
  id,
  name: `Lace ${id}`,
  sku: `EJBL-${id}`,
  uom: "metre",
  unit_cost: 12,
  stock_quantity: stock,
});
const page = (items: CatalogueProduct[], nextCursor: string | null = null) =>
  Response.json({ items, nextCursor, hasMore: nextCursor !== null });

async function advance() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

describe("CatalogueProductPicker", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("access_token", "test-token");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads a bounded page, debounces search, and allows zero-stock procurement products", async () => {
    fetchMock.mockResolvedValue(page([product("1")]));
    const onChange = vi.fn();
    render(React.createElement(CatalogueProductPicker, { value: null, onChange, required: true }));
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=50");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith(product("1"));
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "sil" } });
    fireEvent.change(search, { target: { value: "silk" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("search=silk");
  });

  it("loads additional pages and keeps selected product snapshots outside search results", async () => {
    fetchMock
      .mockResolvedValueOnce(page([product("1")], "next"))
      .mockResolvedValueOnce(page([product("2")]));
    const selected = product("1203");
    render(React.createElement(CatalogueProductPicker, { value: selected, onChange: vi.fn() }));
    await advance();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("1203");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Load more products" })),
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=next");
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("1203");
    fetchMock.mockResolvedValueOnce(page([]));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing" } });
    await advance();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("1203");
    expect(screen.getByText(/No matching products/)).toBeDefined();
  });

  it("displays errors distinctly from no matches and supports retry", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: "Catalogue unavailable" }, { status: 500 }))
      .mockResolvedValueOnce(page([product("1")]));
    render(React.createElement(CatalogueProductPicker, { value: null, onChange: vi.fn() }));
    await advance();
    expect(screen.getByText(/Catalogue unavailable/)).toBeDefined();
    expect(screen.queryByText(/No products in/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await advance();
    expect(screen.getByRole("option", { name: /Lace 1/ })).toBeDefined();
  });

  it("cancels obsolete searches, ignores stale responses, and aborts on unmount", async () => {
    let resolveOld: (response: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(page([product("new")]));
    const view = render(
      React.createElement(CatalogueProductPicker, { value: null, onChange: vi.fn() }),
    );
    await advance();
    const oldSignal = fetchMock.mock.calls[0][1]?.signal;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });
    expect(oldSignal?.aborted).toBe(true);
    await advance();
    await act(async () => resolveOld(page([product("old")])));
    expect(screen.queryByRole("option", { name: /Lace old/ })).toBeNull();
    const newSignal = fetchMock.mock.calls[1][1]?.signal;
    view.unmount();
    expect(newSignal?.aborted).toBe(true);
  });

  it("preserves transfer stock restrictions and duplicate-product exclusions", async () => {
    fetchMock.mockResolvedValue(page([product("zero"), product("stock", 10), product("taken", 5)]));
    render(
      React.createElement(CatalogueProductPicker, {
        value: null,
        onChange: vi.fn(),
        requireStock: true,
        excludeIds: ["taken"],
      }),
    );
    await advance();
    expect((screen.getByRole("option", { name: /Lace zero/ }) as HTMLOptionElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("option", { name: /Lace stock/ }) as HTMLOptionElement).disabled).toBe(
      false,
    );
    expect(screen.queryByRole("option", { name: /Lace taken/ })).toBeNull();
  });

  it("supports multi-destination checkbox selection without losing existing selections", async () => {
    fetchMock.mockResolvedValue(page([product("stock", 5), product("zero")]));
    const onChange = vi.fn();
    render(
      React.createElement(CatalogueProductPicker, {
        value: null,
        onChange,
        selectedIds: ["stock"],
        requireStock: true,
      }),
    );
    await advance();
    expect((screen.getByRole("checkbox", { name: /Lace stock/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Lace stock/ }));
    expect(onChange).toHaveBeenCalledWith(product("stock", 5));
    expect((screen.getByRole("checkbox", { name: /Lace zero/ }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
