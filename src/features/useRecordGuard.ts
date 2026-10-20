import { useEffect, useRef } from 'react';
import type { FeatureProps } from '../types';

/** Unsaved form values stay in memory; they never enter shared browser storage. */
export function useRecordGuard(dirty: boolean, busy: boolean, onChange: FeatureProps['onUnsavedChange']) {
  const handler = useRef(onChange);
  handler.current = onChange;
  useEffect(() => { handler.current?.(dirty, busy); }, [dirty, busy]);
  useEffect(() => () => handler.current?.(false, false), []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty, busy]);
}
