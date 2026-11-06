# NovoSGA — Laboratório Rio Branco

Pacote de implantação do **NovoSGA open source 2.3.4**, com PostgreSQL e HTTPS, preparado para uma VM **Oracle Cloud Ubuntu 24.04 ARM64**. O **Mangati** é usado como painel da TV, conectado à instalação própria do NovoSGA.

**Estado:** preparado para implantação futura. Ainda não há VM ou domínio configurados. Os testes locais de cadastros e OAuth passaram; a stack Docker ARM e o fluxo nos equipamentos precisam ser homologados após o deploy. Consulte [VALIDACAO.md](VALIDACAO.md).

## O que o instalador configura

- Unidade Laboratório Rio Branco, idioma português e fuso `America/Rio_Branco`.
- Serviços Recepção e Coleta, prioridades Normal/Prioridade e tipos de local Guichê/Sala de coleta.
- Usuários iniciais por posto, usuário `totem` para a triagem e usuário `painel` com cliente OAuth para o Mangati.
- Banco persistente, worker de mensagens, agendador e proxy Caddy para HTTPS.
- Geração de credenciais exclusivas na VM e comando de backup.

A configuração de piloto é um guichê e uma sala de coleta. Ajuste as quantidades reais antes da primeira instalação. Reexecutar o instalador preserva cadastros e senhas já alterados.

## Publicar mais tarde

Siga primeiro [COMECE-AQUI.md](COMECE-AQUI.md) e [NUVEM-GRATUITA.md](NUVEM-GRATUITA.md). Crie uma VM elegível à faixa Always Free, aponte um domínio/subdomínio para ela e libere TCP 80/443. A disponibilidade e as condições da gratuidade são definidas pelos provedores.

Clone este repositório **na VM** usando a autenticação da sua conta GitHub, pois o repositório é privado. Entre na pasta clonada e execute:

```sh
sudo sh instalar-requisitos.sh
sudo python3 gerenciar.py preparar --dominio SEU-ENDERECO.duckdns.org --email SEU-EMAIL --guiches 1 --salas 1
sudo python3 gerenciar.py publicar
```

Substitua endereço/e-mail e ajuste guichês/salas. Os comandos de implantação são para Linux; o Windows do totem e o PC da TV serão clientes. Na primeira publicação ARM, o código oficial incluído é compilado nativamente.

## Credenciais e painel

O comando `preparar` cria `.env` e `credenciais.json` privados na VM. Eles não estão neste repositório e não devem ser commitados. A senha inicial de `admin` fica em `ADMIN_PASSWORD`; as demais senhas e Client ID/Secret ficam em `credenciais.json`.

No Mangati Painel, configure um app **NovoSGA V2.1+** com a URL HTTPS do servidor, usuário `painel` e os dados OAuth gerados. Selecione Laboratório Rio Branco e os serviços Recepção/Coleta. O vínculo da conta e do PC da TV acontece depois de o servidor estar online. [Tutorial oficial](https://mangati.com/posts/configurar-painel-novosga-parte-1/).

## Totem e impressão

O pacote usa o módulo gratuito de Triagem do NovoSGA para emitir senhas e solicitar impressão pelo navegador. A Elgin usa o driver instalado no Windows; o modelo exato ainda precisa ser confirmado. A triagem oficial é uma interface operacional: o uso direto por pacientes precisa de adaptação e homologação específicas. Veja [TOTEM-E-TV.md](TOTEM-E-TV.md).

## Documentação e origem

- [Guia resumido](COMECE-AQUI.md)
- [Guia completo, operação e recuperação de backup](LEIA-ME.md)
- [Infraestrutura gratuita proposta](NUVEM-GRATUITA.md)
- [Totem, postos e TV](TOTEM-E-TV.md)
- [Testes realizados e limites](VALIDACAO.md)
- [Procedência do código e licença original](SOURCE.md)

O código oficial está no arquivo `source/novosga-2.3.4.tar.gz`, com a licença MIT original e `composer.lock`. Os arquivos de implantação ficam separados da fonte oficial. Este repositório é uma configuração de implantação para o laboratório; não é o repositório oficial do NovoSGA nem da Mangati.
