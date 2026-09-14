import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const [previousFocus] = useState(
    () => document.activeElement as HTMLElement | null,
  );
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={`dialog-content ${wide ? "dialog-wide" : ""}`}
          onCloseAutoFocus={(event) => {
            const candidates = [
              previousFocus,
              ...document.querySelectorAll<HTMLElement>(
                '[data-selected="true"]',
              ),
              document.querySelector<HTMLElement>(
                '[aria-label="Create new shot"]',
              ),
            ];
            const trigger = candidates.find(
              (element) =>
                element?.isConnected && element.getClientRects().length > 0,
            );
            if (trigger) {
              event.preventDefault();
              trigger.focus();
            }
          }}
        >
          <div className="dialog-heading">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description
                className={description ? "muted" : "sr-only"}
              >
                {description || title}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="button button-ghost button-icon"
              aria-label="Close dialog"
            >
              <X size={18} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
