import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueProduct } from "../../lib/catalogue";

const { push, navigation } = vi.hoisted(() => ({
  push: vi.fn(),
  navigation: { editId: null as string | null },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(navigation.editId ? { edit: navigation.editId } : {}),
}));

const selected: CatalogueProduct = {
  id: "00000000-0000-0000-0000-000000001203",
  name: "Q2 Lace",
  sku: "EJBL-1203",
  uom: "metre",
  unit_cost: 12,
  stock_quantity: 0,
};

describe("purchase request paginated catalogue integration", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    navigation.editId = null;
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("access_token", "test-token");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function mount() {
    const { default: Page } = await import("../../app/purchase-requests/new/page");
    render(React.createElement(Page));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }

  it("selects a product outside the initial page, retains its cost after search, and submits its snapshot", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/bu/catalogue")) {
        return Response.json({
          items: url.includes("search=EJBL-1203") ? [selected] : [],
          hasMore: false,
          nextCursor: null,
        });
      }
      return Response.json({ id: "purchase-1", reference_number: "PR-001" });
    });
    await mount();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EJBL-1203" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: selected.id } });
    expect(screen.getByDisplayValue("metre")).toBeDefined();
    expect(screen.getByDisplayValue("12")).toBeDefined();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
    expect(screen.getByText("ZMW 24")).toBeDefined();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "not found" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(selected.id);
    expect(screen.getByText("ZMW 24")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("procurement@company.com"), {
      target: { value: "procurement@example.com" },
    });
    const form = screen.getByRole("combobox").closest("form");
    if (!form) throw new Error("Purchase request form missing");
    await act(async () => {
      fireEvent.submit(form);
    });
    const save = fetchMock.mock.calls.find(
      ([url, options]) => String(url) === "/api/purchase-requests" && options?.method === "POST",
    );
    expect(save).toBeDefined();
    expect(JSON.parse(String(save?.[1]?.body)).lines[0]).toMatchObject({
      product_id: selected.id,
      product_name: selected.name,
      sku: selected.sku,
      quantity_requested: 2,
      unit_cost: 12,
      unit_of_measure: "metre",
    });
    expect(push).toHaveBeenCalledWith("/purchase-requests?created=PR-001");
  });

  it("hydrates an edited request's selected product without downloading the whole catalogue", async () => {
    navigation.editId = "purchase-1";
    fetchMock.mockImplementation(async (input) => {
      if (String(input).startsWith("/api/bu/catalogue")) {
        return Response.json({ items: [], hasMore: false, nextCursor: null });
      }
      return Response.json({
        procurement_email: "procurement@example.com",
        purchase_request_line_items: [
          {
            product_id: selected.id,
            product_name: selected.name,
            sku: selected.sku,
            unit_cost: 12,
            unit_of_measure: "metre",
            quantity_requested: 3,
            notes: "",
          },
        ],
      });
    });
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(selected.id);
    expect(screen.getByText("ZMW 36")).toBeDefined();
    expect(screen.getAllByText("Requested Items")).toHaveLength(1);
    expect(
      fetchMock.mock.calls
        .filter(([url]) => String(url).startsWith("/api/bu/catalogue"))
        .every(([url]) => String(url).includes("limit=50")),
    ).toBe(true);
  });
});
