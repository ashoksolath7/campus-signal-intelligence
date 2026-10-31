import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-navy-900">Page not found</h1>
      <p className="text-sm text-slate-500">That route is not part of the Campus Signal Intelligence UI.</p>
      <Link to="/">
        <Button>Back to home</Button>
      </Link>
    </section>
  );
}
