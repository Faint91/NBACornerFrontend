/** Captured by the pre-analytics bootstrap. Never persisted or reported. */
declare global {
  interface Window { __ncResetLink?: { token: string; present: boolean } }
}
let link = window.__ncResetLink;
delete window.__ncResetLink;
export function resetLink() { return link; }
export function clearResetLink() { link = undefined; }
