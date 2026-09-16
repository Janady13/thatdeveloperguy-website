import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
for (const room of ['lobby']) {
  const out = `apps/web/public/scenes/${room}`; mkdirSync(out, { recursive: true });
  copyFileSync(`creative-source/refined/${room}/scene.svg`, `${out}/scene.svg`);
  for (const file of [`${room}.riv`, 'rive-manifest.json']) if (existsSync(`creative-source/rive/${room}/${file}`)) copyFileSync(`creative-source/rive/${room}/${file}`, `${out}/${file}`);
  console.log(`synced ${room}`);
}
