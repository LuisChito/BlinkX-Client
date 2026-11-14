# Ilustraciones de la historia

Seis imágenes para la portada. Ilustran la historia; **no son datos** y se muestran con la etiqueta «Ilustración».
Ninguna es obligatoria: un capítulo sin imagen usa su fondo de degradado.

## Estilo común

Añadir a todos los prompts:

> Ilustración cinematográfica, fondo casi negro (#050304), paleta de brasas naranjas (#ff8a5c) y violeta profundo,
> luz tenue y contrastada, grano fino de película, sin texto, sin logotipos, sin marcas de agua, formato 16:9,
> con espacio oscuro y vacío en la mitad izquierda para colocar un título.

## Prompts

| Capítulo | Archivo | Prompt |
|---|---|---|
| `portada` | `portada.jpg` | Campo de estrellas profundo visto en infrarrojo; entre cientos de puntos blancos fríos, uno solo brilla en naranja cálido a la derecha del encuadre. |
| `pluton` | `comparador-1930.jpg` | Interior de un observatorio de 1930 a media luz: un comparador de placas de latón y madera con dos placas fotográficas de vidrio iluminadas desde atrás, visto de cerca, a la derecha del encuadre. Sin personas reconocibles. |
| `telescopio` | `telescopio.jpg` | Telescopio espacial pequeño con tres escudos cónicos concéntricos, flotando sobre la curva nocturna de la Tierra, a la derecha del encuadre; el cielo detrás muestra un abanico tenue de colores del violeta al ámbar. |
| `infrarrojo` | `enana-marron.jpg` | Enana marrón fría y solitaria: una esfera oscura con bandas de nubes apenas visibles en magenta y brasa, sin estrella cercana, a la derecha del encuadre, sobre un cielo estrellado. |
| `planeta-x` | `planeta-x.jpg` | Planeta helado y oscuro en el borde del sistema solar, apenas iluminado; el Sol es solo una estrella más brillante a lo lejos. Sensación de frío y distancia. Planeta a la derecha del encuadre. |
| `objetivos` | `objetivos.jpg` | Horizonte negro de un paisaje sin detalle bajo un cielo lleno de estrellas, con una franja tenue de luz violeta y naranja cerca del horizonte. |

## Cómo añadirlas

1. Guardar cada archivo en `src/assets/img/`.
2. Registrarla en `src/data/illustrations.ts`:

```ts
import portada from '../assets/img/portada.jpg';

export const illustrations = {
  portada: { src: portada, alt: 'Campo de estrellas con un punto naranja que destaca.' },
};
```

Astro genera versiones AVIF/WebP en varios tamaños. Objetivo: menos de 400 kB de imágenes en la portada.
