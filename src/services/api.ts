import type {
  Filters,
  Identity,
  Member,
  InventoryRequest,
  InventoryResult,
  Occurrence,
  Preview,
  RecordPage,
  Summary,
  Store,
  AccessRequest,
  TicketInput,
  HistoryPage,
  CatalogPage,
  CatalogProduct,
  SupplierCheck, SupplierCheckInput, SupplierFilters, SupplierPage, SupplierHistory,
  OperationalPolicy, FinanceReview, UnitReference, Diagnostics,
} from "../domain/types";
import { exact } from "../domain/money";

const environment = import.meta.env;
export const demo =
  import.meta.env.MODE === "demo" ||
  (import.meta.env.MODE !== "homologacao" &&
    import.meta.env.VITE_APP_MODE !== "operational");

function apiBase() {
  if (demo) throw new Error("A demonstração executa apenas no navegador.");
  const configured = environment.VITE_API_URL;
  if (!configured && environment.DEV) return "http://127.0.0.1:8000";
  if (!configured) throw new Error("Configure a URL da API de homologação.");
  const url = new URL(configured, window.location.origin);
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

const responseMessages: Record<number, string> = {
  401: "Sessão expirada. Entre novamente.",
  403: "Sua conta não tem permissão para esta operação.",
  429: "Muitas requisições. Aguarde e tente novamente.",
  503: "O servidor está iniciando ou temporariamente indisponível. Tente novamente em instantes.",
};

export class ApiError extends Error {
  constructor(
    public status: number,
    detail?: string,
  ) {
    super(
      (status === 403 && detail) ||
        responseMessages[status] ||
        detail ||
        `A API retornou HTTP ${status}.`,
    );
  }
}

async function result<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data?.detail === "string" ? data.detail : undefined,
    );
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

export function api(
  token: (force?: boolean) => Promise<string> | string,
  onUnauthorized?: (error: ApiError) => void,
) {
  async function request<T>(path: string, options: RequestInit = {}, binary = false) {
    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(90_000)])
      : AbortSignal.timeout(90_000);
    const headers = new Headers(options.headers);
    if (typeof options.body === "string")
      headers.set("Content-Type", "application/json");
    async function send(force = false) {
      const bearer = await token(force);
      if (!bearer) throw new ApiError(401);
      headers.set("Authorization", "Bearer " + bearer);
      try {
        return await fetch(apiBase() + path, {
          ...options,
          signal,
          headers,
          cache: "no-store",
          redirect: "error",
        });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (signal.aborted) throw new ApiError(503);
        throw new ApiError(
          0,
          "Falha de conexão com a API. Confira a rede e tente novamente.",
        );
      }
    }
    let response = await send();
    if (response.status === 401 && !signal.aborted) {
      try {
        response = await send(true);
      } catch (error) {
        if ((error as { code?: string })?.code === "auth/user-token-expired")
          onUnauthorized?.(new ApiError(401));
        throw error;
      }
    }
    if (response.status === 401) onUnauthorized?.(new ApiError(401));
    if (
      response.status === 403 &&
      response.headers.get("X-RM-Account-Denied") === "1"
    ) {
      onUnauthorized?.(
        new ApiError(403, "Conta sem autorização para acessar o RM Control."),
      );
    }
    if (binary && response.ok) return (await response.blob()) as T;
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
    if (data.comparison && ["new","updated","unchanged","conflicts"].some(key=>!Number.isSafeInteger(data.comparison![key as keyof typeof data.comparison]) || data.comparison![key as keyof typeof data.comparison]<0)) throw new Error("Comparação fora do formato esperado.");
    if (data.classifications && (!Array.isArray(data.classifications) || data.classifications.some(c=>typeof c.code!=="string"||typeof c.destination!=="string"||!["new","updated","unchanged","conflicts"].includes(c.state)))) throw new Error("Classificação fora do formato esperado.");
    return data;
  }

  function supplierParams(filters: SupplierFilters) {
    const {include_cancelled,from_date,to_date,...other}=filters;
    const params=new URLSearchParams({...other,include_cancelled:String(include_cancelled)});
    if(from_date)params.set('from_date',from_date);
    if(to_date)params.set('to_date',to_date);
    return params;
  }
  return {
    units: (code:string,signal?:AbortSignal)=>request<UnitReference[]>('/admin/units?code='+encodeURIComponent(code),{signal}),
    saveUnit: (data:UnitReference)=>request<UnitReference>('/admin/units',{method:'PUT',body:JSON.stringify(data)}),
    diagnostics: (signal?:AbortSignal)=>request<Diagnostics>('/admin/diagnostics',{signal}),
    policy: (signal?:AbortSignal)=>request<OperationalPolicy>('/admin/policy',{signal}),
    savePolicy: (data:OperationalPolicy)=>request<OperationalPolicy>('/admin/policy',{method:'PUT',body:JSON.stringify(data)}),
    finance: (record:Occurrence,signal?:AbortSignal)=>request<FinanceReview>('/occurrences/'+encodeURIComponent(record.code)+'/finance?store='+encodeURIComponent(record.destination),{signal}),
    saveFinance: (record:Occurrence,data:FinanceReview)=>request<FinanceReview>('/occurrences/'+encodeURIComponent(record.code)+'/finance?store='+encodeURIComponent(record.destination),{method:'PUT',body:JSON.stringify(data)}),
    supplierChecks: (filters:SupplierFilters,cursor:number,signal?:AbortSignal) => {const p=supplierParams(filters);p.set('cursor',String(cursor));return request<SupplierPage>('/supplier-checks?'+p,{signal});},
    createSupplierCheck: (data:SupplierCheckInput,key:string) => request<SupplierCheck>('/supplier-checks',{method:'POST',body:JSON.stringify(data),headers:{'Idempotency-Key':key}}),
    editSupplierCheck: (id:number,data:SupplierCheckInput,revision:number,active:boolean,change_reason:string) => request<SupplierCheck>('/supplier-checks/'+id,{method:'PUT',body:JSON.stringify({...data,revision,active,change_reason})}),
    supplierHistory: (id:number,cursor:number,signal?:AbortSignal) => request<SupplierHistory>('/supplier-checks/'+id+'/history?cursor='+cursor,{signal}),
    exportSuppliers: (filters:SupplierFilters,signal?:AbortSignal) => request<Blob>('/reports/fornecedores.xlsx?'+supplierParams(filters),{signal},true),
    catalog: (search: string, cursor = 0, code?: string, signal?: AbortSignal) => {
      const params = new URLSearchParams({search,cursor:String(cursor)});
      if(code) params.set('code',code);
      return request<CatalogPage>('/catalog?'+params,{signal});
    },
    saveProduct: (product: CatalogProduct) => request<CatalogProduct>('/admin/catalog',{method:'PUT',body:JSON.stringify(product)}),
    stores: (signal?: AbortSignal) => request<Store[]>("/stores", { signal }),
    saveStore: (store: Store) => request<Store>("/admin/stores", { method: "PUT", body: JSON.stringify(store) }),
    requestAccess: () => request<{ status: string }>("/access/request", { method: "POST" }),
    accessRequests: (signal?: AbortSignal) => request<AccessRequest[]>("/admin/access-requests", { signal }),
    rejectAccess: (uid: string) => request<{status: string}>("/admin/access-requests/" + encodeURIComponent(uid) + "/reject", { method: "POST" }),
    createTicket: (ticket: TicketInput, key: string) => request<Occurrence>("/tickets", {
      method: "POST", body: JSON.stringify(ticket), headers: {"Idempotency-Key": key},
    }),
    editTicket: (code: string, ticket: TicketInput, revision: number) => request<Occurrence>("/tickets/" + encodeURIComponent(code), {
      method: "PUT", body: JSON.stringify({...ticket, revision}),
    }),
    exportWorkbook: (filters: Filters, signal?: AbortSignal) => {
      const {from_date, to_date, include_tests, ...remaining} = filters;
      const params = new URLSearchParams({...remaining, include_tests: String(include_tests)});
      if (from_date) params.set("from_date", from_date);
      if (to_date) params.set("to_date", to_date);
      return request<Blob>("/reports/chamados.xlsx?" + params, {signal}, true);
    },
    users: (signal?: AbortSignal) =>
      request<Member[]>("/admin/users", { signal }),
    saveUser: (member: Member) =>
      request<Member>("/admin/users", {
        method: "PUT",
        body: JSON.stringify(member),
      }),
    me: async (signal?: AbortSignal) => {
      const identity = await request<Identity>("/me", { signal });
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
    clipboard: (text: string, code: string, signal: AbortSignal, store?: string) =>
      preview(
        "/imports/preview",
        JSON.stringify({ text, target_code: code || null, target_store: store || null }),
        signal,
      ),
    workbook: (
      file: File,
      sheet: string,
      partial: boolean,
      signal: AbortSignal,
      mapping?: Record<string, string>,
    ) => {
      const data = new FormData();
      data.append("file", file);
      if (sheet) data.append("sheet", sheet);
      data.append("skip_invalid", String(partial));
      if (mapping && Object.keys(mapping).length) data.append("mapping", JSON.stringify(mapping));
      return preview("/imports/workbook", data, signal);
    },
    confirm: (records: Occurrence[], key: string) =>
      request<{ saved: number }>("/imports/confirm", {
        method: "POST",
        body: JSON.stringify(records),
        headers: { "Idempotency-Key": key },
      }),
    history: (record: Occurrence, cursor: number, signal?: AbortSignal) => request<HistoryPage>(`/occurrences/${encodeURIComponent(record.code)}/history?store=${encodeURIComponent(record.destination)}&cursor=${cursor}`, {signal}),
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
