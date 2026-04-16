export const API_BASE = "http://127.0.0.1:8000";

export const apiUrl = (path = "") => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const buildHeaders = (extraHeaders = {}) => {
  const headers = { ...extraHeaders };
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const apiGet = async (path) => {
  const response = await fetch(apiUrl(path), { headers: buildHeaders() });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

const readError = async (response) => {
  try {
    const payload = await response.json();
    return payload.detail || `Request failed: ${response.status}`;
  } catch (error) {
    return `Request failed: ${response.status}`;
  }
};

export const apiPost = async (path, data) => {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
};

export const apiPut = async (path, data, options = {}) => {
  const { wrapData = true } = options;
  const response = await fetch(apiUrl(path), {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(wrapData ? { data } : data),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
};
