# Deploy Astro Launcher API

## Requirements
- Ubuntu 22.04+ server
- Docker & Docker Compose
- PostgreSQL (or use existing one at 57.128.239.39:54235)
- Domain api.morisastro.pl pointing to server IP

## Quick start

### 1. Clone and setup

```bash
# Copy deploy folder to server
# ssh into server, then:

mkdir -p /opt/astro
# Copy deploy/ contents to /opt/astro
cd /opt/astro
```

### 2. SSL Certificate

```bash
chmod +x setup-ssl.sh
sudo ./setup-ssl.sh
```

### 3. Environment

```bash
# Set your vault passphrase
export ASTRO_VAULT_KEY="M0j4T4jn4Hasl0D0V4ult4!"
```

### 4. Start

```bash
# Copy vault file
mkdir -p ../config/vault
# copy credentials.vault to ../config/vault/

docker compose up -d --build
```

### 5. Verify

```bash
curl https://api.morisastro.pl/api/health
# Expected: {"status":"ok","database":"connected","version":"1.0.0"}
```

## Discord Bot

```bash
cd packages/discord-bot
npm install

export DISCORD_TOKEN="your_token"
export DISCORD_CLIENT_ID="your_client_id"
export DISCORD_GUILD_ID="optional_guild_id"
export ADMIN_ROLE_ID="optional_admin_role_id"
export API_URL="https://api.morisastro.pl"
export LAUNCHER_KEY="your_launcher_key"

# Register commands
npm run deploy:commands

# Start bot
npm start
```
