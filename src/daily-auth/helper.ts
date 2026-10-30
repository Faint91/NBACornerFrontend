// NBA-owned code only. This document never mounts the NBA app or analytics.
export const DAILY_AUTH_CONTRACT = "daily-stats-auth-v1";
const NBA_ORIGIN = "https://www.nbacorner.com";
const noncePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exactKeys = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === keys.sort().join(",");

export function installNbaDailyAssertionHelper(options: {
  window: Window; apiOrigin: string; allowLocalTesting?: boolean;
  fetcher?: typeof fetch; now?: () => number;
}) {
  const win = options.window, origin = win.location.origin;
  const api = new URL(options.apiOrigin);
  const local = (url: URL) => url.protocol === "http:" && url.hostname === "127.0.0.1";
  if (origin !== NBA_ORIGIN && !(options.allowLocalTesting && local(new URL(origin)))) throw Error("Invalid helper origin");
  if (api.origin !== options.apiOrigin || !(api.protocol === "https:" || options.allowLocalTesting && local(api))) throw Error("Invalid assertion API origin");
  if (win.location.search || win.location.hash || win.parent === win) return () => {};
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now;
  let requestId: string | null = null, controller: AbortController | null = null;
  const seen = new Set<string>();
  function send(status: string, payload: object = {}) {
    if (requestId) win.parent.postMessage({ contract: DAILY_AUTH_CONTRACT, type: "daily:assertion:response", requestId, status, ...payload }, origin);
  }
  function invalidate() {
    controller?.abort(); controller = null;
    if (requestId) win.parent.postMessage({ contract: DAILY_AUTH_CONTRACT, type: "daily:assertion:invalidated", requestId }, origin);
    requestId = null;
  }
  function authState() {
    const token = win.localStorage.getItem("auth_token"), profile = win.localStorage.getItem("auth_user");
    if (!token && !profile) return { status: "guest" };
    if (!token || !profile) return { status: "unavailable" };
    // Presence is a readiness hint only. No cached identity is ever trusted.
    const parsed = JSON.parse(profile);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "unavailable" };
    return { status: "ready", token };
  }
  async function receive(event: MessageEvent) {
    if (event.origin !== origin || event.source !== win.parent ||
        !exactKeys(event.data, ["contract", "type", "requestId"]) ||
        event.data.contract !== DAILY_AUTH_CONTRACT || event.data.type !== "daily:assertion:request" ||
        typeof event.data.requestId !== "string" || !noncePattern.test(event.data.requestId)) return;
    try { if (!/^\/1on1(?:\/|$)/.test(win.parent.location.pathname)) return; } catch { return; }
    const nonce = event.data.requestId;
    if (seen.has(nonce)) return;
    seen.add(nonce); if (seen.size > 256) seen.delete(seen.values().next().value!);
    controller?.abort(); requestId = nonce;
    const active = new AbortController(); controller = active;
    const timer = win.setTimeout(() => active.abort(), 5000);
    try {
      const state = authState();
      if (state.status !== "ready") { send(state.status); return; }
      const response = await fetcher(`${api.origin}/auth/daily-assertion`, {
        method: "POST", headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" },
        body: "{}", credentials: "omit", redirect: "error", cache: "no-store", signal: active.signal,
      });
      if (requestId !== nonce) return;
      if (authState().token !== state.token) { invalidate(); return; }
      if (response.status === 401) { send("guest"); return; }
      if (!response.ok) { send("unavailable"); return; }
      const data = await response.json();
      if (requestId !== nonce || active.signal.aborted) return;
      if (!exactKeys(data, ["assertion", "expiresAt", "contract"]) || data.contract !== DAILY_AUTH_CONTRACT ||
          typeof data.assertion !== "string" || data.assertion.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(data.assertion) ||
          typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt)) ||
          Date.parse(data.expiresAt) <= now() || Date.parse(data.expiresAt) - now() > 60000) { send("unavailable"); return; }
      if (requestId === nonce && !active.signal.aborted && authState().token === state.token)
        send("authenticated", { assertion: data.assertion, expiresAt: data.expiresAt });
    } catch { if (requestId === nonce) send("unavailable"); }
    finally { win.clearTimeout(timer); }
  }
  const listener = (event: MessageEvent) => { void receive(event); };
  const storage = (event: StorageEvent) => { if (event.key === null || event.key === "auth_token" || event.key === "auth_user") invalidate(); };
  win.addEventListener("message", listener);
  win.addEventListener("storage", storage);
  win.addEventListener("pagehide", invalidate);
  return () => { invalidate(); win.removeEventListener("message", listener); win.removeEventListener("storage", storage); win.removeEventListener("pagehide", invalidate); };
}
