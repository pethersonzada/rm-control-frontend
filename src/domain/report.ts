import type { Occurrence } from "./types";

export function csv(records: Occurrence[]) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const prefix =
      /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text) ? "'" : "";
    return '"' + prefix + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Chamado",
      "Loja",
      "Carga",
      "BDV",
      "Motivo",
      "Status",
      "Inclusão",
      "Recebimento",
      "PLU",
      "Produto",
      "Quantidade",
      "Embalagem",
      "Valor informado",
    ],
    ...records.flatMap((record) =>
      (record.items.length ? record.items : [null]).map((item) => [
        record.code,
        record.destination,
        record.load,
        record.bdv,
        record.reason,
        record.status,
        record.included_at,
        record.received_at,
        item?.code,
        item?.description,
        item?.quantity,
        item?.package,
        item?.total,
      ]),
    ),
  ];
  return "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
}

export function downloadReport(records: Occurrence[]) {
  const url = URL.createObjectURL(
    new Blob([csv(records)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rm-control.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
