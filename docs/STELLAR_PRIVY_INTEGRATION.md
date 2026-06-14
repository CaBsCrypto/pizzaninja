# Integración de Privy con Stellar/Soroban (Sin EVM)

Este documento explica cómo implementar un sistema de "Billetera Instantánea" (Instant Wallet) con inicio de sesión Web2 (Google, Email, Discord, Apple) para aplicaciones nativas de Stellar y contratos inteligentes en Soroban.

## 🌟 El Problema
Privy es una excelente herramienta para el onboarding Web2, pero sus "Billeteras Integradas" (Embedded Wallets) generan cuentas EVM (Ethereum/Polygon) por defecto. Para un proyecto en Stellar, una billetera EVM no nos sirve para firmar transacciones de Soroban.

## 💡 La Solución Multi-Modal (Triple Amenaza)
Para maximizar la adopción, este proyecto implementa un sistema de onboarding de tres frentes:
1. **Web2 Instantáneo (Privy):** Login con Google/Mail que deriva una llave nativa de Stellar.
2. **Biometría (Passkeys):** Llaves nativas almacenadas en el hardware del dispositivo (FaceID/TouchID).
3. **DeFi Clásico (Web3):** Billeteras nativas del ecosistema Stellar (Freighter, Albedo, etc.) a través de Stellar Wallets Kit.

A continuación documentamos cómo opera y se implementa cada una.

---

### 🟢 1. Web2 Instantáneo (Google/Email vía Privy)
Utilizamos Privy **estrictamente como proveedor de autenticación (Identity Provider)**. 
Una vez que Privy verifica criptográficamente que el usuario es dueño de un correo o cuenta de Google, nos devuelve un ID único (DID) inmutable. Nosotros tomamos ese ID único, lo usamos como semilla determinista (hasheada con SHA-256) y generamos una **llave Ed25519 nativa de Stellar** en el lado del cliente.

**Beneficios:**
1. Experiencia de usuario (UX) perfecta: Login con Google/Mail en 1 clic.
2. Cero fricción: El usuario no necesita anotar frases semilla de 24 palabras.
3. 100% Nativo de Stellar: Generamos direcciones reales `G...` capaces de firmar transacciones Soroban de forma nativa.
4. Totalmente determinista: El usuario siempre recupera la misma billetera al iniciar sesión con su misma cuenta de Google.

---

## 🛠️ Guía de Implementación: Privy (Paso a Paso)

### 1. Configuración del Proveedor (Privy)
Instala Privy en tu proyecto React:
```bash
npm install @privy-io/react-auth
```

Asegúrate de **desactivar** las billeteras integradas EVM en la configuración de tu `PrivyProvider` para no generar confusión ni llamadas innecesarias al backend de Privy:

```tsx
import { PrivyProvider } from '@privy-io/react-auth';

<PrivyProvider
  appId="TU_PRIVY_APP_ID"
  config={{
    loginMethods: ['email', 'google', 'apple', 'discord'],
    appearance: {
      theme: 'dark',
      accentColor: '#f43f5e',
    }
    // IMPORTANTE: No usar la propiedad `embeddedWallets`
  }}
>
  <App />
</PrivyProvider>
```

### 2. Configuración de OAuth (Google Cloud Console)
Para que Google permita el inicio de sesión desde tu dominio en producción:
1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Configura la **Pantalla de Consentimiento OAuth** eligiendo "Usuarios Externos" (External) y "Publica la aplicación".
3. Crea credenciales de tipo **ID de Cliente OAuth** (Aplicación Web).
4. En **Orígenes autorizados de JavaScript**, añade:
   - `http://localhost:5173` (Para desarrollo local)
   - `https://tudominio.com` (Tu app en producción)
   - `https://auth.privy.io` (El dominio de autenticación de Privy)
5. En **URIs de redireccionamiento autorizados**, añade:
   - `https://auth.privy.io/api/v1/oauth/callback`
6. Copia el **Client ID** y **Client Secret** y pégalos en tu [Privy Dashboard](https://dashboard.privy.io/) bajo `Login Methods -> Google -> Custom`.

### 3. Derivación Determinista de la Billetera Stellar
En tu componente principal (donde manejas el estado de la billetera), utiliza el hook `usePrivy` para escuchar el inicio de sesión. Cuando el usuario se autentica, generamos la llave de Stellar:

```tsx
import React, { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Keypair } from '@stellar/stellar-sdk';

export function StellarWalletDerivator() {
  const { ready, authenticated, user } = usePrivy();

  useEffect(() => {
    if (ready && authenticated && user) {
      // 1. Tomamos el ID único garantizado por Privy (ej. did:privy:12345)
      // Agregamos un "salt" específico de nuestra app para mayor seguridad
      const deriveStellarKey = async () => {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(user.id + "_mi_app_secreta_salt");
          
          // 2. Hasheamos la cadena usando SHA-256 para obtener 32 bytes exactos
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = new Uint8Array(hashBuffer);
          
          // 3. Usamos los 32 bytes como semilla Ed25519 nativa de Stellar
          const keypair = Keypair.fromRawEd25519Seed(Buffer.from(hashArray));
          const pubKey = keypair.publicKey();
          
          // 4. Guardamos el Keypair en el estado global para firmar transacciones
          console.log("Tu billetera Stellar nativa es:", pubKey);
          
        } catch (e) {
          console.error("Error derivando la llave de Stellar desde Privy", e);
        }
      };

      deriveStellarKey();
    }
  }, [ready, authenticated, user]);

  return null;
}
```

---

### 🔵 2. Biometría sin contraseñas (Passkeys)
El protocolo WebAuthn (Passkeys) permite a los usuarios crear llaves de Stellar utilizando la seguridad de su propio dispositivo (Huella dactilar, FaceID, Windows Hello). 

**Flujo de funcionamiento:**
1. Usamos la API del navegador `navigator.credentials.create()` para solicitar al usuario que genere un Passkey con su biometría.
2. Extraemos el `rawId` o los datos binarios del credential generado por el encriptador de hardware del teléfono/PC.
3. Al igual que con Privy, tomamos esos bytes únicos e irrepetibles, los pasamos por `crypto.subtle.digest('SHA-256')`.
4. El hash resultante de 32 bytes se utiliza para `Keypair.fromRawEd25519Seed()`.
5. Esto nos permite generar y recuperar la *misma billetera* de Stellar cada vez que el usuario pone su huella dactilar para iniciar sesión, sin depender de servidores de terceros.

---

### 🟣 3. Billeteras DeFi Clásicas (Stellar Wallets Kit)
Para los usuarios Web3 avanzados que ya tienen fondos en la red, ofrecemos el método de conexión directa mediante `@creit.tech/stellar-wallets-kit`.

**Configuración:**
```tsx
import { 
  StellarWalletsKit, 
  WalletNetwork, 
  allowAllModules,
  FREIGHTER_ID
} from '@creit.tech/stellar-wallets-kit';

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});
```

**Flujo de conexión:**
1. Se abre el modal nativo usando `kit.openModal()`.
2. El usuario elige su billetera instalada (ej. Freighter, xBull, Lobstr).
3. Se solicita conexión mediante `kit.setWallet(option.id)` y extraemos la llave pública con `kit.getAddress()`.
4. En este escenario, las transacciones se envían a la extensión del navegador (Freighter) para que el usuario las firme manualmente con su propia seguridad, por lo que el juego no retiene la llave privada, solo la pública.

---

## 🔒 Consideraciones de Seguridad
Dado que el modelo de **Privy** y **Passkeys** utiliza una semilla generada a partir de un hash estático en el frontend:
- Este esquema es catalogado como **"Custodia en el Dispositivo"** impulsada por identidad Web2/Biometría.
- Mientras el usuario pueda loguearse en su cuenta de Google, siempre tendrá acceso a sus fondos en Stellar.
- Asegúrate de usar siempre un HTTPS seguro en producción para evitar interceptación del objeto `user` de Privy.
- Para aplicaciones de muy alto valor (bancos reales, DeFi de gran escala), es recomendable una solución MFA adicional antes de permitir el descifrado del keypair local o migrar hacia Smart Wallets (Passkeys) en Soroban. Pero para juegos y dApps orientadas a adopción masiva, esta es la forma más rápida y amigable de operar.
