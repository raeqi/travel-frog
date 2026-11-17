import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { useStore } from './state';
import { latestTrip } from './lib/selectors';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/Home';
import { ImportPage } from './pages/Import';
import { TripDetailPage } from './pages/TripDetail';
import { ReplayPage } from './pages/Replay';
import { MapPage } from './pages/MapPage';
import { FillPage } from './pages/FillPage';
import { FrogPage } from './pages/FrogPage';
import { GapsPage } from './pages/GapsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const route = useRoute();
  const { data, toast } = useStore();
  const activeTripId = route.param ?? latestTrip(data)?.id;

  useEffect(() => {
    document.body.dataset.screen = route.name;
  }, [route.name]);

  let screen = null;
  switch (route.name) {
    case 'home':
      screen = <HomePage />;
      break;
    case 'import':
      screen = <ImportPage />;
      break;
    case 'trip':
      screen = <TripDetailPage tripId={route.param} />;
      break;
    case 'replay':
      screen = <ReplayPage tripId={route.param} />;
      break;
    case 'map':
      screen = <MapPage />;
      break;
    case 'fill':
      screen = <FillPage tripId={route.param} />;
      break;
    case 'frog':
      screen = <FrogPage />;
      break;
    case 'gaps':
      screen = <GapsPage />;
      break;
    case 'settings':
      screen = <SettingsPage />;
      break;
    default:
      screen = <HomePage />;
  }

  return (
    <>
      <TopBar route={route} activeTripId={activeTripId} />
      <main>{screen}</main>
      <div className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

export default App;
