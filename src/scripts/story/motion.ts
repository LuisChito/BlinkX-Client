/* Movimiento de la portada: GSAP + ScrollTrigger + SplitText + Lenis.
   Todo respeta prefers-reduced-motion: si está activo se muestra el estado final sin movimiento. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function mountMotion(): void {
  const root = document.documentElement;
  const ready = () => root.classList.add('anim-ready');
  const mm = gsap.matchMedia();

  // Barra superior: fondo al hacer scroll y se oculta al bajar.
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  ScrollTrigger.create({
    start: 'top -40',
    onUpdate: (self) => {
      nav?.classList.toggle('is-scrolled', self.scroll() > 40);
      nav?.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 700);
    },
  });

  // Riel de capítulos: marca el capítulo en pantalla (funciona también sin animaciones).
  const links = new Map([...document.querySelectorAll<HTMLAnchorElement>('[data-rail-link]')].map((a) => [a.dataset.railLink!, a]));
  for (const section of document.querySelectorAll<HTMLElement>('[data-chapter]')) {
    ScrollTrigger.create({
      trigger: section, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return;
        links.forEach((a, id) => a.setAttribute('aria-current', String(id === section.id)));
      },
    });
  }

  mm.add('(prefers-reduced-motion: reduce)', () => {
    ready();
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Scroll suave sincronizado con ScrollTrigger.
    const lenis = new Lenis({ duration: 1.1, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    const onAnchor = (e: Event) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const target = document.querySelector<HTMLElement>(a.getAttribute('href')!);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0 });
      history.replaceState(null, '', a.getAttribute('href'));
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    document.addEventListener('click', onAnchor);

    // Títulos: líneas que suben. Textos y visuales: aparecen al entrar.
    const splits: SplitText[] = [];
    document.querySelectorAll<HTMLElement>('[data-split]').forEach((el, i) => {
      splits.push(SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'sl', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 110, duration: 1, stagger: 0.1, ease: 'power4.out', delay: i === 0 ? 0.15 : 0,
          scrollTrigger: i === 0 ? undefined : { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
        }),
      }));
    });
    document.querySelectorAll<HTMLElement>('[data-chapter]').forEach((section, i) => {
      const items = section.querySelectorAll('[data-reveal]');
      if (!items.length) return;
      gsap.from(items, {
        y: 28, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out', delay: i === 0 ? 0.5 : 0,
        scrollTrigger: i === 0 ? undefined : { trigger: section, start: 'top 70%', toggleActions: 'play none none none' },
      });
    });
    ready();

    // Paralaje suave de las ilustraciones.
    document.querySelectorAll<HTMLElement>('[data-parallax] img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.closest('[data-chapter]'), start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Las 102 bandas se dibujan de izquierda a derecha.
    const spectrum = document.querySelector('[data-spectrum]');
    if (spectrum) {
      gsap.from(spectrum.children, {
        scaleY: 0, transformOrigin: '50% 100%', duration: 0.5, stagger: 0.008, ease: 'power2.out',
        scrollTrigger: { trigger: spectrum, start: 'top 80%', toggleActions: 'play none none none' },
      });
    }

    // El mosaico se llena y el contador sube.
    const mosaic = document.querySelector('[data-mosaic]');
    if (mosaic) {
      gsap.from(mosaic.children, {
        opacity: 0, scale: 0.6, duration: 0.4, stagger: { each: 0.012, from: 'random' }, ease: 'power2.out',
        scrollTrigger: { trigger: mosaic, start: 'top 80%', toggleActions: 'play none none none' },
      });
    }
    const counter = document.querySelector<HTMLElement>('[data-counter]');
    if (counter) {
      const end = Number(counter.dataset.counter);
      const state = { v: 0 };
      gsap.to(state, {
        v: end, duration: 2.4, ease: 'power2.inOut',
        scrollTrigger: { trigger: counter, start: 'top 85%', toggleActions: 'play none none none' },
        onUpdate: () => { counter.textContent = Math.round(state.v).toLocaleString('es'); },
      });
    }

    return () => {
      document.removeEventListener('click', onAnchor);
      gsap.ticker.remove(tick);
      lenis.destroy();
      splits.forEach((s) => s.revert());
    };
  });
}
