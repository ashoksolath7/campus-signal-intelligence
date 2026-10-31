import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatusTimeline } from "../../components/complaints/StatusTimeline";
import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Field, TextInput } from "../../components/ui/Field";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useCampusStore } from "../../context/CampusStore";
import { getComplaintsApi } from "../../services/complaints";
import type { Complaint } from "../../types/domain";

export function StatusTrackingPage() {
  const { user } = useAuth();
  const { complaints } = useCampusStore();
  const [ticket, setTicket] = useState("");
  const [lookup, setLookup] = useState("");
  const [remoteFound, setRemoteFound] = useState<Complaint | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const mine = useMemo(
    () => complaints.filter((complaint) => complaint.studentId === user?.id),
    [complaints, user?.id],
  );

  const localFound = useMemo(() => {
    if (!lookup) return null;
    return mine.find(
      (complaint) =>
        complaint.ticket.toLowerCase() === lookup.trim().toLowerCase() ||
        complaint.id.toLowerCase() === lookup.trim().toLowerCase(),
    ) ?? null;
  }, [lookup, mine]);

  const found = localFound ?? remoteFound;

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const query = ticket.trim();
    if (!query) return;

    setLookup(query);
    setHasSearched(true);
    setRemoteFound(null);

    // If not found in local state, query MongoDB API
    const match = mine.find(
      (c) =>
        c.ticket.toLowerCase() === query.toLowerCase() ||
        c.id.toLowerCase() === query.toLowerCase(),
    );
    if (!match) {
      setIsSearching(true);
      try {
        const results = await getComplaintsApi({ query });
        if (results.length > 0) {
          setRemoteFound(results[0]);
        }
      } catch {
        // Search error handled by not found state
      } finally {
        setIsSearching(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status tracking"
        description="Look up any of your tickets to inspect the real-time workflow step."
      />
      <Card>
        <CardBody>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleTrack}>
            <div className="flex-1">
              <Field label="Ticket ID or Internal ID" htmlFor="ticket">
                <TextInput
                  id="ticket"
                  value={ticket}
                  placeholder="e.g. CSI-2401"
                  onChange={(event) => setTicket(event.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" disabled={isSearching} className="w-full sm:w-auto min-h-[44px] justify-center">
              {isSearching ? "Searching…" : "Track ticket"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {isSearching ? (
        <div className="flex justify-center py-6">
          <Spinner label="Searching live database…" />
        </div>
      ) : null}

      {hasSearched && !isSearching && !found ? (
        <Alert tone="error">No matching ticket found for '{lookup}'. Check the ID and try again.</Alert>
      ) : null}

      {found ? (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-navy-900">{found.ticket}</h2>
              <StatusBadge status={found.status} />
              <PriorityBadge priority={found.priority} />
            </div>
            <p className="text-sm text-slate-600">{found.title}</p>
            <StatusTimeline complaint={found} />
            <Link to={`/student/complaints/${found.id}`} className="block sm:inline-block">
              <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">Open complaint details</Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      {mine.length > 0 ? (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-navy-900">Your recent tickets</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {mine.map((complaint) => (
                <li key={complaint.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    className="text-left font-medium text-brand-600 hover:underline"
                    onClick={() => {
                      setTicket(complaint.ticket);
                      setLookup(complaint.ticket);
                      setHasSearched(true);
                      setRemoteFound(null);
                    }}
                  >
                    {complaint.ticket} — {complaint.title}
                  </button>
                  <StatusBadge status={complaint.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
