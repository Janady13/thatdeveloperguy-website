import { useLocation } from 'react-router';
import type { CompiledPage } from '../../src/contracts/page';
import { pageForPath } from '../components/publication/PageMetadata';
import { NotFoundContent } from './not-found';

/** Every route module reads its page from the registry by pathname; an unregistered path renders the 404 content. */
export function usePage(): CompiledPage | null {
  const location = useLocation();
  return pageForPath(location.pathname) ?? null;
}
export function Missing() { return <NotFoundContent />; }
