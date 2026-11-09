# Laboratório Rio Branco — deploy futuro na Oracle

O pacote está preparado para uma VM **Ubuntu 24.04 ARM64**, com NovoSGA open source e Mangati apenas como painel. Não é necessário cadastrar conta nem provisionar recursos agora.

Para publicar o **frontend do totem na Vercel**, siga [VERCEL.md](VERCEL.md). Selecione a pasta `frontend` ao importar o GitHub. Os comandos abaixo são para o backend Oracle e não devem ser usados como Build Command da Vercel.

## Quando for publicar

1. Crie a VM Oracle dentro da faixa Always Free e aponte um domínio/subdomínio para seu IP. As condições estão em [NUVEM-GRATUITA.md](NUVEM-GRATUITA.md).
2. Libere TCP 80/443 no firewall da Oracle. Envie a pasta inteira deste pacote à VM por SCP/SFTP.
3. Abra o terminal **na VM**, entre na pasta enviada e execute:

```sh
sudo sh instalar-requisitos.sh
sudo python3 gerenciar.py preparar --dominio SEU-ENDERECO.duckdns.org --email SEU-EMAIL --guiches 1 --salas 1
sudo python3 gerenciar.py publicar
```

Substitua endereço e e-mail. Ajuste `--guiches` e `--salas` para as quantidades reais antes da primeira publicação. O padrão de 1 de cada é um piloto configurável, pois ainda não sabemos quantas salas haverá.

O instalador prepara banco, HTTPS, unidade, prioridades, serviços **Recepção (R)** e **Coleta (C)**, tipos de local **Guichê** e **Sala de coleta**, operadores por posto, usuário de triagem `totem`, usuário de integração `painel` e cliente OAuth do Mangati. O marcador no banco impede recriar cadastros ou redefinir senhas em reinícios.

## Acessos após o deploy

- Sistema: `https://SEU-ENDERECO/login`. Login `admin`; senha inicial em `ADMIN_PASSWORD` no `.env`.
- Senhas iniciais de `recepcao01`, `coleta01`, `totem` e `painel`: arquivo privado `credenciais.json`, criado na VM. Se houver mais postos, os logins seguem `recepcao02`, `coleta02` etc.
- Tela de atendimento: `/novosga.attendance/`.
- Triagem para emissão/impressão: `/novosga.triage/`, com login `totem`.

Os arquivos privados não acompanham este ZIP: as senhas são geradas apenas quando executar `preparar`. Guarde `.env` e `credenciais.json` junto dos backups. Novos operadores e alterações posteriores são feitos pela administração do NovoSGA.

## Painel na TV

No [Mangati Painel](https://painel.mangati.com/apps/), crie o app **NovoSGA V2.1+**. Informe:

| Campo | Valor |
|---|---|
| Nome | Laboratório Rio Branco |
| URL | Endereço HTTPS da VM, sem `/login` |
| Usuário | `painel` |
| Senha | Usuário `painel` em `credenciais.json` |
| Client ID / Client Secret | Seção `mangati` de `credenciais.json` |
| Unidade | Laboratório Rio Branco |
| Serviços | Atendimento e Retirada de Exames, conforme os cadastros ativos da unidade |

Crie o painel com senha em destaque, histórico e áudio; associe o PC da TV à conta. O cadastro e o vínculo do dispositivo precisam ser feitos nessa conta após o servidor estar online. [Tutorial oficial](https://mangati.com/posts/configurar-painel-novosga-parte-1/).

## Totem Windows e Elgin

O frontend da pasta `frontend` permite autoatendimento na Vercel e se conecta ao backend Oracle, conforme [VERCEL.md](VERCEL.md). Também é possível usar a Triagem integrada do NovoSGA, que exige login e seleção de serviço/prioridade. O roteiro de equipamentos está em [TOTEM-E-TV.md](TOTEM-E-TV.md).

Antes do uso com pacientes, valide emissão, impressão, encaminhamento e chamada com áudio. O modelo exato da Elgin ainda é necessário para acertar driver, papel e corte.

## O que já foi validado

Veja [VALIDACAO.md](VALIDACAO.md). A configuração pode ser revisada agora, mas o build ARM, HTTPS público e integração com a TV dependem da VM futura. O sistema ainda não está publicado nem homologado para atendimento real.
