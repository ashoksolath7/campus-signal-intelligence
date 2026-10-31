import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Complaint } from "../../types/domain";
import { formatDay } from "../../utils/format";

export function TrendChart({ complaints }: { complaints: Complaint[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date("2026-10-30T12:00:00.000Z");
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const data = days.map((day) => ({
    day: formatDay(`${day}T00:00:00.000Z`),
    complaints: complaints.filter((complaint) => complaint.createdAt.slice(0, 10) === day).length,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="complaints" stroke="#1d4ed8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
