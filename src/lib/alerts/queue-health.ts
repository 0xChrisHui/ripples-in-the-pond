const MINUTE = 60_000;

export function queueHealth(oldest: string | undefined, lastSuccess: string | undefined, now = Date.now()) {
  const age = oldest ? now - Date.parse(oldest) : 0;
  return {
    noProgress: age >= 60 * MINUTE && (!lastSuccess || now - Date.parse(lastSuccess) >= 60 * MINUTE),
    waitingTooLong: age >= 180 * MINUTE,
  };
}
export function heartbeatLate(active: number, lastRun: string | undefined, now = Date.now()) {
  return active > 0 && (!lastRun || now - Date.parse(lastRun) > 10 * MINUTE);
}
