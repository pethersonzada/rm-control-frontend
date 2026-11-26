import { describe, expect, it } from "vitest";
import { decimal, exact, money } from "./money";
import { csv } from "./report";
import { demoPreview } from "../services/demo";

describe("relatórios", () => {
  it("soma decimais sem perda e arredonda apenas a exibição", () => {
    expect(decimal(exact("0.1") + exact("0.2"))).toBe("0.30000000");
    expect(money("-10000000000000.015")).toBe("−R$ 10.000.000.000.000,02");
    expect(money(null)).toBe("—");
  });

  it("neutraliza fórmulas no CSV, inclusive após espaços", () => {
    const record = { ...demoPreview("list").records[0], reason: "  =SUM(1)" };
    const exported = csv([record]);
    expect(exported).toContain('"\'  =SUM(1)"');
    expect(exported).toContain("Inclusão");
    expect(exported).toContain("Recebimento");
  });
});
