import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { PrivyProvider } from '@privy-io/react-auth';

// Reemplazar este ID con el App ID real en Vercel
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "cmqdk627p00na0cjsi6ioszjx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
