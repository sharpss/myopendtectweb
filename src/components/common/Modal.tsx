import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  width?: string;
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, className, width = 'max-w-2xl', footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div 
        ref={modalRef}
        className={cn(
          'relative bg-slate-800 border border-slate-700 rounded-lg shadow-2xl',
          'w-full mx-4 flex flex-col max-h-[90vh]',
          width,
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
        
        {footer && (
          <div className="px-4 py-3 border-t border-slate-700 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
