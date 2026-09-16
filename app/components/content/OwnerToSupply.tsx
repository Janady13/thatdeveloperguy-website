import { truth } from '../../../src/authority/select-public-facts';
/** Registry facts the node does not hold yet. Rendered as an honest placeholder, never invented. */
export function OwnerToSupply() {
  return (
    <aside className="owner-to-supply" aria-labelledby="owner-to-supply-heading">
      <h2 id="owner-to-supply-heading">Registry facts to be supplied by the owner</h2>
      <ul>{truth.ownerToSupply.map(item => <li key={item}>{item}</li>)}</ul>
    </aside>
  );
}
