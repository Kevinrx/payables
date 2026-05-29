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
      { template_name: "Split", category: "Marketing", percentage: "50" },
      { template_name: "Other", category: "Operations", percentage: "100" },
      { template_name: "split", category: "Sales", percentage: "50" },
    ];
    const { templates } = groupCsvRowsToTemplates(rows);
    const split = templates.find((t) => t.name.toLowerCase() === "split");
    expect(split?.splits).toHaveLength(2);
  });

  it("rejects a template whose percentages don't sum to 100%", () => {
    const rows: TemplateCsvRow[] = [
      { template_name: "Bad", category: "Marketing", percentage: "50" },
      { template_name: "Bad", category: "Sales", percentage: "30" },
    ];
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(templates).toHaveLength(0);
    expect(errors[0]).toContain("80%");
  });

  it("rejects category or dimension values not in the chart-of-accounts lists", () => {
    const badCategory = groupCsvRowsToTemplates([
      { template_name: "Weird", category: "Totally Made Up", percentage: "100" },
    ]);
    expect(badCategory.templates).toHaveLength(0);
    expect(badCategory.errors[0]).toContain("Unknown category");

    const badDept = groupCsvRowsToTemplates([
      { template_name: "Weird", category: "Marketing", department: "Growth", percentage: "100" },
    ]);
    expect(badDept.templates).toHaveLength(0);
    expect(badDept.errors[0]).toContain("Unknown department");
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
      { template_name: "Good", category: "Marketing", percentage: "100" },
      { template_name: "Bad", category: "Sales", percentage: "70" },
    ];
    const { templates, errors } = groupCsvRowsToTemplates(rows);
    expect(templates.map((t) => t.name)).toEqual(["Good"]);
    expect(errors).toHaveLength(1);
  });
});
