const matchupPath = /^\/1on1\/matchup\/(\d{4})-(\d{2})-(\d{2})$/;

function validDailyReturnPath(value: string): boolean {
  const match = matchupPath.exec(value);
  if (!match || match[0] !== value) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= ([31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0);
}

export function readDailyReturnPath(search: string): string | null {
  const targets = new URLSearchParams(search).getAll("returnTo");
  const target = targets[0];
  return targets.length === 1 && validDailyReturnPath(target) ? target : null;
}

export function dailyAuthPath(route: "/login" | "/register", target: string | null): string {
  return target && validDailyReturnPath(target)
    ? `${route}?${new URLSearchParams({ returnTo: target })}`
    : route;
}
