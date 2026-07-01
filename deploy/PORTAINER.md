# Deploy Astro Launcher przez Portainer

## Stack w Portainer

1. Portainer → **Stacks** → **Add stack**
2. Name: `astro-launcher`
3. Build method: **Repository**
4. Repository URL: `https://github.com/morisastro/astrolauncher.git`
5. Repository reference: `main`
6. Compose path: `deploy/docker-compose.yml`

### Zmienne środowiskowe (ustaw w Portainer)

| Zmienna | Wartość |
|---------|---------|
| `DATABASE_URL` | `postgresql://astrolauncher:AsTr0_mOrIsAsTr0.pl@57.128.239.39:54235/astrolauncher` |
| `JWT_SECRET` | `4851b11bb4eaa4bf266a446d939997196d6697851e88bbd6bf50422e0c07c29068747a8944a26b214e4b2d936bf34611` |
| `LAUNCHER_KEY` | `583582787f59a73a972be0367615f0fbcd1fc1569b893529bb710ebe25659a7d` |

### Deploy

Kliknij **Deploy the stack**.

## SSL — pierwsze uruchomienie

Po deploy otwórz Portainer → **Containers** → kliknij `astro-certbot` → **Exec console** i wpisz:

```bash
certbot certonly --webroot -w /var/www/certbot -d api.morisastro.pl --email admin@morisastro.pl --agree-tos --non-interactive
```

Potem zrestartuj nginx:
```bash
docker restart astro-nginx
```

Certbot będzie odnawiał certyfikat automatycznie co 12h.

## Sprawdzenie

```bash
curl https://api.morisastro.pl/api/health
```

## Troubleshooting

**API not reachable:**
Portainer → Containers → astro-api → Logs
