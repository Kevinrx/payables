import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyDiscord, billLink, vendorLink } from "./discord";

describe("notifyDiscord", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is a no-op and never calls fetch when DISCORD_WEBHOOK_URL is unset", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    await notifyDiscord("hello");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the message to the webhook when the url is set", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 204 }));

    await notifyDiscord("new bill created");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/test");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ content: "new bill created" });
  });

  it("swallows a fetch rejection without throwing", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));

    await expect(notifyDiscord("hello")).resolves.toBeUndefined();
  });
});

describe("billLink / vendorLink", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an empty string when no Vercel URL env var is set", () => {
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(billLink("bill-1")).toBe("");
    expect(vendorLink("vendor-1")).toBe("");
  });

  it("prefers VERCEL_PROJECT_PRODUCTION_URL over VERCEL_URL", () => {
    vi.stubEnv("VERCEL_URL", "deployment-abc.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "payables.vercel.app");
    expect(billLink("bill-1")).toBe("\nhttps://payables.vercel.app/bills/bill-1");
  });

  it("falls back to VERCEL_URL when the production url is unset", () => {
    vi.stubEnv("VERCEL_URL", "deployment-abc.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(vendorLink("vendor-1")).toBe("\nhttps://deployment-abc.vercel.app/vendors/vendor-1");
  });
});
