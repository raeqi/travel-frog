import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './prototype.css';
import './styles.css';
import App from './App.tsx';
import { StoreProvider } from './state';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
