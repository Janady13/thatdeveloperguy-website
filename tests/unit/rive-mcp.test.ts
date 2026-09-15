import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RiveEditor } from '../../tools/rive-mcp.ts';

function stub(handler: (req: any) => any) {
  const server = createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const rpc = JSON.parse(body);
      if (rpc.id === undefined) { res.statusCode = 202; res.end(); return; } // notification
      const result = handler(rpc);
      res.setHeader('content-type', 'text/event-stream');
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result })}\n\n`);
    });
  });
  return new Promise<{ url: string; close: () => void }>(resolve => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as any).port}/mcp`, close: () => server.close() })));
}

test('call parses SSE-framed JSON text content and throws on isError', async () => {
  const seen: any[] = [];
  const s = await stub(rpc => {
    seen.push(rpc);
    if (rpc.method === 'initialize') return { serverInfo: { name: 'rive', version: '0.6' } };
    if (rpc.params.name === 'bad') return { isError: true, content: [{ type: 'text', text: 'Error: nope' }] };
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, echo: rpc.params.arguments }) }] };
  });
  const editor = new RiveEditor(s.url);
  assert.deepEqual(await editor.initialize(), { name: 'rive', version: '0.6' });
  assert.deepEqual(await editor.call('list_artboards', { a: 1 }), { success: true, echo: { a: 1 } });
  await assert.rejects(editor.call('bad'), /nope/);
  assert.equal(seen[1].params.name, 'list_artboards'); // notifications never reach the handler
  s.close();
});

test('uploadSvg sends a data URI and exportRiv writes decoded bytes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tdg-mcp-'));
  writeFileSync(join(dir, 'x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  let uploaded = '';
  const s = await stub(rpc => {
    if (rpc.method === 'initialize') return { serverInfo: { name: 'rive', version: '0.6' } };
    if (rpc.params.name === 'upload_asset') { uploaded = rpc.params.arguments.file; return { content: [{ type: 'text', text: JSON.stringify({ success: true, asset: { id: '0-14' } }) }] }; }
    if (rpc.params.name === 'export_file') return { content: [{ type: 'text', text: JSON.stringify({ success: true, filename: 'x.riv', data: Buffer.from('RIVE').toString('base64') }) }] };
    throw new Error('unexpected');
  });
  const editor = new RiveEditor(s.url);
  assert.equal(await editor.uploadSvg(join(dir, 'x.svg'), 'x'), '0-14');
  assert.match(uploaded, /^data:image\/svg\+xml;name=x\.svg;base64,/);
  const out = await editor.exportRiv(dir);
  assert.equal(readFileSync(out.path, 'utf8'), 'RIVE'); assert.equal(out.bytes, 4);
  s.close();
});
