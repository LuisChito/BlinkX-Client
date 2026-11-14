// Ilustraciones de la historia, por id de capítulo. Todas se muestran con la etiqueta "Ilustración".
// Para añadir una: guarda la imagen en src/assets/img/, impórtala aquí y asígnala a su capítulo.
// Un capítulo sin ilustración usa su fondo de degradado.
import type { ImageMetadata } from 'astro';

export interface Illustration { src: ImageMetadata; alt: string }

export const illustrations: Record<string, Illustration | undefined> = {};
