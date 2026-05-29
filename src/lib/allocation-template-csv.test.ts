import { describe, it, expect } from "vitest";
import { groupCsvRowsToTemplates, type TemplateCsvRow } from "./allocation-template-csv";

describe("groupCsvRowsToTemplates", () => {
  it("groups rows sharing a template_name and converts pct to bps", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Marketing 60/40", category: "Marketing", percentage: "60" },
      { template_name: "Marketing 60/40", category: "Sales", percentage: "40" },
    ];
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(errors).toEqual([]);
    expect(templates).toHaveLength(1);
    expect(templates[0]).toEqual({
      name: "Marketing 60/40",
      splits: [
        { category: "Marketing", department: null, glAccount: null, location: null, percentageBps: 6000 },
        { category: "Sales", department: null, glAccount: null, location: null, percentageBps: 4000 },
      ],
    });
  });

  it("carries multi-dimension fields and tolerates % signs and whitespace", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Eng", category: "Engineering / R&D", department: "Engineering", gl_account: "6100 · R&D", location: "Remote", percentage: "100%" },
    ];
    const { templates } = groupCsvRowsToTemplates(rows);
    expect(templates[0].splits[0]).toEqual({
      category: "Engineering / R&D",
      department: "Engineering",
      glAccount: "6100 · R&D",
      location: "Remote",
      percentageBps: 10000,
    });
  });

  it("merges non-contiguous rows with the same name (case-insensitive)", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Split", category: "A", percentage: "50" },
      { template_name: "Other", category: "X", percentage: "100" },
      { template_name: "split", category: "B", percentage: "50" },
    ];
    const { templates } = groupCsvRowsToTemplates(rows);
    const split = templates.find((t) => t.name.toLowerCase() === "split");
    expect(split?.splits).toHaveLength(2);
  });

  it("rejects a template whose percentages don't sum to 100%", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Bad", category: "A", percentage: "50" },
      { template_name: "Bad", category: "B", percentage: "30" },
    ];
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(templates).toHaveLength(0);
    expect(errors[0]).toContain("80%");
  });

  it("rejects a line missing a category", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Bad", category: "", percentage: "100" },
    ];
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(templates).toHaveLength(0);
    expect(errors[0]).toContain("category");
  });

  it("rejects a template exceeding the 150-line limit", () => {
    const rows: TemplateCsvRow[] = Array.from({ length: 151 }, (_, i) => ({
      template_name: "Huge",
      category: `Cat${i}`,
      percentage: "1",
    }));
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(templates).toHaveLength(0);
    expect(errors[0]).toContain("150");
  });

  it("keeps valid templates and reports invalid ones in the same batch", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Good", category: "A", percentage: "100" },
      { template_name: "Bad", category: "B", percentage: "70" },
    ];
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(templates.map((t) => t.name)).toEqual(["Good"]);
    expect(errors).toHaveLength(1);
  });
});
