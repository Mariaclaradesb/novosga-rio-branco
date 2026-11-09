# Deploy manual do frontend na Vercel

O aplicativo da Vercel está na pasta **`frontend`** deste repositório. Ele contém a tela de emissão de senhas, impressão pelo navegador e uma API Node que se conecta ao NovoSGA. O NovoSGA e o PostgreSQL continuam na Oracle. O painel da TV continua no Mangati.

Você pode publicar a tela agora, antes de criar o servidor. Sem as variáveis de conexão, a página abre com a emissão desativada e **não inventa nem simula senhas**.

## 1. Importar o GitHub

1. Acesse [vercel.com/new](https://vercel.com/new) e entre na sua conta.
2. Escolha importar um repositório GitHub e procure **`Mariaclaradesb/novosga-rio-branco`**.
3. Se não aparecer, configure o acesso da integração GitHub/Vercel a esse repositório privado e volte à importação. O repositório pode permanecer privado.
4. Clique em **Import**.

## 2. Configurar o projeto

Use estes valores:

| Campo | Valor |
|---|---|
| Project Name | `novosga-rio-branco` ou outro nome disponível |
| Framework Preset | **Other** |
| Root Directory | **`frontend`** — clique em Edit e selecione essa pasta |
| Build Command | `npm run build` |
| Output Directory | `public` |
| Install Command | Automático (`npm install`) |
| Node.js Version | `22.x` |

O arquivo `frontend/vercel.json` já define o comando de build e a saída. Não escolha a raiz inteira do repositório, nem as pastas `source` ou `config`. Não selecione PHP ou Docker para esse projeto: a aplicação importada é o frontend Node/HTML.

## 3. Publicar a primeira tela

Pode deixar **Environment Variables** vazio nessa primeira publicação. Clique em **Deploy** e aguarde **Ready**.

Abra **Visit**. A Vercel fornecerá uma URL terminada em `.vercel.app`; use a URL efetivamente exibida, pois o nome depende de disponibilidade e da conta. A página deve mostrar **Laboratório Rio Branco**, as opções **Atendimento** e **Retirada de Exames** lado a lado e a mensagem de emissão ainda não ativada. Depois de ativar, tocar em um serviço abre a escolha **Normal / Preferencial**; somente essa confirmação emite uma senha.

Esta etapa publica a interface. Para emitir senhas reais, conclua a configuração abaixo depois que a Oracle estiver online.

## 4. Conectar ao NovoSGA na Oracle

Depois de publicar o backend pelo [guia Oracle](COMECE-AQUI.md), abra o projeto Vercel em **Settings → Environment Variables**. Cadastre as variáveis abaixo no ambiente **Production**, como valores do servidor. Não use prefixos `NEXT_PUBLIC_` ou `VITE_`.

| Variável | De onde vem |
|---|---|
| `SGA_BASE_URL` | URL da instalação Oracle, sem `/login`, `/api` ou outro caminho; pode incluir uma porta |
| `SGA_ALLOW_HTTP` | `false` para HTTPS; `true` para aceitar um backend HTTP por escolha explícita |
| `SGA_CLIENT_ID` | Seção `mangati.client_id` do arquivo privado `credenciais.json` da VM |
| `SGA_CLIENT_SECRET` | Seção `mangati.client_secret` do mesmo arquivo |
| `SGA_USERNAME` | `totem` |
| `SGA_PASSWORD` | Senha do usuário `totem` em `credenciais.json` |
| `SGA_UNIT_ID` | ID da unidade Laboratório Rio Branco no NovoSGA |
| `SGA_SERVICE_ID` | ID do Atendimento ou da antiga Recepção, mantido para compatibilidade |
| `SGA_NORMAL_PRIORITY_ID` | ID da prioridade Normal |
| `SGA_PRIORITY_ID` | ID da prioridade Prioridade |
| `KIOSK_ACCESS_CODE` | Código forte, aleatório, com pelo menos 16 caracteres, guardado pela equipe |
| `COOKIE_SECRET` | Outro segredo aleatório, com pelo menos 32 caracteres |

O cliente OAuth criado pelo pacote pode atender a ambas as interfaces com usuários diferentes. Se preferir isolar as integrações, crie um cliente OAuth específico na administração `/admin/api/` e use seus dados na Vercel. Não use o login `admin` no totem.

### Conexão HTTP escolhida para esta instalação

O endereço `http://147.15.87.164:8088` foi conferido e abre a tela de login do NovoSGA CE. Para usar essa instalação sem alterar seu HTTP, cadastre na Vercel:

```text
SGA_BASE_URL=http://147.15.87.164:8088
SGA_ALLOW_HTTP=true
```

O navegador acessa o frontend em HTTPS e a função Vercel chama o backend em HTTP. Esse segundo trecho transmite usuário, senha, Client Secret e token sem criptografia. As credenciais continuam fora do JavaScript do navegador, mas não ficam protegidas durante esse trânsito. A opção HTTP é desativada por padrão e só funciona com `SGA_ALLOW_HTTP=true`.

Caso esta VM tenha sido instalada por outro método, crie o cliente OAuth em `http://147.15.87.164:8088/admin/api/` e cadastre um usuário específico `totem`, com vínculo à unidade e ao módulo de triagem. Nesse caso, obtenha as senhas e IDs na instalação existente: o arquivo `credenciais.json` deste pacote não terá sido gerado lá automaticamente.

Os IDs são os números exibidos nos cadastros da instalação; **não presuma que todos serão 1**. Na VM, o marcador `metadata` de namespace `riobranco`, nome `instalacao.v1`, também guarda os IDs de unidade e serviços após a instalação.

### Atendimento e Retirada de Exames

Cadastre os dois serviços com esses nomes e mantenha ambos ativos e vinculados à unidade do laboratório. A função Vercel consulta `/api/unidades/{id}/servicos` e resolve os IDs reais pelo nome antes de emitir; diferenças de maiúsculas ou acentos são normalizadas. Não é necessário adicionar uma variável de ambiente para a Retirada de Exames. O navegador envia somente a opção `atendimento` ou `retirada`, e os IDs são escolhidos no servidor.

Enquanto a antiga Recepção não tiver sido renomeada, seu ID em `SGA_SERVICE_ID` continua funcionando como Atendimento. Retirada de Exames nunca é mapeada automaticamente para Coleta. Se um serviço estiver ausente, inativo ou com nome duplicado, nenhuma senha será emitida para essa opção. O serviço escolhido aparece na confirmação e no comprovante impresso.

Para gerar os dois segredos no PowerShell do seu computador, execute duas vezes e guarde cada resultado em sua variável correspondente:

```powershell
[guid]::NewGuid().ToString('N')
```

Não envie os segredos pelo chat nem os coloque no GitHub. Cadastre diretamente na Vercel. Os valores são acessados somente pela função do servidor; o navegador recebe um cookie de autorização assinado, sem senha do NovoSGA ou Client Secret.

Após salvar as variáveis, vá a **Deployments → último deploy → Redeploy**. Alterar variáveis não atualiza um deploy já publicado. Para testar Preview com o backend, as variáveis precisam existir também no ambiente Preview; caso contrário, essa prévia continua sem emissão.

## 5. Ativar o computador do totem

1. No Windows dedicado ao totem, abra a URL de produção `.vercel.app`.
2. Clique em **Ativar este totem**, abaixo das opções de atendimento, e digite o valor de `KIOSK_ACCESS_CODE`. Se houver falha na consulta inicial, **Tentar novamente** refaz somente a consulta de conexão, sem emitir senhas.
3. A aplicação confere a autenticação no NovoSGA antes de autorizar o equipamento. A autorização fica salva no navegador e se renova automaticamente ao abrir a tela ou emitir uma senha, sem reativação mensal durante o uso normal. Ativações anteriores que ainda estejam válidas passam a ser renovadas automaticamente ao acessar a tela. Não use navegação anônima se precisar preservá-la.
4. Instale o driver Elgin correto e escolha a impressora térmica padrão do Windows. Configure largura e corte conforme o modelo.
5. Escolha **Atendimento** ou **Retirada de Exames** e, no popup, **Normal** ou **Preferencial**. **Voltar** cancela a escolha sem emitir. Teste as quatro combinações: o número vem do NovoSGA e a impressão usa o navegador. A opção **Imprimir novamente** reaproveita o número emitido, sem gerar outra senha.
6. Para impressão sem caixa de diálogo, teste depois o Chrome em perfil dedicado com `--kiosk-printing`. O modelo Elgin e a impressão real ainda precisam ser homologados.

O cookie e a autorização assinada no servidor vencem 30 dias após o último uso autenticado. Cada acesso à tela e cada emissão com autorização válida renovam ambos os prazos sem pedir o código. Se ficar 30 dias sem usar o sistema, o navegador apagar o cookie ou a equipe mudar `KIOSK_ACCESS_CODE` ou `COOKIE_SECRET`, será preciso autorizar novamente. Fechar o navegador, reiniciar o computador e publicar atualizações preservam a autorização enquanto o cookie válido e os segredos forem mantidos.

Em falha de comunicação durante uma emissão, a tela bloqueia novas emissões até a equipe conferir a fila e recarregar: a senha pode ter sido criada mesmo se a resposta não chegou. Não há repetição automática de emissão nem garantia de operação offline.

## 6. Conferir a chamada na TV

Configure o Mangati conforme o [guia principal](COMECE-AQUI.md), apontando para a URL **do backend Oracle**, com o usuário `painel`. A URL `.vercel.app` é usada pelo totem; ela não substitui a URL da API NovoSGA no Mangati.

No app e nos widgets do Mangati, selecione os serviços **Atendimento** e **Retirada de Exames**, usando os IDs efetivos dos cadastros. Vincule os operadores responsáveis às duas filas no NovoSGA.

Emita pelo totem e confira número, serviço, guichê e áudio na TV ao chamar tanto Atendimento quanto Retirada de Exames.

## Se aparecer erro

| Situação | Conferir |
|---|---|
| Repositório não aparece | Permissão da integração GitHub/Vercel para o repositório privado |
| Build procura Docker/PHP ou não encontra `package.json` | Root Directory precisa ser `frontend` |
| Página ou `/api/atendimento` retorna 404 | Framework Other, saída `public`, raiz `frontend`; depois Redeploy |
| Tela abre, mas emissão está desativada | Variáveis completas em Production, protocolo HTTPS ou HTTP explicitamente autorizado, IDs positivos, tamanhos dos dois segredos e novo deploy |
| Código é aceito, mas ativação falha | Credenciais OAuth/usuário e acesso ao backend Oracle |
| Senha aparece sem imprimir | Impressora padrão, driver Windows e permissões de impressão do navegador |
| Falha após clicar para emitir | Conferir a fila no NovoSGA antes de recarregar e tentar novamente |

## Verificação e manutenção

Na pasta `frontend`, `npm test` executa os testes da API e `npm run build` verifica os arquivos necessários à publicação. O teste usa um backend simulado; a homologação completa depende da Oracle e dos equipamentos.

Novos commits na branch de produção vinculada podem gerar publicação automática pela integração GitHub/Vercel. Não é necessário reenviar o ZIP.

Referências: [importação GitHub](https://vercel.com/docs/git/vercel-for-github), [Root Directory e build](https://vercel.com/docs/builds/configure-a-build), [variáveis de ambiente](https://vercel.com/docs/environment-variables), [Node Functions](https://vercel.com/docs/functions/runtimes/node-js).
