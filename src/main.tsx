import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyDisplaySettings, readDisplaySettings } from './lib/display-settings';
import './index.css';

// Applied before the first paint, so a saved theme or text size never flashes.
applyDisplaySettings(readDisplaySettings());

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
