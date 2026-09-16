import projection from '../../build-inputs/authority/public-projection.json';
/** The pinned public projection of the truth node. Read-only; regenerate with `npm run truth`. */
export type Projection = typeof projection;
export const truth: Projection = projection;
export const ORGANIZATION_ID = truth.org.id;
export const PERSON_ID = truth.person.id;
