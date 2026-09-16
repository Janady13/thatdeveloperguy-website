import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import type { SceneHotspot } from '../../src/contracts/scene';
import { resolveDestination } from './resolve-destination';
import type { ResolvedHotspot } from './HotspotOverlay';

interface SceneNavigationOptions {
  hotspots: SceneHotspot[];
  pageId: string;
  motion: boolean;
  transitionMs?: number | ((hotspot: ResolvedHotspot) => number);
  onAnchor?: (hotspot: ResolvedHotspot) => void;
  onRouteStart?: (hotspot: ResolvedHotspot) => void;
}

/** One progressive-enhancement navigation contract for every illustrated room. */
export function useSceneNavigation({ hotspots: sourceHotspots, pageId, motion, transitionMs = 0, onAnchor, onRouteStart }: SceneNavigationOptions) {
  const navigate = useNavigate();
  const timer = useRef<number | null>(null);
  const [leavingTarget, setLeavingTarget] = useState<string | null>(null);
  const hotspots = useMemo<ResolvedHotspot[]>(() => sourceHotspots.flatMap(hotspot => {
    const href = resolveDestination(hotspot.target, pageId);
    return href ? [{ ...hotspot, href }] : [];
  }), [pageId, sourceHotspots]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const activate = useCallback((hotspot: ResolvedHotspot, event: MouseEvent<Element>) => {
    if (hotspot.href.startsWith('#')) {
      if (onAnchor) {
        event.preventDefault();
        onAnchor(hotspot);
      }
      return;
    }
    event.preventDefault();
    if (leavingTarget) return;
    setLeavingTarget(hotspot.id);
    onRouteStart?.(hotspot);
    const requestedDelay = typeof transitionMs === 'function' ? transitionMs(hotspot) : transitionMs;
    const delay = motion ? Math.max(0, requestedDelay) : 0;
    if (delay === 0) {
      navigate(hotspot.href);
      return;
    }
    timer.current = window.setTimeout(() => navigate(hotspot.href), delay);
  }, [leavingTarget, motion, navigate, onAnchor, onRouteStart, transitionMs]);

  return { hotspots, activate, leavingTarget, leaving: leavingTarget !== null };
}
