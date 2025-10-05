import React, { createContext, useContext, useState, useCallback } from 'react';
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

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border-2 border-purple-200 p-6 max-w-md w-full mx-4 animate-in zoom-in-95">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-gray-300 hover:bg-gray-50"
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
