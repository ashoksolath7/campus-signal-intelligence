import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Complaint, Priority } from "../../types/domain";
import { priorityLabel } from "../../utils/format";

const order: Priority[] = ["low", "medium", "high", "critical"];

export function PriorityChart({ complaints }: { complaints: Complaint[] }) {
  const data = order.map((priority) => ({
    name: priorityLabel[priority],
    count: complaints.filter((complaint) => complaint.priority === priority).length,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#0b1f3a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
