import React from "react";

export default function AdminPanel({ title, eyebrow, description, actions, children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
