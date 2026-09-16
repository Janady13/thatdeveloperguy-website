import type { CSSProperties } from 'react';
import type { SceneHotspot } from '../../src/contracts/scene';

export const CYBERSECURITY_CANVAS = { width: 1648, height: 928 } as const;
export type CybersecurityFocus = 'monitoring' | 'health' | 'response' | 'infrastructure' | 'briefing' | 'process' | 'return-lobby';
export type CybersecurityObjectFocus =
  | 'console_chair_1'
  | 'console_chair_2'
  | 'console_chair_3'
  | `console_${1 | 2 | 3}_${'left' | 'right'}_cabinet_drawer_${1 | 2 | 3}`;

interface CybersecurityObjectRegion {
  id: CybersecurityObjectFocus;
  label: string;
  hit: { x: number; y: number; width: number; height: number };
}

/**
 * Small object regions come directly from the supplied layer-index.csv. They are
 * resolved from scene coordinates instead of rendered as another hit overlay, so
 * furniture motion can never cover or intercept the seven real navigation links.
 */
export const CYBERSECURITY_OBJECT_REGIONS: readonly CybersecurityObjectRegion[] = [
  { id: 'console_1_left_cabinet_drawer_1', label: 'Console one left top drawer', hit: { x: 347, y: 503, width: 68, height: 23 } },
  { id: 'console_1_left_cabinet_drawer_2', label: 'Console one left middle drawer', hit: { x: 347, y: 519, width: 68, height: 23 } },
  { id: 'console_1_left_cabinet_drawer_3', label: 'Console one left bottom drawer', hit: { x: 347, y: 536, width: 68, height: 23 } },
  { id: 'console_1_right_cabinet_drawer_1', label: 'Console one right top drawer', hit: { x: 581, y: 503, width: 68, height: 23 } },
  { id: 'console_1_right_cabinet_drawer_2', label: 'Console one right middle drawer', hit: { x: 581, y: 519, width: 68, height: 23 } },
  { id: 'console_1_right_cabinet_drawer_3', label: 'Console one right bottom drawer', hit: { x: 581, y: 536, width: 68, height: 23 } },
  { id: 'console_2_left_cabinet_drawer_1', label: 'Console two left top drawer', hit: { x: 670, y: 503, width: 68, height: 23 } },
  { id: 'console_2_left_cabinet_drawer_2', label: 'Console two left middle drawer', hit: { x: 670, y: 519, width: 68, height: 23 } },
  { id: 'console_2_left_cabinet_drawer_3', label: 'Console two left bottom drawer', hit: { x: 670, y: 536, width: 68, height: 23 } },
  { id: 'console_2_right_cabinet_drawer_1', label: 'Console two right top drawer', hit: { x: 897, y: 503, width: 68, height: 23 } },
  { id: 'console_2_right_cabinet_drawer_2', label: 'Console two right middle drawer', hit: { x: 897, y: 519, width: 68, height: 23 } },
  { id: 'console_2_right_cabinet_drawer_3', label: 'Console two right bottom drawer', hit: { x: 897, y: 536, width: 68, height: 23 } },
  { id: 'console_3_left_cabinet_drawer_1', label: 'Console three left top drawer', hit: { x: 985, y: 503, width: 68, height: 23 } },
  { id: 'console_3_left_cabinet_drawer_2', label: 'Console three left middle drawer', hit: { x: 985, y: 519, width: 68, height: 23 } },
  { id: 'console_3_left_cabinet_drawer_3', label: 'Console three left bottom drawer', hit: { x: 985, y: 536, width: 68, height: 23 } },
  { id: 'console_3_right_cabinet_drawer_1', label: 'Console three right top drawer', hit: { x: 1215, y: 503, width: 56, height: 23 } },
  { id: 'console_3_right_cabinet_drawer_2', label: 'Console three right middle drawer', hit: { x: 1215, y: 519, width: 56, height: 23 } },
  { id: 'console_3_right_cabinet_drawer_3', label: 'Console three right bottom drawer', hit: { x: 1215, y: 536, width: 68, height: 23 } },
  { id: 'console_chair_1', label: 'Console chair one', hit: { x: 469, y: 481, width: 85, height: 99 } },
  { id: 'console_chair_2', label: 'Console chair two', hit: { x: 778, y: 481, width: 85, height: 99 } },
  { id: 'console_chair_3', label: 'Console chair three', hit: { x: 1090, y: 481, width: 85, height: 99 } },
] as const;

export function resolveCybersecurityObject(x: number, y: number): CybersecurityObjectFocus | null {
  const region = CYBERSECURITY_OBJECT_REGIONS.find(({ hit }) =>
    x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height);
  return region?.id ?? null;
}

export const CYBERSECURITY_HOTSPOTS: SceneHotspot[] = [
  { id: 'monitoring', label: 'Security monitoring overview', hit: { x: 354, y: 188, width: 476, height: 246 }, target: { kind: 'anchor', anchor: 'monitoring', pageId: 'capability.cybersecurity' }, focusValue: 'monitoring' },
  { id: 'health', label: 'Security review and system health', hit: { x: 832, y: 189, width: 193, height: 245 }, target: { kind: 'anchor', anchor: 'security-review', pageId: 'capability.cybersecurity' }, focusValue: 'health' },
  { id: 'response', label: 'Incident response planning', hit: { x: 1031, y: 188, width: 244, height: 246 }, target: { kind: 'anchor', anchor: 'response', pageId: 'capability.cybersecurity' }, focusValue: 'response' },
  { id: 'infrastructure', label: 'Infrastructure protection', hit: { x: 1306, y: 232, width: 87, height: 333 }, target: { kind: 'anchor', anchor: 'infrastructure', pageId: 'capability.cybersecurity' }, focusValue: 'infrastructure' },
  { id: 'briefing', label: 'Request a human security review', hit: { x: 669, y: 440, width: 305, height: 128 }, target: { kind: 'page', pageId: 'contact', project: 'security' }, focusValue: 'briefing' },
  { id: 'process', label: 'Security review process', hit: { x: 269, y: 552, width: 125, height: 135 }, target: { kind: 'anchor', anchor: 'process', pageId: 'capability.cybersecurity' }, focusValue: 'process' },
  { id: 'return-lobby', label: 'Return to the lobby', hit: { x: 1497, y: 291, width: 123, height: 286 }, target: { kind: 'page', pageId: 'home' }, focusValue: 'return-lobby' },
];

export const CYBERSECURITY_CAPTIONS: Record<CybersecurityFocus, string> = {
  monitoring: 'Monitoring is scoped to your systems and read by a person. The map is illustrative, not live telemetry.',
  health: 'A human security review turns configuration, exposure and logs into an ordered remediation plan.',
  response: 'Decide who is called, what is isolated and what is preserved before an incident happens.',
  infrastructure: 'Protect the foundations: patching, segmentation, restore-tested backups and intentional access.',
  briefing: 'Request a human security review for the systems and accounts you choose to place in scope.',
  process: 'Scope, collect, read, report, remediate and re-check—with a written record at every step.',
  'return-lobby': 'Return to the lobby and choose another room.',
};

export function toCyberRect(hit: { x: number; y: number; width: number; height: number }): CSSProperties {
  return {
    left: `${hit.x / CYBERSECURITY_CANVAS.width * 100}%`,
    top: `${hit.y / CYBERSECURITY_CANVAS.height * 100}%`,
    width: `${hit.width / CYBERSECURITY_CANVAS.width * 100}%`,
    height: `${hit.height / CYBERSECURITY_CANVAS.height * 100}%`,
  };
}
