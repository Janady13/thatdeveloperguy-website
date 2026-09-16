# IT Services Rive architecture status

The supplied kit contains `rive/ITServicesMachine.build-spec.json`, not a compiled `.riv` file. No existing useful native IT Services `.riv` was found in the application source during this pass.

Production V1 therefore ships the React/SVG implementation using the same scene graph and state contract that should be authored in Rive later. The Rive handoff contract is:

- Artboard: `ITServices`
- State machine: `ITServicesMachine`
- Inputs: `sceneActive`, `motionEnabled`, `reducedMotion`, `pauseMotion`, `pointerX`, `pointerY`, `focusedRegion`, `selectedRegion`, `attentionRegion`, `deploymentState`, `roomIdlePhase`
- Components: Environment, Lighting, StatusSystems, Workstations, ServerInfrastructure, Deployment, Equipment, FloorResponse, Interaction, FutureMascotHooks.

Do not rename the build spec to `.riv`; author a real native file only when Rive tooling/editor export is available and verified by the official runtime.
