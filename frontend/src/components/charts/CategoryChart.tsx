import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { Complaint } from "../../types/domain";
import { categoryLabel } from "../../utils/format";
import { chartColors } from "./chartTheme";

export function CategoryChart({ complaints }: { complaints: Complaint[] }) {
  const data = Object.entries(
    complaints.reduce<Record<string, number>>((acc, complaint) => {
      acc[complaint.category] = (acc[complaint.category] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([key, value]) => ({ name: categoryLabel[key as keyof typeof categoryLabel], value }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
