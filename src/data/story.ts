// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Textos de la historia de la portada. Edita aquí sin tocar los componentes.
// Las ilustraciones se registran aparte, en data/illustrations.ts (ver docs/ilustraciones.md).

export interface StoryChapter {
  id: string;
  /** Texto corto del riel de progreso. */
  nav: string;
  kicker: string;
  title: string;
  body: string[];
}

export const STORY: StoryChapter[] = [
  {
    id: 'portada', nav: 'Inicio', kicker: 'NASA Space Apps 2026 · Planet X and SPHEREx',
    title: 'Algo se movió',
    body: ['Mil millones de objetos. Nadie puede revisarlos solo. Dos imágenes del mismo cielo bastan para encontrar al que cambió de lugar.'],
  },
  {
    id: 'pluton', nav: 'Plutón', kicker: '· El truco',
    title: 'Así se encontró Plutón',
    body: [
      'En 1930, Clyde Tombaugh comparó dos placas fotográficas del mismo pedazo de cielo, tomadas con días de diferencia. Un aparato las alternaba ante sus ojos.',
      'Casi todo seguía igual. Un punto saltaba. Era Plutón.',
    ],
  },
  {
    id: 'movimiento', nav: 'Movimiento', kicker: '· Por qué se mueven',
    title: 'Lo que está cerca, se mueve',
    body: [
      'Los asteroides y cometas giran alrededor del Sol. Las estrellas vecinas cruzan el cielo mientras orbitan la galaxia. La Tierra también se mueve, y eso desplaza lo que tenemos cerca.',
      'Lo lejano parece clavado en su sitio. Por eso un punto que cambia de lugar casi siempre es un vecino.',
    ],
  },
  {
    id: 'telescopio', nav: 'SPHEREx', kicker: '· El telescopio',
    title: 'El cielo en 102 colores',
    body: [
      'Desde mayo de 2025, el telescopio espacial SPHEREx de la NASA fotografía el cielo completo cada seis meses.',
      'No ve los colores que conocemos. Separa la luz infrarroja en 102 bandas, de 0.75 a 5 micras, y así distingue agua, hielo y moléculas en cada objeto.',
    ],
  },
  {
    id: 'problema', nav: 'El problema', kicker: '· El problema',
    title: 'Demasiado cielo para una sola persona',
    body: [
      'Estrellas, galaxias, cometas, asteroides, enanas marrones: imágenes de más de mil millones de objetos, que a menudo se enciman o cambian de brillo.',
      'Ni una persona ni un programa pueden entenderlo todo. Hacen falta muchos ojos.',
    ],
  },
  {
    id: 'infrarrojo', nav: 'Lo invisible', kicker: '· Lo invisible',
    title: 'Mundos que solo brillan en infrarrojo',
    body: [
      'WISE 0855 es una enana marrón: demasiado pequeña para ser estrella y tan fría como el Polo Norte.',
      'Es el mismo pedazo de cielo en los seis detectores de SPHEREx. En los primeros no hay nada en el centro. En los últimos, aparece.',
    ],
  },
  {
    id: 'planeta-x', nav: 'Planeta X', kicker: '· La pregunta',
    title: '¿Y si hay algo más allá afuera?',
    body: [
      'Un planeta lejano, más allá de Neptuno, sería frío y oscuro. Se movería muy poco entre dos imágenes.',
      'Si existe, puede estar ya en los datos, esperando a que alguien compare las imágenes correctas.',
    ],
  },
  {
    id: 'reto', nav: 'Prueba', kicker: '· Tu turno',
    title: 'Encuentra el que se mueve',
    body: ['Dos imágenes del mismo cielo, con año y medio de diferencia. Una estrella cambió de lugar. Haz clic sobre ella.'],
  },
  {
    id: 'objetivos', nav: 'Empezar', kicker: '· Empieza aquí',
    title: 'Cinco lugares para empezar',
    body: ['Los objetos de prueba del reto. Cada uno enseña algo distinto: unos se mueven, otros cambian de brillo.'],
  },
  {
    id: 'colores', nav: 'Colores', kicker: '· Guía',
    title: 'Qué significa cada color',
    body: ['SPHEREx reparte sus 102 bandas en seis detectores. Cada tramo del infrarrojo revela algo distinto. Elige uno.'],
  },
  {
    id: 'creditos', nav: 'Datos', kicker: '· Créditos',
    title: 'De dónde vienen los datos',
    body: [],
  },
];

export const chapter = (id: string): StoryChapter => {
  const c = STORY.find((x) => x.id === id);
  if (!c) throw new Error(`No existe el capítulo ${id}`);
  return c;
};

export const UI = {
  start: 'Empezar la historia',
  viewer: 'Abrir el visor',
  illustration: 'Ilustración',
  simulated: 'Cielo simulado',
  skip: 'Saltar la historia',
  plates: { toggle: 'Alternar placas', auto: 'Parpadeo automático', a: 'Placa A', b: 'Placa B', caption: 'Recreación con cielo simulado: dos fechas del mismo campo.' },
  motion: [
    { label: 'Asteroide', value: 'minutos de arco por día', speed: 'fast' },
    { label: 'Estrella vecina', value: 'segundos de arco por año', speed: 'slow' },
    { label: 'Estrella lejana', value: 'parece fija', speed: 'still' },
  ],
  stats: [
    { value: '102', label: 'bandas de infrarrojo' },
    { value: '6', label: 'detectores' },
    { value: '0.75–5 µm', label: 'rango de longitudes de onda' },
    { value: '6 meses', label: 'para cubrir todo el cielo' },
  ],
  counter: { target: 1_000_000_000, prefix: 'más de', suffix: 'objetos' },
  detectors: 'Detector',
  game: {
    hint: 'Haz clic en el punto que salta. También puedes recorrer los candidatos con Tab.',
    candidate: 'Candidato',
    miss: 'Ese no se movió. Fíjate en el que salta.',
    reveal: 'Aquí está: mira el círculo.',
    win: '¡Lo encontraste! Es la estrella de Barnard: está a seis años luz y se mueve unos 10″ por año, más que cualquier otra estrella.',
    cta: 'Verla en el visor',
    again: 'Volver a intentar',
  },
  search: { label: 'Busca otra región', placeholder: 'Nombre o coordenadas: R Dra · 133.795 -7.245', submit: 'Ver' },
  credits: {
    sources: [
      { name: 'SPHEREx', role: 'Imágenes y espectros infrarrojos', where: 'NASA / IRSA' },
      { name: 'SIMBAD', role: 'Nombres y tipos de objetos', where: 'CDS, Estrasburgo' },
      { name: 'NED', role: 'Galaxias y objetos extragalácticos', where: 'NASA / IPAC' },
      { name: 'Gaia', role: 'Posiciones y movimientos de estrellas', where: 'ESA' },
      { name: 'WISE', role: 'Fuentes infrarrojas ya conocidas', where: 'NASA' },
    ],
    simulated: 'Esta versión usa cielo y catálogos simulados por código mientras se termina la API. Los movimientos y brillos de los cinco objetos de prueba siguen sus valores reales aproximados.',
    illustrations: 'Las imágenes marcadas como «Ilustración» fueron generadas para explicar la historia. No son datos.',
    challenge: 'Reto «Planet X and SPHEREx» · NASA Space Apps Challenge 2026',
    challengeUrl: 'https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/',
  },
};
