import { EXPIRY_STATUS_COLORS, EXPIRY_STATUS_LABELS, getExpiryStatus } from "@/lib/expiry";

export default function ExpiryBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  const status = getExpiryStatus(expiryDate);
  if (!status || !expiryDate) return <span className="text-slate-300">—</span>;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${EXPIRY_STATUS_COLORS[status]}`}
      title={new Date(expiryDate).toLocaleDateString()}
    >
      {EXPIRY_STATUS_LABELS[status]}
      <span className="font-mono normal-case font-semibold opacity-75">
        {new Date(expiryDate).toLocaleDateString()}
      </span>
    </span>
  );
}
