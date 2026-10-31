import { useHealth } from "../hooks/useHealth";

export function HomePage() {
  const { data, error, loading } = useHealth();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API foundation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Frontend and backend are separate applications. This page only reports the live
          health endpoint so you can confirm local setup. Feature screens are not stubbed.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-900">Backend health</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Checking /api/v1/health…</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-600">
            Could not reach the API. Start the FastAPI server, then refresh. {error}
          </p>
        ) : null}
        {data ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{data.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Service</dt>
              <dd className="font-medium">{data.service}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Version</dt>
              <dd className="font-medium">{data.version}</dd>
            </div>
            <div>
              <dt className="text-slate-500">MongoDB</dt>
              <dd className="font-medium">{data.mongodb.status}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
