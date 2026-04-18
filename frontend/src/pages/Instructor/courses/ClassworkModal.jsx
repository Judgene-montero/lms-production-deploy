import React, { useEffect } from "react";
import { CLASSWORK_TYPE_OPTIONS } from "./classworkTypeConfig";

export default function ClassworkModal({ open, onClose, onSelectType }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select classwork type"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Create Classwork</h2>
            <p className="mt-1 text-sm text-gray-600">Select a type to continue to its dedicated builder page.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CLASSWORK_TYPE_OPTIONS.map((typeItem) => (
            <button
              key={typeItem.key}
              type="button"
              onClick={() => onSelectType?.(typeItem.key)}
              className="rounded-xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow"
            >
              <p className="text-sm font-semibold text-emerald-900">{typeItem.label}</p>
              <p className="mt-1 text-xs text-gray-600">{typeItem.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
