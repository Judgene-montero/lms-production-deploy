const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

export const getApiBaseUrl = () => {
  const envBase = process.env.REACT_APP_API_BASE_URL?.trim();
  if (envBase) {
    return trimTrailingSlash(envBase);
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }

  const { protocol, hostname, port } = window.location;
  if (port === "3000") {
    return `http://${hostname}:8000`;
  }

  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
};

export const getWebSocketBaseUrl = () => {
  const envBase = process.env.REACT_APP_WS_BASE_URL?.trim();
  if (envBase) {
    return trimTrailingSlash(envBase);
  }

  return getApiBaseUrl()
    .replace(/^http:\/\//i, "ws://")
    .replace(/^https:\/\//i, "wss://");
};
