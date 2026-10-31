import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Field, TextInput } from "../../components/ui/Field";
import { PreviewBanner } from "../../components/ui/PreviewBanner";
import { Spinner } from "../../components/ui/Spinner";
import { useCampusStore } from "../../context/CampusStore";
import { useHealth } from "../../hooks/useHealth";
import { apiBaseUrl } from "../../utils/env";
import { readJson, writeJson } from "../../utils/storage";

export function SettingsPage() {
  const { isLiveBackend, enablePreviewFallback, exitPreviewFallback, resetPreview } = useCampusStore();
  const { data, error, loading } = useHealth();
  const stored = readJson<{ campusName: string; supportEmail: string }>("settings");
  const [campusName, setCampusName] = useState(stored?.campusName ?? "Campus Signal Intelligence");
  const [supportEmail, setSupportEmail] = useState(stored?.supportEmail ?? "ops@campus.edu");
  const [saved, setSaved] = useState(false);
  const [modeNotice, setModeNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace preferences, MongoDB Atlas connection health, and database source configuration."
      />
      <PreviewBanner />

      {saved ? <Alert tone="success">Workspace settings saved locally.</Alert> : null}
      {modeNotice ? <Alert tone="info">{modeNotice}</Alert> : null}

      <Card>
        <CardHeader title="Database Connection & Health" description={`Backend endpoint: ${apiBaseUrl}`} />
        <CardBody className="space-y-3">
          {loading ? <Spinner label="Checking MongoDB health…" /> : null}
          {error ? <Alert tone="error">API connection error: {error}</Alert> : null}
          {data ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-semibold text-navy-900">{data.service} (v{data.version})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">FastAPI API Health:</span>
                <span className="font-semibold text-emerald-700">{data.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">MongoDB Atlas:</span>
                <span className={`font-semibold ${data.mongodb.status === "connected" ? "text-emerald-700" : "text-amber-700"}`}>
                  {data.mongodb.status} ({data.mongodb.database})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Source:</span>
                <span className="font-semibold text-navy-900">
                  {isLiveBackend ? "Live MongoDB Atlas Cluster" : "Explicit Demo Fallback Mode"}
                </span>
              </div>
            </div>
          ) : null}

          <div className="pt-2">
            {isLiveBackend ? (
              <Button
                variant="outline"
                onClick={() => {
                  enablePreviewFallback();
                  setModeNotice("Switched to Demo Fallback Mode (offline mock sample).");
                }}
              >
                Switch to Demo Fallback Mode
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  await exitPreviewFallback();
                  setModeNotice("Connected to Live MongoDB Atlas Database.");
                }}
              >
                Connect to Live MongoDB Database
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Workspace Details" />
        <CardBody>
          <form
            className="grid max-w-xl gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              writeJson("settings", { campusName, supportEmail });
              setSaved(true);
            }}
          >
            <Field label="Campus name" htmlFor="campusName">
              <TextInput
                id="campusName"
                value={campusName}
                onChange={(event) => setCampusName(event.target.value)}
              />
            </Field>
            <Field label="Support email" htmlFor="supportEmail">
              <TextInput
                id="supportEmail"
                value={supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
              />
            </Field>
            <div>
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {!isLiveBackend ? (
        <Card>
          <CardHeader
            title="Reset demo fallback data"
            description="Restores the local offline demo dataset back to original sample records."
          />
          <CardBody>
            <Button
              variant="danger"
              onClick={() => {
                resetPreview();
                setModeNotice("Local demo store restored to initial sample set.");
              }}
            >
              Reset sample dataset
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
