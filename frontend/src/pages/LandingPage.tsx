import { ArrowRight, Shield, Signal, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useHealth } from "../hooks/useHealth";

export function LandingPage() {
  const { data, error, loading } = useHealth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <p className="text-sm font-semibold text-navy-900">Campus Signal Intelligence</p>
          <div className="flex gap-2">
            <Link to="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button>Register</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-12">
        <section className="max-w-3xl space-y-4">
          <p className="text-sm font-medium text-brand-600">Intelligent Campus Operations</p>
          <h1 className="text-4xl font-semibold tracking-tight text-navy-900">
            Route student issues to the right campus team.
          </h1>
          <p className="text-base leading-7 text-slate-600">
            A student portal for submitting and tracking complaints, and an admin portal for
            priority, duplicates, analytics, and department operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/login" className="w-full sm:w-auto">
              <Button icon={<ArrowRight className="h-4 w-4" />} className="w-full sm:w-auto min-h-[44px] justify-center">Open student portal</Button>
            </Link>
            <Link to="/login?portal=admin" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto min-h-[44px] justify-center">Open admin portal</Button>
            </Link>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <Users className="h-5 w-5 text-brand-600" />
            <h2 className="mt-3 font-semibold text-navy-900">Student portal</h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit complaints, review history, and follow status updates.
            </p>
          </Card>
          <Card className="p-5">
            <Shield className="h-5 w-5 text-brand-600" />
            <h2 className="mt-3 font-semibold text-navy-900">Admin portal</h2>
            <p className="mt-1 text-sm text-slate-500">
              Triage priority, group duplicates, and manage departments and users.
            </p>
          </Card>
          <Card className="p-5">
            <Signal className="h-5 w-5 text-brand-600" />
            <h2 className="mt-3 font-semibold text-navy-900">Live API health</h2>
            <p className="mt-1 text-sm text-slate-500">
              The existing FastAPI health endpoint is the live backend signal.
            </p>
          </Card>
        </section>
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-navy-900">Backend health</h2>
            {loading ? <div className="mt-3"><Spinner label="Checking /api/v1/health…" /></div> : null}
            {error ? (
              <p className="mt-3 text-sm text-rose-600">Could not reach the API. {error}</p>
            ) : null}
            {data ? (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium">{data.status}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Service</dt>
                  <dd className="font-medium">{data.service}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">MongoDB</dt>
                  <dd className="font-medium">{data.mongodb.status}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Database</dt>
                  <dd className="font-medium">{data.mongodb.database ?? "unknown"}</dd>
                </div>
              </dl>
            ) : null}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
