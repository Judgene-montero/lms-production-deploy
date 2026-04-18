import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

let refreshPromise = null;
const REFRESH_ENDPOINT = "/api/users/token/refresh/";
const ACCESS_STORAGE_KEY = "access";
const REFRESH_STORAGE_KEY = "refresh";
const REFRESH_SKEW_SECONDS = 30;

const parseJwtExp = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(window.atob(base64));
    const exp = Number(json?.exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
};

const shouldRefreshProactively = (token) => {
  const exp = parseJwtExp(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= REFRESH_SKEW_SECONDS;
};

const clearAuthStorage = () => {
  localStorage.removeItem(ACCESS_STORAGE_KEY);
  localStorage.removeItem(REFRESH_STORAGE_KEY);
  localStorage.removeItem("role");
  localStorage.removeItem("profile_complete");
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    const refresh = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (!refresh) {
      throw new Error("Missing refresh token");
    }

    refreshPromise = axios
      .post(`http://127.0.0.1:8000${REFRESH_ENDPOINT}`, { refresh })
      .then((response) => {
        const nextAccess = response?.data?.access;
        if (!nextAccess) {
          throw new Error("Refresh response missing access token");
        }
        localStorage.setItem(ACCESS_STORAGE_KEY, nextAccess);
        return nextAccess;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

axiosInstance.interceptors.request.use(async (config) => {
  const requestUrl = String(config?.url || "");
  const isRefreshRequest = requestUrl.includes(REFRESH_ENDPOINT);
  const skipAuth = Boolean(config?.skipAuth);

  if (skipAuth) {
    if (config?.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  }

  let token = localStorage.getItem(ACCESS_STORAGE_KEY);

  if (!isRefreshRequest && token && shouldRefreshProactively(token)) {
    try {
      token = await refreshAccessToken();
    } catch {
      clearAuthStorage();
      redirectToLogin();
      return Promise.reject(new Error("Session expired"));
    }
  }

  if (!isRefreshRequest && token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;
    const isRefreshRequest = String(originalRequest?.url || "").includes(REFRESH_ENDPOINT);
    const skipAuth = Boolean(originalRequest?.skipAuth);

    if (status !== 401 || originalRequest._retry || isRefreshRequest || skipAuth) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const nextAccess = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextAccess}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      clearAuthStorage();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
