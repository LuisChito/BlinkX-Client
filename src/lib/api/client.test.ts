import { afterEach, describe, expect, it, vi } from 'vitest';
import { absolute, httpApi } from './client';
import { ApiError } from './types';

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('httpApi', () => {
  it('entrega el resultado directo cuando la API responde 200', async () => {
    respond(200, { frames: [] });
    expect(await httpApi.sequence({ ra: 1, dec: 2, fov: 300 })).toEqual({ kind: 'result', result: { frames: [] } });
  });

  it('entrega el trabajo cuando la API responde 202', async () => {
    respond(202, { id: 'seq_1', status: 'queued' });
    expect(await httpApi.sequence({ ra: 1, dec: 2, fov: 300 })).toEqual({ kind: 'job', job: { id: 'seq_1', status: 'queued' } });
  });

  it('convierte el cuerpo de error en ApiError con su código y mensaje', async () => {
    respond(404, { error: { code: 'not_found', message: 'No encontramos "Estrella Falsa" en SIMBAD ni en NED.' } });
    const e = await httpApi.resolve({ name: 'Estrella Falsa' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 404, code: 'not_found', message: 'No encontramos "Estrella Falsa" en SIMBAD ni en NED.' });
  });

  it('avisa con un mensaje claro cuando no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(httpApi.status()).rejects.toMatchObject({ code: 'upstream_error', message: 'No hay conexión con el servidor.' });
  });

  it('manda las listas separadas por comas y omite lo que no tiene valor', async () => {
    const f = respond(202, { id: 'st_1' });
    await httpApi.stack({ ra: 1, dec: 2, fov: 300, op: 'diff', a: ['f1', 'f2'], b: ['f3'] });
    const url = new URL(f.mock.calls[0][0], 'http://x');
    expect(url.pathname).toBe('/api/stack');
    expect(url.searchParams.get('a')).toBe('f1,f2');
    expect(url.searchParams.get('b')).toBe('f3');
    expect(url.searchParams.has('size')).toBe(false);
  });

  it('usa los nombres de parámetro del contrato', async () => {
    const f = respond(200, {});
    await httpApi.frames({ ra: 1, dec: 2, fov: 300, detector: 6, date_from: '2025-05-01', limit: 50, offset: 100 });
    const q = new URL(f.mock.calls[0][0], 'http://x').searchParams;
    expect(Object.fromEntries(q)).toEqual({ ra: '1', dec: '2', fov: '300', detector: '6', date_from: '2025-05-01', limit: '50', offset: '100' });
  });
});

describe('absolute', () => {
  it('deja intactas las URLs completas y las blob:', () => {
    expect(absolute('blob:x')).toBe('blob:x');
    expect(absolute('https://a.b/c.png')).toBe('https://a.b/c.png');
  });
  it('antepone la base a las rutas relativas', () => {
    expect(absolute('/api/frame/x.png?ra=1')).toMatch(/\/api\/frame\/x\.png\?ra=1$/);
  });
});
