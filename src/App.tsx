import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { DialogHost } from './components/dialogs';
import { useSettings } from './lib/settings';
import { Home } from './pages/Home';
import { CpuPage, RoomPage } from './pages/Room';
import { SettingsPage } from './pages/Settings';
import { ManualsPage } from './guide/Guide';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room" element={<RoomPage />} />
        <Route path="/cpu" element={<CpuPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/guide" element={<ManualsPage />} />
        <Route path="/guide/:mode" element={<ManualsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DialogHost />
      <Dimmer />
    </BrowserRouter>
  );
}

/** The brightness setting: a dark layer over everything that lets taps through. */
function Dimmer() {
  const { brightness } = useSettings();
  if (brightness >= 1) return null;
  return <div className="pointer-events-none fixed inset-0 z-[100] bg-black" style={{ opacity: 1 - brightness }} aria-hidden />;
}
