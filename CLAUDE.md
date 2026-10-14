# CLAUDE.md — Mis Finanzas

App personal de finanzas (gastos, ingresos, deudas) en español rioplatense, pesos `es-AR`. JS vanilla, **sin build ni dependencias propias**. Hay una skill con más detalle de dominio: `.claude/skills/finanzas-personales-context` (leerla antes de tocar `app.js`/`index.html`/`nube/`). Este archivo es el mapa técnico de la exploración completa del repo.

## 1. Cómo está armada

Dos versiones de la misma app + backend en Supabase:

| Carpeta | Qué es |
|---|---|
| raíz (`index.html`, `app.js` ~100 KB, `styles.css`, `datos-iniciales.js`) | Versión **escritorio**. Se abre con doble clic (`file://`) o hosteada. |
| `movil/` | Versión **móvil / PWA**, con el **rediseño "verde profundo + vidrio" (oscuro/claro)** ya implementado en local (ver `docs/REDISENO.md`): `index.html` (shell, 6 páginas, nav de 5 pestañas, overlay del asistente), `styles.css` (tokens + componentes), `app.js` (lógica, un IIFE), `asistente.js` (pantalla de voz, elegir voz, reproductor ElevenLabs/navegador), `manifest.json`, `sw.js`, `icons/`. Chart.js, jsQR y supabase-js por CDN; sin Tailwind. Tiene chat IA, escáner de tickets, push y login. |
| `nube/` | Código fuente SQL + Edge Functions (Deno). **Nunca lo ejecuta el navegador**: se pega a mano en el dashboard de Supabase. No hay Deno instalado acá para tipar `*.ts`. |

- Cada `app.js` es un único IIFE `'use strict'`, funciones planas, sin módulos. `render()` re-renderiza todo; `actualizarCalculos()` es la liviana (no pierde foco de inputs).
- `datos-iniciales.js` **debe quedar siempre vacío** (`{meses:{}, deudas:[]}`): la app está en una URL pública (GitHub Pages) y antes tenía datos reales.
- `movil/sw.js`: cachea solo el cascarón estático; **subir `CACHE_VERSION` (hoy `v65`) y los `?v=` de `app.js` (`45`) / `styles.css` (`37`) / `asistente.js` (`7`) en `ASSETS` e `index.html` cada vez que se cambie algo**. También maneja Web Push (`push`, `notificationclick`).
- Categorías fijas (`CATEGORIAS` en `app.js`): vivienda, trabajo, alimentacion, transporte, salud, educacion, mascota, entretenimiento, ropa, seguros, ahorro. Están **duplicadas** en `nube/telegram-bot/index.ts` y `nube/chat-ia/index.ts` — si se agrega una, tocar los tres.

### Modelo de datos (`estado`)
Un único objeto, en `localStorage['misFinanzas_v1']`:
```
{ version, catNombres{}, presupuestos{cat:monto}, deudas[], chats[],
  meses{ "YYYY-MM": { ingresos[], gastos[] (acumuladores por fila),
                      movimientos[] (log real), deudasPagadas{} } } }
```
`gastos` son filas acumuladoras (las compras se **suman** a una fila, vía `registrarCompra`); `movimientos` es el historial real; `chats[]` guarda hasta 30 conversaciones del asistente (150 mensajes c/u).

### Persistencia y sincronización (3 modos, excluyentes)
1. **Local**: solo `localStorage`.
2. **Nube manual (legado, `file://`)**: `localStorage['misFinanzas_nube']={url,key}`; todo `estado` en una fila `finanzas` (`id='main'`) por `fetch` directo a PostgREST (sin SDK). Polling cada 5 s por `rev`. Usada con el bot viejo.
3. **Cuenta Google (`modoCuenta`, solo http/https)**: `supabase-js` (`sbClient`), `signInWithOAuth({provider:'google'})`. Cada usuario pertenece a **un** proyecto (`miembros`); `estado` completo en `proyectos.data` + `rev`. `guardar()` → debounce 800 ms → `guardarEnProyecto()` (`update` con `rev+1`, **sin control de concurrencia real**: gana el último). Polling cada 5 s de `proyectos.rev`; si subió y no hay un input enfocado, baja `data` y re-renderiza. Rol `lector` nunca escribe. `bootstrapProyecto` (movil/app.js ~850–940): busca membresía → si hay `?invite=token` llama `unirse-por-link` → si hay invitación pendiente por mail la reclama → si no, crea proyecto propio + membresía de dueño.
- Tras guardar, `avisarActividad()` invoca `enviar-notificacion` (máx. 1 cada 2 min) para avisar a los demás miembros.

### Edge Functions (`nube/*/index.ts`)
| Función | Qué hace | Auth |
|---|---|---|
| `telegram-bot` | Bot "carrito": productos → categoría → fila → nota; escribe en `proyectos` vía `service_role`. Vinculación por `/start CODIGO` (tabla `bot_codigos_vinculo` → `bot_vinculos`). Comandos `/historial /nota /cancelar /resumen`. | Header `x-telegram-bot-api-secret-token` == `WEBHOOK_SECRET` (JWT verify **OFF**) |
| `chat-ia` | Asistente de chat (ver §3). | JWT del usuario validado contra `/auth/v1/user` |
| `leer-ticket` | Lee ticket por URL (QR) o foto (`imagenBase64`) con NVIDIA. | JWT usuario |
| `invitar-colaborador` | Dueño invita por mail/rol. | JWT + chequea ser dueño |
| `unirse-por-link` | Canjea token de `invitaciones_link` (service_role). | JWT usuario |
| `enviar-notificacion` | Web Push a miembros del proyecto (excluye al emisor). | JWT + chequea membresía |
| `resumen-semanal` | Push semanal a todos los proyectos. | Header `x-cron-secret` == `CRON_SECRET` |
| `tts` | Texto a voz con ElevenLabs (streaming; recibe `texto` y `voz` 1 o 2; máx. 500 caracteres). **Escrita, no desplegada.** Secretos: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_1`, `ELEVENLABS_VOICE_2`, `ELEVENLABS_MODEL`. | JWT usuario |

Si cambia la forma de `estado.meses[k]` hay que actualizar a mano la lógica espejo del bot (no hay tipos compartidos).

## 2. Supabase: tablas y RLS

Proyecto: `iivjrpfkwkxgxzgyzrvq.supabase.co`. Orden de SQL: `1` → `2` → `4` → `5` → `6` → `7`/`8` (diagnóstico) → `9` → `10`.

| Tabla | Columnas | RLS (según el SQL) |
|---|---|---|
| `finanzas` (legado) | `id text PK`, `data jsonb`, `rev bigint`, `updated_by`, `updated_at` | **Policy `using(true) with check(true)` para `anon`, `for all`** → cualquiera con la URL + anon key lee y escribe. `nube/11-cerrar-tabla-legado.sql` la borra (junto con `debug_mi_uid()`); **verificar en el dashboard que se haya corrido**. Solo la usa el modo "nube manual" en `file://`. |
| `pending_bot` | `chat_id bigint PK`, `monto`, `nombre`, `sesion jsonb` (SQL 2), `created_at` | RLS on, sin policies → solo `service_role` (el bot). |
| `proyectos` | `id uuid PK`, `data jsonb`, `rev`, `dueno_id → auth.users`, `updated_by`, `created_at`, `updated_at` | SELECT: miembro aceptado. UPDATE: dueño/editor aceptado. INSERT: `dueno_id = auth.uid()`. Sin DELETE. |
| `miembros` | `id`, `proyecto_id`, `user_id` (null si pendiente), `email`, `rol` (`dueno/editor/lector`), `estado` (`pendiente/aceptado`), `created_at`; `unique(user_id)`, `unique(proyecto_id,email)` | SELECT: propia fila o de mi proyecto (vía `mi_proyecto_como()`). UPDATE: reclamar invitación propia (por email del JWT) o dueño administra. INSERT: solo uno mismo como dueño aceptado. DELETE: dueño, nunca filas con `rol='dueno'`. |
| `bot_vinculos` | `chat_id PK`, `proyecto_id`, `vinculado_por`, `created_at` | `for all` a dueño/editor del proyecto. |
| `bot_codigos_vinculo` | `codigo PK`, `proyecto_id`, `creado_por`, `usado`, `expira_en` (15 min) | `for all` donde `creado_por = auth.uid()`. |
| `invitaciones_link` | `token PK` (uuid text), `proyecto_id`, `rol` (`editor/lector`), `creado_por`, `usado_por`, `expira_en` (7 días) | INSERT/SELECT/DELETE solo dueño. Sin SELECT para no miembros: canje por `unirse-por-link`. |
| `push_subscripciones` | `id`, `proyecto_id`, `user_id`, `endpoint unique`, `p256dh`, `auth`, `creado_en` | `for all` si `user_id = auth.uid()` (y miembro aceptado al escribir). |

Funciones SQL: `mi_proyecto_como(rol_req text)` (security definer, rompe la recursión de RLS en `miembros`); `debug_mi_uid()` (diagnóstico temporal, **concedida a `anon`**; conviene borrarla). SQL 7 re-otorga `grant select,insert,update,delete` a `authenticated` sobre las tablas nuevas. SQL 10 programa `pg_cron` (domingos 23:00 UTC) → `net.http_post` a `resumen-semanal`.

Notas: la policy "editar mi proyecto" es por proyecto completo (un editor puede pisar todo `data`); el cliente puede escribir `data` arbitrario (el chat IA solo *propone*, el cliente es quien registra).

## 3. Chat con micrófono (solo `movil/`)

Flujo real, **sí llama a un backend**:
1. UI en `movil/index.html` (overlay `#chatBack`, clase `.asis`): FAB `#chatFab` → 3 vistas: voz (`#vConv`, círculo `.cwrap` con estados `idle|escuchando|hablando`), elegir voz (`#vElegir`) y chat de texto (`#chatPanel`, con `#chatMensajes`, `#chatInput`, historial, atajos). La lógica de vistas y voz vive en `movil/asistente.js`; el chat y el registro de gastos siguen en `app.js` (puente `window.MisFinanzas` / `window.MFAsis`). El reproductor pide el audio a la Edge Function `tts` frase por frase y cae a `speechSynthesis` si falla.
2. **Micrófono = Web Speech API del navegador** (`chatToggleMic`, movil/app.js ~292): `SpeechRecognition`/`webkitSpeechRecognition`, `lang 'es-AR'`, `interimResults`, `continuous=false`. Solo vuelca el texto al input; **no se envía solo** (hay que tocar enviar/Enter). Si el navegador no la soporta (Safari/iOS), el botón se oculta. No hay audio subido a ningún servidor propio.
3. Respuestas en voz: `speechSynthesis` (`chatHablar`, `es-AR`), preferencia en `localStorage['misFinanzas_chatVoz']`. Existen parámetros `alTerminar` pensados para un "Modo Voz" continuo, pero no se vio un botón que lo use.
4. `enviarMensajeChat` → `sbClient.functions.invoke('chat-ia', {mensaje, historial, contexto})` (`contexto` = resumen del mes: ingresos, gastos por categoría, balance, presupuestos, deudas, mes anterior).
5. `chat-ia/index.ts`: valida JWT, llama a **Claude** (API Messages de Anthropic; modelo por defecto `claude-sonnet-5-5`, configurable con el secreto `CLAUDE_MODEL`; key en `ANTHROPIC_API_KEY`; `llamarClaude()` normaliza el historial a roles alternados) con un system prompt (modo `voz` o `texto`) que exige JSON `{analisis?, respuesta, registrar[], presupuesto, pagosDeudas[], acciones[], buscarWeb}`. El asistente **solo modifica datos si el usuario se lo pide**; el cliente aplica las propuestas con sus propias funciones (`aplicarAccionesChat`/`ejecutarAccionChat`, `aplicarPagosDeudasChat`, `registrarCompra` con `fila` y `fecha`), cruzando nombres e ids con los datos reales, y guarda una foto del estado en memoria para el botón **Deshacer** (`deshacerCambiosChat`). Tipos de `acciones`: `mes_ir`, `mes_nuevo`, `movimiento_editar`, `movimiento_eliminar`, `fila_agregar`, `fila_editar`, `fila_eliminar`, `ingreso_agregar`, `ingreso_editar`, `ingreso_eliminar`, `deuda_agregar`, `deuda_editar`, `deuda_eliminar`, `presupuesto_quitar`, `categoria_renombrar` (se validan en `sanearAcciones` del servidor y se aplican con chequeos en el cliente). Las cuentas de solo lectura no pueden modificar. El contexto (`contextoFinancieroParaChat`) trae filas, movimientos recientes con id, presupuestos restantes, deudas y mes anterior. Si hay `buscarWeb`, consulta **Tavily** (general + sitios de Coto, Día, Carrefour, Jumbo, Vea) y hace una 2ª pasada; agrega las URLs reales como "Fuentes".
6. El **cliente** registra: `registrarCompra()` por cada ítem de `registrar` (con freno anti-duplicado `chatYaRegistrados`), fija presupuestos en `estado.presupuestos` y añade el progreso. La función nunca escribe en `proyectos`.
7. Historial en `estado.chats[]` (se sincroniza con el proyecto). Requiere sesión (`modoCuenta && miProyectoId`).

## 4. Claves y secretos en el repo

| Qué | Dónde | Evaluación |
|---|---|---|
| Google OAuth Client Secret | `CONECTAR-LOGIN-GOOGLE.md` | **Resuelto (fase 1):** rotado en Google y reemplazado por `TU_CLIENT_SECRET`. El valor viejo sigue en el historial de git (ya inválido). El Client ID sigue en la guía (no es secreto). |
| Supabase publishable (anon) key `sb_publishable_…` | `app.js:61`, `movil/app.js:62` | Pública por diseño; la seguridad depende del RLS (ojo con `finanzas`, §2). |
| Supabase URL del proyecto | `app.js`, `movil/app.js`, `CONECTAR-*.md`, `nube/10-cron-resumen-semanal.sql` | No es secreto. |
| VAPID **public** key | `movil/app.js:67` | Pública por diseño; la privada va como secreto de la función. |
| `TELEGRAM_BOT_USERNAME` (`misfinanzas_ivan_bot`) | `movil/app.js:64` | Público. |
| `'REEMPLAZAR_CON_UN_SECRETO_PROPIO'` | `nube/10-cron-resumen-semanal.sql:28` | Placeholder. **Cuidado:** no commitear el SQL con el secreto real pegado. |
| Email `ivan@example.com` | `enviar-notificacion`, `resumen-semanal` (default de `VAPID_SUBJECT`) | Placeholder. |

Sin valores en el repo (solo `Deno.env.get`): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `NVIDIA_API_KEY` (solo `leer-ticket`), `TAVILY_API_KEY`, `TELEGRAM_TOKEN`, `WEBHOOK_SECRET`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. No se encontraron JWT `eyJ…`, tokens de Telegram ni claves de API pegadas. No se pudo revisar el historial de git (`git` no está en el PATH de esta máquina).

## Cómo probar
- Móvil: servidor `mis-finanzas-static` (puerto 8765) → http://localhost:8765/movil/ , "Continuar como invitado". Tema en `<html class="oscuro|claro">`. Para capturas en el panel del entorno, el área visible es ~65 % del viewport emulado (usar 594×1287 + `max-width:390px` en `.shell` para ver 390 px). Para probar chat/voz sin Google hace falta una sesión simulada (ver `docs/REDISENO.md`).
- Node 24 y la Supabase CLI están instalados (`C:\Program Files\nodejs`, `C:\Users\Administrador\supabase-cli`; en una terminal ya abierta puede hacer falta la ruta completa). El proyecto se vincula con `--project-ref iivjrpfkwkxgxzgyzrvq`.
- `node --check movil/app.js` y `node --check app.js` antes de previsualizar.
- Para los `.ts` de `nube/` no hay type-check: `node:module.stripTypeScriptTypes` + `node --check` valida solo la sintaxis.
- Launch config `finanzas` (python `http.server`, puerto 8765) en `OneDrive - Argensys/.claude/launch.json`; el origen `localhost` tiene otro `localStorage` que `file://`. Para la versión móvil servir desde `movil/`.
- `nube/*.ts` no se puede chequear localmente: releer a mano antes de pedir que se re-suba.
- Chat/micrófono: `SpeechRecognition` requiere Chrome/Edge/Android (y HTTPS o localhost); el chat necesita login con Google para funcionar.
