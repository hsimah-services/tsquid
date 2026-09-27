import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './styles/global.css';

import { App } from './app/App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
