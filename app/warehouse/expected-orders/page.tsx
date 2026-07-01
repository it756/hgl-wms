"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { Truck, ChevronDown, ChevronUp } from "lucide-react";

interface ExpectedOrder {
  id: string;
  reference_number: string;
  status: string;
  supplier_name: string | null;
  estimated_total: number | null;
  notes: string | null;
  internal_control_actioned_at: string | null;
  created_at: string;
  sbus: { name: string; code: string } | null;
  purchase_request_line_items: {
    id: string;
    product_name: string;
    sku: string | null;
    quantity_requested: number;
    unit_of_measure: string;
    unit_cost: number | null;
  }[];
}

export default function WarehouseExpectedOrdersPage() {
  const [orders, setOrders] = useState<ExpectedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/purchase-requests?status=EXPECTED_ORDER", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load expected orders");
      setOrders(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expected Inbound Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Approved purchase requests awaiting supplier delivery. Receive against one by creating a
            Supplier GRN.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading expected orders…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No expected orders at this time.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  aria-expanded={expanded === order.id}
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <Truck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-slate-700">
                        {order.reference_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.sbus?.name ?? "Unknown SBU"}
                        {order.supplier_name && ` · ${order.supplier_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {order.estimated_total != null && (
                      <span className="text-sm font-medium text-slate-600">
                        KES {order.estimated_total.toLocaleString()}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                      Expected
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                    {expanded === order.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {expanded === order.id && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-center">Expected Qty</th>
                          <th className="px-3 py-2 text-right">Unit Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.purchase_request_line_items.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2">
                              {l.product_name}
                              {l.sku && (
                                <span className="ml-1 text-slate-400 text-xs">({l.sku})</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {l.quantity_requested} {l.unit_of_measure}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {l.unit_cost != null ? `KES ${l.unit_cost.toLocaleString()}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {order.notes && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Notes:</span> {order.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <Link
                        href={`/warehouse/supplier-grn?purchase_request_id=${order.id}&ref=${order.reference_number}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <Truck className="w-4 h-4" />
                        Receive Goods (Create GRN)
                      </Link>
                      <span className="text-xs text-slate-400">
                        Creates a Supplier GRN linked to this expected order. Stock posts after
                        Finance approval.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
