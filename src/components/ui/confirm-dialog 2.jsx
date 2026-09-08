import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        onConfirm: () => {
          resolve(true);
          setDialog(null);
        },
        onCancel: () => {
          resolve(false);
          setDialog(null);
        },
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && <ConfirmDialog {...dialog} />}
    </ConfirmContext.Provider>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;
  const messageId = `${id}-message`;

  // Move focus into the dialog on open and hand it back to whatever opened
  // it on close, so a keyboard user isn't dropped at the top of the page.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    // Cancel is the safe default for a destructive confirmation.
    cancelRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  // Escape dismisses; Tab is trapped inside the panel.
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-indigo-200 dark:border-gray-700 p-6 max-w-md w-full mx-4 animate-in zoom-in-95"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
            <p id={messageId} className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            ref={cancelRef}
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-gray-300 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
}
