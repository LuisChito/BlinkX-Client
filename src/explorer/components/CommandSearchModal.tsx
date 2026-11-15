// AI-assisted development used for code development, debugging and documentation.
// Tool: ChatGPT, Claude
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TargetCatalogEntry } from '../types/spherex';
import { parseRaDecInput } from '../utils/urlState';
import { Search, MapPin, Sparkles, Sliders, ArrowRight, Compass } from 'lucide-react';

interface CommandSearchModalProps {
  targets: TargetCatalogEntry[];
  isOpen: boolean;
  onClose: () => void;
  onSelectTarget: (target: TargetCatalogEntry) => void;
  onJumpCoordinates: (ra: number, dec: number) => void;
  onResolveName?: (name: string) => Promise<void> | void;
  onExecuteAction: (action: 'blink' | 'diff' | 'sum' | 'split' | 'motion' | 'selection') => void;
}

interface CommandItem {
  id: string;
  type: 'coord' | 'object' | 'resolve' | 'action';
  badge: string;
  badgeColor: string;
  label: string;
  detail?: string;
  run: () => void;
}

interface CatalogPreset {
  name: string;
  category: string;
  catalog: 'SPHEREx' | 'SIMBAD' | 'NED' | 'SIMBAD / NED';
  detail: string;
  tags: string[];
  targetId?: string;
  resolveName?: string;
}

const ASTRONOMICAL_CATALOG: CatalogPreset[] = [
  // 1. Objetos del Reto SPHEREx
  {
    name: "Barnard's Star",
    category: 'Estrella Rápida',
    catalog: 'SPHEREx',
    detail: 'Enana roja con el mayor movimiento propio conocido (μ = 10.36"/año)',
    tags: ['barnard', 'estrella de barnard', 'movimiento', 'red dwarf'],
    targetId: 'barnards-star',
  },
  {
    name: 'WISE 0855-0714',
    category: 'Enana Marrón',
    catalog: 'SPHEREx',
    detail: 'La enana marrón más fría conocida. Fuerte absorción de H₂O y CH₄ (> 3 µm)',
    tags: ['wise', 'wise 0855', 'brown dwarf', 'metano', 'fria'],
    targetId: 'wise-0855',
  },
  {
    name: 'Epsilon Indi B',
    category: 'Par Binario',
    catalog: 'SPHEREx',
    detail: 'Sistema binario de enanas marrones frías cercanas',
    tags: ['epsilon', 'indi', 'binaria'],
    targetId: 'epsilon-indi-b',
  },
  {
    name: 'RW Aurigae',
    category: 'Variable Joven',
    catalog: 'SPHEREx',
    detail: 'Estrella T Tauri en formación con caídas periódicas de brillo',
    tags: ['rw', 'aur', 'aurigae', 'variable'],
    targetId: 'rw-aur',
  },
  {
    name: 'R Draconis',
    category: 'Gigante Pulsante',
    catalog: 'SPHEREx',
    detail: 'Gigante roja variable pulsante Mira (período de 245 días)',
    tags: ['r dra', 'dra', 'draconis', 'pulsante'],
    targetId: 'r-dra',
  },

  // 2. Polos Eclípticos (Máxima cobertura de exposiciones SPHEREx)
  {
    name: 'NGC 6543',
    category: 'Polo Norte Eclíptico (NEP)',
    catalog: 'SIMBAD / NED',
    detail: 'Nebulosa Ojo de Gato · Zona de máxima densidad de exposiciones SPHEREx',
    tags: ['ngc 6543', 'cat eye', 'ojo de gato', 'nebula', 'nep', 'polo'],
    resolveName: 'NGC 6543',
  },
  {
    name: 'NGC 6552',
    category: 'Polo Norte Eclíptico (NEP)',
    catalog: 'NED',
    detail: 'Galaxia espiral usada como estándar de calibración fotométrica en el NEP',
    tags: ['ngc 6552', 'galaxia', 'nep', 'calibracion'],
    resolveName: 'NGC 6552',
  },
  {
    name: 'LMC (Gran Nube de Magallanes)',
    category: 'Polo Sur Eclíptico (SEP)',
    catalog: 'SIMBAD / NED',
    detail: 'Galaxia satélite en el polo sur · Densidad estelar e infrarroja masiva',
    tags: ['lmc', 'magellanic', 'nube', 'gran nube', 'sep', 'polo sur'],
    resolveName: 'LMC',
  },
  {
    name: 'R136 (NGC 2070)',
    category: 'Supercúmulo Estelar',
    catalog: 'SIMBAD',
    detail: 'Cúmulo estelar masivo en la Nebulosa Tarántula (LMC / Polo Sur)',
    tags: ['r136', 'ngc 2070', 'tarantula', 'lmc'],
    resolveName: 'R136',
  },

  // 3. Galaxias e Infrarrojo Extragaláctico
  {
    name: 'M82 (Galaxia del Cigarro)',
    category: 'Galaxia Starburst',
    catalog: 'NED',
    detail: 'Formación estelar acelerada con brillo extremo en infrarrojo medio',
    tags: ['m82', 'messier 82', 'cigar', 'cigarro', 'starburst'],
    resolveName: 'M82',
  },
  {
    name: 'M31 (Galaxia de Andrómeda)',
    category: 'Galaxia Espiral Gigante',
    catalog: 'SIMBAD / NED',
    detail: 'La galaxia espiral gigante más cercana a la Vía Láctea',
    tags: ['m31', 'andromeda', 'galaxia'],
    resolveName: 'M31',
  },
  {
    name: 'M51 (Galaxia del Remolino)',
    category: 'Galaxia Espiral',
    catalog: 'SIMBAD / NED',
    detail: 'Galaxia interactuante con estructura de brazos de gran diseño',
    tags: ['m51', 'whirlpool', 'remolino'],
    resolveName: 'M51',
  },
  {
    name: 'NGC 253 (Galaxia del Escultor)',
    category: 'Galaxia Starburst',
    catalog: 'NED',
    detail: 'Una de las galaxias más brillantes del cielo en el infrarrojo térmico',
    tags: ['ngc 253', 'sculptor', 'escultor'],
    resolveName: 'NGC 253',
  },
  {
    name: 'Centaurus A (NGC 5128)',
    category: 'Galaxia Activa (AGN)',
    catalog: 'NED',
    detail: 'Galaxia con banda masiva de polvo interestelar y chorros relativistas',
    tags: ['centaurus a', 'ngc 5128', 'agn'],
    resolveName: 'Centaurus A',
  },
  {
    name: 'Arp 220',
    category: 'Galaxia ULIRG',
    catalog: 'NED',
    detail: 'Galaxia infrarroja ultraluminosa prototipo; emisión dominada por polvo',
    tags: ['arp 220', 'ulirg', 'infrarrojo'],
    resolveName: 'Arp 220',
  },

  // 4. Enanas Marrones y Estrellas de Interés Espectral
  {
    name: 'Luhman 16',
    category: 'Enana Marrón Binaria',
    catalog: 'SIMBAD',
    detail: 'El sistema de enanas marrones más cercano al Sistema Solar (6.5 al)',
    tags: ['luhman', 'luhman 16', 'enana marron'],
    resolveName: 'Luhman 16',
  },
  {
    name: 'TRAPPIST-1',
    category: 'Enana Roja Ultrafría',
    catalog: 'SIMBAD / NED',
    detail: 'Estrella enana ultrafría con sistema de 7 exoplanetas rocosos',
    tags: ['trappist', 'trappist-1', 'exoplanetas'],
    resolveName: 'TRAPPIST-1',
  },
  {
    name: 'Gliese 229 B',
    category: 'Enana Marrón Tipo T',
    catalog: 'SIMBAD',
    detail: 'Primera enana marrón descubierta con bandas de metano CH₄',
    tags: ['gliese', 'gliese 229', 'ch4', 'metano'],
    resolveName: 'Gliese 229 B',
  },
  {
    name: 'Proxima Centauri',
    category: 'Estrella Vecina',
    catalog: 'SIMBAD',
    detail: 'La estrella más cercana a la Tierra (4.2 al) con alto movimiento propio',
    tags: ['proxima', 'centauri', 'cercana'],
    resolveName: 'Proxima Centauri',
  },
  {
    name: 'Wolf 359',
    category: 'Enana Roja Fría',
    catalog: 'SIMBAD',
    detail: 'Enana roja tipo espectral tardío (M6V), muy contrastada en IR',
    tags: ['wolf', 'wolf 359', 'enana roja'],
    resolveName: 'Wolf 359',
  },
  {
    name: "Kapteyn's Star",
    category: 'Estrella del Halo',
    catalog: 'SIMBAD',
    detail: 'Estrella subenana con movimiento propio extremo (μ = 8.67"/año)',
    tags: ['kapteyn', 'halo', 'movimiento'],
    resolveName: "Kapteyn's star",
  },
  {
    name: 'Betelgeuse',
    category: 'Supergigante Roja',
    catalog: 'SIMBAD',
    detail: 'Supergigante pulsante con eyección masiva de polvo circunestelar en IR',
    tags: ['betelgeuse', 'orion', 'supergigante'],
    resolveName: 'Betelgeuse',
  },
  {
    name: 'Mira (Omicron Ceti)',
    category: 'Gigante Variable',
    catalog: 'SIMBAD',
    detail: 'Estrella pulsante de período largo con envoltura de polvo frío',
    tags: ['mira', 'omicron ceti', 'variable'],
    resolveName: 'Mira',
  },
];

export function CommandSearchModal({
  targets,
  isOpen,
  onClose,
  onSelectTarget,
  onJumpCoordinates,
  onResolveName,
  onExecuteAction,
}: CommandSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (isOpen) {
          e.preventDefault();
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 25);
    }
  }, [isOpen]);

  const parsedCoords = useMemo(() => parseRaDecInput(query), [query]);

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];
    const q = query.trim().toLowerCase();

    // 1. Salto directo por coordenadas si el usuario escribió números / grados
    if (parsedCoords) {
      list.push({
        id: 'jump-coords',
        type: 'coord',
        badge: 'COORD',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        label: `Centrar en RA ${parsedCoords.ra.toFixed(4)}°, Dec ${parsedCoords.dec.toFixed(4)}°`,
        detail: 'Salto directo por coordenadas celestes (grados decimales o sexagesimales)',
        run: () => {
          onJumpCoordinates(parsedCoords.ra, parsedCoords.dec);
          onClose();
        },
      });
    }

    // 2. Si el usuario escribió texto personalizado, ofrecer resolverlo en tiempo real en SIMBAD / NED
    if (!parsedCoords && q.length >= 2 && onResolveName) {
      const trimmedName = query.trim();
      list.push({
        id: 'resolve-live-api',
        type: 'resolve',
        badge: 'RESOLVER',
        badgeColor: 'bg-[#ff8a5c]/25 text-[#ff8a5c] border-[#ff8a5c]/40',
        label: `Buscar "${trimmedName}" en SIMBAD / NED`,
        detail: 'Consulta en tiempo real a /api/resolve (resuelve nombre → RA/Dec)',
        run: () => {
          onResolveName(trimmedName);
          onClose();
        },
      });
    }

    // 3. Recomendaciones del Catálogo Astronómico (autocompletado filtrado)
    const matchingPresets = q
      ? ASTRONOMICAL_CATALOG.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.detail.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q)),
        )
      : ASTRONOMICAL_CATALOG;

    matchingPresets.forEach((preset) => {
      list.push({
        id: `preset-${preset.name}`,
        type: 'object',
        badge: preset.catalog,
        badgeColor:
          preset.catalog === 'SPHEREx'
            ? 'bg-[#ff8a5c]/20 text-[#ff8a5c] border-[#ff8a5c]/30'
            : preset.catalog === 'SIMBAD'
              ? 'bg-[#6fd3ff]/20 text-[#6fd3ff] border-[#6fd3ff]/30'
              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        label: preset.name,
        detail: `${preset.category} · ${preset.detail}`,
        run: () => {
          if (preset.targetId) {
            const t = targets.find((x) => x.id === preset.targetId) ?? targets[0];
            onSelectTarget(t);
          } else if (preset.resolveName && onResolveName) {
            onResolveName(preset.resolveName);
          }
          onClose();
        },
      });
    });

    // 4. Acciones rápidas de la herramienta
    const quickActions: CommandItem[] = [
      {
        id: 'act-blink',
        type: 'action',
        badge: 'ACCIÓN',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        label: 'Modo Blink (Alternar épocas temporales)',
        detail: 'Reproduce o salta entre las épocas SPHEREx para detectar movimiento o variabilidad',
        run: () => {
          onExecuteAction('blink');
          onClose();
        },
      },
      {
        id: 'act-diff',
        type: 'action',
        badge: 'ACCIÓN',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        label: 'Modo Resta Diferencial (T₂ − T₁)',
        detail: 'Sustrae dos épocas temporales mediante /api/stack para revelar dipolos en movimiento',
        run: () => {
          onExecuteAction('diff');
          onClose();
        },
      },
      {
        id: 'act-sum',
        type: 'action',
        badge: 'ACCIÓN',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        label: 'Modo Co-Adición Suma (T₁ + T₂)',
        detail: 'Co-adición de frames temporales para maximizar la relación señal/ruido (SNR)',
        run: () => {
          onExecuteAction('sum');
          onClose();
        },
      },
      {
        id: 'act-split',
        type: 'action',
        badge: 'ACCIÓN',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        label: 'Abrir Panel de 6 Detectores LVF & Cubo 3D',
        detail: 'Despliega el visor multiespectral de los 6 detectores SPHEREx y el corte del cubo',
        run: () => {
          onExecuteAction('split');
          onClose();
        },
      },
    ];

    quickActions.forEach((act) => {
      if (!q || act.label.toLowerCase().includes(q) || (act.detail && act.detail.toLowerCase().includes(q))) {
        list.push(act);
      }
    });

    return list;
  }, [onClose, onExecuteAction, onJumpCoordinates, onResolveName, onSelectTarget, parsedCoords, query, targets]);

  useEffect(() => {
    setActiveIdx(0);
  }, [items.length, query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((p) => (items.length > 0 ? (p + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((p) => (items.length > 0 ? (p - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[activeIdx]) {
      e.preventDefault();
      items[activeIdx].run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[560px] hud-card-elevated rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/15 animate-panel-enter space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.04] rounded-xl border border-white/10 focus-within:border-[#ff8a5c]/60 transition-colors">
          <Search className="w-4 h-4 text-[#ff8a5c] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe nombre (ej. LMC, M82, NGC 6543) o coordenadas (ej. 80.89, -69.75)..."
            className="w-full bg-transparent text-xs font-mono text-[#f6f1ee] placeholder:text-[#b9a8a3]/60 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[10px] font-mono text-[#b9a8a3] hover:text-white px-1.5 py-0.5 rounded bg-white/10"
            >
              Borrar
            </button>
          ) : (
            <kbd className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[9px] font-mono text-[#b9a8a3]">
              Esc
            </kbd>
          )}
        </div>

        {/* Helper Hint */}
        <div className="px-2 flex items-center justify-between text-[10px] font-mono text-[#b9a8a3]">
          <span className="flex items-center gap-1">
            <Compass className="w-3 h-3 text-[#6fd3ff]" />
            Autocompletado de recomendaciones (SIMBAD, NED & SPHEREx)
          </span>
          <span className="text-[#525866]">↑↓ navegar · ↵ seleccionar</span>
        </div>

        {/* Autocomplete Dropdown List */}
        <div className="max-h-80 overflow-y-auto space-y-1 pt-1 pr-1">
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono text-[#b9a8a3]">
              No se encontraron coincidencias locales. Pulsa Enter para consultar SIMBAD/NED.
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={item.run}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-start justify-between gap-3 text-xs font-mono transition-all ${
                    active
                      ? 'bg-white/[0.12] text-white border border-[#ff8a5c]/40 shadow-sm'
                      : 'text-[#C8CDD6] hover:bg-white/[0.05] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {item.type === 'coord' ? (
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      ) : item.type === 'resolve' ? (
                        <Search className="w-3.5 h-3.5 text-[#ff8a5c]" />
                      ) : item.type === 'action' ? (
                        <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[#6fd3ff]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#f6f1ee] truncate flex items-center gap-2">
                        <span>{item.label}</span>
                      </div>
                      {item.detail && (
                        <div className="text-[10px] text-[#b9a8a3] truncate mt-0.5 font-sans">
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 self-center">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wider uppercase ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                    {active && <ArrowRight className="w-3 h-3 text-[#ff8a5c]" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
