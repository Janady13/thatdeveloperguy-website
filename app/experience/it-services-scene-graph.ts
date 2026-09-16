import type { CSSProperties } from 'react';

export const IT_ROOM = { width: 1648, height: 928 } as const;
export type ItRegion = 'status' | 'helpdesk' | 'workstations' | 'racks' | 'deployment' | 'toolcart';
export type ItSceneState = 'idle' | 'hover' | 'focus' | 'transition' | 'reducedMotion' | 'paused' | 'debug';

export interface RectSpec { id: string; x: number; y: number; width: number; height: number; className?: string; delay?: number; phase?: number }
export interface LayerSpec { id: string; src: string; className: string; depth: number; region?: ItRegion; system: string; responsibility: string }
export interface DebugRegion extends RectSpec { label: string; depth: number; role: string }
export interface MascotAnchor { id: string; x: number; y: number; role: string }

export const toSceneRect = (x: number, y: number, width: number, height: number, extra?: CSSProperties) => ({
  left: `${(x / IT_ROOM.width) * 100}%`,
  top: `${(y / IT_ROOM.height) * 100}%`,
  width: `${(width / IT_ROOM.width) * 100}%`,
  height: `${(height / IT_ROOM.height) * 100}%`,
  ...extra,
}) as CSSProperties;

const layer = (id: string, system: string, responsibility: string, depth: number, region?: ItRegion): LayerSpec => ({
  id,
  src: `/animation/it-services/layers/${id}.svg`,
  className: `it-kit-layer it-kit-${id.replaceAll('_', '-')}`,
  depth,
  region,
  system,
  responsibility,
});

export const KIT_LAYERS: LayerSpec[] = [
  layer('ceiling_lights', 'Lighting', 'ceiling fixture emission and wall/floor response source', 210),
  layer('hanging_sign', 'Signage', 'signage edge illumination source', 225),
  layer('status_board', 'StatusSystems', 'operations display base response', 320, 'status'),
  layer('board_row_1', 'StatusSystems', 'IT Services health-row signal animation', 321, 'status'),
  layer('board_row_2', 'StatusSystems', 'Network health-row signal animation', 322, 'status'),
  layer('board_row_3', 'StatusSystems', 'Applications health-row signal animation', 323, 'status'),
  layer('board_row_4', 'StatusSystems', 'Infrastructure health-row signal animation', 324, 'status'),
  layer('service_monitor_left', 'Workstations', 'service desk monitor glow and refresh', 430, 'helpdesk'),
  layer('service_monitor_right', 'Workstations', 'service desk monitor glow and refresh', 431, 'helpdesk'),
  layer('desk_reader', 'Deployment', 'countertop reader status pulse', 432, 'helpdesk'),
  layer('workstation_monitor_01', 'Workstations', 'endpoint display activity', 455, 'workstations'),
  layer('workstation_monitor_02', 'Workstations', 'endpoint display activity', 456, 'workstations'),
  layer('workstation_monitor_03', 'Workstations', 'endpoint display activity', 457, 'workstations'),
  layer('workstation_monitor_04', 'Workstations', 'endpoint display activity', 458, 'workstations'),
  layer('workstation_phone', 'Workstations', 'support phone notification micro-state', 459, 'workstations'),
  layer('network_appliance', 'ServerInfrastructure', 'network appliance LED status', 500, 'racks'),
  layer('server_rack_01', 'ServerInfrastructure', 'rack A LED and glass activity', 510, 'racks'),
  layer('server_rack_02', 'ServerInfrastructure', 'rack B LED and glass activity', 511, 'racks'),
  layer('server_rack_03', 'ServerInfrastructure', 'rack C LED and glass activity', 512, 'racks'),
  layer('server_rack_04', 'ServerInfrastructure', 'rack D LED and glass activity', 513, 'racks'),
  layer('deployment_door_leaf', 'Deployment', 'deployment destination attention and selected response; no fake opening', 540, 'deployment'),
  layer('laptop_lid', 'Equipment', 'repair laptop screen refresh', 560, 'toolcart'),
  layer('tool_cart', 'Equipment', 'process cart emphasis', 610, 'toolcart'),
  layer('tool_cart_drawer_1', 'Equipment', 'Plan drawer state highlight', 611, 'toolcart'),
  layer('tool_cart_drawer_2', 'Equipment', 'Configure drawer state highlight', 612, 'toolcart'),
  layer('tool_cart_drawer_3', 'Equipment', 'Deploy drawer state highlight', 613, 'toolcart'),
  layer('tool_cart_drawer_4', 'Equipment', 'Maintain drawer state highlight', 614, 'toolcart'),
  layer('tool_cart_drawer_5', 'Equipment', 'Improve drawer state highlight', 615, 'toolcart'),
];

export const STATUS_PULSES: RectSpec[] = [
  { id: 'board-heading', x: 645, y: 239, width: 21, height: 21, delay: -0.4 },
  { id: 'board-it', x: 645, y: 281, width: 21, height: 21, delay: -1.8 },
  { id: 'board-network', x: 645, y: 313, width: 21, height: 21, delay: -3.7 },
  { id: 'board-apps', x: 645, y: 344, width: 21, height: 21, delay: -5.1 },
  { id: 'board-infra', x: 645, y: 375, width: 21, height: 21, delay: -6.6 },
];

export const WORKSTATION_SCREENS: RectSpec[] = [
  { id: 'work-a', x: 13, y: 418, width: 116, height: 72, delay: -2.1 },
  { id: 'work-b', x: 136, y: 409, width: 102, height: 72, delay: -5.2 },
  { id: 'work-c', x: 262, y: 416, width: 82, height: 54, delay: -7.8 },
  { id: 'work-d', x: 362, y: 417, width: 74, height: 52, delay: -10.4 },
  { id: 'service-left', x: 720, y: 419, width: 74, height: 50, delay: -4.5 },
  { id: 'service-right', x: 910, y: 421, width: 62, height: 46, delay: -8.8 },
  { id: 'laptop', x: 1545, y: 459, width: 72, height: 54, delay: -6.5 },
];

export const RACK_LED_GROUPS: RectSpec[] = Array.from({ length: 31 }, (_, index) => {
  const rack = index < 9 ? 0 : index < 18 ? 1 : index < 27 ? 2 : 3;
  const local = rack === 0 ? index : rack === 1 ? index - 9 : rack === 2 ? index - 18 : index - 27;
  const baseX = [1357, 1464, 1571, 1290] as const;
  const baseY = [253, 228, 208, 310] as const;
  return { id: `rack-${rack + 1}-${local + 1}`, x: baseX[rack] ?? baseX[0], y: (baseY[rack] ?? baseY[0]) + local * 29, width: rack === 3 ? 9 : 12, height: 6, delay: -((index * 1.37) % 11), phase: (index * 37) % 100 };
});

export const FLOOR_EFFECTS: RectSpec[] = [
  { id: 'ambient', x: 0, y: 534, width: 1648, height: 394, className: 'it-floor-ambient' },
  { id: 'ceiling', x: 280, y: 562, width: 900, height: 250, className: 'it-floor-ceiling' },
  { id: 'status', x: 570, y: 535, width: 520, height: 190, className: 'it-floor-status' },
  { id: 'helpdesk', x: 520, y: 600, width: 610, height: 180, className: 'it-floor-helpdesk' },
  { id: 'workstations', x: 35, y: 555, width: 475, height: 250, className: 'it-floor-workstations' },
  { id: 'racks', x: 1240, y: 548, width: 390, height: 265, className: 'it-floor-racks' },
  { id: 'deployment', x: 1010, y: 545, width: 300, height: 215, className: 'it-floor-deployment' },
  { id: 'toolcart', x: 1280, y: 662, width: 340, height: 195, className: 'it-floor-toolcart' },
  { id: 'window', x: 70, y: 530, width: 500, height: 250, className: 'it-floor-window' },
  { id: 'specular', x: 220, y: 585, width: 1120, height: 315, className: 'it-floor-specular' },
];

export const FOCUS_REGIONS: DebugRegion[] = [
  { id: 'status', label: 'Status board', x: 615, y: 213, width: 420, height: 200, depth: 3, role: 'monitoring overview' },
  { id: 'helpdesk', label: 'Service desk', x: 568, y: 473, width: 511, height: 142, depth: 3, role: 'support desk' },
  { id: 'workstations', label: 'Workstations', x: 112, y: 413, width: 280, height: 126, depth: 3, role: 'endpoint support' },
  { id: 'racks', label: 'Racks', x: 1351, y: 258, width: 195, height: 274, depth: 3, role: 'infrastructure' },
  { id: 'deployment', label: 'Deployment door', x: 1062, y: 282, width: 126, height: 272, depth: 3, role: 'deployment and maintenance' },
  { id: 'toolcart', label: 'Tool cart', x: 1377, y: 545, width: 160, height: 248, depth: 4, role: 'service process' },
];

export const MASCOT_ANCHORS: MascotAnchor[] = [
  { id: 'floor-contact-zone', x: 810, y: 770, role: 'future walking/contact shadow zone' },
  { id: 'status-anchor', x: 824, y: 420, role: 'explain status board' },
  { id: 'workstation-anchor', x: 250, y: 590, role: 'explain support/workstations' },
  { id: 'rack-anchor', x: 1350, y: 570, role: 'explain network/infrastructure' },
  { id: 'deployment-anchor', x: 1118, y: 540, role: 'explain deployment' },
  { id: 'toolcart-anchor', x: 1435, y: 780, role: 'explain delivery process' },
  { id: 'dialogue-anchor', x: 880, y: 360, role: 'future dialogue safe area' },
];
