import { ReactNode, useState } from "react";

export function Chevron({ open }: { open: boolean }) {
  return (
    <span className="inline-block w-3 text-gray-500 text-xs select-none">
      {open ? "▾" : "▸"}
    </span>
  );
}

interface CollapsiblePanelProps {
  title: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Card panel with a collapsible header (title inside the card).
 */
export function CollapsiblePanel({
  title,
  actions,
  defaultOpen = true,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">{title}</h3>
        </button>
        {actions}
      </div>
      {open && children}
    </div>
  );
}
