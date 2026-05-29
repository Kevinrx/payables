import { describe, it, expect } from "vitest";
import {
  paymentBucket,
  eligibleActions,
  canApply,
  PAYMENT_STATUS_DISPLAY,
} from "./payments";

const TODAY = "2026-05-29";

describe("paymentBucket", () => {
  it("routes paid and canceled to history", () => {
    expect(paymentBucket({ status: "paid", scheduledFor: "2026-05-01" }, TODAY)).toBe("history");
    expect(paymentBucket({ status: "canceled", scheduledFor: "2026-06-01" }, TODAY)).toBe("history");
  });

  it("routes failed to needs_review", () => {
    expect(paymentBucket({ status: "failed", scheduledFor: "2026-06-10" }, TODAY)).toBe("needs_review");
  });

  it("routes processing to pending", () => {
    expect(paymentBucket({ status: "processing", scheduledFor: "2026-05-20" }, TODAY)).toBe("pending");
  });

  it("routes future-dated scheduled to pending", () => {
    expect(paymentBucket({ status: "scheduled", scheduledFor: "2026-06-15" }, TODAY)).toBe("pending");
  });

  it("routes past-dated (stale) scheduled to needs_review", () => {
    expect(paymentBucket({ status: "scheduled", scheduledFor: "2026-05-01" }, TODAY)).toBe("needs_review");
  });

  it("treats a scheduled payment dated today as pending (boundary)", () => {
    expect(paymentBucket({ status: "scheduled", scheduledFor: TODAY }, TODAY)).toBe("pending");
  });

  it("treats a scheduled payment with no date as pending", () => {
    expect(paymentBucket({ status: "scheduled", scheduledFor: null }, TODAY)).toBe("pending");
  });
});

describe("eligibleActions", () => {
  it("offers the full set for scheduled", () => {
    expect(eligibleActions("scheduled").sort()).toEqual(
      ["cancel", "editDate", "markPaid", "release", "unschedule"].sort()
    );
  });

  it("offers markPaid + cancel for processing", () => {
    expect(eligibleActions("processing").sort()).toEqual(["cancel", "markPaid"].sort());
  });

  it("offers retry + cancel for failed", () => {
    expect(eligibleActions("failed").sort()).toEqual(["cancel", "retry"].sort());
  });

  it("offers nothing for terminal statuses", () => {
    expect(eligibleActions("paid")).toEqual([]);
    expect(eligibleActions("canceled")).toEqual([]);
  });
});

describe("canApply", () => {
  it("matches eligibleActions membership", () => {
    expect(canApply("release", "scheduled")).toBe(true);
    expect(canApply("release", "processing")).toBe(false);
    expect(canApply("retry", "failed")).toBe(true);
    expect(canApply("markPaid", "paid")).toBe(false);
  });
});

describe("PAYMENT_STATUS_DISPLAY", () => {
  it("has an entry for every status", () => {
    for (const s of ["scheduled", "processing", "paid", "failed", "canceled"] as const) {
      expect(PAYMENT_STATUS_DISPLAY[s]).toBeTruthy();
      expect(PAYMENT_STATUS_DISPLAY[s].cls).toMatch(/^pill-/);
    }
  });
});
