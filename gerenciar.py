#!/usr/bin/env python3
"""Preparacao, deploy e backup do NovoSGA; requer somente Python padrao."""

import argparse
from datetime import datetime, timezone
import ipaddress
import json
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import subprocess
import sys
import urllib.request
import urllib.parse

PASTA = Path(__file__).resolve().parent
CHAVES = ("APP_SECRET", "DB_PASSWORD", "MERCURE_JWT_SECRET", "OAUTH_PASSPHRASE", "OAUTH_ENCRYPTION_KEY", "ADMIN_PASSWORD")


def validar_dominio(valor):
    valor = valor.strip().lower().rstrip(".")
    try:
        ipaddress.ip_address(valor)
    except ValueError:
        pass
    else:
        raise ValueError("Use um nome DNS, em vez de um endereco IP.")
    rotulo = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    if len(valor) > 253 or not re.fullmatch(rf"{rotulo}(?:\.{rotulo})+", valor):
        raise ValueError("Informe somente o dominio, sem https://, porta ou caminho.")
    if valor.endswith((".example", ".invalid", ".localhost", ".test")):
        raise ValueError("O dominio precisa ser publico e apontar para o servidor.")
    return valor


def preparar(dominio, email, pasta=PASTA, arquitetura=None, guiches=1, salas=1):
    dominio = validar_dominio(dominio)
    email = email.strip()
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", email):
        raise ValueError("Informe um email valido para os avisos do certificado HTTPS.")
    destino = pasta / ".env"
    if any(type(n) is not int or not 1 <= n <= 50 for n in (guiches, salas)):
        raise ValueError("Informe entre 1 e 50 guiches e salas de coleta.")
    if destino.exists() or (pasta / "credenciais.json").exists():
        raise FileExistsError("Configuracao privada ja existe.")
    valores = {"SGA_DOMAIN": dominio, "ACME_EMAIL": email}
    arquitetura = arquitetura or ("arm64" if platform.machine().lower() in ("aarch64", "arm64") else "amd64")
    if arquitetura not in ("amd64", "arm64"):
        raise ValueError("Arquitetura suportada: amd64 ou arm64.")
    valores.update({
        "SGA_PLATFORM": "linux/" + arquitetura,
        "SGA_IMAGE": "laboratorio-novosga:2.3.4-arm64" if arquitetura == "arm64" else "novosga/novosga:2.3.4",
        "SGA_PULL_POLICY": "never" if arquitetura == "arm64" else "missing",
    })
    valores.update({chave: secrets.token_hex(32) for chave in CHAVES})
    usuarios = []
    for tipo, quantidade in (("recepcao", guiches), ("coleta", salas), ("totem", 1), ("painel", 1)):
        for numero in range(1, quantidade + 1):
            login = f"{tipo}{numero:02}" if tipo in ("recepcao", "coleta") else tipo
            usuarios.append({"login": login, "senha": secrets.token_hex(16), "tipo": tipo, "numero": numero})
    credenciais = {"schema": 1, "url": "https://" + dominio, "guiches": guiches, "salas_coleta": salas,
                   "usuarios": usuarios, "mangati": {"client_id": secrets.token_hex(16), "client_secret": secrets.token_hex(64)}}
    criados = []
    try:
        for caminho, conteudo in (
            (destino, "# Configuracao privada do Laboratorio Rio Branco. Guarde um backup.\n" +
             "".join(f"{chave}='{valor}'\n" for chave, valor in valores.items())),
            (pasta / "credenciais.json", json.dumps(credenciais, ensure_ascii=False, indent=2) + "\n"),
        ):
            descritor = os.open(caminho, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            criados.append(caminho)
            with os.fdopen(descritor, "w", encoding="utf-8", newline="\n") as arquivo:
                arquivo.write(conteudo)
    except BaseException:
        for caminho in criados:
            caminho.unlink()
        raise
    print(".env e credenciais.json criados. As credenciais nao foram exibidas.")
    print("O usuario inicial sera admin. A senha esta em ADMIN_PASSWORD no .env.")
    return destino


def ler_credenciais(pasta=PASTA):
    config = json.loads((pasta / "credenciais.json").read_text(encoding="utf-8"))
    if config.get("schema") != 1 or not config.get("usuarios"):
        raise ValueError("credenciais.json invalido. Preserve o arquivo original da instalacao.")
    return config


def ler_ambiente(pasta=PASTA):
    valores = {}
    for linha in (pasta / ".env").read_text(encoding="utf-8").splitlines():
        if not linha or linha.startswith("#"):
            continue
        chave, valor = linha.split("=", 1)
        valores[chave] = valor.strip().strip("'")
    validar_dominio(valores.get("SGA_DOMAIN", ""))
    if not valores.get("ACME_EMAIL") or any(not re.fullmatch(r"[0-9a-f]{64}", valores.get(chave, "")) for chave in CHAVES):
        raise ValueError("Configuracao incompleta. Gere o .env com o comando preparar.")
    if valores.get("SGA_PLATFORM") not in ("linux/amd64", "linux/arm64"):
        raise ValueError("Arquitetura do .env ausente ou invalida.")
    return valores


def compose(*argumentos):
    ler_ambiente()
    if shutil.which("docker") is None:
        raise RuntimeError("Docker nao encontrado. Instale o Docker Engine e o plugin Compose na VPS.")
    # O .env do projeto prevalece sobre variaveis homonimas do terminal.
    ambiente = os.environ.copy()
    for chave in (*CHAVES, "SGA_DOMAIN", "ACME_EMAIL", "SGA_IMAGE", "SGA_PLATFORM", "SGA_PULL_POLICY", "COMPOSE_FILE", "COMPOSE_PROJECT_NAME", "COMPOSE_PROFILES"):
        ambiente.pop(chave, None)
    return ["docker", "compose", "--project-directory", str(PASTA), "--env-file", str(PASTA / ".env"), "-f", str(PASTA / "compose.yaml"), *argumentos], ambiente


def executar(*argumentos):
    comando, ambiente = compose(*argumentos)
    subprocess.run(comando, env=ambiente, check=True)


def publicar():
    if platform.system() != "Linux" or platform.machine().lower() not in ("x86_64", "amd64", "aarch64", "arm64"):
        raise RuntimeError("Execute o deploy em uma VPS Linux AMD64 ou ARM64. O pacote nao instala no Windows do totem.")
    arquitetura = "arm64" if platform.machine().lower() in ("aarch64", "arm64") else "amd64"
    if ler_ambiente()["SGA_PLATFORM"] != "linux/" + arquitetura:
        raise RuntimeError("O .env foi preparado para outra arquitetura. Confira SGA_PLATFORM, SGA_IMAGE e SGA_PULL_POLICY.")
    ler_credenciais()
    executar("version")
    executar("config", "--quiet")
    executar("pull", "db", "proxy")
    if arquitetura == "arm64":
        executar("build", "init")
    else:
        executar("pull", "init", "novosga", "worker", "scheduler")
    executar("up", "-d", "--wait", "--wait-timeout", "300")
    executar("ps")
    verificar()


def verificar():
    base = "https://" + ler_ambiente()["SGA_DOMAIN"]
    with urllib.request.urlopen(base + "/login", timeout=30) as resposta:
        if resposta.status != 200:
            raise RuntimeError("A tela de login nao respondeu como esperado.")
    print("Login acessivel com certificado HTTPS valido.")
    for origem in ("https://painel.mangati.com", "https://painel-client.mangati.com"):
        pedido = urllib.request.Request(base + "/api", method="OPTIONS", headers={
            "Origin": origem,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        })
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            cabecalhos = resposta.headers.get("Access-Control-Allow-Headers", "").lower()
            if resposta.headers.get("Access-Control-Allow-Origin") != origem or "authorization" not in cabecalhos or "content-type" not in cabecalhos:
                raise RuntimeError("A API nao permitiu o acesso do painel em " + origem)
        print("Preflight CORS do painel conferido: " + origem)
    credenciais = ler_credenciais()
    usuario = next(item for item in credenciais["usuarios"] if item["tipo"] == "painel")
    formulario = {"grant_type": "password", "client_id": credenciais["mangati"]["client_id"],
                  "client_secret": credenciais["mangati"]["client_secret"], "username": usuario["login"], "password": usuario["senha"]}
    pedido = urllib.request.Request(base + "/api/token", data=urllib.parse.urlencode(formulario).encode(), method="POST")
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        token = json.load(resposta).get("access_token")
    if not token:
        raise RuntimeError("A API nao retornou token OAuth para a integracao do painel.")
    pedido = urllib.request.Request(base + "/api/unidades", headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        unidades = json.load(resposta)
    if not isinstance(unidades, list) or not any(u.get("nome") == "Laboratório Rio Branco" for u in unidades):
        raise RuntimeError("A API nao retornou a unidade Laboratorio Rio Branco.")
    print("OAuth do usuario painel e consulta autenticada da unidade conferidos.")
    print("Teste na TV: emitir, chamar e conferir numero/local e audio no Mangati.")


def capturar(destino, *argumentos):
    comando, ambiente = compose(*argumentos)
    with destino.open("xb") as arquivo:
        os.chmod(destino, 0o600)
        subprocess.run(comando, stdout=arquivo, env=ambiente, check=True)


def backup():
    ler_ambiente()
    horario = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destino = PASTA / "backups" / horario
    destino.mkdir(parents=True, mode=0o700)
    try:
        capturar(destino / "database.dump", "exec", "-T", "db", "pg_dump", "-U", "novosga", "-d", "novosga", "--format=custom", "--no-owner")
        capturar(destino / "oauth-keys.tar.gz", "exec", "-T", "novosga", "tar", "-czf", "-", "-C", "/run/novosga-jwt", ".")
        capturar(destino / "uploads.tar.gz", "exec", "-T", "novosga", "tar", "-czf", "-", "-C", "/app/public/uploads", ".")
        privado = destino / "configuracao.env"
        descritor = os.open(privado, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descritor, "wb") as arquivo:
            arquivo.write((PASTA / ".env").read_bytes())
        privado_json = destino / "credenciais.json"
        descritor = os.open(privado_json, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descritor, "wb") as arquivo:
            arquivo.write((PASTA / "credenciais.json").read_bytes())
        (destino / "CONCLUIDO.txt").write_text("Backup concluido. Copie esta pasta para armazenamento externo protegido.\n", encoding="utf-8")
    except BaseException:
        print("Backup incompleto em " + str(destino) + ". Nao use este conjunto para restauracao.", file=sys.stderr)
        raise
    print("Backup concluido em " + str(destino))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="acao", required=True)
    preparar_parser = sub.add_parser("preparar", help="Gerar .env sem sobrescrever configuracao existente")
    preparar_parser.add_argument("--dominio", required=True)
    preparar_parser.add_argument("--email", required=True)
    preparar_parser.add_argument("--arquitetura", choices=("amd64", "arm64"), help="Padrao: detectar no computador atual; prepare na propria VPS")
    preparar_parser.add_argument("--guiches", type=int, default=1, help="Quantidade inicial de guiches; padrao de piloto: 1")
    preparar_parser.add_argument("--salas", type=int, default=1, help="Quantidade inicial de salas de coleta; padrao de piloto: 1")
    sub.add_parser("publicar", help="Baixar imagens e iniciar os containers na VPS Linux")
    sub.add_parser("status", help="Exibir o estado dos containers")
    sub.add_parser("verificar", help="Testar HTTPS, login e preflight do Painel Mangati")
    sub.add_parser("backup", help="Exportar banco, chaves, imagens e configuracao")
    args = parser.parse_args()
    try:
        if args.acao == "preparar":
            preparar(args.dominio, args.email, arquitetura=args.arquitetura, guiches=args.guiches, salas=args.salas)
        elif args.acao == "publicar":
            publicar()
        elif args.acao == "status":
            executar("ps")
        elif args.acao == "verificar":
            verificar()
        elif args.acao == "backup":
            backup()
    except FileExistsError:
        print("A configuracao privada ja existe; foi preservada. Nao regenere chaves nem senhas para reiniciar.", file=sys.stderr)
        return 1
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as erro:
        print("Erro: " + str(erro), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
