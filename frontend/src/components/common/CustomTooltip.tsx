import React, { useState, useEffect, useRef } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipState {
  text: string;
  x: number;
  y: number;
  transform: string;
  position: TooltipPosition;
  visible: boolean;
}

export const GlobalTooltip: React.FC = () => {
  const [state, setState] = useState<TooltipState>({
    text: '',
    x: 0,
    y: 0,
    transform: '',
    position: 'top',
    visible: false
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[title], [data-tooltip]') as HTMLElement | null;

      if (!target) return;

      // Extract tooltip text and strip native title to prevent default browser tooltip
      let text = target.getAttribute('data-tooltip');
      const nativeTitle = target.getAttribute('title');

      if (nativeTitle) {
        text = nativeTitle;
        target.setAttribute('data-tooltip', nativeTitle);
        target.removeAttribute('title'); // Prevents ugly default OS/browser tooltip
      }

      if (!text || text.trim() === '') return;

      currentTargetRef.current = target;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        if (!currentTargetRef.current) return;

        const rect = target.getBoundingClientRect();
        let pos = target.getAttribute('data-tooltip-position') as TooltipPosition | null;

        // Auto-detect optimal position based on element placement
        if (!pos) {
          if (rect.left < 220 && rect.width < 320) {
            pos = 'right';
          } else if (rect.top < 90) {
            pos = 'bottom';
          } else if (window.innerHeight - rect.bottom < 80) {
            pos = 'top';
          } else {
            pos = 'top';
          }
        }

        let x = 0;
        let y = 0;
        let transform = '';

        switch (pos) {
          case 'right':
            x = rect.right + 10;
            y = rect.top + rect.height / 2;
            transform = 'translate(0, -50%)';
            break;
          case 'left':
            x = rect.left - 10;
            y = rect.top + rect.height / 2;
            transform = 'translate(-100%, -50%)';
            break;
          case 'bottom':
            x = rect.left + rect.width / 2;
            y = rect.bottom + 8;
            transform = 'translate(-50%, 0)';
            break;
          case 'top':
          default:
            x = rect.left + rect.width / 2;
            y = rect.top - 8;
            transform = 'translate(-50%, -100%)';
            pos = 'top';
            break;
        }

        // Viewport bounds safety
        x = Math.max(12, Math.min(x, window.innerWidth - 12));

        setState({
          text,
          x,
          y,
          transform,
          position: pos,
          visible: true
        });
      }, 70); // Crisp 70ms response time
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (currentTargetRef.current && currentTargetRef.current.contains(related)) {
        return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      currentTargetRef.current = null;
      setState((prev) => ({ ...prev, visible: false }));
    };

    const handleHide = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      currentTargetRef.current = null;
      setState((prev) => ({ ...prev, visible: false }));
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    window.addEventListener('scroll', handleHide, true);
    window.addEventListener('resize', handleHide);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      window.removeEventListener('scroll', handleHide, true);
      window.removeEventListener('resize', handleHide);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!state.visible && !state.text) return null;

  return (
    <div
      className="fixed z-[999999] pointer-events-none transition-all duration-150 ease-out"
      style={{
        left: `${state.x}px`,
        top: `${state.y}px`,
        transform: state.transform,
        opacity: state.visible ? 1 : 0,
        visibility: state.visible ? 'visible' : 'hidden'
      }}
    >
      <div className="relative px-2 py-0.5 rounded-sm bg-slate-900/95 dark:bg-cyber-900/95 text-slate-100 dark:text-slate-100 text-[10px] font-mono font-medium shadow-2xl border border-slate-700/80 dark:border-cyber-600/80 backdrop-blur-sm whitespace-nowrap flex items-center space-x-1.5">
        {/* Subtle Cyber Blue status dot */}
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-xs shadow-blue-500/60 flex-shrink-0"></span>
        <span className="leading-none">{state.text}</span>
      </div>
    </div>
  );
};

export const Tooltip: React.FC<{
  content: string;
  position?: TooltipPosition;
  children: React.ReactNode;
  className?: string;
}> = ({ content, position = 'top', children, className = '' }) => {
  return (
    <span
      data-tooltip={content}
      data-tooltip-position={position}
      className={`inline-block ${className}`}
    >
      {children}
    </span>
  );
};
