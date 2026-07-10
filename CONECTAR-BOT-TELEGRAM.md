# 🤖 Conectar el bot de Telegram (paso a paso)

Con esto vas a poder mandarle un gasto al bot por Telegram desde el celular, y que
aparezca solo en tu app — funcione 24/7, aunque la compu esté apagada.

Necesitás 2 cosas gratis: un **bot de Telegram** y un proyecto en **Supabase**
(la "nube" donde se guardan los datos). Son ~15 minutos, una sola vez.

Guardá en un bloc de notas estos 4 valores que vas a ir consiguiendo:

```
TOKEN del bot      = ______________________
URL de Supabase    = https://__________.supabase.co
Clave anon (public)= eyJ...
Palabra secreta    = (una que inventes vos, ej: mifinanzas2026)
```

---

## PASO 1 — Crear el bot en Telegram

1. En Telegram, buscá **@BotFather** y abrí el chat.
2. Mandá `/newbot`.
3. Elegí un nombre (ej: *Mis Finanzas*) y un usuario que termine en `bot`
   (ej: `misfinanzas_ivan_bot`).
4. BotFather te da un **TOKEN** (algo como `8123456:AAH...`). **Copialo** al bloc.

---

## PASO 2 — Crear el proyecto en Supabase

1. Entrá a **https://supabase.com** → *Start your project* → registrate (con Google o mail).
2. *New project*. Poné un nombre (ej: `finanzas`), una contraseña de base (guardala)
   y la región **South America (São Paulo)**. Create.
3. Esperá 1–2 minutos a que termine de crearse.
4. Andá a **Project Settings** (el engranaje) → **API**. Copiá al bloc:
   - **Project URL** → es tu *URL de Supabase*.
   - **Project API keys → `anon` `public`** → es tu *Clave anon*.

---

## PASO 3 — Crear las tablas

1. En Supabase, menú izquierdo → **SQL Editor** → *New query*.
2. Abrí el archivo **`nube/1-esquema.sql`** (está en esta misma carpeta),
   copiá TODO y pegalo en el editor.
3. Apretá **Run** (o Ctrl+Enter). Tiene que decir *Success*.

---

## PASO 4 — Subir el bot (Edge Function)

1. En Supabase, menú izquierdo → **Edge Functions** → **Deploy a new function**
   (o *Create a new function*).
2. Nombre de la función: **`telegram-bot`** (exactamente así).
3. Se abre un editor de código: **borrá el ejemplo** y pegá TODO el contenido del
   archivo **`nube/telegram-bot/index.ts`** (está en esta carpeta).
4. **MUY IMPORTANTE:** buscá la opción **"Enforce JWT verification"** /
   *Verify JWT* y **desactivala** (queda en OFF). Si no, Telegram no va a poder
   hablarle al bot.
5. Apretá **Deploy**.
6. Ahora hay que cargar 2 "secretos". Andá a **Edge Functions → Secrets**
   (o *Project Settings → Edge Functions → Secrets*) y agregá:
   - Nombre `TELEGRAM_TOKEN`  → valor: el TOKEN del bot (paso 1).
   - Nombre `WEBHOOK_SECRET`  → valor: tu palabra secreta.
   (No hace falta cargar la URL ni la clave de Supabase: la función ya las tiene.)

La dirección de tu función queda así (anotala):

```
https://TU-URL.supabase.co/functions/v1/telegram-bot
```

(reemplazá `TU-URL` por lo de tu Project URL, ej: `abcdxyz`.)

---

## PASO 5 — Conectar el bot con la función (webhook)

Pegá esta dirección en el navegador, **reemplazando** el TOKEN, la URL y la
palabra secreta por los tuyos, y apretá Enter:

```
https://api.telegram.org/botTU_TOKEN/setWebhook?url=https://TU-URL.supabase.co/functions/v1/telegram-bot&secret_token=TU_PALABRA_SECRETA
```

Tiene que responder algo como: `{"ok":true,"result":true,"description":"Webhook was set"}`

---

## PASO 6 — Conectar la app

1. Abrí la app (index.html).
2. Arriba a la derecha, tocá el ícono de descarga (⤓) → **☁️ Conectar Telegram**.
3. Pegá la **URL de Supabase** y la **Clave anon**. Tocá **Guardar y probar**.
4. Si todo está bien, aparece "¡Conectado!" y un puntito celeste en el ícono.

---

## PASO 7 — ¡Probalo! (modo carrito)

En Telegram, abrí tu bot y mandá lo que vas comprando. Podés poner varios productos
en un mensaje o en varios:

```
2000 arroz, 2300 azúcar
5000 aceite
```

El bot te va llevando la cuenta y el **total**. Cuando terminás:
1. Tocás **✅ Sumar al total**.
2. Elegís la **categoría** (te sugiere una con ⭐).
3. Opcional: tocás **✏️ Nota** o mandás `/nota` para agregarle un dato (ej: *Chino de casa*).

En unos segundos **el gasto aparece solo en la app**, con su fecha y el detalle de productos.

Comandos útiles:
- `/historial` → tus últimos gastos del mes
- `/nota` → ponerle una nota al último gasto
- `/cancelar` → descartar la compra en curso
- `/resumen` → cómo venís este mes

---

## Si algo no anda

- **El bot no responde:** revisá que en el Paso 5 haya dicho `"ok":true`. Reintentá
  el link. Verificá que la función tenga *Verify JWT* en **OFF** (Paso 4.4).
- **La app dice "no se pudo conectar":** revisá que la URL y la clave *anon* sean
  las correctas (Paso 2.4), sin espacios.
- **El gasto no aparece en la app:** la app sincroniza cada ~5 segundos y solo
  cuando está abierta. Dale unos segundos o recargá.
- **Ver logs del bot:** Supabase → Edge Functions → `telegram-bot` → *Logs*.

Cualquier cosa, mandame la captura del error y lo resolvemos. 🙂
