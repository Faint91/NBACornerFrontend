import { useSyncExternalStore } from "react";

export function deadlineReached(deadline: string | null, now: number): boolean {
  const timestamp = deadline ? Date.parse(deadline) : NaN;
  return Number.isFinite(timestamp) && now >= timestamp;
}

const subscribeClock = (notify: () => void) => {
  const timer = setInterval(notify, 250);
  return () => clearInterval(timer);
};

// The server supplies the canonical deadline. Backend enforcement is authoritative.
export function useBracketDeadline(serverLocked: boolean, deadline: string | null) {
  const reached = useSyncExternalStore(
    subscribeClock,
    () => deadlineReached(deadline, Date.now()),
    () => serverLocked,
  );
  return serverLocked || reached;
}

export function bracketContentAccess({ isOwner, isAdmin, isMaster, locked, ready }: {
  isOwner: boolean; isAdmin: boolean; isMaster: boolean; locked: boolean; ready: boolean;
}) {
  const adminMaster = isAdmin && isMaster;
  const ordinaryOwner = isOwner && !isAdmin && !isMaster;
  return {
    canManage: adminMaster || ordinaryOwner,
    canEdit: adminMaster || (ordinaryOwner && ready && !locked),
    savingLockedForUser: locked && !adminMaster,
  };
}

export function bracketCreationDisabled({ creating, hasBracket, isAdmin, creationOpen, locked, ready }: {
  creating: boolean; hasBracket: boolean; isAdmin: boolean; creationOpen: boolean; locked: boolean; ready: boolean;
}) {
  return creating || hasBracket || (!isAdmin && (!ready || !creationOpen || locked));
}
