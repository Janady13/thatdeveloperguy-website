/**
 * The native layer is offered only on hardware-accelerated WebGL2. Software renderers (SwiftShader, llvmpipe, Mesa software)
 * can draw the vector rooms, but at seconds per frame on the main thread — a hung page, not an enhancement.
 */
export type RendererVerdict = { ok: true; renderer: string } | { ok: false; reason: string; renderer?: string };

export function probeRenderer(): RendererVerdict {
  if (typeof document === 'undefined') return { ok: false, reason: 'no document' };
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | null = null;
  try { gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }); } catch { gl = null; }
  if (!gl) return { ok: false, reason: 'no hardware WebGL2 context (major performance caveat or unsupported)' };
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (/swiftshader|llvmpipe|softpipe|software|mesa offscreen/i.test(renderer)) return { ok: false, reason: `software renderer: ${renderer}`, renderer };
  return { ok: true, renderer };
}
