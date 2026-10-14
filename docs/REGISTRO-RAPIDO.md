# Registro rápido de gastos (rama `registro-rapido`)

Un único backend (la Edge Function `gasto-rapido`) para tres clientes:

| Cliente | Qué hace | Alcance del token |
|---|---|---|
| **iPhone** (atajo del Centro de control) | Pregunta categoría, concepto, monto y nota, y registra el gasto directo | `gasto` |
| **Android** (app nativa pequeña, etapa posterior) | Detecta pagos de Mercado Pago por sus notificaciones y deja una propuesta | `detector` |
| **App web** (`movil/`) | Muestra las propuestas pendientes para registrarlas o ignorarlas; administra los tokens | (usa la sesión de Google, no tokens) |

Estado de las fases: 0 diseño ✔ · 1 SQL 12 ✔ (aplicado) · 1b sincronización segura ✔ · 2 función ✔ (deployada) · 3 interfaz ✔ · 4 pruebas y documentación ✔ ·
**Pendiente:** SQL 13, auditoría de escritores (ver más abajo), atajo del iPhone, app de Android. Nada de esto está en `main` todavía.

## 1. Cómo se escribe sin pisar a nadie

Todos los escritores de `proyectos.data` (la app de cada persona, la función, y en el futuro el bot) tienen que guardar con condición:

```
UPDATE proyectos SET data = …, rev = <leído>+1 WHERE id = … AND rev = <leído>   -- 0 filas = alguien escribió antes
```

* **La función** (`gasto-rapido`): relee el estado y **reaplica la misma operación** (hasta 3 reintentos con espera al azar). Si no puede, responde `503 ocupado` y no guarda nada. Las operaciones son idempotentes (`idem` / id derivado de la propuesta).
* **La app** (`movil/sync-merge.js`): ante un conflicto baja lo remoto y hace una **fusión de tres vías** (base = último estado sincronizado, local, remoto): las altas, ediciones y bajas locales se aplican sobre lo remoto; las bajas no resucitan; una edición gana contra un borrado ajeno; el `monto` de las filas de gastos se fusiona por delta; el texto en conflicto gana lo local; los campos desconocidos (`origen`, `dispositivo`, `creadoEn`) se conservan.
* Un mes creado a la vez en los dos lados (la app y la función copian el anterior con ids nuevos) se unifica por categoría y nombre.

## 2. La función `gasto-rapido`

* **URL base:** `https://iivjrpfkwkxgxzgyzrvq.supabase.co/functions/v1/gasto-rapido`
* **Autenticación:** `Authorization: Bearer mfa_<43 caracteres>`. Se deploya con `verify_jwt` **apagado** (el atajo no tiene JWT de Supabase). La seguridad es el token: 256 bits aleatorios, en la base solo el hash SHA-256, comparación en tiempo constante, revocable, con alcance y tope de **60 pedidos por hora por token**. En cada pedido se verifica que el dueño del token siga siendo dueño o editor aceptado del proyecto.
* **Secretos:** `ANTHROPIC_API_KEY` (ya cargado) y `PARSER_MODEL` (opcional, por defecto `claude-haiku-5-5`).
* Mes: si la fecha cae en un mes que no existe, solo se crea cuando es el **mes actual en horario Argentina** y hay un mes anterior para copiar (se marca `creadoPor: "atajo"`). Si no, el gasto queda como propuesta pendiente (`202`).

### Alcances

| Endpoint | `gasto` (iPhone) | `detector` (Android) |
|---|:--:|:--:|
| `GET /config` | ✔ | ✔ |
| `POST /gasto` | ✔ | ✘ |
| `POST /propuesta` | ✔ (`ios-comprobante`, `manual`) | ✔ (solo `android-notif`) |
| `POST /propuesta/:id/confirmar` y `/ignorar` | ✘ | ✔ |
| `POST /deshacer` | ✔ | ✔ |

### Endpoints y ejemplos

Reemplazá `$TOKEN` por el código que muestra la app (no lo pegues en archivos ni en chats).

```bash
BASE=https://iivjrpfkwkxgxzgyzrvq.supabase.co/functions/v1/gasto-rapido

# Categorías, conceptos (filas) del mes sin montos, y comercios conocidos
curl -s "$BASE/config" -H "Authorization: Bearer $TOKEN"

# Registrar un gasto. monto puede ser número o cuenta ("200+120", "(1500+300)*2", "1.500,50"); concepto null = fila general de la categoría
curl -s -X POST "$BASE/gasto" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"categoria":"alimentacion","concepto":null,"monto":"200+120","nota":"verdulería","idem":"unico-123456"}'
# 201 {"ok":true,"id":"rq_unico-123456","categoria":"alimentacion","concepto":"Supermercado / almacén","monto":320,"fecha":"2026-10-14","totalCategoriaMes":320}
# Repetir el mismo "idem" devuelve 200 con "repetido":true y NO suma de nuevo.

# Interpretar una notificación o un comprobante (texto o imagenBase64 JPEG/PNG/WEBP/GIF de hasta 4,5 MB; HEIC no)
curl -s -X POST "$BASE/propuesta" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"origen":"android-notif","texto":"Pagaste $ 3.500 a Kiosco Don Pepe"}'
# 201 {"id":"<uuid>","estado":"pendiente","tipo":"gasto","monto":3500,"comercio":"Kiosco Don Pepe","fecha":"…",
#      "sugerencia":{"categoria":"alimentacion","concepto":null},"confianza":0.5,"comercio_conocido":false}
# 200 con "ya_existe":true si hay otra igual hace menos de 3 minutos (solo orígenes automáticos). {"ignorado":true} si no es un pago.

curl -s -X POST "$BASE/propuesta/<id>/confirmar" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"categoria":"alimentacion","concepto":"Kiosco"}'      # categoria/concepto/monto opcionales (si no, usa lo sugerido). Registra con id rp_<id>
curl -s -X POST "$BASE/propuesta/<id>/ignorar" -H "Authorization: Bearer $TOKEN" -d '{}'

# Deshacer un registro hecho por este mecanismo (menos de 10 minutos). La propuesta de origen vuelve a quedar pendiente.
curl -s -X POST "$BASE/deshacer" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"id":"rq_unico-123456"}'
```

> Los textos de notificación de este documento y de los scripts son **supuestos**: no se conoce el texto real de Mercado Pago.
> El mapa de comercios se aprende de las propuestas que ya registraste (`comercio_norm` → categoría y fila que elegiste).

### Códigos de error

Las respuestas de error son `{"error":"<código>","mensaje":"…"}`.

| Estado | `error` | Cuándo |
|---|---|---|
| 400 | `monto_invalido` · `categoria_invalida` · `fecha_invalida` · `fecha_futura` · `idem_invalido` · `json_invalido` · `origen_invalido` · `falta_contenido` · `imagen_invalida` · `id_invalido` · `categoria_requerida` | Datos mal formados (el monto tiene que ser > 0 y ≤ 1.000 millones) |
| 401 | `token_invalido` · `token_revocado` | Sin token, con formato raro, desconocido o revocado |
| 403 | `sin_permiso` · `alcance_insuficiente` · `no_deshacible` | El dueño del token ya no edita el proyecto; el alcance no permite esa operación; el registro no se creó por atajo |
| 404 | `ruta_inexistente` · `propuesta_inexistente` · `proyecto_inexistente` · `no_encontrado` | No existe (o ya estaba deshecho) |
| 409 | `mes_no_disponible` · `ya_resuelta` · `pasaron_mas_de_10_minutos` | Mes que no se puede crear; propuesta ya ignorada/registrada; ventana de deshacer vencida |
| 413 | `pedido_demasiado_grande` · `texto_demasiado_largo` · `imagen_demasiado_grande` | Límites de tamaño |
| 415 | `solo_imagenes` | El archivo no es JPEG/PNG/WEBP/GIF (convertí las HEIC a JPEG) |
| 429 | `demasiados_pedidos` | Más de 60 pedidos en una hora con ese token |
| 502 | `no_pude_leer` · `no_pude_guardar` · `no_pude_verificar` · `no_pude_interpretar` | Falla de la base o de Claude (no se guardó nada) |
| 503 | `ocupado` | Alguien escribió a la vez y se agotaron los 3 reintentos (no se guardó: reintentar) |
| 202 | (`pendiente:true`) | `/gasto` en un mes que no se puede crear: quedó como propuesta pendiente, no se perdió |

## 3. En la app (Ajustes y Pendientes)

* **Ajustes → Atajos del celular** (solo dueño o editor): "Conectar un celular" genera el token **en el navegador**, sube solo su hash y lo muestra **una vez** (copiar el código y la dirección). La lista muestra cada dispositivo con su último uso y **Revocar**.
* **Pendientes** (ícono del encabezado, con contador): cambiar categoría y fila, **Registrar** o **Ignorar**. Registrar usa el id `rp_<id de la propuesta>`, guarda en la nube y recién entonces marca la propuesta como registrada; si algo falla, repetir no duplica.
* **Historial**: los movimientos hechos desde el celular llevan una marca con un ícono de teléfono y el dispositivo.
* **Ajustes → Versión**: abajo de todo dice `Versión N · sincronización segura activa`. Sale del `?v=` con el que se cargó `app.js`, así que muestra lo que realmente está corriendo en ese celular.

## 4. Cómo revocar un token

* **Desde la app:** Ajustes → Atajos del celular → **Revocar** en el dispositivo. Tiene efecto en el siguiente pedido (el token deja de servir al instante). Un token revocado no se puede reactivar.
* **Desde el SQL Editor** (si no tenés la app a mano), uno o todos:
  ```sql
  update public.tokens_atajo set revocado = true where id = '<id del token>';
  update public.tokens_atajo set revocado = true where not revocado;      -- todos
  ```
* Un token también deja de valer si su dueño deja de ser dueño o editor del proyecto.

## 5. Cómo deshacer el SQL 12

Está al final de `nube/12-registro-rapido.sql` (bloque comentado). Resumen (borra también los datos de esas dos tablas):

```sql
alter publication supabase_realtime drop table public.movimientos_pendientes;   -- si dice "not part of the publication", ignorarlo
drop table if exists public.movimientos_pendientes;
drop table if exists public.tokens_atajo;
drop function if exists public.consumir_cupo_atajo(uuid, integer);
drop function if exists public.tokens_atajo_no_desrevocar();
```

Antes, **revocá los tokens**. Lo que la función ya escribió en `proyectos.data` **no se borra** con el SQL: los movimientos quedan (con los campos extra `origen`, `dispositivo`, `creadoEn`, que las versiones viejas de la app ignoran) y los meses creados llevan `creadoPor:"atajo"`. Para ver exactamente qué escribió la función (solo lectura):

```sql
select m.key as mes, mv->>'id' as id, mv->>'fecha' as fecha, mv->>'monto' as monto, mv->>'origen' as origen
from public.proyectos p, jsonb_each(p.data->'meses') m, jsonb_array_elements(coalesce(m.value->'movimientos','[]'::jsonb)) mv
where mv->>'id' like 'rq\_%' or mv->>'id' like 'rp\_%'
order by 1, 2;
```

Cada uno se puede borrar desde la app (Historial → papelera), que también resta el monto de la fila.

## 6. Pruebas

| Qué | Cómo |
|---|---|
| Fusión de tres vías (13 pruebas) | `node tests/sync-merge.test.js` |
| La función contra un Supabase y un Claude **simulados** (37 pruebas: auth, alcances, tope de 60/h, `/gasto`, idem, meses, concurrencia, propuestas, duplicados, deshacer, logs) | `node tests/gasto-rapido.test.js` |
| Un servidor local con la función simulada, para ensayar los scripts sin tocar nada | `node tests/servidor-simulado.js` (imprime tokens falsos) |
| La función **real** de punta a punta con curl | `TOKEN='mfa_…' bash scripts/prueba-gasto-rapido.sh` (sin `TOKEN` solo comprueba los 401). Usa 1 peso y lo deshace |
| Concurrencia contra la base **real** con 2 tokens | ver 6.1 |

Los simuladores reproducen el comportamiento esperado de la base; no reemplazan probar contra Supabase de verdad.

### 6.1 Repetir la prueba de concurrencia contra la base real

1. En Ajustes → Atajos del celular → Conectar un celular, generá **dos** tokens de tipo **iPhone** (`prueba A` y `prueba B`).
2. Desde una terminal con Git Bash (o cualquier shell con curl):
   ```bash
   TOKEN_A='mfa_…' TOKEN_B='mfa_…' bash scripts/prueba-concurrencia.sh        # N=6 pedidos simultáneos de 1 peso, MONTO y N configurables
   ```
3. El script registra un gasto inicial, lanza N pedidos a la vez (mitad con cada token), registra uno final y comprueba que `total final = total inicial + (registrados + 1) × monto`. Después deshace todo (hay 10 minutos).
4. Resultado esperado: `RESULTADO: OK`. Es normal que algún pedido dé `503 ocupado` si hay muchísima actividad (no se guarda y se reintenta); lo que **no** puede pasar es que el total sea menor al esperado.
5. **Revocá** los dos tokens de prueba.

## 7. Auditoría de escritores de `proyectos` y SQL 13 (estado)

Quién escribe `proyectos.data`:

| Escritor | Cómo escribe hoy | Estado |
|---|---|---|
| `movil/app.js` (v44 en adelante) | Condicional por `rev` + fusión de tres vías | ✔ protegido |
| `gasto-rapido` | Condicional por `rev` + reintentos | ✔ protegido |
| **`nube/telegram-bot`** (`writeState`) | `PATCH ?id=eq.X` con `rev+1` de lo que leyó, **sin condición y sin mirar el resultado** | ⚠ ventana corta en la que puede pisar |
| **`app.js` de la raíz** (versión de escritorio, modo cuenta de Google) | `update … .eq('id')` con `rev = local+1`, **sin condición**; el poll usa `<=` | ⚠ **escritor a ciegas** si se usa la URL de la raíz con Google |
| `unirse-por-link` | Solo borra un proyecto propio sin usar o con confirmación | sin riesgo de pisar |
| `resumen-semanal`, `enviar-notificacion`, `chat-ia`, `leer-ticket`, `tts`, `precio-producto`, `invitar-colaborador` | Solo leen o no tocan `proyectos` | — |
| `app.js` de la raíz y `movil/app.js` al crear el proyecto (`insert`) | Alta inicial | — |

**SQL 13 (trigger que exige `rev = anterior + 1`): NO está escrito ni aplicado.** Sería una red de seguridad en la base: cualquier `UPDATE` de `proyectos` cuyo `rev` nuevo no sea exactamente el anterior más 1 se rechaza. Antes de aplicarlo hay que resolver los dos escritores marcados ⚠, porque con el trigger:
* el **bot** recibiría un error que hoy ignora y le diría "✅ cargado" a una persona cuyo gasto no se guardó;
* la **app de la raíz** perdería el cambio local de alguien con datos viejos.

Orden recomendado: (1) pasar el bot a escritura condicional con reintentos (cambio chico, igual que `gasto-rapido`), (2) hacer lo mismo con la app de la raíz o dejarla de usar (redirigir a `/movil/`), (3) con los dos celulares ya en la versión nueva, recién ahí escribir y aplicar el SQL 13.

## 8. Checklist de despliegue

En este orden. No generes tokens antes del paso **d**.

**a. Respaldos**
- [ ] En la app (cada uno): Ajustes → Respaldar y restaurar → **Descargar copia** (JSON). Guardarla fuera del teléfono.
- [ ] En Supabase → SQL Editor: `select id, rev, updated_by, updated_at, data from public.proyectos;` → **Download CSV/JSON**. Guardarlo.
- [ ] Anotar los hashes: tag de vuelta atrás `pre-sync-change` (commit `f16a875`) y el último commit de `registro-rapido`.

**b. Mezclar a `main` y publicar**
- [ ] `git checkout main && git merge --no-ff registro-rapido && git push origin main` (lo hago yo cuando me des el OK).
- [ ] Esperar 1–3 minutos a que GitHub Pages publique y comprobar que sirve lo nuevo, por ejemplo: `curl -s https://ivanbrossino-hue.github.io/Mis-Finanzas/movil/index.html | grep -o 'app.js?v=[0-9]*'` (ajustar el dominio si es otro) → tiene que decir `app.js?v=46` (o la versión actual).

**c. Los dos celulares abren la app nueva (dos veces cada uno)**
- [ ] 1.ª apertura: la app todavía usa lo viejo guardado en el celular y baja la versión nueva en segundo plano.
- [ ] 2.ª apertura (cerrar del todo y volver a abrir): ya corre la nueva.
- [ ] Ajustes → abajo de todo tiene que decir **`Versión 46 · sincronización segura activa`**. Si dice otra versión o "sin sincronización segura", cerrarla del todo y abrirla de nuevo (o reinstalar el acceso directo). **Los dos** celulares (y la PC) tienen que decirlo antes de seguir.
- [ ] Usar la app de la raíz (versión de escritorio vieja) **no** es seguro mientras no esté resuelto el punto ⚠ de la sección 7: en la PC usar `/movil/`.

**d. Recién ahora, tu token (Android) y la prueba de 1 peso**
- [ ] Ajustes → Atajos del celular → Conectar un celular → **Android** → copiar el código (no se vuelve a mostrar).
- [ ] Probar: `TOKEN='mfa_…' bash scripts/prueba-gasto-rapido.sh` (usa 1 peso en Alimentación y lo deshace). Con token de Android prueba el flujo de propuestas (el texto de ejemplo es un supuesto).
- [ ] Ver en la app: la propuesta/gasto aparece (Pendientes o Historial con la marca del teléfono) y desaparece al deshacer.

**e. Tu pareja ve el movimiento y todo sigue sincronizado**
- [ ] Repetir un registro de 1 peso **sin** deshacer; en el celular de tu pareja (con la app abierta) tiene que aparecer en unos segundos ("Actualizado ☁️") en Historial.
- [ ] Que cada uno cargue un gasto a mano a la vez (mismo momento) y verificar que **ambos** aparecen en los dos celulares y en `select data from proyectos`.
- [ ] Deshacer o borrar los de prueba. Opcional: `TOKEN_A=… TOKEN_B=… bash scripts/prueba-concurrencia.sh` (sección 6.1).

**f. Volver atrás**
- [ ] **Revocar tokens** (sección 4): app o SQL.
- [ ] **Código:** `git revert -m 1 <hash del merge>` en `main` y `git push` (Pages vuelve a publicar la versión anterior). El tag `pre-sync-change` apunta al último commit de `main` antes de todo esto, para comparar o crear una rama de rescate: `git checkout -b rescate pre-sync-change`. Cada celular recupera la versión anterior con la misma regla de dos aperturas.
- [ ] **Función:** se puede dejar deployada (sin tokens vigentes no responde a nadie) o borrarla desde el panel de Supabase → Edge Functions.
- [ ] **SQL 12:** sección 5 (después de revocar tokens).
- [ ] **Datos que ya escribió la función:** quedan en `proyectos.data` (movimientos con `rq_`/`rp_`, meses con `creadoPor:"atajo"`). Las versiones viejas de la app los muestran como cualquier movimiento (ignoran los campos extra). Para listarlos usar la consulta de solo lectura de la sección 5 y borrarlos desde el Historial si hace falta. Si se quiere volver exactamente al estado previo, restaurar el respaldo del paso **a** (Ajustes → Respaldar y restaurar), sabiendo que se pierde todo lo cargado después.
- [ ] Una app vieja (anterior a la v44) que quede abierta en algún celular vuelve a guardar "a ciegas": después de volver atrás, abrir la app dos veces en cada celular.
