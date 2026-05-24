import { authGet, getUserProfile } from "./api";
import { resolveMediaUrl } from "./mediaUrls";

const PROFILE_STORAGE_KEY = "instructor_profile";
const PROFILE_EVENT = "instructor-profile-updated";

const buildInitials = (profile = {}) => {
  const source = profile?.name || profile?.full_name || profile?.username || "Instructor";
  const parts = String(source)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "IN";
  return parts.map((part) => part[0].toUpperCase()).join("");
};

export const getDefaultAvatarDataUrl = (profile = {}) => {
  const initials = buildInitials(profile);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#d1fae5"/><text x="40" y="46" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#065f46">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const resolveInstructorAvatar = (profile = {}) => {
  const avatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || null;
  if (!avatar) return null;
  return resolveMediaUrl(avatar);
};

export const readCachedInstructorProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeInstructorProfile = (profile) => {
  if (!profile) return;
  const normalizedProfile = {
    ...profile,
    avatar: resolveInstructorAvatar(profile),
    avatar_url: resolveInstructorAvatar(profile),
  };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: normalizedProfile }));
};

export const subscribeInstructorProfile = (handler) => {
  const listener = (event) => handler(event.detail);
  window.addEventListener(PROFILE_EVENT, listener);
  return () => window.removeEventListener(PROFILE_EVENT, listener);
};

export const loadInstructorProfile = async () => {
  try {
    const profile = await authGet("/api/instructor/profile/");
    writeInstructorProfile(profile);
    return profile;
  } catch {
    const token = localStorage.getItem("access");
    const fallback = await getUserProfile(token);
    writeInstructorProfile(fallback);
    return fallback;
  }
};
