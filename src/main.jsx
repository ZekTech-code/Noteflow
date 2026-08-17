import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { NotesProvider } from './store';
import './styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NotesProvider>
      <App />
    </NotesProvider>
  </React.StrictMode>,
);
