# Deploy Astro Launcher przez Portainer

## Wymagania wstępne (na serwerze)

```bash
# 1. Utwórz katalog na vault
mkdir -p /opt/astro/vault

# 2. Skopiuj plik credentials.vault
#    (wygenerowany lokalnie przez npm run vault:create)
#    Wrzuć go do /opt/astro/vault/credentials.vault

# 3. Zainstaluj Docker + Portainer (jeśli nie masz)
#    Portainer: https://docs.portainer.io/start/install/server/docker
```

## Stack w Portainer

### Krok 1: Dodaj stack

1. Portainer → **Stacks** → **Add stack**
2. Name: `astro-launcher`
3. Build method: **Repository**
4. Repository URL: `https://github.com/morisastro/astrolauncher.git`
5. Repository reference: `main`
6. Compose path: `deploy/docker-compose.yml`

### Krok 2: Zmienne środowiskowe

| Zmienna | Wartość |
|---------|---------|
| `ASTRO_VAULT_KEY` | Twoje hasło master do vaulta |
| `LAUNCHER_KEY` | (opcjonalnie, nadpisuje klucz z vaulta) |

Ustaw je w sekcji **Environment variables** w Portainer.

### Krok 3: Zaawansowane (volumes)

Portainer sam stworzy bind mount dla vaulta. Upewnij się że:
- `/opt/astro/vault/credentials.vault` istnieje na serwerze
- Ma odpowiednie permisje (`chmod 600`)

### Krok 4: Deploy

Kliknij **Deploy the stack**. Portainer:
1. Sklonuje repo z GitHuba
2. Zbuduje obraz API z Dockerfile
3. Uruchomi: api + nginx + certbot

## SSL — pierwsze uruchomienie

Po deploy, certbot będzie czekał. Musisz ręcznie wydać pierwszy certyfikat:

```bash
# Wejdź do kontenera certbot
docker exec -it astro-certbot /bin/sh

# Wewnątrz kontenera:
certbot certonly --webroot -w /var/www/certbot \
  -d api.morisastro.pl \
  --email admin@morisastro.pl \
  --agree-tos --non-interactive
```

Po uzyskaniu certyfikatu:
```bash
# Restart nginx
docker restart astro-nginx
```

Certbot będzie potem automatycznie odnawiał certyfikat co 12h.

## Sprawdzenie

```bash
curl https://api.morisastro.pl/api/health
# → {"status":"ok","database":"connected","version":"1.0.0"}
```

## Troubleshooting

**Vault not found:**
Upewnij się że `/opt/astro/vault/credentials.vault` istnieje przed deploy.

**SSL not working:**
Sprawdź czy certyfikat został wygenerowany:
`docker exec astro-certbot certbot certificates`

**API not reachable:**
Sprawdź logi: Portainer → Containers → astro-api → Logs
