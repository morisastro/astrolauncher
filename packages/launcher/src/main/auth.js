const { ipcMain, shell } = require('electron');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { createServer } = require('node:http');

const CLIENT_ID = '00000000402b5328';
const REDIRECT_PORT = 8085;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth`;
const AUTH_URL = 'https://login.live.com/oauth20_authorize.srf';
const TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const XBL_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';

async function jsonPost(url, body, headers = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function loginWithMicrosoft() {
  return new Promise((resolve, reject) => {
    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const authUrl = `${AUTH_URL}?${new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'XboxLive.signin offline_access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })}`;

    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== '/auth') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const returnedState = url.searchParams.get('state');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Auth failed</h1><p>You can close this window.</p>');
        server.close();
        reject(new Error(error));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Invalid state</h1>');
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      try {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="background:#0d1117;color:#3fb950;font-family:sans-serif;text-align:center;padding:60px"><h1>Astro Launcher</h1><p>Login successful! You can close this window.</p></body></html>');

        // Exchange code for token
        const tokenResp = await jsonPost(TOKEN_URL, new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }).toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });

        const accessToken = tokenResp.access_token;

        // Xbox Live auth
        const xblResp = await jsonPost(XBL_URL, {
          Properties: {
            AuthMethod: 'RPS',
            SiteName: 'user.auth.xboxlive.com',
            RpsTicket: `d=${accessToken}`,
          },
          RelyingParty: 'http://auth.xboxlive.com',
          TokenType: 'JWT',
        });

        const xblToken = xblResp.Token;
        const userHash = xblResp.DisplayClaims.xui[0].uhs;

        // XSTS auth
        const xstsResp = await jsonPost(XSTS_URL, {
          Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
          RelyingParty: 'rp://api.minecraftservices.com/',
          TokenType: 'JWT',
        });

        const xstsToken = xstsResp.Token;

        // Minecraft auth
        const mcResp = await jsonPost(MC_AUTH_URL, {
          identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
        });

        const mcToken = mcResp.access_token;

        // Get MC profile
        const profileResp = await fetch(MC_PROFILE_URL, {
          headers: { Authorization: `Bearer ${mcToken}` },
        });
        const profile = await profileResp.json();

        server.close();
        resolve({
          mcToken,
          uuid: profile.id,
          username: profile.name,
          expiresAt: Date.now() + (mcResp.expires_in * 1000),
        });
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      shell.openExternal(authUrl);
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Auth timeout'));
    }, 300000);
  });
}

function setupAuthIpc() {
  ipcMain.handle('mc:login', async () => {
    return loginWithMicrosoft();
  });
}

module.exports = { setupAuthIpc, loginWithMicrosoft };
