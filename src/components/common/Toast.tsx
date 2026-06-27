import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, ToastType } from '../../store/toastStore';
import { cn } from '../../lib/utils';

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    case 'info':
    default:
      return <Info className="w-4 h-4 text-blue-400" />;
  }
}

function getToastStyles(type: ToastType) {
  switch (type) {
    case 'success':
      return 'border-green-500/50 bg-green-500/10';
    case 'error':
      return 'border-red-500/50 bg-red-500/10';
    case 'warning':
      return 'border-yellow-500/50 bg-yellow-500/10';
    case 'info':
    default:
      return 'border-blue-500/50 bg-blue-500/10';
  }
}

function ToastItem({ toast }: { toast: { id: string; type: ToastType; message: string; duration: number } }) {
  const { removeToast } = useToastStore();

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded border backdrop-blur-sm shadow-lg min-w-[280px] max-w-[400px] animate-in slide-in-from-right-5 fade-in duration-200',
        getToastStyles(toast.type)
      )}
    >
      <ToastIcon type={toast.type} />
      <p className="text-sm text-slate-200 flex-1 break-words">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
