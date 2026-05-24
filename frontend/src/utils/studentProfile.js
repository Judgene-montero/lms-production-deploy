import { authGet, getUserProfile } from "./api";
import { appendMediaCacheBust, resolveMediaUrl } from "./mediaUrls";

const PROFILE_STORAGE_KEY = "student_profile";
const PROFILE_EVENT = "student-profile-updated";

const buildInitials = (profile = {}) => {
  const source = profile?.name || profile?.full_name || profile?.username || "Student";
  const parts = String(source)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "ST";
  return parts.map((part) => part[0].toUpperCase()).join("");
};

export const getDefaultStudentAvatarDataUrl = (profile = {}) => {
  const initials = buildInitials(profile);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#d1fae5"/><text x="40" y="46" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#065f46">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const resolveStudentAvatar = (profile = {}) => {
  const avatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || null;
  if (!avatar) return null;
  const resolvedUrl = resolveMediaUrl(avatar);
  return appendMediaCacheBust(resolvedUrl, profile?.avatar_updated_at || profile?.avatar_version);
};

export const readCachedStudentProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeStudentProfile = (profile) => {
  if (!profile) return;
  const normalizedProfile = {
    ...profile,
    avatar: resolveStudentAvatar(profile),
    avatar_url: resolveStudentAvatar(profile),
  };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: normalizedProfile }));
};

export const subscribeStudentProfile = (handler) => {
  const listener = (event) => handler(event.detail);
  window.addEventListener(PROFILE_EVENT, listener);
  return () => window.removeEventListener(PROFILE_EVENT, listener);
};

export const loadStudentProfile = async () => {
  try {
    const profile = await authGet("/api/student/profile/");
    writeStudentProfile(profile);
    return profile;
  } catch {
    try {
      const fallback = await authGet("/api/dashboards/student/profile/");
      writeStudentProfile(fallback);
      return fallback;
    } catch {
      const token = localStorage.getItem("access");
      const user = await getUserProfile(token);
      writeStudentProfile(user);
      return user;
    }
  }
};
