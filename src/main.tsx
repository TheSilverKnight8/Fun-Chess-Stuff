import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/archivo';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App';

// Installs the service worker. New versions activate on the next app launch.
if (!import.meta.env.DEV) registerSW({ immediate: true });

// Development only: lets automated tests look inside the running app.
if (import.meta.env.DEV) {
  void Promise.all([import('./game/session'), import('./chess/standard'), import('./chess/status')]).then(([session, standard, status]) => {
    (window as unknown as Record<string, unknown>).__chess = { session, standard, status };
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
