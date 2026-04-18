import React from "react";

export default function ConfirmDeleteModal({ open, onCancel, onConfirm, text="Are you sure?" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Confirm</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{text}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">Delete</button>
        </div>
      </div>
    </div>
  );
}
