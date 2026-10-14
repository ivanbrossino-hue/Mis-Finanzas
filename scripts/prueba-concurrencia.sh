#!/usr/bin/env bash
# Prueba de concurrencia contra la base REAL: varios registros a la vez desde DOS tokens distintos, y se comprueba que no se
# pierda ninguno (la escritura es condicional por rev, con reintentos).
#
#   TOKEN_A='mfa_...' TOKEN_B='mfa_...' bash scripts/prueba-concurrencia.sh
#
# Hacen falta dos tokens de alcance "gasto" (tipo iPhone): generalos en Ajustes > Atajos del celular > Conectar un celular
# (elegí iPhone, ponele "prueba A" y "prueba B") y REVOCALOS al terminar. Cada registro es de MONTO pesos (1 por defecto) en
# Alimentación, y al final se deshacen todos (hay 10 minutos). Tarda unos segundos.
#
# Variables: TOKEN_A, TOKEN_B (obligatorias, nunca se escriben en el archivo), BASE_URL, N (cantidad de pedidos simultáneos, 6), MONTO (1)
# Para ensayar sin tocar datos reales: node tests/servidor-simulado.js  y usar TOKEN_GASTO / TOKEN_GASTO_2 que imprime.
set -u
BASE_URL="${BASE_URL:-https://iivjrpfkwkxgxzgyzrvq.supabase.co/functions/v1/gasto-rapido}"
N="${N:-6}"; MONTO="${MONTO:-1}"
TOKEN_A="${TOKEN_A:-}"; TOKEN_B="${TOKEN_B:-}"
[ -n "$TOKEN_A" ] && [ -n "$TOKEN_B" ] || { echo "Faltan TOKEN_A y TOKEN_B (dos tokens de alcance gasto)."; exit 2; }
DIR="$(mktemp -d)"; trap 'rm -rf "$DIR"' EXIT
OPC=(-s --max-time 60)
case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) OPC+=(--ssl-no-revoke);; esac

registrar() {   # registrar TOKEN IDEM ARCHIVO_SALIDA
  curl "${OPC[@]}" -o "$3.cuerpo" -w '%{http_code}' -X POST "$BASE_URL/gasto" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
    -d "{\"categoria\":\"alimentacion\",\"concepto\":null,\"monto\":$MONTO,\"nota\":\"prueba-concurrencia\",\"idem\":\"$2\"}" > "$3.estado"
}
total_de() { grep -o '"totalCategoriaMes":[0-9.]*' "$1" | head -1 | cut -d: -f2; }
id_de() { grep -o '"id":"[^"]*"' "$1" | head -1 | cut -d'"' -f4; }

BASE="conc-$(date +%s)-$$"
echo "Registro inicial (para conocer el total de Alimentación)…"
registrar "$TOKEN_A" "$BASE-0" "$DIR/0"
[ "$(cat "$DIR/0.estado")" = "201" ] || { echo "No se pudo registrar el inicial: $(cat "$DIR/0.estado") $(cat "$DIR/0.cuerpo")"; exit 1; }
T0="$(total_de "$DIR/0.cuerpo")"; echo "  total de Alimentación tras el inicial: $T0"

echo "Lanzando $N registros simultáneos (mitad con cada token)…"
for i in $(seq 1 "$N"); do
  if [ $((i % 2)) -eq 0 ]; then TOK="$TOKEN_A"; else TOK="$TOKEN_B"; fi
  registrar "$TOK" "$BASE-$i" "$DIR/$i" &
done
wait

OK=0; OCUPADO=0; OTROS=0
for i in $(seq 1 "$N"); do
  case "$(cat "$DIR/$i.estado")" in 201) OK=$((OK + 1));; 503) OCUPADO=$((OCUPADO + 1));; *) OTROS=$((OTROS + 1)); echo "  inesperado: $(cat "$DIR/$i.estado") $(cat "$DIR/$i.cuerpo")";; esac
done
echo "  resultado: $OK registrados, $OCUPADO con 'ocupado' (503, no se guardó, hay que reintentar), $OTROS inesperados"

echo "Registro final (para verificar el total)…"
registrar "$TOKEN_A" "$BASE-final" "$DIR/final"
T1="$(total_de "$DIR/final.cuerpo")"
ESPERADO="$(awk -v t="$T0" -v ok="$OK" -v m="$MONTO" 'BEGIN { printf "%.2f", t + (ok + 1) * m }')"
OBTENIDO="$(awk -v t="$T1" 'BEGIN { printf "%.2f", t }')"
echo "  total esperado: $ESPERADO   total obtenido: $OBTENIDO"

echo "Deshaciendo todo lo de la prueba…"
for i in 0 $(seq 1 "$N") final; do
  [ "$(cat "$DIR/$i.estado")" = "201" ] || continue
  curl "${OPC[@]}" -o /dev/null -X POST "$BASE_URL/deshacer" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d "{\"id\":\"$(id_de "$DIR/$i.cuerpo")\"}"
done

if [ "$OTROS" -eq 0 ] && [ "$ESPERADO" = "$OBTENIDO" ]; then
  echo "RESULTADO: OK, no se perdió ningún registro."
  exit 0
fi
echo "RESULTADO: FALLA, revisá lo anterior (si ves un total menor al esperado, se perdió un registro)."
exit 1
