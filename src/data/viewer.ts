// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Textos del visor. Edita aquí sin tocar componentes ni scripts.
import type { Cmap, Detector, Scale, Stretch } from '../lib/api/types';
import type { ViewMode } from '../lib/url';

export const T = {
  simulated: 'Datos simulados',
  simulatedHelp: 'Cielo y catálogos simulados mientras se termina la API.',
  search: {
    label: 'Buscar una región del cielo',
    placeholder: 'Nombre o coordenadas: WISE 0855 · 133.795 -7.245',
    submit: 'Ver',
    empty: 'Escribe un nombre o unas coordenadas.',
    badCoords: 'No entendimos esas coordenadas. Prueba con «133.795 -7.245» o «08h55m10.8s -07d14m42s».',
  },
  share: { link: 'Copiar enlace a esta vista', embed: 'Copiar código para incrustar', linkDone: 'Enlace copiado', embedDone: 'Código para incrustar copiado', failed: 'No se pudo copiar. Usa la barra de direcciones.' },
  rail: 'Herramientas',
  panels: { tiempo: 'Tiempo', comparar: 'Comparar', imagen: 'Imagen', capas: 'Capas', datos: 'Datos' },
  closePanel: 'Cerrar panel',
  player: {
    play: 'Reproducir', pause: 'Pausar', prev: 'Imagen anterior', next: 'Imagen siguiente', speed: 'Velocidad',
    timeline: 'Línea de tiempo', more: 'Cargar más', loadingMore: 'Cargando…', mode: 'Modo',
  },
  modes: { video: 'Video', blink: 'Parpadeo A/B', diff: 'Resta', stack: 'Apilar' } satisfies Record<ViewMode, string>,
  modeHelp: {
    video: 'Recorre las imágenes en orden de fecha.',
    blink: 'Alterna dos imágenes: lo que salta, se movió.',
    diff: 'Resta A − B: lo nuevo queda ámbar; lo que ya no está, cian.',
    stack: 'Promedia una pasada completa para ver objetos débiles.',
  } satisfies Record<ViewMode, string>,
  states: {
    idleTitle: 'Elige una región del cielo',
    idleBody: 'Escribe un nombre o unas coordenadas en el buscador.',
    idleTry: 'O prueba con:',
    resolving: 'Buscando en SIMBAD y NED',
    notFoundHint: 'Prueba con coordenadas (RA Dec) o con otro nombre, por ejemplo «R Dra» o «WISE 0855».',
    loading: 'Preparando las imágenes',
    emptyTitle: 'SPHEREx aún no tiene imágenes de esta región',
    emptyBody: 'Prueba con otra región o quita el filtro de fechas.',
    errorTitle: 'No pudimos cargar las imágenes',
    retry: 'Reintentar', cancel: 'Cancelar',
    queue: 'En cola', eta: 'Faltan unos', seconds: 's',
    degraded: 'Algunas fuentes no responden:',
  },
  head: { region: 'Región del cielo', propagated: 'Posición propagada a', catalog: 'catálogo en', perYear: '″/año' },
  tiempo: {
    coverage: 'Imágenes por semana', none: 'Sin cobertura en esta región.', from: 'Desde', to: 'Hasta', apply: 'Aplicar', clear: 'Quitar fechas',
    badRange: 'La fecha inicial es posterior a la final.', summary: 'imágenes disponibles', passes: 'pasadas', between: 'entre',
  },
  comparar: {
    intro: 'Elige dos imágenes de fechas distintas. A es la reciente, B la antigua.',
    a: 'Imagen A', b: 'Imagen B', swap: 'Intercambiar A y B', pass: 'Pasada', needFrames: 'Carga una región para comparar imágenes.',
  },
  imagen: {
    detector: 'Detector', detectorHelp: 'Cada detector cubre un tramo del infrarrojo.', fov: 'Campo de visión',
    fovHelp: 'Un campo mayor sigue objetos rápidos, pero tarda más en cargar.', fovCustom: 'Otro valor (″)', apply: 'Aplicar',
    stretch: 'Contraste', cmap: 'Color', scale: 'Escala de brillo',
  },
  stretch: { linear: 'Lineal', sqrt: 'Raíz', log: 'Log', asinh: 'Asinh' } satisfies Record<Stretch, string>,
  cmap: { gray: 'Gris', viridis: 'Viridis', magma: 'Magma', inferno: 'Inferno' } satisfies Record<Cmap, string>,
  scale: { sequence: 'Compartida', frame: 'Por imagen' } satisfies Record<Scale, string>,
  scaleHelp: {
    sequence: 'Todas las imágenes usan la misma escala: si un objeto se ve más brillante, es que lo está.',
    frame: 'Cada imagen se ajusta sola: se ven mejor los objetos débiles, pero no se pueden comparar brillos.',
  } satisfies Record<Scale, string>,
  capas: {
    objects: 'Objetos de SIMBAD y NED', gaia: 'Fuentes de Gaia', wise: 'Fuentes de WISE', prediction: 'Trayectoria predicha', reticle: 'Retícula',
    objectsHelp: 'Círculos: posición de catálogo.', gaiaHelp: 'Rombos: posición llevada a la fecha de la imagen.',
    wiseHelp: 'Cuadrados: fuentes infrarrojas ya conocidas.', predictionHelp: 'Dónde debería estar el objeto según su movimiento.',
    reticleHelp: 'Marca el centro del campo.', empty: 'sin fuentes en el campo', loading: 'cargando…',
  },
  datos: {
    point: 'Punto analizado', pointHelp: 'Haz clic en la imagen para analizar otro punto.', center: 'Analizar el centro',
    spectrum: 'Espectro', spectrumHelp: 'Brillo en cada longitud de onda. Un punto por exposición.',
    spectrumJob: 'Midiendo el espectro', spectrumEmpty: 'Sin exposiciones para este punto.',
    light: 'Curva de luz', lightHelp: 'Los mismos puntos, ordenados por fecha, para el detector actual.',
    frame: 'Imagen actual', date: 'Fecha', band: 'Longitud de onda', exposure: 'Exposición', id: 'Identificador',
    flags: 'Banderas de contaminación', noFlags: 'Sin banderas', objects: 'Objetos en el campo', noObjects: 'Sin objetos de catálogo en el campo.',
    legend: 'Qué significa cada color', table: 'Ver los datos en tabla', wavelength: 'Longitud de onda (µm)', flux: 'Brillo (µJy)',
  },
  flags: {
    cosmic_ray: 'Rayo cósmico', saturation: 'Saturación', stray_light: 'Luz parásita', edge: 'Borde del detector', low_snr: 'Señal débil',
  } as Record<string, string>,
  objectType: { star: 'Estrella', galaxy: 'Galaxia', other: 'Otro' },
  globe: 'Posición en el cielo',
};

export const QUICK_TARGETS: { label: string; query: string; det: Detector; fov?: number }[] = [
  { label: 'Estrella de Barnard', query: "Barnard's star", det: 3 },
  { label: 'WISE 0855', query: 'WISE 0855', det: 6 },
  { label: 'R Draconis', query: 'R Dra', det: 4, fov: 600 },
];

export const FOV_PRESETS: { label: string; value: number }[] = [
  { label: '1′', value: 60 }, { label: '5′', value: 300 }, { label: '15′', value: 900 }, { label: '60′', value: 3600 },
];
