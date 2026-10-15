export type PredictionMatch = {
  id: string; conference: string; round: number; slot: number;
  team_a: string | null; team_b: string | null;
  predicted_winner: string | null; predicted_winner_games: number | null;
  next_match_id?: string | null; next_slot?: "a" | "b" | null;
};

export function bracketSubmissionReady(matches: PredictionMatch[]): boolean {
  const expected: Record<string, number> = { "nba:4": 1 };
  for (const conf of ["east", "west"]) {
    for (const [round, count] of [[0, 3], [1, 4], [2, 2], [3, 1]]) {
      expected[`${conf}:${round}`] = count;
    }
  }
  const actual: Record<string, number> = {};
  const ids = new Map(matches.map((m) => [m.id, m]));
  if (ids.size !== matches.length) return false;
  for (const m of matches) {
    const key = `${m.conference}:${m.round}`;
    actual[key] = (actual[key] ?? 0) + 1;
    if (!m.team_a || !m.team_b || m.team_a === m.team_b ||
        ![m.team_a, m.team_b].includes(m.predicted_winner ?? "")) return false;
    const count = m.predicted_winner_games;
    if (m.round === 0 ? count !== 1 : !Number.isInteger(count) || ![4, 5, 6, 7].includes(count ?? 0)) return false;
    if (m.round !== 4) {
      const next = ids.get(m.next_match_id ?? "");
      if (!next || !m.next_slot || next[`team_${m.next_slot}`] !== m.predicted_winner) return false;
    }
  }
  return Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, count]) => actual[key] === count);
}
