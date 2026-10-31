import type { ReactNode } from "react";

import { Button } from "./Button";

export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
          <Button variant="ghost" onClick={onClose} className="min-h-[44px] sm:min-h-0">
            Close
          </Button>
        </div>
        {children}
        {footer ? <div className="mt-4 flex flex-col-reverse sm:flex-row justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
