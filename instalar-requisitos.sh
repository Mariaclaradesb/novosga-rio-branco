#!/bin/sh
# Execute somente na VM Ubuntu 24.04 dedicada ao NovoSGA.
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo 'Execute na VM: sudo sh instalar-requisitos.sh' >&2
    exit 1
fi
. /etc/os-release
if [ "$ID" != ubuntu ] || [ "$VERSION_ID" != 24.04 ]; then
    echo 'Instalador preparado para Ubuntu 24.04 LTS. Nenhuma alteracao realizada.' >&2
    exit 1
fi
rb_arch=$(dpkg --print-architecture)
case "$rb_arch" in arm64|amd64) ;; *) echo 'Arquitetura nao suportada.' >&2; exit 1 ;; esac

if command -v docker >/dev/null 2>&1; then
    docker version >/dev/null
    docker compose version
    python3 --version
    echo 'Docker, Compose e Python existentes conferidos.'
    exit 0
fi
for rb_package in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
    if [ "$(dpkg-query -W -f='${Status}' "$rb_package" 2>/dev/null || true)" = 'install ok installed' ]; then
        echo "Pacote existente precisa de revisao antes da instalacao: $rb_package. Nada sera removido." >&2
        exit 1
    fi
done

apt-get update
apt-get install -y ca-certificates curl python3
install -m 0755 -d /etc/apt/keyrings
if [ ! -e /etc/apt/keyrings/docker.asc ]; then
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
        https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
fi
if [ ! -e /etc/apt/sources.list.d/docker.sources ]; then
    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $rb_arch
Signed-By: /etc/apt/keyrings/docker.asc
EOF
fi
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version
python3 --version
echo 'Requisitos instalados. Continue em COMECE-AQUI.md.'
