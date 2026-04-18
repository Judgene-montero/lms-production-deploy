export const ATTENDANCE_OPTIONS = [
  { value: "present", short: "P", label: "Present", chipClass: "bg-emerald-100 text-emerald-800" },
  { value: "late", short: "L", label: "Late", chipClass: "bg-amber-100 text-amber-800" },
  { value: "absent", short: "A", label: "Absent", chipClass: "bg-rose-100 text-rose-800" },
  { value: "excused", short: "E", label: "Excused", chipClass: "bg-sky-100 text-sky-800" },
];

export const ATTENDANCE_SET = new Set(ATTENDANCE_OPTIONS.map((item) => item.value));

export const DEFAULT_STATUS_POINTS = {
  present: 10,
  late: 7.5,
  absent: 0,
  excused: 10,
};

export const STATUS_BUTTON_STYLE = {
  present: {
    active: "bg-emerald-600 text-white shadow-sm",
    idle: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  },
  late: {
    active: "bg-amber-500 text-white shadow-sm",
    idle: "bg-amber-50 text-amber-700 hover:bg-amber-100",
  },
  absent: {
    active: "bg-rose-600 text-white shadow-sm",
    idle: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
  excused: {
    active: "bg-sky-600 text-white shadow-sm",
    idle: "bg-sky-50 text-sky-700 hover:bg-sky-100",
  },
};

export const statusButtonClass = (statusValue, active) => {
  const palette = STATUS_BUTTON_STYLE[statusValue] || STATUS_BUTTON_STYLE.present;
  return `rounded-md px-2.5 py-1 text-xs font-semibold transition ${active ? palette.active : palette.idle}`;
};

export const getLocalDateISO = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
};

export const toMessage = (error, fallback) => {
  const text = String(error?.message || "").trim();
  return text || fallback;
};
