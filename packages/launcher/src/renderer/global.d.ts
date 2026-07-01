interface AstroMc {
  download: (version: string) => Promise<boolean>;
  launch: (version: string, javaPath?: string) => Promise<boolean>;
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

interface Window {
  astro: {
    getApiUrl: () => Promise<string>;
    getLauncherKey: () => Promise<string>;
    getMcDir: () => Promise<string>;
    platform: string;
    app: AstroApp;
    mc: AstroMc;
    update: AstroUpdate;
  };
}
