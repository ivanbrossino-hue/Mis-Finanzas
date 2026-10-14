// Servidor HTTP LOCAL con la función gasto-rapido sobre el simulador en memoria (sin Supabase ni Claude reales).
// Sirve para ensayar los scripts de curl sin tocar datos reales:
//
//   node tests/servidor-simulado.js            (imprime los tokens de prueba y queda escuchando en el puerto 8799)
//   BASE_URL=http://localhost:8799/functions/v1/gasto-rapido TOKEN=<token> bash scripts/prueba-gasto-rapido.sh
//
// Los tokens de este servidor son falsos y solo existen mientras corre. Claude se simula: un texto "Pagaste $ 1" se
// interpreta como un pago de ese monto; cualquier otro texto no es un pago.
'use strict';
const http = require('node:http');
const sim = require('./sim-gasto-rapido.js');
const { db, limpiarBD, crearToken } = sim;

const hoy = sim.F.hoyAR();
const [y, m] = hoy.slice(0, 7).split('-').map(Number);
const d = new Date(Date.UTC(y, m - 2, 1));
const previo = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
limpiarBD({ previo });
db.anthropic = (cuerpo) => {
  const t = JSON.stringify(cuerpo.messages);
  const mm = /Pagaste \$ ?([\d.]+)/.exec(t);
  return mm ? { es_pago: true, tipo: 'gasto', monto: parseFloat(mm[1].replace(/\./g, '')), comercio: 'PRUEBA SCRIPT', categoria_sugerida: 'alimentacion' } : { es_pago: false };
};
const tokens = { TOKEN_GASTO: crearToken('gasto').token, TOKEN_GASTO_2: crearToken('gasto').token, TOKEN_DETECTOR: crearToken('detector').token };

const PUERTO = Number(process.env.PUERTO || 8799);
http.createServer(async (req, res) => {
  const trozos = [];
  for await (const c of req) trozos.push(c);
  const cuerpo = Buffer.concat(trozos);
  const request = new Request('http://localhost:' + PUERTO + req.url, {
    method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : cuerpo,
  });
  const r = await sim.manejador()(request);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PUERTO, () => {
  console.log('Servidor simulado en http://localhost:' + PUERTO + '/functions/v1/gasto-rapido');
  for (const [k, v] of Object.entries(tokens)) console.log(k + '=' + v);
  console.log('\nCtrl+C para cortar.');
});
