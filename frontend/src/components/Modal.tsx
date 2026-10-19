import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
}
export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-xl",
}: ModalProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || !isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
      className={`sentinel-dialog w-[calc(100%-2rem)] ${maxWidth} bg-[#191a1d] border border-zinc-700 rounded-lg p-6 text-zinc-100 shadow-2xl`}
    >
      <div className="flex items-start justify-between pb-4 border-b border-zinc-800 mb-5 gap-4">
        <div>
          <h3
            id={titleId}
            className="text-lg font-medium text-white tracking-tight"
          >
            {title}
          </h3>
          {description && (
            <p
              id={descriptionId}
              className="text-xs text-zinc-400 mt-2 leading-relaxed"
            >
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="icon-button"
        >
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto pr-1">{children}</div>
    </dialog>
  );
};
