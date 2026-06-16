// Simple in-memory rate limiter for Next.js API routes
// Uses a sliding window approach with per-route limits

interface RateLimitEntry {
  timestamp: number;
}

const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  '/api/news': { maxRequests: 5, windowMs: 60_000 },    // 5 req/min for news fetching (20+ sources)
  '/api/chat': { maxRequests: 10, windowMs: 60_000 },   // 10 req/min for chat
  '/api/auth/github': { maxRequests: 3, windowMs: 60_000 }, // 3 req/min for auth flow
};

const trackers: Record<string, RateLimitEntry[]> = {};

export function checkRateLimit(path: string): boolean {
  const limit = LIMITS[path];
  if (!limit) return true; // No limit configured — allow through

  const now = Date.now();
  const windowStart = now - limit.windowMs;

  if (!trackers[path]) trackers[path] = [];

  // Remove entries outside the window
  trackers[path] = trackers[path].filter(e => e.timestamp > windowStart);

  if (trackers[path].length >= limit.maxRequests) {
    return false; // Rate limited
  }

  trackers[path].push({ timestamp: now });
  return true;
}

export function getRateLimitInfo(path: string): { remaining: number; resetAt: number } | null {
  const limit = LIMITS[path];
  if (!limit) return null;

  const now = Date.now();
  const windowStart = now - limit.windowMs;

  if (!trackers[path]) trackers[path] = [];

  const activeCount = trackers[path].filter(e => e.timestamp > windowStart).length;
  const remaining = Math.max(0, limit.maxRequests - activeCount);
  // Reset at the oldest entry's timestamp + window
  const oldest = trackers[path][0]?.timestamp || now;
  const resetAt = oldest + limit.windowMs;

  return { remaining, resetAt };
}
