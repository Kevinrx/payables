import { describe, it, expect } from "vitest";
import { containsProfanity, findProfaneField } from "./content-filter";

describe("containsProfanity", () => {
  it("passes clean text", () => {
    expect(containsProfanity("Acme Cloud Services, Inc.")).toBe(false);
    expect(containsProfanity("Net 30. Wire instructions on file.")).toBe(false);
  });

  it("catches an obvious profane word", () => {
    expect(containsProfanity("what the fuck")).toBe(true);
  });

  it("catches a leetspeak/duplicate-letter evasion", () => {
    expect(containsProfanity("fu.....uuuuCK")).toBe(true);
  });

  it("treats null, undefined, and empty string as clean", () => {
    expect(containsProfanity(null)).toBe(false);
    expect(containsProfanity(undefined)).toBe(false);
    expect(containsProfanity("")).toBe(false);
  });
});

describe("findProfaneField", () => {
  it("returns null when every field is clean", () => {
    expect(
      findProfaneField({ "vendor name": "Acme Cloud", notes: "Net 30" })
    ).toBeNull();
  });

  it("returns the label of the first profane field", () => {
    expect(
      findProfaneField({
        "vendor name": "Acme Cloud",
        notes: "what the fuck is this bill",
      })
    ).toBe("notes");
  });

  it("ignores null/undefined fields", () => {
    expect(
      findProfaneField({ "vendor name": null, notes: undefined })
    ).toBeNull();
  });
});
