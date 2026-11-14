import { describe, expect, it } from 'vitest';
import { separationArcsec } from '../../coords';
import { DAY_MS, SURVEY_START_MS, TARGETS, fieldSources, findTarget, fluxAt, positionAt, surveyPasses } from './sky';

const t0 = Date.UTC(2025, 4, 1);
const t1 = Date.UTC(2026, 4, 1);

describe('objetos del reto', () => {
  it('incluye los cinco objetos de prueba', () => {
    expect(TARGETS.map((x) => x.name)).toEqual(expect.arrayContaining(["Barnard's star", 'Epsilon Indi B', 'WISE 0855', 'RW Aur', 'R Dra']));
  });

  it('encuentra un objeto por cualquiera de sus nombres', () => {
    expect(findTarget('estrella de barnard')?.name).toBe("Barnard's star");
    expect(findTarget('  R  Draconis ')?.name).toBe('R Dra');
    expect(findTarget('Estrella Falsa')).toBeUndefined();
  });

  it('mueve la estrella de Barnard a su ritmo real, sin exagerar', () => {
    const b = findTarget("Barnard's star")!;
    const d = separationArcsec(positionAt(b, t0)!, positionAt(b, t1)!);
    expect(d).toBeGreaterThan(9.5);
    expect(d).toBeLessThan(11.5);
  });

  it('coloca a Barnard en 2026 lejos de su posición de catálogo J2000', () => {
    const b = findTarget("Barnard's star")!;
    expect(separationArcsec(positionAt(b, t1)!, { ra: b.ra, dec: b.dec })).toBeGreaterThan(250);
  });

  it('hace que WISE 0855 solo brille en los últimos detectores', () => {
    const w = findTarget('WISE 0855')!;
    expect(fluxAt(w, 6, t0) / Math.max(fluxAt(w, 1, t0), 1e-9)).toBeGreaterThan(50);
  });

  it('hace que R Dra cambie de brillo pero no de lugar', () => {
    const r = findTarget('R Dra')!;
    const months = Array.from({ length: 12 }, (_, i) => t0 + i * 30 * DAY_MS);
    const flux = months.map((m) => fluxAt(r, 3, m));
    expect(Math.max(...flux) / Math.min(...flux)).toBeGreaterThan(2);
    expect(separationArcsec(positionAt(r, t0)!, positionAt(r, t1)!)).toBeLessThan(0.5);
  });
});

describe('campo y pasadas', () => {
  it('devuelve siempre las mismas fuentes para la misma región', () => {
    const c = { ra: 133.795129, dec: -7.245147 };
    expect(fieldSources(c, 300).map((s) => s.id)).toEqual(fieldSources(c, 300).map((s) => s.id));
    expect(fieldSources(c, 300).length).toBeGreaterThan(5);
  });

  it('incluye el objeto del reto cuando el campo lo cubre', () => {
    const b = findTarget("Barnard's star")!;
    const ids = fieldSources(positionAt(b, t1)!, 300).map((s) => s.id);
    expect(ids).toContain('barnard');
  });

  it('solo programa visitas entre el inicio del sondeo y ahora', () => {
    const now = Date.UTC(2026, 10, 14);
    const visits = surveyPasses({ ra: 10, dec: 20 }, now).flatMap((p) => p.visits);
    expect(visits.length).toBeGreaterThan(10);
    expect(Math.min(...visits)).toBeGreaterThanOrEqual(SURVEY_START_MS);
    expect(Math.max(...visits)).toBeLessThan(now);
  });
});
