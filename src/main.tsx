import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          className: 'text-sm',
          success: {
            style: { background: '#10B981', color: '#fff' },
            iconTheme: { primary: '#fff', secondary: '#10B981' },
          },
          error: {
            style: { background: '#EF4444', color: '#fff' },
            iconTheme: { primary: '#fff', secondary: '#EF4444' },
          },
        }}
      />
    </>
  </StrictMode>,
);
