import { useEffect, useRef, useState } from 'react';

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export function useAsyncAction() {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const execute = async <T>(asyncFn: () => Promise<T> | T) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setStatus('loading');
    setError(null);

    try {
      const result = await asyncFn();
      setStatus('success');
      timeoutRef.current = window.setTimeout(() => setStatus('idle'), 2000);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro inesperado.';
      setStatus('error');
      setError(message);
      throw err;
    }
  };

  const reset = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setStatus('idle');
    setError(null);
  };

  return { status, error, execute, reset };
}
