import { useEffect, useState } from "react";

import { getHealth } from "../services/health";
import type { HealthResponse } from "../types/health";

type HealthState = {
  data: HealthResponse | null;
  error: string | null;
  loading: boolean;
};

export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Health check failed";
          setState({ data: null, error: message, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
