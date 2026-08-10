import type { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  widthClass?: string;
}

export default function Modal({ children, onClose, widthClass = "max-w-md" }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-ink-950/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-t-xl2 sm:rounded-xl2 shadow-card w-full ${widthClass} p-6 sm:p-8 max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
