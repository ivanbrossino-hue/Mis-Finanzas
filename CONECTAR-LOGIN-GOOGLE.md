# 🔐 Configurar "Iniciar sesión con Google" (paso a paso)

Con esto, vos y tu pareja van a poder entrar a la app con su cuenta de Google y ver
los mismos datos reales desde cualquier dispositivo — sin tener que copiar y pegar
ninguna clave. Cada cuenta de Google que inicie sesión tiene sus propios datos,
totalmente aislados de los demás (nadie ve los datos de otro).

**Esto tiene 2 partes**: crear credenciales en Google Cloud Console, y pegarlas en
Supabase. Ninguna de las dos requiere saber programar, pero hay que ser prolijo con
las URLs — copiá y pegá en vez de tipear a mano.

Guardá estos 2 valores que vas a conseguir en el Paso 1:

```
Client ID     = ______________________.apps.googleusercontent.com
Client Secret = ______________________
```

---

## PASO 1 — Crear las credenciales en Google Cloud Console

1. Andá a **[console.cloud.google.com](https://console.cloud.google.com/)** con tu
   cuenta de Google (cualquiera, no hace falta que sea especial).
2. Arriba, al lado del logo de Google Cloud, tocá el selector de proyecto → **New
   Project**. Nombre: `Mis Finanzas` (o el que quieras) → **Create**. Esperá que
   se cree y seleccionalo.
3. En el buscador de arriba, escribí **"OAuth consent screen"** y entrá.
   - **User type**: elegí **External** → Create.
   - **App name**: `Mis Finanzas`.
   - **User support email**: tu mail.
   - **Developer contact information**: tu mail de nuevo.
   - Guardá y seguí (Next) por las pantallas de Scopes y Test users **sin agregar
     nada** — dejalas en blanco y avanzá.
   - Al final, dejá la app en estado **"Testing"** (no hace falta "publicarla" ni
     pedirle verificación a Google — es solo para vos, tu pareja y quien vos
     invites). En "Test users", agregá tu mail de Google y el de tu pareja.
4. En el buscador de arriba, escribí **"Credentials"** y entrá.
5. **+ Create Credentials** → **OAuth client ID**.
   - **Application type**: **Web application**.
   - **Name**: `Mis Finanzas Web`.
   - En **Authorized JavaScript origins**, agregá (una por línea, con **+ Add URI**):
     ```
     https://ivanbrossino-hue.github.io
     ```
   - En **Authorized redirect URIs**, agregá (te paso este link ya armado con tu
     proyecto, pegalo tal cual):
     ```
     https://iivjrpfkwkxgxzgyzrvq.supabase.co/auth/v1/callback
     ```
   - Tocá **Create**.
6. Te va a mostrar un popup con **Client ID** y **Client secret** — copialos al
   bloc de notas de arriba. (Si cerrás el popup, podés volver a verlos entrando a
   la credencial creada en la lista de Credentials).

---

## PASO 2 — Activar Google en Supabase

1. Andá a tu proyecto de Supabase → **Authentication** (menú izquierdo) →
   **Providers** (o **Sign In / Providers**, según la versión del panel).
2. Buscá **Google** en la lista y activalo (toggle a ON).
3. Pegá el **Client ID** y **Client Secret** del Paso 1.
4. Guardá (**Save**).

---

## Aviso: "Google no verificó esta app"

La primera vez que vos o tu pareja inicien sesión, Google puede mostrar una
pantalla de advertencia tipo *"Google hasn't verified this app"*. **Es normal y
esperado** — pasa porque la dejamos en modo "Testing" (no le pedimos a Google que
la revise, porque es solo para ustedes). Para continuar: tocá **"Advanced"** (o
"Configuración avanzada") → **"Go to Mis Finanzas (unsafe)"**. No es inseguro de
verdad, es solo la forma en que Google marca cualquier app que no pasó por su
revisión formal (que solo tiene sentido para apps públicas masivas).

---

## Cuando termines

Avisame y sigo con la Fase 2 (reescribir la app con el login). Antes de que puedas
usarlo de verdad, voy a necesitar que inicies sesión una vez para migrar tus datos
actuales a tu cuenta nueva — te aviso exactamente cuándo hacerlo.
