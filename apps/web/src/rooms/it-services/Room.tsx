import { Link } from 'react-router';
export function Room() {
  return (
    <section className="room-overview" aria-labelledby="room-title">
      <div><h1 id="room-title">IT Services</h1><p>This room is built in the next plan. <Link to="/">Return to the lobby</Link>.</p></div>
    </section>
  );
}
