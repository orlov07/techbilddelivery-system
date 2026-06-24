import { useEffect, useRef } from 'react';

/**
 * Provides ESC-key close and focus management for modal dialogs.
 * Call at the top of the modal component and spread `dialogProps` onto the container div.
 */
export function useModalA11y(isOpen: boolean, onClose: () => void, labelId?: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember which element had focus before the modal opened
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the modal
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const firstFocusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable ?? el)?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }

      // Basic focus trap
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const dialogProps = {
    ref: containerRef,
    role: 'dialog' as const,
    'aria-modal': true,
    ...(labelId ? { 'aria-labelledby': labelId } : {}),
  };

  return { dialogProps };
}
