export const BLOCKED_SENDER_PATTERNS = [
  "no-reply@",
  "noreply@",
  "donotreply@",
  "notification@",
  "bounce@",
  "promotions",
  "marketing",
  "updates@",
];

export function isSenderBlocked(sender: string | undefined) {
  if (!sender) return false;
  const lower = sender.toLowerCase();
  return BLOCKED_SENDER_PATTERNS.some((pattern) => lower.includes(pattern));
}
