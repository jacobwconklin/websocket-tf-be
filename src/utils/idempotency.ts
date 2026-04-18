const recentEvents = new Map<string, number>();

function cleanupExpired(now: number, windowMs: number) {
  for (const [key, timestamp] of recentEvents.entries()) {
    if (now - timestamp > windowMs) {
      recentEvents.delete(key);
    }
  }
}

export function isDuplicateEvent(scope: string, eventId: string | undefined, windowMs = 15_000): boolean {
  if (!eventId) return false;

  const now = Date.now();
  cleanupExpired(now, windowMs);
  const key = `${scope}:${eventId}`;

  if (recentEvents.has(key)) {
    return true;
  }

  recentEvents.set(key, now);
  return false;
}
