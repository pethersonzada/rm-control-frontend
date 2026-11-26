import { decimal, exact } from "../domain/money";
import {
  pending,
  type Filters,
  type InventoryRequest,
  type InventoryResult,
  type Occurrence,
  type Preview,
} from "../domain/types";

const storageKey = "rm-control-demo-v2";
const legacyKey = "rm-control-demo-v1";
const primary: Occurrence = {
  code: "90001",
  origin: "001-CD EXEMPLO",
  destination: "002-LOJA EXEMPLO",
  load: "100001",
  reason: "FALTA",
  included_at: "01/01/2026 10:00:00",
  status: "AGU. ANALISE",
  items: [
    {
      code: "100",
      description: "PRODUTO FICTÍCIO",
      quantity: "2",
      package: "CX-12",
      total: null,
    },
  ],
};
const detailed: Occurrence = {
  ...primary,
  bdv: "321",
  status: "APROVADO",
  invoices: [{ number: "501", series: "1" }],
  items: [{ ...primary.items[0], unit_value: "10.05", total: "20.10" }],
};
const historical: Occurrence = {
  ...primary,
  code: "90002",
  load: "",
  included_at: null,
  received_at: "02/01/2026",
  reason: "SOBRA",
  status: "PENDENTE",
  items: [
    {
      code: "100",
      description: "PRODUTO FICTÍCIO",
      quantity: "1",
      package: "UN-1",
      total: "8.35",
    },
  ],
};

export const scenarios = {
  list: { label: "Listagem de chamados", record: primary },
  details: { label: "Detalhamento e atualização de status", record: detailed },
  history: { label: "Histórico de planilha", record: historical },
};
export type Scenario = keyof typeof scenarios;

export function demoPreview(scenario: Scenario): Preview {
  return {
    records: [scenarios[scenario].record],
    warnings:
      scenario === "list"
        ? ["O valor informado fica em branco até a importação do detalhamento."]
        : [],
  };
}

function selected(): Scenario[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "O armazenamento da demo precisa ser limpo para continuar.",
    );
  }
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) => typeof item === "string" && Object.hasOwn(scenarios, item),
    )
  ) {
    throw new Error(
      "O armazenamento da demo precisa ser limpo para continuar.",
    );
  }
  return value;
}

export function demoSave(scenario: Scenario) {
  const saved = new Set(selected()).add(scenario);
  localStorage.setItem(storageKey, JSON.stringify([...saved]));
  return { saved: 1 };
}

export function demoReset() {
  localStorage.removeItem(legacyKey);
  localStorage.removeItem(storageKey);
}

function records() {
  const values = selected();
  return [
    values.includes("details")
      ? detailed
      : values.includes("list")
        ? primary
        : null,
    values.includes("history") ? historical : null,
  ].filter((item): item is Occurrence => item !== null);
}

function matchesDate(record: Occurrence, filters: Filters) {
  if (!filters.from_date && !filters.to_date) return true;
  const source =
    filters.date_field === "received" ? record.received_at : record.included_at;
  if (!source) return false;
  const [day, month, year] = source.split(" ")[0].split("/");
  const date = [year, month, day].join("-");
  return (
    (!filters.from_date || date >= filters.from_date) &&
    (!filters.to_date || date <= filters.to_date)
  );
}

export function demoRecords(filters: Filters, cursor: number) {
  const search = filters.search.trim().toLocaleLowerCase("pt-BR");
  const result = records().filter(
    (record) =>
      (!filters.status || record.status === filters.status) &&
      (!filters.reason || record.reason === filters.reason) &&
      matchesDate(record, filters) &&
      (!filters.store || record.destination === filters.store) &&
      [
        record.code,
        record.load,
        record.destination,
        record.reason,
        ...record.items.flatMap((item) => [item.code, item.description]),
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(search)),
  );
  if (filters.order === "code_desc") result.reverse();
  return { records: result.slice(cursor), next_cursor: null };
}

export function demoSummary() {
  const source = records();
  const totals = { FALTA: 0n, SOBRA: 0n, AVARIA: 0n };
  let missing = 0;
  const counts: Record<string, number> = {};
  for (const record of source) {
    counts[record.status] = (counts[record.status] || 0) + 1;
    for (const item of record.items) {
      if (item.total === null) missing++;
      else totals[record.reason as keyof typeof totals] += exact(item.total);
    }
  }
  return {
    occurrences: source.length,
    items_without_value: missing,
    status_counts: counts,
    totals_by_reason: Object.fromEntries(
      Object.entries(totals).map(([reason, value]) => [reason, decimal(value)]),
    ),
    net_reported: decimal(totals.SOBRA - totals.FALTA - totals.AVARIA),
    approved: null,
    recovered: null,
    pending: null,
    note: "Os indicadores usam valores sintéticos informados.",
  };
}

export const demoInventoryInput: InventoryRequest = {
  destination: primary.destination,
  items: [{ code: "100", quantity: "2", value: "19.90" }],
};

export function demoInventory(): InventoryResult {
  const [item] = demoInventoryInput.items;
  const matches = records().filter((record) => pending.has(record.status));
  return {
    items: [
      {
        code: item.code,
        inventory_quantity: item.quantity,
        inventory_value: item.value,
        pending: matches.flatMap((record) =>
          record.items
            .filter((product) => product.code === item.code)
            .map((product) => ({
              occurrence: record.code,
              reason: record.reason,
              quantity: product.quantity,
              package: product.package,
              total: product.total,
            })),
        ),
      },
    ],
    note: "Conferência sintética por loja e PLU. Cada embalagem mantém sua unidade de origem.",
  };
}
