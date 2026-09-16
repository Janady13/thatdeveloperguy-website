/** Trailing-slash policy: no trailing slash except the root. */
export function normalizePath(path: string): string {
  const stripped = path.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}
