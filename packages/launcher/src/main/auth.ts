const { ipcMain, shell } = require('electron');

const CLIENT_ID = '00000000402b5328';
const DEVICE_CODE_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode';
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const XBL_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';
const SCOPE = 'XboxLive.signin offline_access';

async function jsonPost(url, body, contentType = 'application/json') {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function pollForToken(deviceCode) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'urn:ietf:params:oauth:grants:device_code',
    device_code: deviceCode,
  });

  while (true) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const data = await jsonPost(TOKEN_URL, params.toString(), 'application/x-www-form-urlencoded');
      return data.access_token;
    } catch (err) {
      const msg = err.message;
      if (msg.includes('authorization_pending')) continue;
      if (msg.includes('slow_down')) { await new Promise(r => setTimeout(r, 5000)); continue; }
      if (msg.includes('expired_token')) throw new Error('Code expired');
      if (msg.includes('access_denied')) throw new Error('User cancelled');
      throw err;
    }
  }
}

async function loginWithMicrosoft(onUserCode) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPE,
  });

  const deviceResp = await jsonPost(DEVICE_CODE_URL, params.toString(), 'application/x-www-form-urlencoded');

  onUserCode({
    userCode: deviceResp.user_code,
    verificationUri: deviceResp.verification_uri,
    expiresIn: deviceResp.expires_in,
  });

  shell.openExternal(deviceResp.verification_uri);

  const msToken = await pollForToken(deviceResp.device_code);

  const xblResp = await jsonPost(XBL_URL, {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${msToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  });

  const xblToken = xblResp.Token;
  const userHash = xblResp.DisplayClaims.xui[0].uhs;

  const xstsResp = await jsonPost(XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  });

  const xstsToken = xstsResp.Token;

  const mcResp = await jsonPost(MC_AUTH_URL, {
    identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
  });

  const mcToken = mcResp.access_token;

  const profileResp = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcToken}` },
  });
  const profile = await profileResp.json();

  return {
    mcToken,
    uuid: profile.id,
    username: profile.name,
    expiresAt: Date.now() + (mcResp.expires_in * 1000),
  };
}

function setupAuthIpc() {
  ipcMain.handle('mc:login', async (event) => {
    return loginWithMicrosoft((info) => {
      event.sender.send('mc:usercode', info);
    });
  });
}

module.exports = { setupAuthIpc, loginWithMicrosoft };
