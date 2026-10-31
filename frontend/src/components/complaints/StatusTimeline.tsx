import type { Complaint } from "../../types/domain";
import { formatDate, statusLabel } from "../../utils/format";

export function StatusTimeline({ complaint }: { complaint: Complaint }) {
  if (!complaint.updates || complaint.updates.length === 0) {
    return (
      <div className="py-3 text-sm text-slate-500 italic">
        No status transitions recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {complaint.updates.map((update) => (
        <li key={`${update.at}-${update.status}`} className="border-l-2 border-brand-500 pl-4">
          <p className="text-sm font-medium text-navy-900">{statusLabel[update.status]}</p>
          {update.note ? <p className="text-sm text-slate-600">{update.note}</p> : null}
          <p className="mt-1 text-xs text-slate-400">
            {update.actor} · {formatDate(update.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
