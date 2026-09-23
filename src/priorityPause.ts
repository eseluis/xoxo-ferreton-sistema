export type PriorityClock = { startedAt?: string; completedAt?: string; pausedAt?: string; pausedMinutes?: number; pauseReason?: string };
export function activeMinutes(clock: PriorityClock, now = Date.now()) {
  if (!clock.startedAt) return 0;
  const end = clock.completedAt ?? clock.pausedAt;
  return Math.max(0, ((end ? Date.parse(end) : now) - Date.parse(clock.startedAt)) / 60000 - (clock.pausedMinutes ?? 0));
}
export function resumePriority<T extends PriorityClock>(item: T, now = new Date().toISOString()): T {
  return { ...item, pausedMinutes: (item.pausedMinutes ?? 0) + (item.pausedAt ? Math.max(0, (Date.parse(now) - Date.parse(item.pausedAt)) / 60000) : 0), pausedAt: undefined, pauseReason: undefined };
}
