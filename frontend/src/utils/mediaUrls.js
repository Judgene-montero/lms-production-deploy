import { getApiBaseUrl } from "./runtimeConfig";

const ABSOLUTE_URL_PATTERN = /^(https?:)?\/\//i;

export const appendMediaCacheBust = (url, version) => {
  if (!url || !version || /^(data:|blob:)/i.test(String(url))) return url;

  try {
    const parsed = new URL(String(url));
    parsed.searchParams.set("v", String(version));
    return parsed.toString();
  } catch {
    const separator = String(url).includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(String(version))}`;
  }
};

export const resolveMediaUrl = (rawUrl) => {
  if (!rawUrl) return null;

  const value = String(rawUrl).trim();
  if (!value) return null;
  if (/^(data:|blob:)/i.test(value)) return value;

  const apiBaseUrl = getApiBaseUrl();
  let apiOrigin = apiBaseUrl;
  try {
    apiOrigin = new URL(apiBaseUrl).origin;
  } catch {
    apiOrigin = apiBaseUrl.replace(/\/+$/, "");
  }

  if (ABSOLUTE_URL_PATTERN.test(value)) {
    try {
      const absoluteUrl = new URL(value, apiOrigin);
      if (absoluteUrl.pathname.startsWith("/media/") && absoluteUrl.origin !== apiOrigin) {
        return `${apiOrigin}${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
      }
      return absoluteUrl.toString();
    } catch {
      return value;
    }
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${apiOrigin}${normalizedPath}`;
};
