# Rediseño de la app móvil (verde profundo + vidrio, oscuro/claro) y asistente de voz

Estado: **hecho y probado en local**, sin publicar. Referencia de diseño: `referencia-diseno/referencia-diseno/DISENO.md` y `pantallas.dc.html`.

## Respaldo
Antes de tocar nada se hizo un zip completo (incluye `.git`):
`C:\Users\Administrador\Backups\MisFinanzas-antes-del-rediseno-20261009-153643.zip`.
Para volver atrás: descomprimirlo en otra carpeta y copiar de ahí `movil\`, `nube\` y `CLAUDE.md`.

## Cómo verlo en local
1. El servidor ya está sirviendo la carpeta del repo en el puerto 8765 (config `mis-finanzas-static` en `.claude/launch.json`, `python -m http.server`).
2. Abrí **http://localhost:8765/movil/** (en el celular real: `http://<IP de la compu>:8765/movil/`, con la compu y el celular en la misma wifi).
3. Tocá **Continuar como invitado** (datos solo en ese navegador). El asistente y el escáner necesitan sesión con Google: para probar el login en localhost hay que agregar `http://localhost:8765` en Supabase (Authentication → URL Configuration → Redirect URLs) y en el cliente OAuth de Google.
4. Si algo "no cambia", es la caché del Service Worker: en DevTools → Application → Service Workers → Unregister, y recargar. (Ya se subieron `CACHE_VERSION` v53, `styles.css?v=31`, `app.js?v=37`, `asistente.js?v=2`.)

## Qué cambió (solo capa visual; la lógica de datos, sincronización, login, membresías e invitaciones NO se tocó)
| Archivo | Cambio |
|---|---|
| `movil/styles.css` | Reescrito: tokens oscuro/claro tal cual DISENO.md (sobre `<html class="oscuro|claro">`), componentes (card, btn, chip, badge, bar, tile, switch, radio), páginas, modales, login y asistente (círculo de nubes). Alias de las variables viejas (`--danger`, `--text-mute`, `--cyan`…) para no romper estilos en línea. |
| `movil/index.html` | Estructura nueva: encabezado (título + tema + ajustes), selector de mes, 6 páginas (Inicio, Gastos, Deudas, Historial, Análisis, Ajustes), barra de 5 pestañas, botones flotantes (asistente + "+"), overlay del asistente. Fuera: Tailwind CDN, Inter, JetBrains Mono, Material Symbols y el fondo WebGL. Manrope + íconos SVG de trazo. Script en `<head>` que aplica el tema antes de pintar. |
| `movil/app.js` | Plantillas HTML de los renders (hero, donut, gastos por categoría, deudas, historial por día, presupuesto por categoría con estados, análisis), navegación (`mostrarPagina` + Ajustes), tema (`aplicarTema`, `localStorage['misFinanzas_tema']`, `meta theme-color`), colores de Chart.js según tema, Ajustes ("Cuenta y compartir"), `vincularTelegram()` extraída de `modalMenu`, `modalElegirPresupuesto()`, tarjeta de resultado en el chat y puente `window.MisFinanzas`. |
| `movil/asistente.js` (nuevo) | Pantalla de voz (círculo con 3 estados reales), "Elige una voz", reproductor de frases con ElevenLabs + respaldo del navegador, contador mensual de caracteres, desbloqueo de audio. |
| `movil/sw.js`, `movil/manifest.json` | `CACHE_VERSION` v53, assets nuevos, colores del manifest. |
| `nube/tts/index.ts` (nuevo) | Edge Function de texto a voz (ElevenLabs). **No desplegada.** |
| `nube/11-cerrar-tabla-legado.sql` | (Fase anterior) sigue **sin aplicar**. |

Sin cambios: `app.js`/`index.html` de la raíz (versión escritorio), el resto de `nube/`, `datos-iniciales.js`.

## Funciones que se conservaron (todas accesibles en la interfaz nueva)
- **Botón "+"**: Escanear ticket (QR), Nuevo mes, Nuevo ingreso, Nuevo gasto (más los atajos `?accion=gasto|ingreso|chat` del manifest).
- **Inicio**: ocultar saldo, Agregar gasto, Respaldar, Evolución (Día/Sem/Mes/Año), dona por categoría, acceso a Análisis, selector de mes con "Hoy".
- **Gastos**: ingresos y gastos editables (cuentas tipo `200+120`), renombrar categoría, agregar fila.
- **Deudas**: agregar/editar/eliminar, Registrar pago / Revertir, cuotas pendientes.
- **Historial**: buscar, filtros mes/categoría/orden, editar y eliminar movimiento.
- **Análisis**: presupuesto por categoría (anillo, estados *En rango* < 75 % · *Al límite* 75–100 % · *Excedida* > 100 %, ordenado por riesgo, "Editar" y atajo al asistente), flujo por mes, gastos por día, simulador, últimos movimientos, recurrentes, **puntaje de eficiencia**, cuotas pendientes, **Exportar**.
- **Ajustes**: tema, voz del asistente y "Leer respuestas", **Cuenta y compartir** (vincular con Google, invitar por mail/link con rol, miembros, notificaciones push, Telegram, respaldar/restaurar/empezar de cero/borrar meses futuros, cerrar sesión).
- **Asistente**: chat con historial de conversaciones, registro de gastos y presupuestos por chat (con tarjeta de resultado y "deshacer"), dictado, voz.

## Asistente de voz
- Estados del círculo (clase en `.cwrap`), todos por eventos reales: **escuchando** = `SpeechRecognition` activo *o* esperando la respuesta de `chat-ia`; **hablando** = mientras suena audio; **idle** = el resto. `prefers-reduced-motion` apaga las animaciones.
- Tocar el círculo: hablando → corta el audio y cancela pedidos pendientes; escuchando → termina de dictar y envía; idle → empieza a escuchar.
- Voz elegida en `localStorage['misFinanzas_vozAsistente']` (`'1'` mujer, `'2'` hombre).
- Reproductor: parte la respuesta en frases, las pide a `tts` de a una **mientras suena la anterior**, guarda en memoria el audio de frases repetidas (solo en la sesión) y desbloquea el audio en el primer toque (iOS/Chrome).
- Respaldo: si `tts` falla, no está desplegada o se acaba la cuota → voz del navegador `es-AR` + aviso discreto (una vez). Contador de caracteres por mes en `localStorage['misFinanzas_ttsUso']` (por dispositivo), aviso al 80 % (8.000) y corte al 100 % (10.000); se ve en Ajustes.
- Hasta que `tts` esté desplegada, la primera respuesta hablada muestra "La voz premium no está disponible ahora: uso la del navegador" y sigue con la voz del navegador.

### Para activar la voz de ElevenLabs (lo hacés vos; no se desplegó nada)
Secretos (nombres exactos): `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_1`, `ELEVENLABS_VOICE_2`, opcional `ELEVENLABS_MODEL` (por defecto `eleven_flash_v2_5`).
```powershell
supabase secrets set ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_1=... ELEVENLABS_VOICE_2=... --project-ref iivjrpfkwkxgxzgyzrvq
```
Deploy (mismo método que `chat-ia`; `verify_jwt` queda activado por defecto):
```powershell
$stage = Join-Path $env:TEMP 'deploy-tts'
New-Item -ItemType Directory -Force "$stage\supabase\functions\tts" | Out-Null
Copy-Item 'nube\tts\index.ts' "$stage\supabase\functions\tts\index.ts" -Force
& 'C:\Users\Administrador\supabase-cli\supabase.exe' functions deploy tts --project-ref iivjrpfkwkxgxzgyzrvq --use-api --workdir $stage
```

## Qué se probó (navegador del entorno, 390 px, oscuro y claro, sesión simulada)
Consola sin errores. Se recorrieron: las 6 páginas, tema (persistencia + `theme-color`), menú "+", nuevo gasto con cuenta `1000+500`, nuevo ingreso, nuevo mes/Hoy, registrar/revertir/editar/eliminar deuda, buscar/ordenar/editar/eliminar en Historial, categorías (abrir, agregar, calcular, borrar, renombrar), ocultar saldo, Evolución en los 4 modos, simulador, presupuestos (editar, elegir categoría), modales de datos y de cuenta (invitar por mail, link, miembros), Telegram (genera el link), cerrar sesión visible, login con invitado, y el asistente completo (dictado → "Pensando…" → "Hablando…" → idle, tarjeta de gasto, deshacer, historial de conversaciones, elegir voz, cortar el audio, caché, cuota/caída de `tts`, aviso al 80 %).

## Pendiente / límites (no verificado)
- **Rama `rediseno-ui`: no se creó.** Git no está instalado en esta máquina y se rechazó instalarlo. Los cambios están en el árbol de trabajo (sobre `main`, sin commit). Antes de commitear: instalar Git y hacer `git switch -c rediseno-ui`. Nada se subió a GitHub.
- **Cámara/QR**: el panel del entorno bloquea la cámara; el escáner y la foto de ticket (código sin cambios, solo estilos) hay que probarlos en un celular.
- **Micrófono y voces reales**: el dictado se probó con un reemplazo; probar en Chrome/Android real. En Safari/iOS no existe `SpeechRecognition`: el asistente abre directo el chat de texto y lee las respuestas.
- **Login con Google, push y envío real de invitaciones**: se usó un Supabase simulado; falta probar con la cuenta real (ver cómo agregar `localhost`, arriba).
- Las voces 1/2 sin ElevenLabs dependen de las voces instaladas en el dispositivo (acento y género pueden variar).
- El contador de caracteres es por dispositivo; el consumo real de ElevenLabs es de la cuenta.
- Se quitó la agrupación "Tarjetas / Préstamos" del prototipo en Deudas: el modelo de datos no distingue el tipo.
- **Escritorio (PC, desde 900 px de ancho):** mismo diseño con barra lateral fija a la izquierda (Inicio, Gastos, Análisis, Deudas, Historial), contenido a todo el ancho en grillas (Inicio: evolución + dona lado a lado; Gastos y Deudas en dos columnas; Historial por días en dos columnas; Análisis de a pares; Ajustes en dos columnas), ventanas emergentes centradas y botones flotantes abajo a la derecha. Todo vive en un único bloque `@media (min-width: 900px)` al final de `movil/styles.css`, así el celular no cambia. Entre 520 y 899 px (tablet) queda la columna centrada de 480 px.

## Cambios posteriores (octubre 2026)
- **Bug de toques (grave):** el contenedor de los botones flotantes (`.fabs`) ocupaba una zona de la pantalla aun con el menú "+" cerrado y se comía los toques de lo de abajo (por eso fallaban "Registrar pago" y el monto de un gasto, que están a la derecha). Ahora `.fabs` tiene `pointer-events:none` y solo reciben toques los botones. Se revisaron todos los botones/campos de todas las páginas, modales y vistas del asistente comprobando qué elemento queda realmente encima del centro de cada uno (celular, tablet y PC; 0 tapados), más toques reales sobre "Registrar pago" y el monto de un gasto.
- **Colores de categorías:** 11 colores distintos (nuevos `--c8` a `--c12`, `.ct8`–`.ct12`) y la leyenda de la dona lista todas las categorías (sin "Otras").
- **Asistente en PC:** ventana flotante centrada sobre la app (tocar afuera la cierra); el cajón de historial ya no se asoma sobre la barra lateral.
- **Asistente en celular:** al tocar la burbuja se abre primero el **chat**; el micrófono, al lado de la escritura, pasa a la pantalla de voz.
- **Pagos por chat/voz:** "ya pagué la tarjeta naranja, marcala como pagada" marca (o con "desmarcá…" revierte) el pago con las mismas funciones de la sección Deudas. Requiere **redesplegar `chat-ia`** (contrato nuevo `pagosDeudas`); con la versión vieja simplemente no marca nada.
- **Voces:** los secretos `ELEVENLABS_VOICE_1/2` están cargados con los nombres correctos, pero la función `tts` **no estaba desplegada** (por eso se oía la voz del navegador). `tts` ahora limpia espacios/comillas de los secretos.

## Próximos pasos (anotados, NO hechos)
1. Rutina mensual de plan de comida y lista de compras (tabla `planes_mensuales`, Edge Function `plan-mensual`, cron, pantalla "Comida del mes"). Los atajos del chat "Armar el plan del mes" / "Lista de compras" del prototipo no se agregaron porque todavía no existen.
2. Pasar `leer-ticket` a Claude (hoy usa NVIDIA; `NVIDIA_API_KEY` sigue siendo necesaria).
3. Limpiar el secreto viejo de Google del historial de git (ya está rotado).
4. Cambiar el hosting.
5. Aplicar `nube/11-cerrar-tabla-legado.sql` (sigue pendiente).
