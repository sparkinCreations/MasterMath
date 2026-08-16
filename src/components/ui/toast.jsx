import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

// Monotonic counter rather than Date.now(): two toasts raised in the same
// millisecond (a status message plus a save warning, say) would otherwise
// share an id, colliding as React keys and dismissing each other.
let nextToastId = 0;

// Timing (WCAG 2.2.1 Timing Adjustable). Errors and warnings carry something
// the reader must act on, so they stay until dismissed. Success and info are
// confirmations and may auto-dismiss — but at a duration a slow reader can
// actually finish, and the countdown pauses while the toast is hovered or
// holds keyboard focus. Callers can still pass an explicit duration (0 keeps
// any toast open indefinitely).
const DEFAULT_DURATION = {
  success: 6000,
  info: 6000,
  warning: 0,
  error: 0,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = nextToastId++;
    const resolved = duration === undefined ? DEFAULT_DURATION[type] : duration;
    setToasts(prev => [...prev, { id, message, type, duration: resolved }]);
  }, []);

  const toast = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    info: (message, duration) => addToast(message, 'info', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(({ id, message, type, duration }) => (
          <Toast
            key={id}
            message={message}
            type={type}
            duration={duration}
            onClose={() => removeToast(id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ message, type, duration, onClose }) {
  // The auto-dismiss timer lives with the toast so it can be paused. Remaining
  // time is tracked across pauses, so a hover doesn't reset the clock.
  const remaining = useRef(duration);
  const startedAt = useRef(null);
  const timer = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    if (!timer.current) return;
    remaining.current -= Date.now() - startedAt.current;
    clear();
  }, [clear]);

  const resume = useCallback(() => {
    if (!duration || duration <= 0 || timer.current) return;
    if (remaining.current <= 0) {
      onCloseRef.current();
      return;
    }
    startedAt.current = Date.now();
    timer.current = setTimeout(() => {
      timer.current = null;
      onCloseRef.current();
    }, remaining.current);
  }, [duration]);

  useEffect(() => {
    resume();
    return clear;
  }, [resume, clear]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
  };

  const styles = {
    success: 'bg-green-50 dark:bg-green-950/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  };

  const iconStyles = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
  };

  // Errors and warnings interrupt (assertive); confirmations wait their turn.
  const isUrgent = type === 'error' || type === 'warning';

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border-2 shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${styles[type]}`}
    >
      <div className={iconStyles[type]} aria-hidden="true">
        {icons[type]}
      </div>
      <p className="font-medium text-sm">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="ml-2 rounded hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
