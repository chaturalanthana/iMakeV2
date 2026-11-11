import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';

let openDialog = null;

export function confirmDialog({ title = 'Please confirm', message, confirmText = 'Confirm', type = 'danger' }) {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(false);
      return;
    }
    openDialog({ mode: 'confirm', title, message, confirmText, type, resolve });
  });
}

export function promptDialog({ title = 'Enter a value', message, defaultValue = '', confirmText = 'Continue' }) {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(null);
      return;
    }
    openDialog({ mode: 'prompt', title, message, defaultValue, confirmText, type: 'primary', resolve });
  });
}

export function DialogHost() {
  const [state, setState] = useState(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    openDialog = (next) => {
      setValue(next.defaultValue || '');
      setState(next);
    };
    return () => {
      openDialog = null;
    };
  }, []);

  if (!state) return null;

  const close = (result) => {
    state.resolve(result);
    setState(null);
  };

  return (
    <ConfirmModal
      isOpen
      type={state.type}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      onClose={() => close(state.mode === 'prompt' ? null : false)}
      onConfirm={() => close(state.mode === 'prompt' ? value.trim() : true)}
    >
      {state.mode === 'prompt' && (
        <input
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          className="field-control"
          style={{ width: '100%', marginTop: '0.35rem', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
        />
      )}
    </ConfirmModal>
  );
}
