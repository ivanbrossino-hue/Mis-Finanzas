# Registro rápido (rama `registro-rapido`)

Documento en construcción; la versión completa (endpoints, ejemplos, cómo probar) se escribe en la Fase 4.

## Notas para la Fase 3 (interfaz web)

- **"Registrar" una propuesta desde la web debe ser idempotente.** El id del movimiento se deriva del id de la propuesta
  (por ejemplo `rp_<id de la propuesta>`), no se genera al azar. Si ya existe un movimiento con ese id, no se vuelve a sumar.
- **La propuesta se marca como `registrado` solo si el guardado en `proyectos` tuvo éxito** (la actualización condicional por `rev`
  confirmó). Si el guardado falla, la propuesta sigue `pendiente`. Así repetir la acción (doble toque, reintento, otro dispositivo)
  no duplica el gasto.
- Orden: 1) crear el movimiento y guardar el proyecto, 2) recién entonces `update` de la propuesta
  (`estado='registrado'`, `categoria_final`, `fila_final`, `movimiento_id`, `resuelto_en`, `resuelto_por`).

## Fase 1b: sincronización segura (hecha)

- `movil/sync-merge.js`: `MFSync.merge(base, local, remoto)` (fusión de tres vías) y `MFSync.sincronizar(ctx)` (guardar con
  `UPDATE ... WHERE rev = el_leído`, y ante conflicto: bajar, fusionar y reintentar hasta 3 veces).
- `guardarEnProyecto` (movil/app.js) ahora usa eso. La base (último estado sincronizado) se guarda en
  `localStorage['misFinanzas_base_<proyecto>']`; el arranque y el poll de 5 s también fusionan en vez de pisar cambios locales sin subir.
- Reglas: bajas respetadas (no resucitan), edición gana a baja ajena, `monto` de filas de `gastos` por delta, texto en conflicto gana lo local,
  campos desconocidos se conservan, mes creado a la vez en dos lados se unifica por categoría+nombre.
- Pruebas: `node tests/sync-merge.test.js`.

## Fase 2: función `gasto-rapido` (deployada, verify_jwt apagado)

Ver el encabezado de `nube/gasto-rapido/index.ts` (endpoints, alcances, límites). Pruebas simuladas: `node tests/gasto-rapido.test.js`.
`proyectos.updated_by` es `text` (nube/4-proyectos-y-colaboradores.sql): la función escribe `atajo:<8 caracteres del id del token>`.

## Fase 3: interfaz (movil/)

- **Ajustes > Atajos del celular** (solo dueño/editor con sesión): "Conectar un celular" elige iPhone (alcance `gasto`) o Android (`detector`),
  genera en el navegador un token `mfa_<43 caracteres>`, sube solo su SHA-256 a `tokens_atajo` y muestra el token UNA vez (con la URL base).
  La lista muestra cada dispositivo con su último uso y el botón **Revocar**.
- **Pendientes** (ícono en el encabezado con contador, se refresca cada 20 s): para cada propuesta se puede cambiar categoría y fila y
  **Registrar** o **Ignorar**. Registrar usa el id `rp_<id de la propuesta>`, guarda en la nube y recién entonces marca la propuesta
  como registrada (si algo falla, repetir no duplica).
- **Historial**: los movimientos con `origen` muestran la marca "📲 iPhone/Android".
