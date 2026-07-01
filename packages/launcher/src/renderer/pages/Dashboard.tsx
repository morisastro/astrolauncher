import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { apiGet, apiPost } from '../lib/api';

interface NewsItem {
  id: string; title: string; content: string;
  imageUrl: string | null; author: { username: string }; createdAt: string;
}

interface RankItem {
  id: string; name: string; displayName: string;
  color: string; icon: string | null; priority: number;
}

interface VersionItem {
  id: string; name: string; type: string;
  isInstalled: boolean; installedPath: string | null;
}

interface RemoteVersion {
  id: string; type: string; url: string;
}

interface ModItem {
  id: string; name: string; description: string;
  logoUrl: string | null; source: string;
  minecraftVersions: string[];
}

function VersionCard({ v, onDownload, onLaunch, downloading, launching }:
  { v: VersionItem | RemoteVersion; onDownload: () => void; onLaunch: () => void; downloading: boolean; launching: boolean }) {
  const isInstalled = (v as VersionItem).isInstalled;
  const typeColor = v.type === 'release' ? '#3fb950' : v.type === 'snapshot' ? '#d29922' : '#8b949e';
  return (
    <div className="version-card" style={{ borderLeftColor: typeColor }}>
      <div className="version-info">
        <span className="version-name">{v.id}</span>
        <span className="version-type" style={{ color: typeColor }}>{v.type}</span>
      </div>
      <div className="version-actions">
        {isInstalled ? (
          <button className="btn btn-green" onClick={onLaunch} disabled={launching}>
            {launching ? 'Launching...' : 'Play'}
          </button>
        ) : (
          <button className="btn btn-blue" onClick={onDownload} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        )}
      </div>
    </div>
  );
}

function ModCard({ mod, onInstall, installing }: { mod: ModItem; onInstall: () => void; installing?: boolean }) {
  return (
    <div className="mod-card">
      {mod.logoUrl && <img src={mod.logoUrl} alt="" className="mod-logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
      <div className="mod-info">
        <span className="mod-name">{mod.name}</span>
        <span className="mod-desc">{mod.description}</span>
        <span className="mod-versions">{mod.minecraftVersions.slice(0, 3).join(', ')}</span>
      </div>
      <div className="version-actions">
        <button className="btn btn-blue btn-sm" onClick={onInstall} disabled={installing}>
          {installing ? '...' : 'Install'}
        </button>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [ranks, setRanks] = useState<RankItem[]>([]);
  const [localVersions, setLocalVersions] = useState<VersionItem[]>([]);
  const [remoteVersions, setRemoteVersions] = useState<RemoteVersion[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'versions' | 'mods'>('dashboard');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [mcProgress, setMcProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [mcLog, setMcLog] = useState<string[]>([]);
  const [javaPath, setJavaPath] = useState('java');
  const [filter, setFilter] = useState<'all' | 'release' | 'snapshot'>('release');

  const [mods, setMods] = useState<ModItem[]>([]);
  const [modQuery, setModQuery] = useState('');
  const [modLoader, setModLoader] = useState('');
  const [installingMod, setInstallingMod] = useState<string | null>(null);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    apiGet('/news').then(setNews).catch(() => {});
    apiGet('/ranks').then(setRanks).catch(() => {});
    loadVersions();
    setupMcListeners();
    checkUpdate();
    if (window.astro) {
      window.astro.update.onProgress((pct) => setUpdateProgress(pct));
    }
  }, []);

  async function checkUpdate() {
    if (!window.astro) return;
    try {
      const info = await window.astro.update.check();
      if (info.updateAvailable) {
        setUpdateAvailable(true);
        setUpdateInfo(info);
      }
    } catch {}
  }

  async function handleUpdate() {
    if (!window.astro || !updateInfo) return;
    setUpdating(true);
    try {
      const plat = window.astro.platform === 'win32' ? 'win' : window.astro.platform === 'darwin' ? 'darwin' : 'linux';
      const url = updateInfo.platforms?.[plat]?.url;
      if (!url) throw new Error('No download for this platform');
      const path = await window.astro.update.download(url);
      await window.astro.update.install(path);
    } catch (err: any) {
      alert('Update failed: ' + err.message);
    } finally { setUpdating(false); }
  }

  function setupMcListeners() {
    if (!window.astro) return;
    window.astro.mc.onProgress((data) => setMcProgress(data));
    window.astro.mc.onOutput((line) => setMcLog(prev => [...prev.slice(-199), `[MC] ${line}`]));
    window.astro.mc.onError((line) => setMcLog(prev => [...prev.slice(-199), `[ERR] ${line}`]));
    window.astro.mc.onExit((code) => {
      setMcLog(prev => [...prev, `[EXIT] Process exited with code ${code}`]);
      setLaunching(null);
    });
  }

  async function loadVersions() {
    try {
      const [local, remote] = await Promise.all([
        apiGet('/versions'),
        apiGet('/versions/fetch-remote'),
      ]);
      setLocalVersions(local);
      setRemoteVersions(remote);
    } catch {}
  }

  const handleDownload = useCallback(async (versionName: string) => {
    if (!window.astro) return;
    setDownloading(versionName);
    setMcProgress(null);
    try {
      await window.astro.mc.download(versionName);
      await loadVersions();
    } catch (err: any) {
      setMcLog(prev => [...prev, `[ERROR] ${err.message}`]);
    } finally { setDownloading(null); }
  }, []);

  const handleLaunch = useCallback(async (versionName: string) => {
    if (!window.astro) return;
    setLaunching(versionName);
    setMcLog([]);
    try {
      await window.astro.mc.launch(versionName, javaPath || undefined);
    } catch (err: any) {
      setMcLog(prev => [...prev, `[ERROR] ${err.message}`]);
      setLaunching(null);
    }
  }, [javaPath]);

  async function searchMods() {
    if (!modQuery.trim()) return;
    try {
      let path = `/mods/search?q=${encodeURIComponent(modQuery)}&limit=30`;
      if (modLoader) path += `&loader=${encodeURIComponent(modLoader)}`;
      const results = await apiGet(path);
      setMods(results);
    } catch {}
  }

  async function handleInstallMod(modId: string) {
    setInstallingMod(modId);
    try {
      const resp = await apiGet(`/mods/${modId}`);
      const version = resp.versions?.[0];
      if (!version) { alert('No version available'); return; }
      const dl = await apiGet(`/mods/${modId}/${version.id}/download-url`);
      if (dl?.url) {
        const a = document.createElement('a');
        a.href = dl.url;
        a.download = dl.filename || 'mod.jar';
        a.click();
      }
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally { setInstallingMod(null); }
  }

  const filteredRemote = remoteVersions.filter(v => filter === 'all' ? true : v.type === filter);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          Astro
          {updateAvailable && <span className="update-badge" onClick={handleUpdate}>UPDATE</span>}
        </div>
        <nav>
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={activeTab === 'versions' ? 'active' : ''} onClick={() => setActiveTab('versions')}>Versions</button>
          <button className={activeTab === 'mods' ? 'active' : ''} onClick={() => setActiveTab('mods')}>Mods</button>
        </nav>
        <div className="sidebar-user">
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            {user?.rank && (
              <span className="user-rank" style={{ color: user.rank.color }}>
                {user.rank.icon && <img src={`./assets/ranks/${user.rank.icon}`} alt="" className="rank-icon" />}
                {user.rank.displayName}
              </span>
            )}
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
        {updating && <div className="sidebar-update">Updating... {updateProgress}%</div>}
      </aside>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            {updateAvailable && (
              <div className="update-banner">
                Update {updateInfo?.version} available!
                <button className="btn btn-blue btn-sm" onClick={handleUpdate} disabled={updating}>
                  {updating ? `Downloading ${updateProgress}%` : 'Update Now'}
                </button>
              </div>
            )}
            <h2>News</h2>
            <div className="news-list">
              {news.map(item => (
                <div key={item.id} className="news-card">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="news-image" />}
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  <small>{item.author.username} &middot; {new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
              ))}
              {news.length === 0 && <p className="empty">No news yet.</p>}
            </div>
            <h2>Ranks</h2>
            <div className="ranks-list">
              {ranks.map(r => (
                <div key={r.id} className="rank-card" style={{ borderLeftColor: r.color }}>
                  {r.icon && <img src={`./assets/ranks/${r.icon}`} alt="" className="rank-icon-lg" />}
                  <span style={{ color: r.color, fontWeight: 'bold' }}>{r.displayName}</span>
                  <small>{r.name}</small>
                </div>
              ))}
              {ranks.length === 0 && <p className="empty">No ranks yet.</p>}
            </div>
          </>
        )}

        {activeTab === 'versions' && (
          <>
            <div className="versions-header">
              <h2>Minecraft Versions</h2>
              <div className="version-controls">
                <label>
                  Java:
                  <input className="java-input" value={javaPath} onChange={e => setJavaPath(e.target.value)} placeholder="java" />
                </label>
                <select value={filter} onChange={e => setFilter(e.target.value as any)} className="filter-select">
                  <option value="release">Release</option>
                  <option value="snapshot">Snapshot</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
            {mcProgress && (
              <div className="progress-bar-container">
                <div className="progress-label">{mcProgress.msg}</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${mcProgress.pct}%` }} /></div>
              </div>
            )}
            <div className="versions-grid">
              <h3>Installed</h3>
              <div className="version-cards">
                {localVersions.filter(v => v.isInstalled).map(v => (
                  <VersionCard key={v.id} v={v} onDownload={() => {}} onLaunch={() => handleLaunch(v.name)} downloading={false} launching={launching === v.name} />
                ))}
                {localVersions.filter(v => v.isInstalled).length === 0 && <p className="empty">No versions installed</p>}
              </div>
            </div>
            <div className="versions-grid">
              <h3>Available ({filteredRemote.length})</h3>
              <div className="version-cards">
                {filteredRemote.slice(0, 100).map(v => (
                  <VersionCard key={v.id} v={v} onDownload={() => handleDownload(v.id)} onLaunch={() => {}} downloading={downloading === v.id} launching={false} />
                ))}
              </div>
            </div>
            {mcLog.length > 0 && (
              <div className="mc-log">
                <h3>Game Log</h3>
                <div className="mc-log-content">
                  {mcLog.map((line, i) => <div key={i} className="log-line">{line}</div>)}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'mods' && (
          <>
            <h2>Mod Browser</h2>
            <div className="mod-search">
              <input className="mod-search-input" value={modQuery} onChange={e => setModQuery(e.target.value)} placeholder="Search mods..." onKeyDown={e => e.key === 'Enter' && searchMods()} />
              <button className="btn btn-blue" onClick={searchMods}>Search</button>
            </div>
            <div className="mod-list">
              {mods.map(mod => (
                <ModCard key={mod.id} mod={mod} onInstall={() => handleInstallMod(mod.id)} installing={installingMod === mod.id} />
              ))}
              {mods.length === 0 && <p className="empty">Search for mods above</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
