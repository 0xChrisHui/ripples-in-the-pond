import { useEffect, type RefObject } from 'react';

export function useMintDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  closeRef: RefObject<() => void>,
  busyRef: RefObject<boolean>,
): void {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); first.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); last.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [busyRef, closeRef, dialogRef]);
}
