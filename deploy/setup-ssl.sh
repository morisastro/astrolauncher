#!/bin/bash
# SSL certificate setup for api.morisastro.pl
# Run on the server as root

set -e

DOMAIN="api.morisastro.pl"
EMAIL="admin@morisastro.pl"

echo "=== Installing certbot ==="
apt-get update
apt-get install -y certbot python3-certbot-nginx

echo "=== Obtaining SSL certificate ==="
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

echo "=== Setting up auto-renewal ==="
systemctl enable certbot.timer
systemctl start certbot.timer

echo "=== Testing renewal ==="
certbot renew --dry-run

echo ""
echo "SSL setup complete for $DOMAIN"
echo "Certificates: /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo "Add this to your crontab for monthly renewal checks:"
echo "0 0 1 * * certbot renew --quiet && docker compose -f /path/to/deploy/docker-compose.yml restart nginx"
