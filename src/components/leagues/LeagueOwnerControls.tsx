import { useState } from "react";
import type { FormEvent } from "react";
import { useLeaguesApi } from "../../api/leagues";
import type { LeagueMember, LeagueSummary } from "../../api/leagues";

type Props = { league: LeagueSummary; members: LeagueMember[]; onChanged: () => Promise<void> };

// Shown by the page only for the current member/owner; server authorization remains authoritative.
export function LeagueOwnerControls({ league, members, onChanged }: Props) {
  const { updateLeague, transferOwnership, removeMember } = useLeaguesApi();
  const [name, setName] = useState(league.name);
  const [privateLeague, setPrivateLeague] = useState(!!league.requires_password);
  const [password, setPassword] = useState("");
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState<"transfer" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const candidates = members.filter((member) => !member.is_owner);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setPassword("");
      setPending(null);
      setTarget("");
      await onChanged();
      setMessage("League updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "League update failed. Please refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const settings: { name: string; is_private?: boolean; password?: string } = { name: name.trim() };
    if (privateLeague !== !!league.requires_password || password.trim()) {
      settings.is_private = privateLeague;
      if (privateLeague) settings.password = password.trim();
    }
    void run(() => updateLeague(league.id, settings));
  }

  return (
    <details className="rounded-md border border-slate-700 p-3 text-sm">
      <summary>Owner settings</summary>
      <fieldset disabled={busy} className="mt-3 space-y-3">
        <form onSubmit={save} className="space-y-2">
          <label className="block">League name
            <input className="block rounded bg-slate-800 p-2" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block"><input type="checkbox" checked={privateLeague} onChange={(event) => setPrivateLeague(event.target.checked)} /> Private league</label>
          {privateLeague && <label className="block">{league.requires_password ? "New password (leave blank to keep current password)" : "New password"}
            <input className="block rounded bg-slate-800 p-2" type="password" autoComplete="new-password" maxLength={128} required={!league.requires_password} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>}
          <button type="submit" className="rounded border border-slate-600 px-3 py-1">Save settings</button>
        </form>
        <label className="block">Member
          <select className="block rounded bg-slate-800 p-2" value={target} onChange={(event) => { setTarget(event.target.value); setPending(null); }}>
            <option value="">Choose another member</option>
            {candidates.map((member) => <option key={member.user_id} value={member.user_id}>{member.username || "Member"}</option>)}
          </select>
        </label>
        <div className="flex gap-3">
          <button type="button" disabled={!target} onClick={() => setPending("transfer")}>Transfer ownership</button>
          <button type="button" disabled={!target} onClick={() => setPending("remove")}>Remove member</button>
        </div>
        {pending && <div role="group" aria-label="Confirm member action" className="space-x-3">
          <p>{pending === "transfer" ? "Transfer ownership? You will remain a member." : "Remove this member? Their bracket and global score will be preserved."}</p>
          <button type="button" onClick={() => void run(() => pending === "transfer" ? transferOwnership(league.id, target) : removeMember(league.id, target))}>Confirm {pending === "transfer" ? "transfer" : "removal"}</button>
          <button type="button" onClick={() => setPending(null)}>Cancel</button>
        </div>}
      </fieldset>
      <p role="status">{message}</p>
    </details>
  );
}
