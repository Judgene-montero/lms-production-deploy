import axiosInstance from "./axiosInstance";

const firstValidationMessage = (data) => {
  if (!data) return "";
  if (typeof data === "string") return data;

  const priorityKeys = ["error", "message", "detail", "non_field_errors", "sections", "questions", "title"];
  for (const key of priorityKeys) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length > 0) return String(value[0] || "").trim();
  }

  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length > 0) return String(value[0] || "").trim();
    if (value && typeof value === "object") {
      const nested = firstValidationMessage(value);
      if (nested) return nested;
    }
  }

  return "";
};

const isHtmlErrorDocument = (value) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype") || normalized.startsWith("<html");
};

const buildRequestError = (method, endpoint, error) => {
  const responseData = error?.response?.data;
  const status = error?.response?.status;
  const detail = firstValidationMessage(responseData);
  const safeDetail = detail && !isHtmlErrorDocument(detail) ? detail : `${method} ${endpoint} failed`;
  const wrapped = new Error(safeDetail);
  wrapped.cause = responseData;
  wrapped.status = status;
  return wrapped;
};

/* ------------------------------ REGISTER ------------------------------ */
export const registerUser = async (userData) => {
  try {
    const res = await axiosInstance.post("/api/users/register/", userData, { skipAuth: true });
    return res.data;
  } catch (error) {
    return error?.response?.data || { error: "Registration failed" };
  }
};

/* ------------------------------ LOGIN ------------------------------ */
export const loginUser = async (credentials) => {
  try {
    const res = await axiosInstance.post("/api/users/token/", credentials, { skipAuth: true });
    return res.data; // returns { access, refresh }
  } catch (error) {
    const errData = error?.response?.data || {};
    const detail =
      errData.detail ||
      errData.error ||
      (Array.isArray(errData.non_field_errors) ? errData.non_field_errors[0] : null) ||
      "Login failed";
    throw new Error(detail);
  }
};

/* ------------------------------ GET USER PROFILE ------------------------------ */
export const getUserProfile = async (token) => {
  try {
    const res = await axiosInstance.get("/api/users/me/", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  } catch {
    throw new Error("Failed to fetch user profile");
  }
};

/* ------------------------------ AUTH GET ------------------------------ */
export const authGet = async (endpoint) => {
  try {
    const res = await axiosInstance.get(endpoint);
    return res.data;
  } catch (error) {
    throw buildRequestError("GET", endpoint, error);
  }
};

/* ------------------------------ AUTH POST ------------------------------ */
export const authPost = async (endpoint, data) => {
  try {
    const res = await axiosInstance.post(endpoint, data);
    return res.data;
  } catch (error) {
    throw buildRequestError("POST", endpoint, error);
  }
};

/* ------------------------------ AUTH PUT ------------------------------ */
export const authPut = async (endpoint, data) => {
  try {
    const res = await axiosInstance.put(endpoint, data);
    return res.data;
  } catch (error) {
    throw buildRequestError("PUT", endpoint, error);
  }
};

/* ------------------------------ AUTH PATCH ------------------------------ */
export const authPatch = async (endpoint, data) => {
  try {
    const res = await axiosInstance.patch(endpoint, data);
    return res.data;
  } catch (error) {
    throw buildRequestError("PATCH", endpoint, error);
  }
};

/* ------------------------------ AUTH DELETE ------------------------------ */
export const authDelete = async (endpoint) => {
  try {
    const res = await axiosInstance.delete(endpoint);
    return res?.data || { message: "Deleted successfully" };
  } catch (error) {
    const detail =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      `DELETE ${endpoint} failed`;
    throw new Error(detail);
  }
};

/* ------------------------------ LOGOUT ------------------------------ */
export const logout = () => {
  localStorage.clear();
};
