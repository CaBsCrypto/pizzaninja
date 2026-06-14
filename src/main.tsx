import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { PrivyProvider } from '@privy-io/react-auth';

// Reemplazar este ID con el App ID real en Vercel
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "cmqags31f002m0cl17tx8719m";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'apple', 'discord'],
        appearance: {
          theme: 'dark',
          accentColor: '#f43f5e', // rose-500 from the UI
        }
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
