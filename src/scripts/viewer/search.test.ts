import { describe, expect, it } from 'vitest';
import { classifyQuery } from './search';

describe('classifyQuery', () => {
  it('reconoce coordenadas válidas', () => {
    expect(classifyQuery('08h55m10.831s -7d14m42.53s').kind).toBe('coords');
    expect(classifyQuery(' 133.795129, -7.245147 ').kind).toBe('coords');
  });
  it('trata el texto como un nombre', () => {
    expect(classifyQuery("Barnard's star")).toEqual({ kind: 'name', name: "Barnard's star" });
    expect(classifyQuery('WISE 0855').kind).toBe('name');
    expect(classifyQuery('2MASS J17574849+0441405').kind).toBe('name');
  });
  it('pide algo cuando el campo está vacío', () => {
    expect(classifyQuery('   ')).toMatchObject({ kind: 'error' });
  });
  it('no confunde coordenadas mal escritas con un nombre', () => {
    for (const q of ['360 10', '120 91', '12', '10 20 30', '25:00:00 +10:00:00', '-7.2']) {
      expect(classifyQuery(q).kind, q).toBe('error');
    }
  });
});
