#!/usr/bin/env bash
# Prueba de punta a punta de la función gasto-rapido, con curl.
#
#   TOKEN='mfa_...' bash scripts/prueba-gasto-rapido.sh
#
# Variables de entorno:
#   TOKEN     token del celular (iPhone = alcance "gasto", Android = alcance "detector"). NUNCA se escribe en este archivo.
#             Sin TOKEN solo se corren las comprobaciones sin autenticación (todas tienen que dar 401).
#   BASE_URL  por defecto la función desplegada. Para ensayar sin tocar datos: node tests/servidor-simulado.js
#   MONTO     monto de prueba, por defecto 1 (un peso)
#
# Qué hace:
#   1. sin token / token falso -> 401 token_invalido            (no escribe nada)
#   2. GET /config                                              (no escribe nada)
#   3. token "gasto":    POST /gasto -> mismo idem repetido (no duplica) -> /deshacer -> /deshacer otra vez (404)
#      token "detector": POST /propuesta -> /confirmar -> /confirmar repetido -> /deshacer -> /ignorar (queda limpio)
#      (la forma real de las notificaciones de Mercado Pago NO se conoce: el texto de ejemplo "Pagaste $ 1 a PRUEBA SCRIPT" es un SUPUESTO)
#   Al final deshace lo que haya registrado (también si el script se corta a la mitad). El gasto de prueba es de MONTO pesos
#   en Alimentación, en la fila general, y se revierte en menos de 10 minutos (la ventana para deshacer).
set -u

BASE_URL="${BASE_URL:-https://iivjrpfkwkxgxzgyzrvq.supabase.co/functions/v1/gasto-rapido}"
MONTO="${MONTO:-1}"
TOKEN="${TOKEN:-}"
TMP="$(mktemp)"
trap 'limpiar' EXIT

OPCIONES_CURL=(-s --max-time 40)
case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) OPCIONES_CURL+=(--ssl-no-revoke);; esac   # curl de Git Bash en Windows

PASARON=0; FALLARON=0
ID_A_DESHACER=""     # movimiento registrado que todavía no se deshizo
ID_PROPUESTA=""      # propuesta creada que todavía no se resolvió
STATUS=""; CUERPO=""

llamar() {   # llamar METODO RUTA [JSON] [TOKEN_A_USAR]  -> deja STATUS y CUERPO
  local metodo="$1" ruta="$2" json="${3:-}" tok="${4-$TOKEN}"
  local args=("${OPCIONES_CURL[@]}" -o "$TMP" -w '%{http_code}' -X "$metodo" "$BASE_URL$ruta")
  [ -n "$tok" ] && args+=(-H "Authorization: Bearer $tok")
  [ -n "$json" ] && args+=(-H 'Content-Type: application/json' -d "$json")
  STATUS="$(curl "${args[@]}")"
  CUERPO="$(cat "$TMP")"
}
texto_de() { printf '%s' "$CUERPO" | grep -o "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }
verificar() {   # verificar "descripción" estado_esperado [texto que debe aparecer en la respuesta]
  local desc="$1" esperado="$2" contiene="${3:-}"
  if [ "$STATUS" = "$esperado" ] && { [ -z "$contiene" ] || printf '%s' "$CUERPO" | grep -q -- "$contiene"; }; then
    echo "  OK   $desc"; PASARON=$((PASARON + 1))
  else
    echo "  FALLA $desc  (estado $STATUS, esperaba $esperado${contiene:+ con \"$contiene\"})"; echo "        respuesta: $CUERPO" | cut -c1-300
    FALLARON=$((FALLARON + 1))
  fi
}
limpiar() {
  # Si algo quedó registrado o pendiente, se revierte para no dejar datos de prueba
  if [ -n "$TOKEN" ] && [ -n "$ID_A_DESHACER" ]; then
    llamar POST /deshacer "{\"id\":\"$ID_A_DESHACER\"}" >/dev/null; echo "  (limpieza) deshacer $ID_A_DESHACER -> $STATUS"
  fi
  if [ -n "$TOKEN" ] && [ -n "$ID_PROPUESTA" ]; then
    llamar POST "/propuesta/$ID_PROPUESTA/ignorar" '{}' >/dev/null; echo "  (limpieza) ignorar propuesta -> $STATUS"
  fi
  rm -f "$TMP"
}

echo "Probando $BASE_URL"
echo
echo "1) Sin autenticación (no escribe nada)"
llamar GET /config "" ""            ; verificar "GET /config sin token -> 401" 401 token_invalido
llamar GET /config "" "basura"      ; verificar "GET /config con token falso -> 401" 401 token_invalido
llamar POST /gasto '{"categoria":"alimentacion","monto":1}' "" ; verificar "POST /gasto sin token -> 401" 401 token_invalido

if [ -z "$TOKEN" ]; then
  echo; echo "Falta la variable TOKEN: se saltea la parte autenticada. Uso:  TOKEN='mfa_...' bash $0"
  echo "Resultado: $PASARON bien, $FALLARON con falla"; [ "$FALLARON" -eq 0 ]; exit $?
fi

echo; echo "2) GET /config (no escribe nada)"
llamar GET /config
verificar "GET /config -> 200 con categorías" 200 '"categorias"'
printf '%s' "$CUERPO" | grep -q '"alimentacion"' && { echo "  OK   incluye la categoría alimentacion"; PASARON=$((PASARON + 1)); } || { echo "  FALLA falta alimentacion en /config"; FALLARON=$((FALLARON + 1)); }

echo; echo "3) Registro de prueba de $MONTO peso(s) en Alimentación"
IDEM="prueba-$(date +%s)-$$"
llamar POST /gasto "{\"categoria\":\"alimentacion\",\"concepto\":null,\"monto\":$MONTO,\"nota\":\"prueba-script\",\"idem\":\"$IDEM\"}"
if [ "$STATUS" = "403" ]; then
  echo "  (este token no puede usar /gasto: es de Android/detector; sigo con el flujo de propuestas)"
  MODO=detector
else
  MODO=gasto
fi

if [ "$MODO" = "gasto" ]; then
  verificar "POST /gasto -> 201 y devuelve el id esperado" 201 "\"id\":\"rq_$IDEM\""
  [ "$STATUS" = "201" ] && ID_A_DESHACER="rq_$IDEM"
  ID1="$(texto_de id)"
  llamar POST /gasto "{\"categoria\":\"alimentacion\",\"concepto\":null,\"monto\":$MONTO,\"nota\":\"prueba-script\",\"idem\":\"$IDEM\"}"
  verificar "mismo idem repetido -> 200, repetido:true (no duplica)" 200 '"repetido":true'
  [ "$(texto_de id)" = "$ID1" ] && { echo "  OK   devolvió el mismo id"; PASARON=$((PASARON + 1)); } || { echo "  FALLA el id cambió"; FALLARON=$((FALLARON + 1)); }
  llamar POST /gasto '{"categoria":"no-existe","monto":1}'   ; verificar "categoría inválida -> 400" 400 categoria_invalida
  llamar POST /gasto '{"categoria":"alimentacion","monto":"abc"}' ; verificar "monto inválido -> 400" 400 monto_invalido
  llamar POST /deshacer "{\"id\":\"rq_$IDEM\"}"
  verificar "POST /deshacer -> 200" 200 '"deshecho"' && [ "$STATUS" = "200" ] && ID_A_DESHACER=""
  llamar POST /deshacer "{\"id\":\"rq_$IDEM\"}"
  verificar "deshacer de nuevo -> 404 (ya estaba deshecho)" 404 no_encontrado
else
  llamar POST /propuesta "{\"origen\":\"android-notif\",\"texto\":\"Pagaste \$ $MONTO a PRUEBA SCRIPT\"}"
  if printf '%s' "$CUERPO" | grep -q '"ignorado":true'; then
    echo "  AVISO la IA no tomó el texto de ejemplo como un pago (es un supuesto): no se puede seguir con el flujo de Android"
  else
    [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ] && { echo "  OK   POST /propuesta -> $STATUS"; PASARON=$((PASARON + 1)); } || { echo "  FALLA /propuesta -> $STATUS $CUERPO"; FALLARON=$((FALLARON + 1)); }
    ID_PROPUESTA="$(texto_de id)"
    llamar POST "/propuesta/$ID_PROPUESTA/confirmar" '{"categoria":"alimentacion","concepto":null}'
    verificar "confirmar -> 201 con id rp_<id>" 201 "\"id\":\"rp_$ID_PROPUESTA\""
    [ "$STATUS" = "201" ] && { ID_A_DESHACER="rp_$ID_PROPUESTA"; }
    llamar POST "/propuesta/$ID_PROPUESTA/confirmar" '{"categoria":"alimentacion","concepto":null}'
    verificar "confirmar repetido -> 200, repetido:true (no duplica)" 200 '"repetido":true'
    llamar POST /deshacer "{\"id\":\"rp_$ID_PROPUESTA\"}"
    verificar "POST /deshacer -> 200" 200 '"deshecho"' && [ "$STATUS" = "200" ] && ID_A_DESHACER=""
    llamar POST "/propuesta/$ID_PROPUESTA/ignorar" '{}'
    verificar "ignorar la propuesta (queda limpia) -> 200" 200 '"ok":true' && [ "$STATUS" = "200" ] && ID_PROPUESTA=""
  fi
fi

echo
echo "Resultado: $PASARON bien, $FALLARON con falla"
[ "$FALLARON" -eq 0 ]
