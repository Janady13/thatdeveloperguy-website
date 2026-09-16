import { useEffect, useState } from 'react';

const KEY = 'tdg-motion';
/** Visible control for prolonged ambient motion. Stored per browser; reduced-motion media query always wins. */
export function useMotionPreference(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try { const stored = localStorage.getItem(KEY); if (stored === 'off') setOn(false); } catch { /* storage unavailable: default on */ }
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) setOn(false);
  }, []);
  const set = (next: boolean) => { setOn(next); try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* ignore */ } };
  return [on, set];
}

export function MotionPreferenceControl({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return <button type="button" className="motion-control" aria-pressed={!on} onClick={() => onChange(!on)}>{on ? 'Pause motion' : 'Resume motion'}</button>;
}
