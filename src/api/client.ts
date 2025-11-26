import { useAuth } from "../auth/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

export function buildAuthHeaders(token: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Small hook for convenience
export function useApi() {
  const { token } = useAuth();

  async function get(path: string) {
    const resp = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers: buildAuthHeaders(token),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function post(path: string, body?: any) {
    const resp = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: buildAuthHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function patch(path: string, body?: any) {
    const resp = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: buildAuthHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ✅ Proper DELETE helper
  async function del(path: string) {
    const resp = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  return { get, post, patch, del };
}
