// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
/* Guía rápida del visor: qué muestra cada parte y los atajos. */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Kbd } from '../ui/primitives';

const SECTIONS = [
  {
    title: 'El cielo',
    body: 'Imágenes reales de SPHEREx (NASA/IRSA) alineadas para comparar fechas. Arrastra para moverte, usa la rueda para acercar y haz clic en una fuente para medirla.',
  },
  {
    title: 'Línea de tiempo',
    body: 'Recorre las exposiciones en orden. «Parpadeo» alterna la primera y la última fecha: lo que salta de lugar se está moviendo. «Resta» deja solo lo que cambió; «Suma» apila fechas para ver fuentes débiles.',
  },
  {
    title: 'Espectro',
    body: 'Brillo del punto medido entre 0.75 y 5 µm, sumando todas las exposiciones. También puedes verlo como curva de luz (brillo por fecha).',
  },
  {
    title: 'Composición',
    body: 'Busca en ese espectro 18 bandas de hielos, moléculas, minerales e hidrógeno ionizado, y dice qué se detecta, con qué certeza y en qué cantidad.',
  },
  {
    title: 'Detectores',
    body: 'SPHEREx tiene 6 detectores, cada uno con su rango de longitudes de onda. Aquí se resume cada uno y se explora el cubo de 102 canales de la zona.',
  },
  {
    title: 'Imagen L2',
    body: 'La exposición original completa, tal como la entrega la misión. Al hacer clic se lee el brillo de ese píxel en MJy/sr.',
  },
];

const KEYS: Array<[string[], string]> = [
  [['Ctrl', 'K'], 'Buscar objeto o coordenadas'],
  [['Espacio'], 'Parpadeo entre la primera y la última fecha'],
  [['←', '→'], 'Exposición anterior / siguiente (en la línea de tiempo)'],
  [['+', '−'], 'Acercar / alejar (con el cielo enfocado)'],
  [['Esc'], 'Cerrar ventanas'],
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bx-float rounded-2xl p-5 sm:p-6 animate-panel-enter">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="help-title" className="text-lg font-semibold text-fg">Cómo usar el visor</h2>
            <p className="text-[13px] text-muted">Encuentra lo que se mueve en el cielo infrarrojo y descubre de qué está hecho.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg text-muted hover:text-fg hover:bg-white/[0.08] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title} className="bx-card p-3.5">
              <h3 className="text-[13px] font-semibold text-fg mb-1">{s.title}</h3>
              <p className="text-[13px] leading-relaxed text-soft">{s.body}</p>
            </section>
          ))}
        </div>
        <h3 className="bx-eyebrow mt-5 mb-2">Atajos</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {KEYS.map(([keys, label]) => (
            <li key={label} className="flex items-center gap-2 text-[13px] text-soft">
              <span className="flex gap-1 shrink-0">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
