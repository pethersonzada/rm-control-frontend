import type {
  Filters,
  Identity,
  InventoryRequest,
  InventoryResult,
  Occurrence,
  Preview,
  RecordPage,
  Summary,
} from "../domain/types";
import { exact } from "../domain/money";

const environment = import.meta.env;
export const demo =
  environment.MODE === "demo" || environment.VITE_APP_MODE !== "operational";

function apiBase() {
  if (demo) throw new Error("A demonstração executa apenas no navegador.");
  const configured = environment.VITE_API_URL;
  if (!configured && environment.DEV) return "http://127.0.0.1:8000";
  const url = new URL(configured || "/api", window.location.origin);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  ) {
    throw new Error("Configure uma API operacional HTTPS.");
  }
  return url.href.replace(/\/$/, "");
}

async function result<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `A API retornou HTTP ${response.status}.`,
    );
  }
  if (data === null) throw new Error("Resposta inválida da API.");
  return data as T;
}

function validateRecords(records: Occurrence[]) {
  if (!Array.isArray(records)) throw new Error("Lista de chamados inválida.");
  for (const entry of records) {
    if (
      !entry ||
      ![
        entry.code,
        entry.destination,
        entry.status,
        entry.reason,
        entry.origin,
        entry.load,
      ].every((value) => typeof value === "string") ||
      !Array.isArray(entry.items)
    ) {
      throw new Error("Chamado fora do formato esperado.");
    }
    for (const item of entry.items) {
      if (
        !item ||
        ![item.code, item.description, item.package, item.quantity].every(
          (value) => typeof value === "string",
        )
      ) {
        throw new Error("Item fora do formato esperado.");
      }
      if (item.total !== null) exact(item.total);
      if (item.unit_value != null) exact(item.unit_value);
    }
  }
}

export function api(token: string) {
  async function request<T>(path: string, options: RequestInit = {}) {
    if (!token) throw new Error("Informe a credencial individual.");
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + token);
    if (typeof options.body === "string")
      headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetch(apiBase() + path, {
        ...options,
        headers,
        cache: "no-store",
        redirect: "error",
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new Error(
        "Falha de conexão com a API. Confira o endereço e tente novamente.",
      );
    }
    return result<T>(response);
  }

  async function preview(path: string, body: BodyInit, signal?: AbortSignal) {
    const data = await request<Preview>(path, { method: "POST", body, signal });
    validateRecords(data.records);
    if (
      !Array.isArray(data.warnings) ||
      data.warnings.some((warning) => typeof warning !== "string")
    ) {
      throw new Error("Prévia fora do formato esperado.");
    }
    return data;
  }

  return {
    me: async () => {
      const identity = await request<Identity>("/me");
      if (
        typeof identity.subject !== "string" ||
        typeof identity.organization !== "string" ||
        !["viewer", "importer", "admin"].includes(identity.role) ||
        !Array.isArray(identity.stores) ||
        !identity.stores.every((store) => typeof store === "string")
      ) {
        throw new Error("Identidade fora do formato esperado.");
      }
      return identity;
    },
    records: async (filters: Filters, cursor: number, signal?: AbortSignal) => {
      const { from_date, to_date, include_tests, ...remaining } = filters;
      const params = new URLSearchParams({
        ...remaining,
        include_tests: String(include_tests),
        cursor: String(cursor),
      });
      if (from_date) params.set("from_date", from_date);
      if (to_date) params.set("to_date", to_date);
      const data = await request<RecordPage>("/occurrences?" + params, {
        signal,
      });
      validateRecords(data.records);
      if (
        data.next_cursor !== null &&
        (!Number.isSafeInteger(data.next_cursor) ||
          data.next_cursor < 1 ||
          data.next_cursor === cursor)
      ) {
        throw new Error("Paginação fora do formato esperado.");
      }
      return data;
    },
    summary: async (signal?: AbortSignal) => {
      const data = await request<Summary>("/summary", { signal });
      if (
        !Number.isSafeInteger(data.occurrences) ||
        !Number.isSafeInteger(data.items_without_value) ||
        !data.totals_by_reason ||
        !data.status_counts ||
        typeof data.note !== "string" ||
        Object.values(data.status_counts).some(
          (count) => !Number.isSafeInteger(count) || count < 0,
        )
      ) {
        throw new Error("Indicadores fora do formato esperado.");
      }
      for (const value of [
        ...Object.values(data.totals_by_reason),
        data.net_reported,
        data.approved,
        data.recovered,
        data.pending,
      ]) {
        if (value !== null) exact(value);
      }
      return data;
    },
    clipboard: (text: string, code: string, signal: AbortSignal) =>
      preview(
        "/imports/preview",
        JSON.stringify({ text, target_code: code || null }),
        signal,
      ),
    workbook: (
      file: File,
      sheet: string,
      partial: boolean,
      signal: AbortSignal,
    ) => {
      const data = new FormData();
      data.append("file", file);
      if (sheet) data.append("sheet", sheet);
      data.append("skip_invalid", String(partial));
      return preview("/imports/workbook", data, signal);
    },
    confirm: (records: Occurrence[], key: string) =>
      request<{ saved: number }>("/imports/confirm", {
        method: "POST",
        body: JSON.stringify(records),
        headers: { "Idempotency-Key": key },
      }),
    status: (record: Occurrence, status: string) =>
      request<Occurrence>(
        `/occurrences/${encodeURIComponent(record.code)}/status?store=${encodeURIComponent(record.destination)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, expected_status: record.status }),
        },
      ),
    reconcile: (input: InventoryRequest) =>
      request<InventoryResult>("/inventory/reconcile", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };
}
