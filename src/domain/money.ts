// Use eight decimal places through aggregation and round to cents only for display.
const scale = 100_000_000n;
const integerPrinter = new Intl.NumberFormat("pt-BR");

export function exact(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,8})0*)?$/.exec(value);
  if (!match) throw new Error("Valor monetário inválido.");
  const [, negative, integer, fraction = ""] = match;
  return (
    (negative ? -1n : 1n) *
    (BigInt(integer) * scale + BigInt(fraction.padEnd(8, "0")))
  );
}

export function decimal(value: bigint): string {
  const magnitude = value < 0 ? -value : value;
  return `${value < 0 ? "-" : ""}${magnitude / scale}.${String(magnitude % scale).padStart(8, "0")}`;
}

export function money(value: string | null | undefined): string {
  if (value == null) return "—";
  const units = exact(value);
  const magnitude = units < 0 ? -units : units;
  const cents = (magnitude + 500_000n) / 1_000_000n;
  const sign = units < 0 && cents !== 0n ? "−" : "";
  return `${sign}R$ ${integerPrinter.format(cents / 100n)},${String(cents % 100n).padStart(2, "0")}`;
}
