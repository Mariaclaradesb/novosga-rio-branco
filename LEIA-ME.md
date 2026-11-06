# NovoSGA open source — Laboratório Rio Branco

Pacote para hospedar o NovoSGA Community Edition em uma VPS e usar o Mangati como painel da TV. Não requer contratar o NovoSGA Online nem o Mangati Triagem.

**Para publicar mais tarde, comece por [COMECE-AQUI.md](COMECE-AQUI.md).** Não é preciso concluir cadastros em provedores agora.

**Frontend na Vercel:** a pasta `frontend` contém o totem separado para publicação manual; consulte [VERCEL.md](VERCEL.md). Esta documentação continua descrevendo o backend Oracle. A URL do Mangati deve apontar ao NovoSGA na Oracle, e não ao frontend Vercel.

**Situação em 06/11/2026:** orçamento informado: **custo zero**. Arquivos preparados; servidor e endereço DNS ainda não existem. O deploy e os testes reais de senha, totem e impressão continuam pendentes. Este pacote não foi executado em um Docker Engine nesta sessão.

**Caminho proposto:** Oracle Cloud Always Free em ARM + endereço gratuito DuckDNS + plano gratuito do Mangati Painel. Veja [NUVEM-GRATUITA.md](NUVEM-GRATUITA.md) para a criação da infraestrutura e suas condições.

## O que está configurado

| Item | Configuração |
|---|---|
| Aplicação | NovoSGA 2.3.4; imagem oficial em x86_64 ou compilação do código oficial em ARM64 |
| Banco | PostgreSQL 16 em volume persistente, sem porta pública |
| Acesso | HTTPS automático por Caddy; portas públicas 80 e 443 |
| Unidade inicial | Laboratório Rio Branco |
| Idioma e fuso | Português; America/Rio_Branco |
| Administrador inicial | Login `admin`, senha aleatória gerada no servidor |
| Autenticação da API | Chaves OAuth exclusivas da instalação e persistentes |
| Atualizações de chamadas | Hub Mercure da própria imagem, atrás do HTTPS |
| Processos auxiliares | Worker de mensagens e sincronização de agendamentos |
| Numeração | Reinício seguro após 01:00 local, preservando atendimentos do dia atual |
| Arquivos | Logos enviados pelo administrador em volume persistente |
| Backup | Exportação manual do banco, chaves OAuth, logos e `.env` |

O instalador cria unidade, administrador, prioridades Normal/Prioridade, serviços Recepção/Coleta, tipos de local Guichê/Sala de coleta, operadores por posto, usuários `totem`/`painel` e cliente OAuth para o Mangati. As quantidades iniciais são definidas por `--guiches` e `--salas`; o padrão de piloto é 1 de cada. Não representa uma confirmação da estrutura real do laboratório. O marcador persistido no banco preserva os cadastros e senhas em reexecuções.

## 1. Provisionar o servidor e o endereço

Para o caminho gratuito, usaremos uma VM Ubuntu ARM64 na faixa Always Free, se houver capacidade disponível. A compilação nativa ARM está em `Dockerfile.native`, com a procedência do código em [SOURCE.md](SOURCE.md). Em servidores x86_64, o pacote utiliza a imagem oficial pronta.

O software NovoSGA usa licença MIT. Para cumprir o orçamento, a infraestrutura deve permanecer dentro das condições gratuitas dos serviços escolhidos.

Use um domínio/subdomínio apontado para o IP da VPS, por exemplo `senhas.seudominio.com.br`. Como ainda não existe domínio, é possível começar com um subdomínio gratuito do [DuckDNS](https://www.duckdns.org/), sujeito à disponibilidade do nome. Nenhum nome foi reservado.

No DNS, o registro A deve apontar para o IPv4 público. Só configure AAAA se a VPS estiver acessível pelo IPv6 indicado. No firewall do provedor, permita TCP 80/443 e restrinja o SSH ao acesso administrativo. Não publique PostgreSQL ou a porta interna 8080.

## 2. Instalar os requisitos na VPS

Na VM Ubuntu 24.04 dedicada, execute `sudo sh instalar-requisitos.sh`. O script instala Python 3, Docker Engine e o plugin Compose pelo repositório oficial apt, conforme o [guia do Docker](https://docs.docker.com/engine/install/ubuntu/). Verifica instalações existentes e interrompe em conflitos, sem remover pacotes. Não execute esse instalador no Windows. O Compose precisa de suporte a `service_completed_successfully` e `up --wait`.

Verifique no terminal da VPS:

```sh
python3 --version
sudo docker version
sudo docker compose version
```

Os comandos seguintes são para o servidor Linux. O Windows do totem e o PC da TV serão clientes.

## 3. Enviar e preparar o pacote

Transfira a pasta `novosga-rio-branco` inteira para a VPS, preservando a subpasta `config`. Uma localização possível é `/opt/novosga-rio-branco`. Use SCP/SFTP ou o recurso de envio de arquivos do provedor.

Dentro da pasta enviada, substitua domínio e e-mail por dados reais:

```sh
sudo python3 gerenciar.py preparar --dominio senhas.seudominio.com.br --email ti@seudominio.com.br --guiches 1 --salas 1
```

Esse comando gera `.env` e `credenciais.json` privados com credenciais aleatórias. Não sobrescreve arquivos existentes. O domínio pode ser o nome efetivamente criado no DuckDNS. Ajuste a quantidade de postos antes da primeira publicação; novos usuários depois disso são criados na administração do sistema.

Guarde ambos os arquivos privados. O `.env` contém a senha inicial do administrador em `ADMIN_PASSWORD` e os segredos de recuperação. `credenciais.json` contém senhas dos operadores, triagem, painel e o cliente OAuth. Não regenere credenciais para reiniciar containers. Eles não vêm preenchidos no pacote entregue.

## 4. Publicar

Confirme que o DNS aponta para a VPS e que as portas 80/443 estão disponíveis. Execute:

```sh
sudo python3 gerenciar.py publicar
```

O comando detecta a arquitetura. Em ARM64, compila a imagem nativamente a partir do código oficial incluído no pacote; em x86_64, baixa a imagem oficial pronta. Depois aguarda o PostgreSQL, gera as chaves OAuth, executa as migrações oficiais e inicia aplicação, worker, agendador e proxy. Não apaga volumes. As chaves de uma instalação existente são reutilizadas.

Prepare e publique na própria VPS para que a arquitetura seja detectada corretamente. A primeira compilação ARM pode demorar vários minutos e precisa de acesso aos repositórios públicos do Composer e às imagens de base.

O Caddy tenta emitir o certificado automaticamente. Depois, o script testa login com validação normal do certificado, preflight CORS das duas origens do painel e autenticação OAuth do usuário `painel` com consulta da unidade. Falhas são apresentadas como erros; a execução não equivale a homologar o atendimento completo. Se trocar a senha de `painel`, atualize a credencial usada nessa verificação e na conta Mangati.

Abra `https://SEU-ENDERECO/login`, entre com `admin` e a senha `ADMIN_PASSWORD` do `.env`. Se alterar a senha no sistema, o `.env` continuará contendo a senha inicial, não a senha atual.

## 5. Configurar o laboratório

Proposta de fluxo para validar com a equipe:

**Totem → recepção → encaminhamento para coleta → chamada da sala → encerramento.**

Os serviços, vínculos à unidade, perfis e locais já são preparados pelo instalador. O usuário `recepcao01` atende Recepção no Guichê 1, e `coleta01` atende Coleta na Sala de coleta 1. Postos adicionais seguem a numeração configurada. Revise essa organização com a equipe e crie usuários individuais dos funcionários antes de operar. Confirme se haverá atendimento direto na coleta e a regra de prioridades.

Para autoatendimento, publique a pasta `frontend` na Vercel, configure a conexão ao NovoSGA e autorize o navegador do totem como descrito em [VERCEL.md](VERCEL.md). A interface oferece Normal/Prioritário, chama a emissão real da API e imprime sem transmitir credenciais ao navegador. Como alternativa operacional, a equipe pode usar o módulo gratuito Triagem em `/novosga.triage/`, com o login `totem`; essa interface inclui consulta de clientes. A impressão Elgin precisa de homologação, pois o modelo exato não foi informado. Veja [TOTEM-E-TV.md](TOTEM-E-TV.md). O cliente antigo arquivado `novosga/triage-app` não é utilizado.

## 6. Vincular o Mangati à instalação própria

Siga o [tutorial oficial de integração, parte 1](https://mangati.com/posts/configurar-painel-novosga-parte-1/):

1. Use o cliente OAuth já criado pelo instalador; Client ID e Client Secret estão na seção `mangati` de `credenciais.json`. A administração de clientes continua disponível em `/admin/api/`.
2. Use o usuário `painel` e sua senha em `credenciais.json`. Ele tem lotação na unidade e não é administrador. A API original não oferece isolamento completo por esses perfis; proteja as credenciais de integração e não as distribua aos pacientes.
3. Em [Mangati Painel → Apps](https://painel.mangati.com/apps/), crie um app do tipo **NovoSGA V2.1+**.
4. Informe a URL base HTTPS da VPS, sem `/login`, o usuário de integração e os dados OAuth: Client ID e Client Secret.
5. Selecione a unidade Laboratório Rio Branco e os serviços cujas chamadas devem aparecer na TV.

Depois, crie o painel com os componentes de senha em destaque e histórico. Ative alerta sonoro e vocalização de senha/local. Os passos estão no [tutorial oficial, parte 2](https://mangati.com/posts/configurar-painel-novosga-parte-2/).

No PC da TV, abra o cliente do painel e registre/atribua o dispositivo conforme a interface da conta. Coloque em tela cheia e teste o áudio na saída que alimenta a TV. A página pública do [Painel Mangati](https://painel.mangati.com/) informa uma opção gratuita para um painel e um dispositivo ativo; confirme as condições no momento de ativar.

O cadastro da Mangati é utilizado para o painel. A instância NovoSGA deste pacote fica na VPS e não depende da contratação do NovoSGA Online.

## 7. Homologar antes de usar na rotina

1. Confirmar HTTPS válido e acesso dos computadores do laboratório.
2. Emitir uma senha e comprovar que ela entra na fila correta.
3. Chamar, repetir a chamada e conferir número/local, áudio e histórico na TV.
4. Testar encaminhamento da recepção para coleta e encerramento.
5. Testar chamadas de duas salas próximas no tempo, assim que os postos forem definidos.
6. Validar a regra de prioridade aprovada pelo laboratório.
7. Testar impressão real na Elgin, incluindo corte e largura do papel.
8. Reiniciar os containers e verificar que dados e autenticação do painel continuam disponíveis.
9. Fazer backup e testar recuperação em uma instalação de teste.

Para repetir as verificações de rede do pacote:

```sh
sudo python3 gerenciar.py verificar
```

Essas verificações de rede conferem HTTPS, login, preflight CORS e OAuth com consulta da unidade. Não emitem senhas nem imprimem; o teste real de chamada continua necessário.

## Operação e backup

```sh
sudo python3 gerenciar.py status
sudo docker compose logs --tail=100 init novosga proxy worker scheduler
sudo python3 gerenciar.py backup
```

O backup só está completo quando a pasta gerada em `backups/` contém `CONCLUIDO.txt`. Inclui banco, chaves OAuth, uploads, `.env` e `credenciais.json`. Copie o conjunto para armazenamento externo protegido: manter a única cópia na mesma VPS não permite recuperar a perda do servidor. Credenciais e chaves privadas são confidenciais.

O banco é exportado pelo `pg_dump`. Para consistência dos arquivos de identidade visual, evite editar logos enquanto o backup está sendo feito. A periodicidade e a retenção de cópias externas devem ser definidas na implantação; nenhum backup agendado foi ativado.

### Recuperar em uma VPS nova e vazia

Use a mesma versão do pacote e a mesma arquitetura do backup. Restaure `configuracao.env` do conjunto como `.env` e também `credenciais.json`, ambos com permissão 600; preserve os segredos e ajuste apenas o domínio se necessário. **Não execute `preparar` para uma recuperação.** O marcador de configuração acompanha o banco e impede redefinir usuários após a restauração.

Em uma VPS ARM nova, antes dos comandos abaixo, reconstrua a imagem local:

```sh
sudo docker compose build init
```

Na pasta do projeto, com `CAMINHO-DO-BACKUP` substituído pelo caminho real:

```sh
sudo docker compose up -d --wait db
sudo docker compose exec -T db pg_restore -U novosga -d novosga --no-owner --exit-on-error < CAMINHO-DO-BACKUP/database.dump
sudo docker compose run --rm --no-deps --user 0:0 -T init tar -xzf - -C /run/novosga-jwt < CAMINHO-DO-BACKUP/oauth-keys.tar.gz
sudo docker compose run --rm --no-deps --user 0:0 -T init tar -xzf - -C /app/public/uploads < CAMINHO-DO-BACKUP/uploads.tar.gz
sudo python3 gerenciar.py publicar
```

As redireções de entrada precisam ser executadas por uma sessão com permissão para ler os arquivos do backup. O destino do `pg_restore` deve estar vazio. Para recuperar sobre uma instância já usada, planeje a substituição separadamente; os comandos acima não limpam uma base existente.

## Referências e limites de validação

- [Código oficial e licença MIT](https://github.com/novosga/novosga/tree/v2.3.4).
- [Release estável 2.3.4](https://github.com/novosga/novosga/releases/tag/v2.3.4).
- [Imagem e configuração oficial do NovoSGA](https://github.com/novosga/novosga/blob/v2.3.4/Dockerfile).
- [Docker Compose](https://docs.docker.com/compose/).
- [Caddy: proxy e HTTPS](https://caddyserver.com/docs/quick-starts/reverse-proxy).
- [Symfony: configuração de proxy](https://symfony.com/doc/7.4/deployment/proxies.html).

Validações locais registradas em `VALIDACAO.md`. A imagem do NovoSGA está fixada em 2.3.4; PostgreSQL e Caddy seguem suas linhas principais 16 e 2. Atualizações de imagem devem ser precedidas de backup e teste. Não há atualização automática de containers configurada.
