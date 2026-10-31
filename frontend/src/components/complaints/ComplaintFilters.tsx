import type { ComplaintStatus, Priority } from "../../types/domain";
import { Field, Select, TextInput } from "../ui/Field";

export type FilterState = {
  query: string;
  status: "all" | ComplaintStatus;
  priority: "all" | Priority;
};

export function ComplaintFilters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Field label="Search" htmlFor="filter-query">
        <TextInput
          id="filter-query"
          value={value.query}
          placeholder="Ticket, title, or student"
          onChange={(event) => onChange({ ...value, query: event.target.value })}
        />
      </Field>
      <Field label="Status" htmlFor="filter-status">
        <Select
          id="filter-status"
          value={value.status}
          onChange={(event) =>
            onChange({ ...value, status: event.target.value as FilterState["status"] })
          }
        >
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="in_review">In review</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
      </Field>
      <Field label="Priority" htmlFor="filter-priority">
        <Select
          id="filter-priority"
          value={value.priority}
          onChange={(event) =>
            onChange({ ...value, priority: event.target.value as FilterState["priority"] })
          }
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </Select>
      </Field>
    </div>
  );
}

export function matchesFilters(query: string, status: string, priority: string, complaint: {
  ticket: string;
  title: string;
  studentName: string;
  status: string;
  priority: string;
}): boolean {
  const haystack = `${complaint.ticket} ${complaint.title} ${complaint.studentName}`.toLowerCase();
  const queryOk = haystack.includes(query.trim().toLowerCase());
  const statusOk = status === "all" || complaint.status === status;
  const priorityOk = priority === "all" || complaint.priority === priority;
  return queryOk && statusOk && priorityOk;
}
