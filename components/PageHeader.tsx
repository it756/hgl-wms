import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1E293B] md:text-3xl">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 mt-1 font-medium">{description}</p>
        )}
      </div>
      {actions && <div className="self-start md:self-auto">{actions}</div>}
    </div>
  );
}
