#!/bin/sh
set -eu
cd /app
php bin/console cache:clear --no-warmup --no-interaction
exec php bin/console messenger:consume async --time-limit=3600 --memory-limit=128M --no-interaction
