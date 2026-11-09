# NovoSGA — Laboratório Rio Branco

Pacote de implantação do **NovoSGA open source 2.3.4**, com PostgreSQL e HTTPS, preparado para uma VM **Oracle Cloud Ubuntu 24.04 ARM64**. O **Mangati** é usado como painel da TV, conectado à instalação própria do NovoSGA.

O **frontend do totem para a Vercel** está na pasta `frontend`. Para importar manualmente, siga [VERCEL.md](VERCEL.md): Framework **Other**, Root Directory **frontend**, build **npm run build**, saída **public**. É possível publicar a tela antes de configurar a Oracle; a emissão permanece desativada até conectar o backend.

A conexão ao backend usa HTTPS por padrão. Para a instalação HTTP escolhida pelo usuário, configure `SGA_ALLOW_HTTP=true`, conforme o guia; nesse modo o trecho entre Vercel e NovoSGA transmite as credenciais sem criptografia.

**Estado:** o usuário publicou o frontend na Vercel e informou uma instalação NovoSGA CE existente na Oracle em HTTP. A página de login do backend foi conferida; credenciais, IDs e emissão real ainda precisam ser conectados e homologados. Os testes locais do pacote passaram, mas não substituem a validação da instalação Oracle e dos equipamentos. Consulte [VALIDACAO.md](VALIDACAO.md).

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

No Mangati Painel, configure um app **NovoSGA V2.1+** com a URL do servidor, usuário `painel` e os dados OAuth gerados. Selecione Laboratório Rio Branco e os serviços **Atendimento / Retirada de Exames** cadastrados na unidade. O vínculo da conta e do PC da TV acontece depois de o servidor estar online. [Tutorial oficial](https://mangati.com/posts/configurar-painel-novosga-parte-1/).

## Totem e impressão

O frontend Vercel oferece **Atendimento** e **Retirada de Exames** lado a lado. Cada opção abre um popup para escolher **Normal** ou **Preferencial**, antes de emitir pela API NovoSGA e imprimir pelo navegador. Os serviços ativos são resolvidos pelo nome na unidade; a autorização é feita por equipamento, e senha do NovoSGA e Client Secret ficam no servidor Vercel. O módulo de Triagem integrado ao NovoSGA continua disponível como alternativa operacional para a equipe. A Elgin usa o driver instalado no Windows; o modelo exato ainda precisa ser confirmado. A integração real com Oracle, impressão e chamada na TV precisa ser homologada. Veja [VERCEL.md](VERCEL.md) e [TOTEM-E-TV.md](TOTEM-E-TV.md).

## Documentação e origem

- [Guia resumido](COMECE-AQUI.md)
- [Deploy manual do totem na Vercel](VERCEL.md)
- [Guia completo, operação e recuperação de backup](LEIA-ME.md)
- [Infraestrutura gratuita proposta](NUVEM-GRATUITA.md)
- [Totem, postos e TV](TOTEM-E-TV.md)
- [Testes realizados e limites](VALIDACAO.md)
- [Procedência do código e licença original](SOURCE.md)

O código oficial está no arquivo `source/novosga-2.3.4.tar.gz`, com a licença MIT original e `composer.lock`. Os arquivos de implantação ficam separados da fonte oficial. Este repositório é uma configuração de implantação para o laboratório; não é o repositório oficial do NovoSGA nem da Mangati.
