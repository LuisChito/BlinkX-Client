// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
// Los cinco objetos de prueba del reto, como tarjetas de la portada.
import type { Detector } from '../lib/api/types';

export interface TargetCard {
  /** id del objeto en el cielo simulado (para la vista previa). */
  id: string;
  name: string;
  label: string;
  kind: string;
  blurb: string;
  det: Detector;
  fov: number;
  href: string;
}

const link = (name: string, det: Detector, fov: number): string => {
  const q = new URLSearchParams({ name });
  if (fov !== 300) q.set('fov', String(fov));
  q.set('det', String(det));
  return `/ver?${q}`;
};

export const TARGET_CARDS: TargetCard[] = [
  {
    id: 'barnard', name: "Barnard's star", label: 'Estrella de Barnard', kind: 'Se mueve',
    blurb: 'La estrella más rápida del cielo: unos 10″ por año.', det: 3, fov: 300, href: link("Barnard's star", 3, 300),
  },
  {
    id: 'epsindib', name: 'Epsilon Indi B', label: 'Epsilon Indi B', kind: 'Se mueve',
    blurb: 'Un par de enanas marrones que orbitan una estrella vecina.', det: 5, fov: 420, href: link('Epsilon Indi B', 5, 420),
  },
  {
    id: 'wise0855', name: 'WISE 0855', label: 'WISE 0855', kind: 'Se mueve · solo en infrarrojo',
    blurb: 'La enana marrón más fría conocida. Invisible por debajo de 3 µm.', det: 6, fov: 300, href: link('WISE 0855', 6, 300),
  },
  {
    id: 'rwaur', name: 'RW Aur', label: 'RW Aurigae', kind: 'Cambia de brillo',
    blurb: 'Una estrella joven que se apaga y se enciende sin aviso.', det: 3, fov: 300, href: link('RW Aur', 3, 300),
  },
  {
    id: 'rdra', name: 'R Dra', label: 'R Draconis', kind: 'Cambia de brillo',
    blurb: 'Una gigante que late: su brillo sube y baja cada 245 días.', det: 4, fov: 600, href: link('R Dra', 4, 600),
  },
];
