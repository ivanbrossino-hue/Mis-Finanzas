// Datos semilla — se usan SOLO la primera vez que se abre la app en un navegador
// que todavía no tiene nada guardado ni una nube conectada. Se dejan vacíos a
// propósito: como la app ahora se aloja en una URL pública (GitHub Pages) para que
// varias personas la usen, no puede tener datos financieros reales precargados acá
// (los tuyos ya viven en Supabase y en el localStorage de tus dispositivos, no
// dependen de este archivo).
window.DATOS_INICIALES = {
  "meses": {},
  "deudas": []
};
