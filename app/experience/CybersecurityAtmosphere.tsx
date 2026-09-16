import { CYBERSECURITY_HOTSPOTS, toCyberRect } from './cybersecurity-scene-graph';

export function CybersecurityAtmosphere({ motion }: { motion: boolean }) {
  return (
    <div className="cyber-atmosphere" aria-hidden="true" data-motion={motion ? 'on' : 'reduced'}>
      <span className="cyber-ceiling-bloom" />
      <span className="cyber-floor-bloom" />
      <span className="cyber-pointer-light" />
      {CYBERSECURITY_HOTSPOTS.map(hotspot => (
        <span key={hotspot.id} className={`cyber-focus-wash cyber-focus-${hotspot.id}`} data-cyber-focus={hotspot.id} style={toCyberRect(hotspot.hit)} />
      ))}
    </div>
  );
}
