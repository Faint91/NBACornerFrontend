// src/api/leagues.ts
import { useApi } from "./client";

// ----- Types matching backend responses -----

// Basic league info returned by /leagues and /leagues/me
export interface LeagueSummary {
  id: string;
  name: string;
  owner_user_id: string;
  is_global: boolean;
  created_at: string | null;
  updated_at: string | null;
  // Optional fields depending on the endpoint
  is_member?: boolean;
  joined_at?: string | null;
  member_count?: number;
}

// League returned by create/join/delete endpoints under "league"
export interface LeagueDetail extends LeagueSummary {
  // For create/join endpoints, backend also returns is_member + joined_at
  is_member?: boolean;
  joined_at?: string | null;
}

// Member info from GET /leagues/:id/members
export interface LeagueMember {
  user_id: string;
  username: string | null;
  email: string | null;
  joined_at: string | null;
  is_owner: boolean;
  has_bracket: boolean;
  bracket_id: string | null;
}

// Response shapes
export interface MyLeaguesResponse {
  leagues: LeagueSummary[];
}

export interface AllLeaguesResponse {
  leagues: LeagueSummary[];
}

export interface LeagueMembersResponse {
  league: {
    id: string;
    name: string;
    owner_user_id: string;
    is_global: boolean;
    created_at: string | null;
    updated_at: string | null;
  };
  members: LeagueMember[];
}

export interface CreateLeaguePayload {
  name: string;
  password: string;
}

export interface JoinLeaguePayload {
  password: string;
}

// ----- Hook wrapping the leagues endpoints -----

export function useLeaguesApi() {
  const { get, post, del } = useApi();

  return {
    /**
     * GET /leagues/me
     * Returns leagues the current user belongs to (private only).
     */
    async getMyLeagues() {
      const data = (await get("/leagues/me")) as MyLeaguesResponse;
      return data.leagues;
    },

    /**
     * GET /leagues
     * Returns all private leagues, plus is_member flag per league.
     */
    async getAllLeagues() {
      const data = (await get("/leagues")) as AllLeaguesResponse;
      return data.leagues;
    },

    /**
     * POST /leagues
     * Create a new private league (name + password).
     */
    async createLeague(payload: CreateLeaguePayload) {
      const data = (await post("/leagues", payload)) as { league: LeagueDetail };
      return data.league;
    },

    /**
     * POST /leagues/:id/join
     * Join a private league by password.
     */
    async joinLeague(leagueId: string, password: string) {
      const body: JoinLeaguePayload = { password };
      const data = (await post(`/leagues/${leagueId}/join`, body)) as {
        league: LeagueDetail;
      };
      return data.league;
    },

    /**
     * DELETE /leagues/:id/membership
     * Leave a private league (non-owner only).
     */
    async leaveLeague(leagueId: string) {
      const data = (await del(
        `/leagues/${leagueId}/membership`
      )) as { league: LeagueDetail };
      return data.league;
    },

    /**
     * DELETE /leagues/:id
     * Delete a league (owner-only).
     */
    async deleteLeague(leagueId: string) {
      const data = (await del(`/leagues/${leagueId}`)) as { league: LeagueDetail };
      return data.league;
    },

    /**
     * GET /leagues/:id/members
     * Get league info + members (with has_bracket & bracket_id).
     */
    async getLeagueMembers(leagueId: string) {
      const data = (await get(
        `/leagues/${leagueId}/members`
      )) as LeagueMembersResponse;
      return data;
    },
  };
}
