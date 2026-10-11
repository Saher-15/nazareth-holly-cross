import type { MouseEvent } from 'react';

/**
 * onClick for a form <dialog>: a click on the backdrop closes it only while nothing was typed in it (review 04 finding
 * 8: a stray click outside "Add user" or "Mark resolved" threw the text away). Escape and the Cancel button still close
 * it. Confirm dialogs without a field (Feedback.tsx) keep closing on any click outside.
 */
export function closeOnBackdrop(typed: boolean) {
  return (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && !typed) event.currentTarget.close();
  };
}
