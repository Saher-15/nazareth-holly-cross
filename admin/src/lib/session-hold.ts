// "Do not leave this page now": held while a live broadcast is on air or a recording is being uploaded
// (app/(app)/live/LiveStudio.tsx, RecordingUploads.tsx). The idle sign-out (components/shell/IdleGuard.tsx) would
// otherwise navigate away after 30 minutes without a touch, which ends the broadcast (a phone on a tripod is never
// touched during a Mass) and stops the upload. While a hold exists:
//   - being idle never signs the admin out (the warning does not open);
//   - when the 60-minute sign-in itself ends, the page stays: a notice asks the admin to sign in again in another tab
//     (the new cookie serves this tab too), and the page reloads once the hold is released.
// A hold never extends the sign-in on the server: calls made after it ended still answer 401.

type Listener = () => void;

const holds = new Set<symbol>();
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((listener) => listener());

/** Holds the session until the returned function is called (calling it twice is harmless). */
export function holdSession(): () => void {
  const token = Symbol('session-hold');
  holds.add(token);
  notify();
  return () => {
    if (holds.delete(token)) notify();
  };
}

export const sessionHeld = (): boolean => holds.size > 0;

export function onSessionHoldChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Releases every hold (tests). */
export function resetSessionHolds(): void {
  holds.clear();
  notify();
}
