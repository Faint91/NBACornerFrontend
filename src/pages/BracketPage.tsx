import React, {
  useEffect,
  useMemo,
  useState,
  useLayoutEffect,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { Footer } from "../components/layout/Footer";

// NOTE: we dynamically import 'dom-to-image-more' inside the click handler
// to avoid module initialization issues in some environments.

type Owner = {
  id: string;
  username: string;
  email: string;
};

type Bracket = {
  id: string;
  user_id: string;
  is_done: boolean;
  deleted_at: string | null;
  saved_at?: string | null;
  name?: string | null;
  owner?: Owner;
  is_owner?: boolean;
  // server may send either of these:
  is_master?: boolean;
  isMaster?: boolean;
};

type Match = {
  id: string;
  bracket_id: string;
  conference: string;
  round: number;
  slot: number;
  team_a: string | null;
  team_b: string | null;
  predicted_winner: string | null;
  predicted_winner_games: number | null;

  // 🔽 add these optional fields, they already come from the backend
  next_match_id?: string | null;
  next_slot?: "a" | "b" | null;
};


type MatchWithTeamMeta = Match & {
  team_a_name?: string | null;
  team_b_name?: string | null;

  team_a_code?: string | null;
  team_b_code?: string | null;

  team_a_logo_url?: string | null;
  team_b_logo_url?: string | null;

  team_a_primary_color?: string | null;
  team_a_secondary_color?: string | null;
  team_b_primary_color?: string | null;
  team_b_secondary_color?: string | null;
};

type MatchesByConfRound = {
  [conference: string]: {
    [round: string]: Match[];
  };
};

type BracketResponse = {
  bracket: Bracket;
  matches: MatchesByConfRound;
};

type ConnectionLine = {
  points: { x: number; y: number }[];
};

const getTeamName = (match: Match, side: "A" | "B"): string => {
  const m = match as MatchWithTeamMeta;
  return side === "A"
    ? m.team_a_name || match.team_a || "TBD"
    : m.team_b_name || match.team_b || "TBD";
};

const getTeamColors = (
  match: Match,
  side: "A" | "B"
): { primary?: string; secondary?: string } => {
  const m = match as MatchWithTeamMeta;
  return side === "A"
    ? {
        primary: m.team_a_primary_color || undefined,
        secondary: m.team_a_secondary_color || undefined,
      }
    : {
        primary: m.team_b_primary_color || undefined,
        secondary: m.team_b_secondary_color || undefined,
      };
};

const buildWinnerStyle = (
  isWinner: boolean,
  match: Match,
  side: "A" | "B"
): React.CSSProperties | undefined => {
  if (!isWinner) return undefined;
  const { primary, secondary } = getTeamColors(match, side);
  const style: React.CSSProperties = {};
  if (primary && secondary) {
    const innerBg = "rgba(15, 23, 42, 0.9)";
    style.borderWidth = 2;
    style.borderStyle = "solid";
    style.borderColor = "transparent";
    style.backgroundImage = `linear-gradient(${innerBg}, ${innerBg}), linear-gradient(90deg, ${primary}, ${secondary})`;
    style.backgroundOrigin = "border-box";
    style.backgroundClip = "padding-box, border-box";
  } else if (primary || secondary) {
    const highlight = primary || secondary;
    style.borderWidth = 2;
    style.borderStyle = "solid";
    style.borderColor = highlight;
    style.backgroundColor = "rgba(15, 23, 42, 0.9)";
  }
  return style;
};

// optional helper for debugging payloads
const debugMatchTeams = (match: Match) => {
  const m = match as MatchWithTeamMeta;
  // console.log("TEAM DATA", { id: match.id, conf: match.conference, round: match.round, slot: match.slot, team_a: match.team_a, team_a_name: m.team_a_name, team_a_code: m.team_a_code, team_b: match.team_b, team_b_name: m.team_b_name, team_b_code: m.team_b_code });
};

export const BracketPage: React.FC = () => {
  const { bracketId } = useParams<{ bracketId: string }>();
  const { user, logout } = useAuth();
  const { get, patch } = useApi();
  const navigate = useNavigate();

  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [matches, setMatches] = useState<MatchesByConfRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bracketName, setBracketName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false); // ✅ single declaration
  const [playoffsLocked, setPlayoffsLocked] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false); // close menu after navigating
  };

  useEffect(() => {
    const fetchPlayoffFlags = async () => {
      try {
        const info: any = await get("/brackets/me");
        if (info && typeof info.playoffs_locked === "boolean") {
          setPlayoffsLocked(info.playoffs_locked);
        }
      } catch (err) {
        console.error("Failed to fetch playoff flags", err);
      }
    };

    fetchPlayoffFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Local UI state for pending games when no pick yet
  const [pendingGames, setPendingGames] = useState<
    Record<string, number | undefined>
  >({});

  // Refs for drawing connection lines
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bracketRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<ConnectionLine[]>([]);

  const isOwner = bracket?.is_owner ?? false;
  const isAdmin = !!(user as any)?.is_admin;
  const isMaster = Boolean(bracket?.is_master) || Boolean((bracket as any)?.isMaster);

  // Owner can edit their own; Admin can edit the master
  const canEdit = isOwner || (isAdmin && isMaster);
  
  const savingLockedForUser = playoffsLocked && !isAdmin;

  const formatDate = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  // ---------- Load / reload bracket ----------
  const loadBracket = async (opts?: { silent?: boolean }) => {
    if (!bracketId) return;
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);
      const data = (await get(`/bracket/${bracketId}`)) as BracketResponse;
      setBracket(data.bracket);
      setMatches(data.matches);
      setBracketName(data.bracket.name || "");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load bracket");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const mineEnv: any = await get("/brackets/me");
        if (mineEnv && typeof mineEnv.playoffs_locked === "boolean") {
          setPlayoffsLocked(Boolean(mineEnv.playoffs_locked));
        }
      } catch (err) {
        console.error("Failed to fetch playoffs flags", err);
      }
    };

    fetchFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    loadBracket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracketId]);
  
    // Optimistic UI helper: update a single match in local state
  const updateMatchInState = (
    matchId: string,
    updater: (m: Match) => Match
  ) => {
    setMatches((prev) => {
      if (!prev) return prev;

      const updated: MatchesByConfRound = {};
      for (const [conf, rounds] of Object.entries(prev)) {
        updated[conf] = {};
        for (const [roundKey, ms] of Object.entries(rounds)) {
          updated[conf][roundKey] = ms.map((m) =>
            m.id === matchId ? (updater(m as Match) as any) : m
          );
        }
      }

      return updated;
    });
  };
  
  const updateNextMatchSlotInState = (
    match: Match,
    winnerSide: "A" | "B",
    winnerTeamId: string
  ) => {
    const mWithMeta = match as MatchWithTeamMeta;
  
    if (!match.next_match_id || !match.next_slot) return;
  
    // Where in the *next* match does this winner go? (A or B)
    const destSlotLetter = match.next_slot === "a" ? "A" : "B";
    const destTeamKey = destSlotLetter === "A" ? "team_a" : "team_b";
    const destNameKey =
      destSlotLetter === "A" ? "team_a_name" : "team_b_name";
    const destCodeKey =
      destSlotLetter === "A" ? "team_a_code" : "team_b_code";
    const destLogoKey =
      destSlotLetter === "A" ? "team_a_logo_url" : "team_b_logo_url";
    const destPrimaryKey =
      destSlotLetter === "A"
        ? "team_a_primary_color"
        : "team_b_primary_color";
    const destSecondaryKey =
      destSlotLetter === "A"
        ? "team_a_secondary_color"
        : "team_b_secondary_color";
  
    // From which side of the *current* match are we copying?
    const srcNameKey =
      winnerSide === "A" ? "team_a_name" : "team_b_name";
    const srcCodeKey =
      winnerSide === "A" ? "team_a_code" : "team_b_code";
    const srcLogoKey =
      winnerSide === "A" ? "team_a_logo_url" : "team_b_logo_url";
    const srcPrimaryKey =
      winnerSide === "A"
        ? "team_a_primary_color"
        : "team_b_primary_color";
    const srcSecondaryKey =
      winnerSide === "A"
        ? "team_a_secondary_color"
        : "team_b_secondary_color";
  
    updateMatchInState(match.next_match_id, (m) => {
      const next = { ...(m as MatchWithTeamMeta) } as any;
  
      // 🔹 Copy the team ID and all meta so getTeamName + buildWinnerStyle work
      next[destTeamKey] = winnerTeamId;
      next[destNameKey] = (mWithMeta as any)[srcNameKey] ?? null;
      next[destCodeKey] = (mWithMeta as any)[srcCodeKey] ?? null;
      next[destLogoKey] = (mWithMeta as any)[srcLogoKey] ?? null;
      next[destPrimaryKey] = (mWithMeta as any)[srcPrimaryKey] ?? null;
      next[destSecondaryKey] = (mWithMeta as any)[srcSecondaryKey] ?? null;
  
      // New inputs → clear any stale prediction on that future match
      next.predicted_winner = null;
      next.predicted_winner_games = null;
  
      return next as Match;
    });
  };
  
  const updatePlayInGame3LoserInState = (
    match: Match,
    loserSide: "A" | "B",
    loserTeamId: string
  ) => {
    // Only applies to play-in game 2 (round 0, slot 2)
    if (match.round !== 0 || match.slot !== 2) return;
    if (!matches) return;
  
    const conf = match.conference;
    const roundKey = String(0);
    const roundMatches = matches[conf]?.[roundKey];
    if (!roundMatches) return;
  
    const game3 = roundMatches.find(
      (m) => m.round === 0 && m.slot === 3
    );
    if (!game3) return;
  
    const src = match as MatchWithTeamMeta;
  
    const srcNameKey =
      loserSide === "A" ? "team_a_name" : "team_b_name";
    const srcCodeKey =
      loserSide === "A" ? "team_a_code" : "team_b_code";
    const srcLogoKey =
      loserSide === "A" ? "team_a_logo_url" : "team_b_logo_url";
    const srcPrimaryKey =
      loserSide === "A"
        ? "team_a_primary_color"
        : "team_b_primary_color";
    const srcSecondaryKey =
      loserSide === "A"
        ? "team_a_secondary_color"
        : "team_b_secondary_color";
  
    updateMatchInState(game3.id, (m) => {
      const next = { ...(m as MatchWithTeamMeta) } as any;
  
      // Backend puts the loser into game 3, slot B
      next.team_b = loserTeamId;
      next.team_b_name = (src as any)[srcNameKey] ?? null;
      next.team_b_code = (src as any)[srcCodeKey] ?? null;
      next.team_b_logo_url = (src as any)[srcLogoKey] ?? null;
      next.team_b_primary_color = (src as any)[srcPrimaryKey] ?? null;
      next.team_b_secondary_color = (src as any)[srcSecondaryKey] ?? null;
  
      next.predicted_winner = null;
      next.predicted_winner_games = null;
  
      return next as Match;
    });
  };


  // ---------- Actions for matches ----------
  const handleSetWinner = async (match: Match, team: "A" | "B") => {
    if (!bracketId || !matches || !canEdit) return;
    if (!match.team_a || !match.team_b) return;
  
    const winnerTeamId = team === "A" ? match.team_a : match.team_b;
    const loserTeamId = team === "A" ? match.team_b : match.team_a;
    const winnerSide: "A" | "B" = team;
    const loserSide: "A" | "B" = team === "A" ? "B" : "A";
  
    let games: number;
    if (match.round === 0) {
      games = 1;
    } else {
      const pending = pendingGames[match.id];
      const existing =
        match.predicted_winner === winnerTeamId
          ? match.predicted_winner_games
          : null;
      games = existing ?? pending ?? 4;
    }
  
    // 🔹 Optimistic UI: update THIS match locally
    updateMatchInState(match.id, (m) => ({
      ...(m as Match),
      predicted_winner: winnerTeamId,
      predicted_winner_games: games,
    }));
  
    // 🔹 Optimistic UI: propagate winner to the next match
    updateNextMatchSlotInState(match, winnerSide, winnerTeamId);
  
    // 🔹 Optimistic UI: play-in special case – loser goes to game 3, slot B
    updatePlayInGame3LoserInState(match, loserSide, loserTeamId!);
  
    // Clear any pending games once we have a real pick
    setPendingGames((prev) => {
      const copy = { ...prev };
      delete copy[match.id];
      return copy;
    });
  
    try {
      setUpdatingMatchId(match.id);
      setError(null);
      await patch(`/bracket/${bracketId}/match/${match.id}`, {
        action: "set_winner",
        team: winnerTeamId,
        games,
      });
      // ✅ No need to reload bracket on success; backend does same propagation
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update match");
  
      // 🔁 Revert to server truth if something went wrong
      try {
        await loadBracket({ silent: true });
      } catch {
        // ignore secondary errors
      }
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleUndo = async (match: Match) => {
    if (!bracketId || !matches) return;
    // only admin+master can undo
    if (!(isAdmin && isMaster)) return;

    // 🔹 Optimistic UI: clear local pick immediately
    updateMatchInState(match.id, (m) => ({
      ...(m as Match),
      predicted_winner: null,
      predicted_winner_games: null,
    }));
    setPendingGames((prev) => {
      const copy = { ...prev };
      delete copy[match.id];
      return copy;
    });

    try {
      setUpdatingMatchId(match.id);
      setError(null);
      await patch(`/bracket/${bracketId}/match/${match.id}`, {
        action: "undo",
      });
      await loadBracket({ silent: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to undo prediction");
      // 🔁 Re-sync on error
      try {
        await loadBracket({ silent: true });
      } catch {
        // ignore
      }
    } finally {
      setUpdatingMatchId(null);
    }
  };

  const handleSelectGames = async (match: Match, gamesValue: number) => {
    if (!bracketId || !matches || !canEdit) return;
    if (match.round === 0) return; // play-in is always 1 game

    // No winner yet → keep current behaviour (just store pending games locally)
    if (!match.predicted_winner) {
      setPendingGames((prev) => ({ ...prev, [match.id]: gamesValue }));
      return;
    }

    // 🔹 Optimistic UI: update games for this match locally
    updateMatchInState(match.id, (m) => ({
      ...(m as Match),
      predicted_winner: m.predicted_winner,
      predicted_winner_games: gamesValue,
    }));

    try {
      setUpdatingMatchId(match.id);
      setError(null);
      await patch(`/bracket/${bracketId}/match/${match.id}`, {
        action: "set_winner",
        team: match.predicted_winner,
        games: gamesValue,
      });
      // ✅ No loadBracket here on success – server and client are already in sync
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update games");

      // 🔁 Revert to server truth on error
      try {
        await loadBracket({ silent: true });
      } catch {
        // ignore secondary errors
      }
    } finally {
      setUpdatingMatchId(null);
    }
  };

  // ---------- Download image (with hidden borders during export) ----------
  const handleDownloadImage = async () => {
    const node = bracketRef.current;
    if (!node) return;

    try {
      setExporting(true);

      // Dynamically import to avoid module init issues
      const mod: any = await import("dom-to-image-more");
      const toPng =
        mod?.toPng || mod?.default?.toPng || mod?.default || mod;
      if (typeof toPng !== "function") {
        throw new Error("dom-to-image-more: toPng not found");
      }

      // Hide thin Tailwind borders only during export
      node.classList.add("exporting");
      const styleTag = document.createElement("style");
      styleTag.setAttribute("data-export-style", "true");
      styleTag.textContent = `
        /* During export, remove ALL normal borders & shadows */
        .exporting * {
          border-color: transparent !important;
          box-shadow: none !important;
        }
      `;
      document.head.appendChild(styleTag);

      // Capture full scroll area (entire bracket)
      const width = node.scrollWidth;
      const height = node.scrollHeight;

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#0f172a", // slate-900 background (opaque)
        pixelRatio: Math.max(2, window.devicePixelRatio || 1),
        width,
        height,
        style: { transform: "scale(1)", transformOrigin: "top left" },
      });

      const a = document.createElement("a");

      // Build filename: user_bracket-name (both parts sanitized)
      const rawUsername = bracket?.owner?.username || "user";
      const rawBracketName = bracket?.name || "bracket";

      const safeUsername = rawUsername.replace(/[^\w-]+/g, "_");
      const safeBracketName = rawBracketName.replace(/[^\w-]+/g, "_");

      a.download = `${safeUsername}_${safeBracketName}.png`;
      a.href = dataUrl;
      document.body.appendChild(a); // iOS Safari quirk
      a.click();
      a.remove();
	  
    } catch (e) {
      console.error("Export failed:", e);
      setError("Failed to export image");
    } finally {
      // cleanup
      const s = document.head.querySelector('style[data-export-style="true"]');
      if (s) s.remove();
      node.classList.remove("exporting");
      setExporting(false);
    }
  };

  // ---------- Derived data ----------
  const allDecided = useMemo(() => {
    if (!matches) return false;
    const confs = Object.keys(matches);
    if (confs.length === 0) return false;
    for (const conf of confs) {
      const roundsObj = matches[conf];
      for (const roundKey of Object.keys(roundsObj)) {
        const roundMatches = roundsObj[roundKey];
        for (const m of roundMatches) {
          if (!m.team_a || !m.team_b) continue;
          if (!m.predicted_winner) return false;
          if (m.round > 0 && m.predicted_winner_games == null) return false;
        }
      }
    }
    return true;
  }, [matches]);

  const trimmedName = bracketName.trim();
  const canSave =
    canEdit && allDecided && !!trimmedName && !saving && !savingLockedForUser;

  const handleSaveBracket = async () => {
    if (!bracketId) return;
    if (!canSave) return;
    if (savingLockedForUser) {
      setError("Brackets are locked; you can no longer save.");
      return;
    }

    const nameToSave = trimmedName;
    if (!nameToSave) {
      setError("Please enter a bracket name before saving.");
      return;
    }

    try {
      setSaving(true);
      setSaveMessage(null);
      setError(null);

      const res: any = await patch(`/bracket/${bracketId}/save`, {
        name: nameToSave,
      });

      // Update local state so UI reflects saved status immediately
      setBracket((prev) =>
        prev
          ? {
              ...prev,
              name: res?.name ?? nameToSave,
              saved_at: res?.saved_at ?? prev.saved_at,
              is_done: true,
            }
          : prev
      );

      setSaveMessage("Bracket saved!");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save bracket");
    } finally {
      setSaving(false);
    }
  };


  const gameOptions = [4, 5, 6, 7];

  // Grid helpers (your compact layout rules)
  const getGridRowForMatch = (
    round: number,
    matchIndex: number,
    matchSlot: number
  ): number => {
    if (round === 0) {
      // Fix: anchor play-in rows to slot instead of array index
      if (matchSlot === 1) return 2;
      if (matchSlot === 2) return 3;
      if (matchSlot === 3) return 4;
      // Fallback if something unexpected happens
      return 2 + matchIndex;
    }
    if (round === 1) {
      if (matchSlot === 4) return 2;
      if (matchSlot === 7) return 4;
      if (matchSlot === 6) return 6;
      if (matchSlot === 5) return 8;
      return 2 + matchIndex * 2;
    }
    if (round === 2) return matchSlot === 8 ? 7 : 3;
    if (round === 3) return 5;
    return 5;
  };

  // ---------- Read-only game-count badge ----------
  const GamesBadge: React.FC<{ match: Match; selectedGames: number | null }> = ({
    match,
    selectedGames,
  }) => {
    if (!match.team_a || !match.team_b) return null;
    if (!match.predicted_winner) return null;
    if (match.round === 0) return null; // no badge for play-in
    const games = selectedGames;
    if (games == null) return null;
    return (
      <span className="text-[11px] px-2 py-1 rounded-md border border-slate-600 text-slate-300">
        {games}
      </span>
    );
  };

  // ---------- Connection lines ----------
  useLayoutEffect(() => {
    const computeLines = () => {
      try {
        if (!matches) {
          setLines([]);
          return;
        }
        const container = bracketRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const newLines: ConnectionLine[] = [];

        const findMatch = (
          conf: string,
          round: number,
          slot: number
        ): Match | undefined => {
          const confRounds = matches[conf];
          if (!confRounds) return undefined;
          const roundMatches = confRounds[String(round)];
          if (!roundMatches) return undefined;
          return roundMatches.find((m) => m.slot === slot);
        };

        const getRect = (
          conf: string,
          round: number,
          slot: number
        ): DOMRect | null => {
          const match = findMatch(conf, round, slot);
          if (!match) return null;
          const el = cardRefs.current[match.id];
          if (!el) return null;
          return el.getBoundingClientRect();
        };

        const addVerticalPair = (
          conf: "east" | "west",
          round1: number,
          slot1: number,
          round2: number,
          slot2: number,
          destRound?: number,
          destSlot?: number
        ) => {
          const rect1 = getRect(conf, round1, slot1);
          const rect2 = getRect(conf, round2, slot2);
          if (!rect1 || !rect2) return;

          let topRect = rect1;
          let bottomRect = rect2;
          if (rect2.top < rect1.top) {
            topRect = rect2;
            bottomRect = rect1;
          }

          const x = topRect.left + topRect.width / 2;
          const fromY = topRect.bottom;
          const toY = bottomRect.top;

          newLines.push({
            points: [
              { x: x - containerRect.left, y: fromY - containerRect.top },
              { x: x - containerRect.left, y: toY - containerRect.top },
            ],
          });

          if (destRound === undefined || destSlot === undefined) return;

          const destRect = getRect(conf, destRound, destSlot);
          if (!destRect) return;

          const midY = (fromY + toY) / 2;
          const midX = x;

          const isEast = conf === "east";
          const destY = destRect.top + destRect.height / 2;
          const destX = isEast ? destRect.right : destRect.left;

          newLines.push({
            points: [
              { x: midX - containerRect.left, y: midY - containerRect.top },
              { x: destX - containerRect.left, y: midY - containerRect.top },
              { x: destX - containerRect.left, y: destY - containerRect.top },
            ],
          });
        };

        // EAST
        addVerticalPair("east", 1, 4, 1, 7, 2, 9);
        addVerticalPair("east", 1, 6, 1, 5, 2, 8);
        addVerticalPair("east", 2, 8, 2, 9, 3, 10);

        // WEST
        addVerticalPair("west", 1, 4, 1, 7, 2, 9);
        addVerticalPair("west", 1, 6, 1, 5, 2, 8);
        addVerticalPair("west", 2, 8, 2, 9, 3, 10);

        // Conference Finals → NBA Finals (slot 11)
        const eastFinalRect = getRect("east", 3, 10);
        const westFinalRect = getRect("west", 3, 10);
        const nbaFinalRect = getRect("nba", 4, 11);

        if (eastFinalRect && nbaFinalRect) {
          const fromX = eastFinalRect.left;
          const fromY = eastFinalRect.top + eastFinalRect.height / 2;
          const toX = nbaFinalRect.right;
          const toY = nbaFinalRect.top + nbaFinalRect.height / 2;
          const midX = (fromX + toX) / 2;

          newLines.push({
            points: [
              { x: fromX - containerRect.left, y: fromY - containerRect.top },
              { x: midX - containerRect.left, y: fromY - containerRect.top },
              { x: midX - containerRect.left, y: toY - containerRect.top },
              { x: toX - containerRect.left, y: toY - containerRect.top },
            ],
          });
        }

        if (westFinalRect && nbaFinalRect) {
          const fromX = westFinalRect.right;
          const fromY = westFinalRect.top + westFinalRect.height / 2;
          const toX = nbaFinalRect.left;
          const toY = nbaFinalRect.top + nbaFinalRect.height / 2;
          const midX = (fromX + toX) / 2;

          newLines.push({
            points: [
              { x: fromX - containerRect.left, y: fromY - containerRect.top },
              { x: midX - containerRect.left, y: fromY - containerRect.top },
              { x: midX - containerRect.left, y: toY - containerRect.top },
              { x: toX - containerRect.left, y: toY - containerRect.top },
            ],
          });
        }

        setLines(newLines);
      } catch (e) {
        console.error("computeLines error", e);
        setLines([]);
      }
    };

    computeLines();
    const handleResize = () => computeLines();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [matches]);

  if (!bracketId) {
    return <div className="p-6 text-slate-100">Missing bracket id in URL.</div>;
  }

  // Small component: visible only for admin+master AND when there's a pick already
  const UndoButton: React.FC<{ match: Match; isUpdating: boolean }> = ({
    match,
    isUpdating,
  }) => {
    const hasPick = !!match.predicted_winner;
    if (!(isAdmin && isMaster && hasPick)) return null;
    return (
      <button
        onClick={() => handleUndo(match)}
        disabled={isUpdating}
        className="text-[11px] px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
        title="Undo this pick (master)"
      >
        Undo
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden text-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            {/* App title / logo → always goes to dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="text-xl font-semibold tracking-tight hover:text-slate-100"
            >
              NBA Corner
            </button>
      
            {/* Top navigation - desktop only */}
            <nav className="hidden md:flex items-center gap-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate("/leagues/info")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                My Leagues
              </button>
              <button
                onClick={() => navigate("/leagues/find")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Find a League
              </button>
              <button
                onClick={() => navigate("/leaderboard")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Leaderboards
              </button>
              <button
                onClick={() => navigate("/past-seasons")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Past Seasons
              </button>
              {user?.is_admin && (
                <button
                  onClick={() => navigate("/admin")}
                  className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => navigate("/account")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Account
              </button>
            </nav>
          </div>
      
          {/* Right side: user info + logout - desktop only */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <span className="text-sm text-slate-300">
                Logged in as <span className="font-semibold">{user.username}</span>
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
      
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-100 hover:bg-slate-800 md:hidden"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <span className="mr-1">Menu</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {isMobileMenuOpen ? (
                // X icon
                <path
                  fill="currentColor"
                  d="M6.225 4.811 4.81 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.81z"
                />
              ) : (
                // Hamburger icon
                <path
                  fill="currentColor"
                  d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"
                />
              )}
            </svg>
          </button>
        </div>
      
        {/* Mobile menu panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/95">
            <nav className="flex flex-col gap-1 px-6 py-3">
              <button
                onClick={() => {
                  navigate("/dashboard");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  navigate("/leagues/info");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                My Leagues
              </button>
              <button
                onClick={() => {
                  navigate("/leagues/find");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Find a League
              </button>
              <button
                onClick={() => {
                  navigate("/leaderboard");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Leaderboards
              </button>
              <button
                onClick={() => {
                  navigate("/past-seasons");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Past Seasons
              </button>
      
              {user?.is_admin && (
                <button
                  onClick={() => {
                    navigate("/admin");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
                >
                  Admin
                </button>
              )}
      
              <div className="mt-3 border-t border-slate-800 pt-2">
                {user && (
                  <div className="mb-1 text-xs text-slate-300">
                    Logged in as{" "}
                    <span className="font-semibold">{user.username}</span>
                  </div>
                )}
				<button
                  onClick={() => {
                    navigate("/account");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
                >
                  Account
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md border border-slate-600 hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 flex flex-col gap-0">
        {/* Bracket header */}
        <section className="w-full px-6 py-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold mb-1">
                {canEdit ? (
                  <input
                    type="text"
                    className="w-full max-w-md rounded-md px-3 py-1 bg-slate-900 border border-slate-700 focus:outline-none focus:ring focus:ring-indigo-500 text-base"
                    placeholder="Enter bracket name"
                    value={bracketName}
                    onChange={(e) => setBracketName(e.target.value)}
                  />
                ) : (
                  <span>{bracket?.name || "Unnamed bracket"}</span>
                )}
              </h1>
              {bracket?.owner && (
                <p className="text-sm text-slate-300">
                  Owner: <span className="font-semibold">{bracket.owner.username}</span>
                </p>
              )}
              {isOwner && (
                <p className="text-xs text-slate-400 mt-1">
                  Saved: {formatDate(bracket?.saved_at)}{" "}
                  {bracket?.is_done ? "(complete)" : "(not saved/complete)"}
                </p>
              )}
              {isMaster && (
                <p className="text-[11px] text-indigo-300 mt-1">
                  Viewing <b>MASTER</b> bracket {isAdmin ? "(admin-editable)" : ""}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Download image button (owner only; matches Save button color when enabled) */}
              {isOwner && (
                <button
                  onClick={handleDownloadImage}
                  disabled={!Boolean(bracket?.saved_at) || exporting}
                  className={
                    "px-4 py-2 rounded-md text-sm " +
                    (Boolean(bracket?.saved_at) && !exporting
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-slate-700 opacity-60 cursor-not-allowed")
                  }
                  title={
                    Boolean(bracket?.saved_at)
                      ? "Download image"
                      : "Save your bracket first"
                  }
                >
                  {exporting ? "Preparing..." : "Download image"}
                </button>
              )}

              {canEdit && (
                <button
                  onClick={handleSaveBracket}
                  disabled={!canSave}
                  className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm"
                >
                  {saving
                    ? "Saving..."
                    : savingLockedForUser
                    ? "Brackets locked"
                    : "Save bracket"}
                </button>
              )}
              {saveMessage && (
                <span className="text-xs text-emerald-400">{saveMessage}</span>
              )}
            </div>
          </div>
        </section>

        {/* Loading / error */}
        {loading && <p className="px-6 py-3 text-slate-300">Loading bracket...</p>}
        {error && <p className="px-6 py-3 text-sm text-red-400">{error}</p>}

        {/* Bracket grid */}
        {!loading && !error && matches && (
          <section className="w-full pb-4 px-4">
            <div className="w-full overflow-x-auto">
              <div className="relative min-w-[1100px]" ref={bracketRef}>
                {/* SVG lines */}
                <svg className="pointer-events-none absolute inset-0 w-full h-full bracket-lines">
                  {lines.map((line, idx) => (
                    <polyline
                      key={idx}
                      points={line.points.map((p) => `${p.x},${p.y}`).join(" ")}
                      stroke="#4b5563"
                      strokeWidth={3}
                      fill="none"
                    />
                  ))}
                </svg>

                <div className="relative z-10 flex w-full gap-4">
                  {/* WEST */}
                  <div className="flex-1 flex flex-col items-start">
                    {(() => {
                      const roundsObj = matches["west"];
                      if (!roundsObj) return null;

                      const roundNumbers = Object.keys(roundsObj)
                        .map((r) => parseInt(r, 10))
                        .sort((a, b) => a - b);

                      const orderedRounds = roundNumbers;
                      const confLabel = "Western Conference";

                      const cols = orderedRounds.length;
                      const gridClass =
                        "grid grid-rows-[repeat(9,minmax(28px,auto))] gap-4 w-full";
                      const gridStyle: React.CSSProperties = {
                        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
                      };

                      return (
                        <>
                          <h2 className="text-sm font-semibold mb-2 text-center text-slate-200 w-full">
                            {confLabel}
                          </h2>
                          <div className={gridClass} style={gridStyle}>
                            {orderedRounds.map((roundNum, roundIndex) => {
                              const roundMatches = roundsObj[String(roundNum)];
                              if (!roundMatches?.length) return null;

                              const roundLabel =
                                roundNum === 0
                                  ? "Play-in"
                                  : roundNum === 1
                                  ? "Round 1"
                                  : roundNum === 2
                                  ? "Semifinals"
                                  : roundNum === 3
                                  ? "Conference Finals"
                                  : `Round ${roundNum}`;

                              const gridCol = roundIndex + 1;

                              return (
                                <React.Fragment key={roundNum}>
                                  <div
                                    className="col-start-[var(--col)] row-start-1 text-xs font-semibold uppercase text-slate-400 text-center"
                                    style={{ "--col": gridCol } as React.CSSProperties}
                                  >
                                    {roundLabel}
                                  </div>

                                  {roundMatches.map((m, matchIndex) => {
                                    debugMatchTeams(m);

                                    const hasTeams = m.team_a && m.team_b;
                                    const winner = m.predicted_winner;
                                    const isUpdating = updatingMatchId === m.id;

                                    const selectedGames =
                                      m.predicted_winner_games ??
                                      pendingGames[m.id] ??
                                      null;

                                    const isWinnerA = winner && winner === m.team_a;
                                    const isWinnerB = winner && winner === m.team_b;

                                    const gridRow = getGridRowForMatch(
                                      roundNum,
                                      matchIndex,
                                      m.slot
                                    );

                                    const teamButtonBase =
                                      "w-full flex items-center justify-between text-sm px-2 py-1 rounded-md border transition-colors";

                                    const makeTeamClass = (
                                      isWinner: boolean,
                                      hasWinner: boolean
                                    ) => {
                                      let cls =
                                        teamButtonBase +
                                        " bg-slate-900/70 border-slate-700";
                                      if (isWinner) {
                                        cls += " text-white font-semibold shadow-md border-2";
                                      } else if (hasWinner) {
                                        cls += " opacity-40";
                                      } else {
                                        cls += " hover:bg-slate-800";
                                      }
                                      if (canEdit && hasTeams) {
                                        cls += " cursor-pointer";
                                      } else {
                                        cls += " cursor-default";
                                      }
                                      return cls;
                                    };

                                    const hasWinner = !!winner;

                                    return (
                                      <div
                                        key={m.id}
                                        ref={(el) => {
                                          cardRefs.current[m.id] = el;
                                        }}
                                        className="col-start-[var(--col)] row-start-[var(--row)] p-2 rounded-md bg-slate-900/70 border border-slate-700"
                                        style={
                                          {
                                            "--col": gridCol,
                                            "--row": gridRow,
                                          } as React.CSSProperties
                                        }
                                      >
                                        <div className="flex flex-col gap-1">
                                          {/* Team A */}
                                          <button
                                            type="button"
                                            disabled={!hasTeams || !canEdit || isUpdating}
                                            onClick={
                                              hasTeams && canEdit
                                                ? () => handleSetWinner(m, "A")
                                                : undefined
                                            }
                                            className={makeTeamClass(!!isWinnerA, hasWinner)}
                                            style={buildWinnerStyle(!!isWinnerA, m, "A")}
                                          >
                                            <span className="truncate">
                                              {getTeamName(m, "A")}
                                            </span>
                                          </button>

                                          {/* Team B */}
                                          <button
                                            type="button"
                                            disabled={!hasTeams || !canEdit || isUpdating}
                                            onClick={
                                              hasTeams && canEdit
                                                ? () => handleSetWinner(m, "B")
                                                : undefined
                                            }
                                            className={makeTeamClass(!!isWinnerB, hasWinner)}
                                            style={buildWinnerStyle(!!isWinnerB, m, "B")}
                                          >
                                            <span className="truncate">
                                              {getTeamName(m, "B")}
                                            </span>
                                          </button>
                                        </div>

                                        {/* Games + Undo row */}
                                        <div className="mt-1 flex justify-between items-center gap-2">
                                          {(isAdmin && isMaster && !!winner) ? (
                                            <UndoButton match={m} isUpdating={isUpdating} />
                                          ) : (
                                            <span />
                                          )}

                                           {m.round > 0 && hasTeams ? (
                                            canEdit ? (
                                              <>
                                                {/* Mobile: compact dropdown for number of games */}
                                                <div className="md:hidden">
                                                  <select
                                                    value={selectedGames ?? 4}  // ⬅️ default to 4 if null
                                                    onChange={(e) => {
                                                      const val = parseInt(e.target.value, 10);
                                                      if (!Number.isNaN(val)) {
                                                        handleSelectGames(m, val);
                                                      }
                                                    }}
                                                    disabled={isUpdating}
                                                    className="text-[11px] px-2 py-1 rounded-md border border-slate-600 bg-slate-900 text-slate-100"
                                                  >
                                                    {gameOptions.map((g) => (
                                                      <option key={g} value={g}>
                                                        {g}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>
                                          
                                                {/* Desktop / tablet: keep existing 4 buttons */}
                                                <div className="hidden md:flex gap-1">
                                                  {gameOptions.map((g) => (
                                                    <button
                                                      key={g}
                                                      onClick={() => handleSelectGames(m, g)}
                                                      disabled={isUpdating}
                                                      className={
                                                        "text-[11px] px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800 " +
                                                        (selectedGames === g
                                                          ? "bg-indigo-600 border-indigo-500 text-white"
                                                          : "")
                                                      }
                                                    >
                                                      {g}
                                                    </button>
                                                  ))}
                                                </div>
                                              </>
                                            ) : (
                                              <GamesBadge match={m} selectedGames={selectedGames} />
                                            )
                                          ) : (
                                            <div />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* NBA FINALS */}
                  <div className="grow-0 shrink basis-[220px] max-w-[220px] w-full flex flex-col items-center">
                    {(() => {
                      const roundsObj = matches["nba"];
                      if (!roundsObj) return null;

                      const roundNumbers = Object.keys(roundsObj)
                        .map((r) => parseInt(r, 10))
                        .sort((a, b) => a - b);

                      const orderedRounds = roundNumbers;
                      const confLabel = "NBA Finals";

                      const gridClass =
                        "grid grid-cols-[minmax(0,1fr)] grid-rows-[repeat(9,minmax(28px,auto))] gap-4 w-full";

                      return (
                        <>
                          <h2 className="text-sm font-semibold mb-2 text-center text-slate-200">
                            {confLabel}
                          </h2>
                          <div className={gridClass}>
                            {orderedRounds.map((roundNum) => {
                              const roundMatches = roundsObj[String(roundNum)];
                              if (!roundMatches?.length) return null;

                              const roundLabel = "Finals";

                              return (
                                <React.Fragment key={roundNum}>
                                  <div className="col-start-1 row-start-1 text-xs font-semibold uppercase text-slate-400 text-center">
                                    {roundLabel}
                                  </div>

                                  {roundMatches.map((m, matchIndex) => {
                                    debugMatchTeams(m);

                                    const hasTeams = m.team_a && m.team_b;
                                    const winner = m.predicted_winner;
                                    const isUpdating = updatingMatchId === m.id;

                                    const selectedGames =
                                      m.predicted_winner_games ??
                                      pendingGames[m.id] ??
                                      null;

                                    const isWinnerA = winner && winner === m.team_a;
                                    const isWinnerB = winner && winner === m.team_b;

                                    const gridRow = getGridRowForMatch(
                                      roundNum,
                                      matchIndex,
                                      m.slot
                                    );

                                    const teamButtonBase =
                                      "w-full flex items-center justify-between text-sm px-2 py-1 rounded-md border transition-colors";

                                    const makeTeamClass = (
                                      isWinner: boolean,
                                      hasWinner: boolean
                                    ) => {
                                      let cls =
                                        teamButtonBase +
                                        " bg-slate-900/70 border-slate-700";
                                      if (isWinner) {
                                        cls += " text-white font-semibold shadow-md border-2";
                                      } else if (hasWinner) {
                                        cls += " opacity-40";
                                      } else {
                                        cls += " hover:bg-slate-800";
                                      }
                                      if (canEdit && hasTeams) {
                                        cls += " cursor-pointer";
                                      } else {
                                        cls += " cursor-default";
                                      }
                                      return cls;
                                    };

                                    const hasWinner = !!winner;

                                    return (
                                      <div
                                        key={m.id}
                                        ref={(el) => {
                                          cardRefs.current[m.id] = el;
                                        }}
                                        className="col-start-1 row-start-[var(--row)] p-2 rounded-md bg-slate-900/70 border border-slate-700 w-full"
                                        style={{ "--row": gridRow } as React.CSSProperties}
                                      >
                                        <div className="flex flex-col gap-1">
                                          {/* Team A */}
                                          <button
                                            type="button"
                                            disabled={!hasTeams || !canEdit || isUpdating}
                                            onClick={
                                              hasTeams && canEdit
                                                ? () => handleSetWinner(m, "A")
                                                : undefined
                                            }
                                            className={makeTeamClass(!!isWinnerA, hasWinner)}
                                            style={buildWinnerStyle(!!isWinnerA, m, "A")}
                                          >
                                            <span className="truncate">
                                              {getTeamName(m, "A")}
                                            </span>
                                          </button>

                                          {/* Team B */}
                                          <button
                                            type="button"
                                            disabled={!hasTeams || !canEdit || isUpdating}
                                            onClick={
                                              hasTeams && canEdit
                                                ? () => handleSetWinner(m, "B")
                                                : undefined
                                            }
                                            className={makeTeamClass(!!isWinnerB, hasWinner)}
                                            style={buildWinnerStyle(!!isWinnerB, m, "B")}
                                          >
                                            <span className="truncate">
                                              {getTeamName(m, "B")}
                                            </span>
                                          </button>
                                        </div>

                                        <div className="mt-1 flex justify-between items-center gap-2">
                                          {(isAdmin && isMaster && !!winner) ? (
                                            <UndoButton match={m} isUpdating={isUpdating} />
                                          ) : (
                                            <span />
                                          )}

                                           {m.round > 0 && hasTeams ? (
                                            canEdit ? (
                                              <>
                                                {/* Mobile: compact dropdown for number of games */}
                                                <div className="md:hidden">
                                                  <select
                                                    value={selectedGames ?? 4}  // ⬅️ default to 4 if null
                                                    onChange={(e) => {
                                                      const val = parseInt(e.target.value, 10);
                                                      if (!Number.isNaN(val)) {
                                                        handleSelectGames(m, val);
                                                      }
                                                    }}
                                                    disabled={isUpdating}
                                                    className="text-[11px] px-2 py-1 rounded-md border border-slate-600 bg-slate-900 text-slate-100"
                                                  >
                                                    {gameOptions.map((g) => (
                                                      <option key={g} value={g}>
                                                        {g}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>
                                          
                                                {/* Desktop / tablet: keep existing 4 buttons */}
                                                <div className="hidden md:flex gap-1">
                                                  {gameOptions.map((g) => (
                                                    <button
                                                      key={g}
                                                      onClick={() => handleSelectGames(m, g)}
                                                      disabled={isUpdating}
                                                      className={
                                                        "text-[11px] px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800 " +
                                                        (selectedGames === g
                                                          ? "bg-indigo-600 border-indigo-500 text-white"
                                                          : "")
                                                      }
                                                    >
                                                      {g}
                                                    </button>
                                                  ))}
                                                </div>
                                              </>
                                            ) : (
                                              <GamesBadge match={m} selectedGames={selectedGames} />
                                            )
                                          ) : (
                                            <div />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* EAST */}
                  <div className="flex-1 flex flex-col items-end">
                    {(() => {
                      const roundsObj = matches["east"];
                      if (!roundsObj) return null;

                      const roundNumbers = Object.keys(roundsObj)
                        .map((r) => parseInt(r, 10))
                        .sort((a, b) => a - b);

                      const orderedRounds = [...roundNumbers].reverse();
                      const confLabel = "Eastern Conference";

                      const cols = orderedRounds.length;
                      const gridClass =
                        "grid grid-rows-[repeat(9,minmax(28px,auto))] gap-4 w-full";
                      const gridStyle: React.CSSProperties = {
                        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
                      };

                      return (
                        <>
                          <h2 className="text-sm font-semibold mb-2 text-center text-slate-200 w-full">
                            {confLabel}
                          </h2>
                          <div className={gridClass} style={gridStyle}>
                            {orderedRounds.map((roundNum, roundIndex) => {
                              const roundMatches = roundsObj[String(roundNum)];
                              if (!roundMatches?.length) return null;

                              const roundLabel =
                                roundNum === 0
                                  ? "Play-in"
                                  : roundNum === 1
                                  ? "Round 1"
                                  : roundNum === 2
                                  ? "Semifinals"
                                  : roundNum === 3
                                  ? "Conference Finals"
                                  : `Round ${roundNum}`;

                              const gridCol = roundIndex + 1;

                              return (
                                <React.Fragment key={roundNum}>
                                  <div
                                    className="col-start-[var(--col)] row-start-1 text-xs font-semibold uppercase text-slate-400 text-center"
                                    style={{ "--col": gridCol } as React.CSSProperties}
                                  >
                                    {roundLabel}
                                  </div>

                                  {roundMatches.map((m, matchIndex) => {
                                    debugMatchTeams(m);

                                    const hasTeams = m.team_a && m.team_b;
                                    const winner = m.predicted_winner;
                                    const isUpdating = updatingMatchId === m.id;

                                    const selectedGames =
                                      m.predicted_winner_games ??
                                      pendingGames[m.id] ??
                                      null;

                                    const isWinnerA = winner && winner === m.team_a;
                                    const isWinnerB = winner && winner === m.team_b;

                                    const gridRow = getGridRowForMatch(
                                      roundNum,
                                      matchIndex,
                                      m.slot
                                    );

                                    const teamButtonBase =
                                      "w-full flex items-center justify-between text-sm px-2 py-1 rounded-md border transition-colors";

                                    const makeTeamClass = (
                                      isWinner: boolean,
                                      hasWinner: boolean
                                    ) => {
                                      let cls =
                                        teamButtonBase +
                                        " bg-slate-900/70 border-slate-700";
                                      if (isWinner) {
                                        cls += " text-white font-semibold shadow-md border-2";
                                      } else if (hasWinner) {
                                        cls += " opacity-40";
                                      } else {
                                        cls += " hover:bg-slate-800";
                                      }
                                      if (canEdit && hasTeams) {
                                        cls += " cursor-pointer";
                                      } else {
                                        cls += " cursor-default";
                                      }
                                      return cls;
                                    };

                                    const hasWinner = !!winner;

                                    return (
                                      <div
                                        key={m.id}
                                        ref={(el) => {
                                          cardRefs.current[m.id] = el;
                                        }}
                                        className="col-start-[var(--col)] row-start-[var(--row)] p-2 rounded-md bg-slate-900/70 border border-slate-700"
                                        style={
                                          {
                                            "--col": gridCol,
                                            "--row": gridRow,
                                          } as React.CSSProperties
                                        }
                                      >
                                        <div className="flex flex-col gap-1">
                                          {/* Team A */}
                                          <button
                                            type="button"
                                            disabled={!hasTeams || !canEdit || isUpdating}
                                            onClick={
                                              hasTeams && canEdit
                                                ? () => handleSetWinner(m, "A")
                                                : undefined
                                            }
                                            className={makeTeamClass(!!isWinnerA, hasWinner)}
                                            style={buildWinnerStyle(!!isWinnerA, m, "A")}
                                          >
                                            <span className="truncate">
                                              {getTeamName(m, "A")}
                                            </span>
                                          </button>

                                          {/* Team B */}
                                          <button
                                            type="button"
                                            disabled={!hasTeams || !canEdit || isUpdating}
                                            onClick={
                                              hasTeams && canEdit
                                                ? () => handleSetWinner(m, "B")
                                                : undefined
                                            }
                                            className={makeTeamClass(!!isWinnerB, hasWinner)}
                                            style={buildWinnerStyle(!!isWinnerB, m, "B")}
                                          >
                                            <span className="truncate">
                                              {getTeamName(m, "B")}
                                            </span>
                                          </button>
                                        </div>

                                        <div className="mt-1 flex justify-between items-center gap-2">
                                          {(isAdmin && isMaster && !!winner) ? (
                                            <UndoButton match={m} isUpdating={isUpdating} />
                                          ) : (
                                            <span />
                                          )}

                                           {m.round > 0 && hasTeams ? (
                                            canEdit ? (
                                              <>
                                                {/* Mobile: compact dropdown for number of games */}
                                                <div className="md:hidden">
                                                  <select
                                                    value={selectedGames ?? 4}  // ⬅️ default to 4 if null
                                                    onChange={(e) => {
                                                      const val = parseInt(e.target.value, 10);
                                                      if (!Number.isNaN(val)) {
                                                        handleSelectGames(m, val);
                                                      }
                                                    }}
                                                    disabled={isUpdating}
                                                    className="text-[11px] px-2 py-1 rounded-md border border-slate-600 bg-slate-900 text-slate-100"
                                                  >
                                                    {gameOptions.map((g) => (
                                                      <option key={g} value={g}>
                                                        {g}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>
                                          
                                                {/* Desktop / tablet: keep existing 4 buttons */}
                                                <div className="hidden md:flex gap-1">
                                                  {gameOptions.map((g) => (
                                                    <button
                                                      key={g}
                                                      onClick={() => handleSelectGames(m, g)}
                                                      disabled={isUpdating}
                                                      className={
                                                        "text-[11px] px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800 " +
                                                        (selectedGames === g
                                                          ? "bg-indigo-600 border-indigo-500 text-white"
                                                          : "")
                                                      }
                                                    >
                                                      {g}
                                                    </button>
                                                  ))}
                                                </div>
                                              </>
                                            ) : (
                                              <GamesBadge match={m} selectedGames={selectedGames} />
                                            )
                                          ) : (
                                            <div />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
	  <Footer />
    </div>
  );
};
