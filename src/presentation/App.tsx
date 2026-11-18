import type { TravelFrogService } from '../application/travel-frog-service';
import { ServiceProvider } from './context';
import { ErrorBoundary } from './ErrorBoundary';
import { AppShell } from './AppShell';
import { ToastProvider } from './ui';

export function App({ service }: { service: TravelFrogService }) {
  return (
    <ErrorBoundary>
      <ServiceProvider value={service}>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </ServiceProvider>
    </ErrorBoundary>
  );
}
