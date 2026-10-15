export type SeasonStatus = {
  season_code: string;
  bracket_creation_opens_at: string;
  playoff_lock_at: string;
  standings_freeze_reached: boolean;
  playoffs_locked: boolean;
  bracket_creation_open: boolean;
};

export async function loadCurrentSeason(get: () => Promise<unknown>): Promise<SeasonStatus> {
  const value = await get();
  if (!value || typeof value !== "object") throw new Error("Season configuration unavailable");
  const row = value as Record<string, unknown>;
  if (typeof row.season_code !== "string" || !/^[0-9]{4}-[0-9]{2}$/.test(row.season_code)
    || typeof row.bracket_creation_opens_at !== "string" || !Number.isFinite(Date.parse(row.bracket_creation_opens_at))
    || typeof row.playoff_lock_at !== "string" || !Number.isFinite(Date.parse(row.playoff_lock_at))
    || typeof row.standings_freeze_reached !== "boolean" || typeof row.playoffs_locked !== "boolean"
    || typeof row.bracket_creation_open !== "boolean") throw new Error("Season configuration unavailable");
  return row as SeasonStatus;
}
