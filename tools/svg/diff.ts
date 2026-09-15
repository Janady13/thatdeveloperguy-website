import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult { width: number; height: number; differentPixels: number; ratio: number }

export function renderSvg(svg: string, width: number): Uint8Array {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'white' }).render().asPng();
}

/** Renders the SVG at the reference's width and counts pixels that differ by more than pixelmatch's 0.1 threshold. The kit references are 1672×941 against a 1648×928 artboard, so the last row may not exist in one of them; the comparison covers the rows both have. */
export function diffAgainstReference(svg: string, referencePng: string, outPng: string): DiffResult {
  const reference = PNG.sync.read(readFileSync(referencePng));
  const rendered = PNG.sync.read(Buffer.from(renderSvg(svg, reference.width)));
  if (rendered.width !== reference.width || Math.abs(rendered.height - reference.height) > 2) throw new Error(`render is ${rendered.width}×${rendered.height}, reference is ${reference.width}×${reference.height}`);
  const width = reference.width, height = Math.min(rendered.height, reference.height), rows = width * height * 4;
  const diff = new PNG({ width, height });
  const differentPixels = pixelmatch(rendered.data.subarray(0, rows), reference.data.subarray(0, rows), diff.data, width, height, { threshold: 0.1, includeAA: false });
  writeFileSync(outPng, PNG.sync.write(diff));
  return { width, height, differentPixels, ratio: differentPixels / (width * height) };
}
