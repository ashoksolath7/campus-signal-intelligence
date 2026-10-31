import { AlertCircle, RefreshCw } from "lucide-react";

import { useCampusStore } from "../../context/CampusStore";
import { Button } from "./Button";

export function PreviewBanner() {
  const { isLiveBackend, exitPreviewFallback, loading } = useCampusStore();

  if (isLiveBackend) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="font-semibold">Demo Fallback Mode</p>
          <p className="text-xs text-amber-800">
            Currently displaying local preview mock data. Changes will not be saved to MongoDB Atlas.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        disabled={loading}
        onClick={() => {
          exitPreviewFallback();
        }}
        className="self-start border-amber-400 bg-white text-xs text-amber-900 hover:bg-amber-100 sm:self-auto"
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Connect to Live MongoDB
      </Button>
    </div>
  );
}
