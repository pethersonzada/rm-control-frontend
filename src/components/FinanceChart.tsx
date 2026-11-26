import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "../domain/money";

export default function FinanceChart({
  totals,
  counts = false,
}: {
  totals: Record<string, string>;
  counts?: boolean;
}) {
  // The visual proportions use doubles. Exact decimals are used for labels and totals.
  const values = Object.entries(totals).map(([name, total]) => ({
    name,
    plotted: Number(total),
    total,
  }));
  return (
    <div className="chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={values} accessibilityLayer={false}>
          <CartesianGrid stroke="#dce3ec" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#364860", fontSize: 13 }} />
          <YAxis width={64} tick={{ fill: "#364860", fontSize: 12 }} />
          <Tooltip
            formatter={(_value, _name, entry) => [
              counts ? entry.payload.total : money(entry.payload.total),
              counts ? "Chamados" : "Valor informado",
            ]}
          />
          <Bar
            dataKey="plotted"
            fill="#175da9"
            maxBarSize={60}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
