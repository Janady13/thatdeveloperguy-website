import { Route, Routes } from 'react-router';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Lobby } from './rooms/lobby/Lobby';
import { Room as ITServices } from './rooms/it-services/Room';
import { Room as GovernmentSolutions } from './rooms/government-solutions/Room';
import { Room as Cybersecurity } from './rooms/cybersecurity/Room';
import { Contact } from './rooms/contact/Contact';

export function App() {
  return (
    <>
      <Header />
      <main id="content">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/it-services/" element={<ITServices />} />
          <Route path="/government-solutions/" element={<GovernmentSolutions />} />
          <Route path="/cybersecurity/" element={<Cybersecurity />} />
          <Route path="/contact/" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
