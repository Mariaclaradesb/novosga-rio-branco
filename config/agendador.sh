#!/bin/sh
set -eu
cd /app
php bin/console cache:clear --no-warmup --no-interaction
proxima_sincronizacao=0
while :; do
    # O PHP usa o mesmo fuso da unidade, definido pela imagem e por TZ.
    hoje=$(php -r 'echo date("Y-m-d");')
    hora=$(php -r 'echo (int) date("G");')
    ultima_data=$(cat /var/lib/novosga/ultimo-reset 2>/dev/null || true)
    if [ "$hora" -ge 1 ] && [ "$hoje" != "$ultima_data" ]; then
        # --seguro preserva os atendimentos do dia atual.
        if php bin/console novosga:reset --seguro --no-interaction; then
            printf '%s\n' "$hoje" > /var/lib/novosga/ultimo-reset
        else
            echo 'Falha ao reiniciar numeracao; nova tentativa em um minuto.' >&2
        fi
    fi
    agora=$(date +%s)
    if [ "$agora" -ge "$proxima_sincronizacao" ]; then
        if php bin/console novosga:scheduling:sync --no-interaction; then
            proxima_sincronizacao=$((agora + 900))
        else
            echo 'Falha na sincronizacao de agendamentos; nova tentativa em um minuto.' >&2
        fi
    fi
    sleep 60
done
