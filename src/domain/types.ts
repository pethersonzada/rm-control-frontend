export interface Item {
  category?: string | null;
  code: string;
  description: string;
  quantity: string;
  package: string;
  total: string | null;
  unit_value?: string | null;
}

export interface Occurrence {
  external_code?: string | null;
  revision?: number;
  source?: string;
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

export type ImportState = "new" | "updated" | "unchanged" | "conflicts";

export interface Preview {
  comparison?: Record<ImportState, number>;
  classifications?: {code: string; destination: string; state: ImportState}[];
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
  can_delegate_admin?: boolean;
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

export interface Member {
  uid: string;
  stores: string[];
  role: Identity["role"];
  active: boolean;
  owner?: boolean;
}

export interface Store {
  code: string;
  name: string;
  active: boolean;
}
export interface AccessRequest {
  uid: string;
  status: string;
  created_at: string;
}
export interface TicketInput {
  destination: string;
  origin: string;
  load: string;
  bdv: string | null;
  reason: string;
  received_at: string;
  external_code: string | null;
  items: Item[];
  invoices: { number: string; series: string }[];
}


export interface HistoryEvent {
  action: string;
  subject: string;
  previous_status: string | null;
  next_status: string | null;
  created_at: string;
  details: {revision?: number; fields?: string[]; items?: number; invoices?: number} | null;
}
export interface HistoryPage {
  events: HistoryEvent[];
  next_cursor: number | null;
}
