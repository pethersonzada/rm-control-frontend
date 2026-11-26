export interface Item {
  code: string;
  description: string;
  quantity: string;
  package: string;
  total: string | null;
  unit_value?: string | null;
}

export interface Occurrence {
  code: string;
  origin: string;
  destination: string;
  load: string;
  reason: string;
  status: string;
  included_at?: string | null;
  received_at?: string | null;
  approved_at?: string | null;
  bdv?: string | null;
  is_test?: boolean | null;
  due_at?: string;
  deadline_passed?: boolean;
  invoices?: { number: string; series: string }[];
  items: Item[];
}

export interface Preview {
  records: Occurrence[];
  warnings: string[];
  blocked?: boolean;
  counts?: {
    rows: number;
    invalid_rows: number;
    rows_without_value: number;
    omitted_rows: number;
  };
  sheet?: string;
}

export interface Filters {
  search: string;
  status: string;
  store: string;
  reason: string;
  date_field: "included" | "received";
  from_date: string;
  to_date: string;
  include_tests: boolean;
  order: "code_asc" | "code_desc";
}

export interface RecordPage {
  records: Occurrence[];
  next_cursor: number | null;
}

export interface Identity {
  subject: string;
  organization: string;
  stores: string[];
  role: "viewer" | "importer" | "admin";
}

export interface Summary {
  occurrences: number;
  items_without_value: number;
  status_counts: Record<string, number>;
  totals_by_reason: Record<string, string>;
  net_reported: string | null;
  approved: string | null;
  recovered: string | null;
  pending: string | null;
  note: string;
}

export interface InventoryRequest {
  destination: string;
  items: { code: string; quantity: string; value: string | null }[];
}

export interface InventoryResult {
  items: {
    code: string;
    inventory_quantity: string;
    inventory_value: string | null;
    pending: {
      occurrence: string;
      reason: string;
      quantity: string;
      package: string;
      total: string | null;
    }[];
  }[];
  note: string;
}

export const statuses = [
  "AGU. RECONFERENCIA",
  "AGU. ANALISE",
  "APROVADO",
  "REPROVADO",
  "CANCELADO",
  "PENDENTE",
  "EM ANALISE",
  "FORA DO PRAZO",
];

export const pending = new Set([
  "AGU. ANALISE",
  "AGU. RECONFERENCIA",
  "EM ANALISE",
  "PENDENTE",
  "FORA DO PRAZO",
]);
