import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const svgDir = join(root, 'svg');
const required = [
  'tdg-it-services-specialist-master.svg',
  'PatchFaceOverlays.svg',
  'PatchBlinkFace.svg',
  'PatchHappyFace.svg',
  'PatchFocusedFace.svg',
  'PatchTalkingFace.svg',
  'PatchWaveGesture.svg',
  'PatchThumbsUpGesture.svg',
  'PatchTalkingMouth.svg',
];
const controllerPath = join(root, 'controller', 'PatchController.ts');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const failures = [];

for (const filename of required) {
  const path = join(svgDir, filename);
  try {
    const bytes = await readFile(path);
    const text = bytes.toString('utf8');
    if (!text.includes('<svg')) failures.push(`${filename}: missing SVG root`);
    if (/<image(?:\s|>)/i.test(text)) failures.push(`${filename}: embedded raster image found`);
    if (bytes.length === 0) failures.push(`${filename}: empty file`);
    console.log(`${filename}: ${bytes.length} bytes sha256=${sha256(bytes)}`);
  } catch {
    failures.push(`${filename}: missing`);
  }
}

for (const filename of ['tdg-patch.riv', 'tdg-it-services-specialist.riv']) {
  const path = join(root, 'rive', filename);
  try {
    const bytes = await readFile(path);
    if (bytes.subarray(0, 4).toString('ascii') !== 'RIVE') {
      failures.push(`${filename}: missing RIVE signature`);
    }
    console.log(`${filename}: ${bytes.length} bytes sha256=${sha256(bytes)}`);
  } catch {
    failures.push(`${filename}: missing`);
  }
}

const backupPath = join(root, 'rive', 'tdg-patch.rev');
try {
  const backup = await readFile(backupPath);
  if (backup.length < 1024) failures.push('tdg-patch.rev: backup is unexpectedly small');
  console.log(`tdg-patch.rev: ${backup.length} bytes sha256=${sha256(backup)}`);
} catch {
  failures.push('tdg-patch.rev: missing');
}

const contract = JSON.parse(await readFile(join(root, 'animation-contract.json'), 'utf8'));
if (!(await stat(controllerPath)).isFile()) failures.push('controller/PatchController.ts: missing');
if (contract.rive?.artboard !== 'Patch') failures.push('contract: Patch artboard missing');
if (contract.rive?.stateMachine !== 'PatchMachine') failures.push('contract: PatchMachine missing');
if (!contract.rive?.animations?.includes('Patch_Blink')) {
  failures.push('contract: Patch_Blink missing');
}

if (process.argv.includes('--svg-only')) {
  console.log('SVG validation complete');
} else {
  const packageStat = await stat(join(root, 'package.json'));
  if (!packageStat.isFile()) failures.push('package.json missing');
  console.log('Patch package validation complete');
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exitCode = 1;
}
