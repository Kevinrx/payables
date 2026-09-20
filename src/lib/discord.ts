function siteOrigin(): string | null {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : null;
}

export function billLink(billId: string): string {
  const origin = siteOrigin();
  return origin ? `\n${origin}/bills/${billId}` : "";
}

export function vendorLink(vendorId: string): string {
  const origin = siteOrigin();
  return origin ? `\n${origin}/vendors/${vendorId}` : "";
}

// Best-effort activity ping for the demo owner; a missing webhook or a
// Discord outage must never break the mutation that triggered it.
export async function notifyDiscord(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Swallow — see comment above.
  }
}
