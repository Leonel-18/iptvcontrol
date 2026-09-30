/**
 * Sonido de notificaciones internas (HU-N05).
 *
 * Se genera un tono corto con la Web Audio API, sin archivo de audio. Respeta
 * la política de autoplay del navegador: si el contexto no está habilitado, no
 * se fuerza el audio.
 */
let contexto: AudioContext | null = null;

const obtenerContexto = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!contexto) contexto = new Ctor();
  return contexto;
};

/**
 * Prepara el audio en el primer gesto del usuario. La mayoría de los navegadores
 * no permiten reproducir sonido hasta que hubo una interacción.
 */
export const prepararSonido = (): void => {
  try {
    const ctx = obtenerContexto();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    // Sin audio disponible: no se fuerza.
  }
};

/** Reproduce un tono corto. Si el navegador lo bloquea, no hace nada. */
export const reproducirSonidoNotificacion = (): void => {
  try {
    const ctx = obtenerContexto();
    if (!ctx || ctx.state !== 'running') return;

    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = 880;
    ganancia.gain.value = 0.05;
    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);
    oscilador.start();
    oscilador.stop(ctx.currentTime + 0.18);
  } catch {
    // El navegador bloqueó el audio: no se fuerza.
  }
};
