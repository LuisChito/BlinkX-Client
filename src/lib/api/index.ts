// Punto único de acceso a la API. PUBLIC_USE_MOCKS=false cambia de los datos simulados a la API real.
import { httpApi } from './client';
import { mockApi } from './mock/handlers';
import type { Api } from './types';

export const USE_MOCKS = String(import.meta.env?.PUBLIC_USE_MOCKS ?? 'false') === 'true';

export const api: Api = USE_MOCKS ? mockApi : httpApi;
export { absolute } from './client';
export * from './types';
