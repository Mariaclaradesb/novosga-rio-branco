#!/bin/sh
set -eu
cd /app
php bin/console cache:clear --no-warmup --no-interaction
php bin/console cache:warmup --no-interaction
exec frankenphp run --config /etc/frankenphp/Caddyfile --adapter caddyfile
