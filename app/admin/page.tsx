"use client";

import Link from "next/link";

const sections = [
  { href: "/admin/users", label: "Users", desc: "Manage user accounts and roles" },
  { href: "/admin/sbus", label: "SBUs", desc: "Manage Strategic Business Units" },
  { href: "/admin/products", label: "Products", desc: "Manage product catalogue and stock" },
  { href: "/admin/settings", label: "Settings", desc: "App settings including approval thresholds" },
  { href: "/admin/exports", label: "Exports", desc: "Export transfer and audit data as CSV" },
  { href: "/admin/audit", label: "Audit Log", desc: "Review the immutable audit trail" },
  { href: "/admin/variance", label: "Variance Resolution", desc: "Review and resolve transfer variances" },
];

export default function AdminDashboardPage() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="border rounded p-4 hover:bg-blue-50 transition"
          >
            <p className="font-medium">{s.label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
