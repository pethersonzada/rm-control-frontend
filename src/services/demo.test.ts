import { beforeEach, expect, it } from "vitest";
import type { Filters } from "../domain/types";
import { demoRecords, demoReset, demoSave, demoSummary } from "./demo";

const empty: Filters = {
  search: "",
  status: "",
  store: "",
  reason: "",
  date_field: "included",
  from_date: "",
  to_date: "",
  include_tests: false,
  order: "code_asc",
};

beforeEach(() => localStorage.clear());

it("persiste apenas IDs sintéticos, atualiza detalhes e ignora o cache anterior", () => {
  localStorage.setItem(
    "rm-control-demo-v1",
    JSON.stringify([{ code: "not-rendered" }]),
  );
  expect(demoRecords(empty, 0).records).toHaveLength(0);
  demoSave("list");
  demoSave("details");
  demoSave("list");
  expect(localStorage.getItem("rm-control-demo-v2")).toBe('["list","details"]');
  expect(demoRecords(empty, 0).records).toHaveLength(1);
  expect(demoSummary().net_reported).toBe("-20.10000000");
  demoReset();
  expect(localStorage.getItem("rm-control-demo-v1")).toBeNull();
  expect(demoRecords(empty, 0).records).toHaveLength(0);
});

it("distingue datas de inclusão e recebimento", () => {
  demoSave("list");
  demoSave("history");
  expect(
    demoRecords(
      { ...empty, from_date: "2026-01-01", date_field: "received" },
      0,
    ).records.map((r) => r.code),
  ).toEqual(["90002"]);
  expect(
    demoRecords(
      { ...empty, from_date: "2026-01-01", date_field: "included" },
      0,
    ).records.map((r) => r.code),
  ).toEqual(["90001"]);
});
