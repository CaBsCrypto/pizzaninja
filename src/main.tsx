// Polyfill secure context and subtle crypto for Privy in local HTTP environments (like network IPs)
if (typeof window !== 'undefined') {
  if (!window.isSecureContext) {
    try {
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        configurable: true,
        writable: true
      });
    } catch (e) {
      console.warn('Failed to define isSecureContext:', e);
    }
  }
  if (!window.crypto) {
    try {
      (window as any).crypto = {} as any;
    } catch (e) {}
  }
  if (window.crypto && !window.crypto.subtle) {
    try {
      (window.crypto as any).subtle = {
        decrypt: () => Promise.resolve(new ArrayBuffer(0)),
        encrypt: () => Promise.resolve(new ArrayBuffer(0)),
        exportKey: () => Promise.resolve(new ArrayBuffer(0)),
        generateKey: () => Promise.resolve({}),
        importKey: () => Promise.resolve({}),
        sign: () => Promise.resolve(new ArrayBuffer(0)),
        verify: () => Promise.resolve(true),
      } as any;
    } catch (e) {}
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

import { PrivyProvider } from '@privy-io/react-auth';

// Reemplazar este ID con el App ID real en Vercel
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "cmqdk627p00na0cjsi6ioszjx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary region="root">
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google'],
          appearance: {
            theme: 'dark',
            accentColor: '#ffd866', // Amarillo Taberna
          }
        }}
      >
        <App />
      </PrivyProvider>
    </ErrorBoundary>
  </StrictMode>,
);
