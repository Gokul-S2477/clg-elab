const STORAGE_KEY = "user";

export const PRIVILEGED_ROLES = ["faculty", "admin", "super_admin"];

export const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to parse user from localStorage", error);
    return null;
  }
};

export const saveUser = (user, accessToken = null) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  if (accessToken) {
    localStorage.setItem("access_token", accessToken);
  }
  window.dispatchEvent(new CustomEvent("user-updated", { detail: user }));
};

export const getAccessToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
};

export const isPrivilegedRole = (role) => PRIVILEGED_ROLES.includes(role);

export const shouldShowCreateQuestion = () => {
  const user = getStoredUser();
  return isPrivilegedRole(user?.role);
};

export const getRoleLabel = (role) => {
  if (!role) return "Guest";
  return role.replace("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

export const logout = () => {
  const user = getStoredUser();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("access_token");
  window.location.href = isPrivilegedRole(user?.role) ? "/admin-login" : "/student-login";
};
