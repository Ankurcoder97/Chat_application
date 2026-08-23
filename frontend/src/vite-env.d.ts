/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_RTC_ICE_SERVERS?: string;
  readonly VITE_RTC_FORCE_RELAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
