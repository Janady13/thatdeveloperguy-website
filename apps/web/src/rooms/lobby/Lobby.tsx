import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { SceneStage } from '../../animation/stage/SceneStage';
import { LOBBY_HOTSPOTS, LOBBY_RIVE, type Hotspot } from './hotspots';
import { LOBBY_CAPTIONS, LOBBY_REST_CAPTION } from './content';
import { truth } from '../../truth';

const DOOR_OPEN_MS = 26 / 60 * 1000 + 120;

export function Lobby() {
  const navigate = useNavigate();
  const [focus, setFocus] = useState<string | null>(null);
  const [fire, setFire] = useState<{ name: string; nonce: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const activate = useCallback(async (h: Hotspot) => {
    if (leaving) return; setLeaving(true);
    setFocus(h.id); setFire({ name: h.trigger, nonce: Date.now() });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise(r => setTimeout(r, reduced || !LOBBY_RIVE ? 0 : DOOR_OPEN_MS));
    navigate(h.href);
  }, [leaving, navigate]);
  const address = truth.org.address as Record<string, string>;
  return (
    <>
      <h1 className="sr-only">{truth.org.name} — {truth.host.role}</h1>
      <SceneStage poster="/scenes/lobby/scene.svg" rive={LOBBY_RIVE} hotspots={LOBBY_HOTSPOTS} label="Lobby" focus={focus} onFocus={id => { if (!leaving) setFocus(id); }} fire={fire} onActivate={activate} caption={id => (id ? LOBBY_CAPTIONS[id] ?? '' : LOBBY_REST_CAPTION)} />
      <section className="room-overview" aria-label="About this organization">
        <div><h2>{truth.org.name}</h2><p>{truth.org.legalName}, founded {truth.org.foundingDate}, {address.addressLocality}, {address.addressRegion}.</p><p>{truth.person.name}, {truth.person.jobTitle}.</p></div>
        <div className="owner-to-supply"><h2>Registry facts to be supplied by the owner</h2><ul>{truth.ownerToSupply.map(item => <li key={item}>{item}</li>)}</ul></div>
      </section>
    </>
  );
}
