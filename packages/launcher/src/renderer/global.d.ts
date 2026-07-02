interface AstroMc {
  login: () => Promise<{ mcToken: string; uuid: string; username: string; expiresAt: number }>;
  download: (version: string) => Promise<boolean>;
  launch: (version: string, javaPath?: string, mcProfile?: { uuid: string; username: string; mcToken: string }) => Promise<boolean>;
  kill: () => Promise<boolean>;
  status: () => Promise<boolean>;
  onProgress: (cb: (data: { msg: string; pct: number }) => void) => void;
  onOutput: (cb: (line: string) => void) => void;
  onError: (cb: (line: string) => void) => void;
  onExit: (cb: (code: number) => void) => void;
}

interface AstroApp {
  getVersion: () => Promise<string>;
  quit: () => Promise<void>;
}

interface AstroUpdate {
  check: () => Promise<{ updateAvailable: boolean; version?: string; notes?: string; platforms?: { win: { url: string }; linux: { url: string }; darwin: { url: string } } }>;
  download: (url: string) => Promise<string>;
  install: (path: string) => Promise<boolean>;
  onProgress: (cb: (pct: number) => void) => void;
}

interface AstroMod {
  search: (query: string, limit?: number, loader?: string, mcVersion?: string) => Promise<any[]>;
  versions: (modId: string) => Promise<any[]>;
  download: (modId: string, versionId: string) => Promise<string>;
  builtin: () => Promise<any>;
  installBuiltin: (mcVersion: string) => Promise<string | null>;
  onProgress: (cb: (data: { pct: number; msg: string }) => void) => void;
}

interface AstroDiscord {
  openInvite: () => Promise<void>;
}

interface Window {
  astro: {
    getApiUrl: () => Promise<string>;
    getLauncherKey: () => Promise<string>;
    getMcDir: () => Promise<string>;
    platform: string;
    app: AstroApp;
    mc: AstroMc;
    update: AstroUpdate;
    mod: AstroMod;
    discord: AstroDiscord;
  };
}
