import type { ReactNode } from 'react';
import { AlertIcon } from './icons';
import styles from './checkout.module.css';

type Props = {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

// Label + control + inline error. The control itself gets `{...invalidProps(id, error)}`
// so screen readers announce the error with the field.
export default function Field({ id, label, error, className = '', children }: Props) {
  return (
    <div className={`ui-field ${className}`}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className={`ui-error ${styles.fieldError}`}>
          <AlertIcon size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

export function invalidProps(id: string, error?: string) {
  return error ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};
}
