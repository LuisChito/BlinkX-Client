/// <reference types="astro/client" />
interface ImportMetaEnv {
  readonly PUBLIC_USE_MOCKS?: string;
  readonly PUBLIC_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
