import type { TravelFrogService } from '../application/travel-frog-service';
import { ServiceProvider } from './context';
import { ErrorBoundary } from './ErrorBoundary';
import { MapWall } from './mapwall/MapWall';

export function App({ service }: { service: TravelFrogService }) {
  return (
    <ErrorBoundary>
      <ServiceProvider value={service}>
        <MapWall />
      </ServiceProvider>
    </ErrorBoundary>
  );
}
