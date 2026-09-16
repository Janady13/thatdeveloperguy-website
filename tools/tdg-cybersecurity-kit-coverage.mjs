import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const kit = process.env.TDG_CYBERSECURITY_KIT ?? '/Users/josephanady/Desktop/ThatDeveloperGuy/TDG_CYBERSECURITY_ANIMATION_KIT';
const source = resolve('creative-source/refined/cybersecurity');
const evidence = resolve('evidence/rive/cybersecurity/kit-coverage.json');
const passNames = ['background', 'desk-occluders', 'foreground', 'effects'];
const passSources = Object.fromEntries(passNames.map(name => [name, readFileSync(resolve(source, `${name}.svg`), 'utf8')]));
const interactiveScene = readFileSync(resolve(source, 'animation-scene.svg'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(kit, 'docs/scene-manifest.json'), 'utf8'));
const buildSpec = JSON.parse(readFileSync(resolve(kit, 'rive/CybersecurityMachine.build-spec.json'), 'utf8'));

const hasId = id => interactiveScene.includes(`id="${id}"`) || interactiveScene.includes(`id='${id}'`);
const assemblyIds = manifest.assemblies.map(assembly => assembly.id);
const missingAssemblies = assemblyIds.filter(id => !hasId(id));
const animationTargets = buildSpec.animations.flatMap(animation => animation.targets ?? []);
const missingAnimationTargets = animationTargets.filter(id => !hasId(id));
const drawerTargets = buildSpec.animations.find(animation => animation.name === 'Drawer')?.targets ?? [];
const chairTargets = buildSpec.animations.find(animation => animation.name === 'ChairNudge')?.targets ?? [];
const pathCount = (interactiveScene.match(/<path\b/g) ?? []).length;

const assertions = {
  allFourDepthPassesPresent: passNames.every(name => passSources[name].includes('<svg')),
  authoritativeInteractiveScenePresent: interactiveScene.includes('<svg'),
  allSemanticAssembliesPresent: assemblyIds.length === 103 && missingAssemblies.length === 0,
  allAnimationTargetsPresent: animationTargets.length > 0 && missingAnimationTargets.length === 0,
  allIndependentDrawersPresent: drawerTargets.length === 18 && drawerTargets.every(hasId),
  allIndependentChairsPresent: chairTargets.length === 3 && chairTargets.every(hasId),
  suppliedReducedVectorIntact: pathCount === 5307,
};
const report = {
  kit,
  source,
  passNames,
  interactiveScene: 'animation-scene.svg',
  assemblyCount: assemblyIds.length,
  animationNames: buildSpec.animations.map(animation => animation.name),
  animationTargetCount: animationTargets.length,
  drawerTargetCount: drawerTargets.length,
  chairTargetCount: chairTargets.length,
  pathCount,
  missingAssemblies,
  missingAnimationTargets,
  assertions,
  passed: Object.values(assertions).every(Boolean),
};

mkdirSync(resolve(evidence, '..'), { recursive: true });
writeFileSync(evidence, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
