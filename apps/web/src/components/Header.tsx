import { Link } from 'react-router';
import { truth } from '../truth';
export function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="site-brand" aria-label={`${truth.org.name} — lobby`}>thatdeveloper<span>guy</span>.com</Link>
      <nav aria-label="Rooms" className="site-nav">
        <Link to="/it-services/">IT Services</Link><Link to="/government-solutions/">Government Solutions</Link><Link to="/cybersecurity/">Cybersecurity</Link><Link to="/contact/" className="site-nav-cta">Request a briefing</Link>
      </nav>
    </header>
  );
}
