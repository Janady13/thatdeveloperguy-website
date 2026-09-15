import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface ToolResult { text?: unknown; images: Buffer[]; isError: boolean }
export interface LogEntry { at: string; tool: string; args: unknown; ok: boolean; ms: number; summary: string }

/** JSON-RPC client for the Rive Early Access editor MCP. The editor is sandboxed: files go in as data URIs and come out as inline base64. */
export class RiveEditor {
  private id = 0;
  private sessionId: string | null = null;
  private ready: Promise<void> | null = null;
  constructor(private readonly url = 'http://127.0.0.1:9791/mcp', private readonly log: (entry: LogEntry) => void = () => {}) {}

  private async rpc(method: string, params: Record<string, unknown>): Promise<any> {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    const response = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }), signal: AbortSignal.timeout(180_000) });
    const session = response.headers.get('mcp-session-id'); if (session) this.sessionId = session;
    const raw = await response.text();
    if (!raw.trim()) return null; // notifications get an empty 202
    const lines = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
    const body = JSON.parse(lines.length ? lines[lines.length - 1]! : raw);
    if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
    return body.result;
  }

  private async notify(method: string, params: Record<string, unknown> = {}): Promise<void> {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    await fetch(this.url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method, params }), signal: AbortSignal.timeout(30_000) });
  }

  /** MCP handshake: initialize, then the initialized notification the editor insists on before any tool call. */
  async initialize(): Promise<{ name: string; version: string }> {
    const result = await this.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'thatdeveloperguy-website', version: '0.1.0' } });
    await this.notify('notifications/initialized');
    this.ready = Promise.resolve();
    return { name: result.serverInfo.name, version: result.serverInfo.version };
  }

  async callRaw(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    if (!this.ready) this.ready = this.initialize().then(() => undefined);
    await this.ready;
    const t = Date.now();
    const result = await this.rpc('tools/call', { name, arguments: args });
    const out: ToolResult = { images: [], isError: Boolean(result.isError) };
    for (const item of result.content ?? []) {
      if (item.type === 'image') out.images.push(Buffer.from(item.data, 'base64'));
      if (item.type === 'text') { try { out.text = JSON.parse(item.text); } catch { out.text = item.text; } }
    }
    const summary = typeof out.text === 'string' ? out.text.slice(0, 160) : JSON.stringify(out.text ?? '').slice(0, 160);
    this.log({ at: new Date().toISOString(), tool: name, args: name === 'upload_asset' ? { ...args, file: '<data-uri>' } : args, ok: !out.isError, ms: Date.now() - t, summary });
    return out;
  }

  async call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.callRaw(name, args);
    if (result.isError) throw new Error(`${name}: ${typeof result.text === 'string' ? result.text : JSON.stringify(result.text)}`);
    if (result.text && typeof result.text === 'object' && (result.text as any).success === false) throw new Error(`${name}: ${JSON.stringify(result.text)}`);
    return result.text as T;
  }

  async uploadSvg(filePath: string, name: string): Promise<string> {
    const data = readFileSync(filePath).toString('base64');
    const file = `data:image/svg+xml;name=${encodeURIComponent(name)}.svg;base64,${data}`;
    const result = await this.call<{ asset: { id: string } }>('upload_asset', { file, name });
    return result.asset.id;
  }

  async capture(artboard: string, outPng: string, longEdge = 1536): Promise<void> {
    const result = await this.callRaw('capture_artboard', { artboardId: artboard, longEdge, backgroundColor: '#ffffff' });
    if (result.isError || !result.images[0]) throw new Error(`capture_artboard: ${JSON.stringify(result.text)}`);
    writeFileSync(outPng, result.images[0]);
  }

  async exportRiv(outDir: string): Promise<{ path: string; bytes: number }> {
    const result = await this.call<{ filename: string; data?: string; path?: string }>('export_file', { format: 'riv', destination: outDir, inline_base64: true });
    if (!result.data) { const bytes = readFileSync(result.path!); const path = join(outDir, basename(result.path!)); if (path !== result.path) writeFileSync(path, bytes); return { path, bytes: bytes.length }; }
    const bytes = Buffer.from(result.data, 'base64');
    const path = join(outDir, result.filename);
    writeFileSync(path, bytes);
    return { path, bytes: bytes.length };
  }
}
