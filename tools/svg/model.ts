export type Point = [number, number];
export type Ring = Point[];
export interface PathNode { kind: 'path'; id: string; fill: string; rings: Ring[] }
export interface GroupNode { kind: 'group'; id: string; label?: string; children: SvgNode[] }
export type SvgNode = PathNode | GroupNode;
export interface SceneDoc { width: number; height: number; title: string; children: SvgNode[] }

export function* walkPaths(nodes: SvgNode[]): Generator<PathNode> {
  for (const node of nodes) {
    if (node.kind === 'path') yield node; else yield* walkPaths(node.children);
  }
}
export function findGroup(nodes: SvgNode[], id: string): GroupNode | null {
  for (const node of nodes) {
    if (node.kind !== 'group') continue;
    if (node.id === id) return node;
    const inner = findGroup(node.children, id);
    if (inner) return inner;
  }
  return null;
}
