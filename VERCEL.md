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

Abra **Visit**. A Vercel fornecerá uma URL terminada em `.vercel.app`; use a URL efetivamente exibida, pois o nome depende de disponibilidade e da conta. A página deve mostrar **Laboratório Rio Branco**, as opções Normal/Prioritário e a mensagem de emissão ainda não ativada. Os botões de emissão permanecem desativados.

Esta etapa publica a interface. Para emitir senhas reais, conclua a configuração abaixo depois que a Oracle estiver online.

## 4. Conectar ao NovoSGA na Oracle

Depois de publicar o backend pelo [guia Oracle](COMECE-AQUI.md), abra o projeto Vercel em **Settings → Environment Variables**. Cadastre as variáveis abaixo no ambiente **Production**, como valores do servidor. Não use prefixos `NEXT_PUBLIC_` ou `VITE_`.

| Variável | De onde vem |
|---|---|
| `SGA_BASE_URL` | URL HTTPS da instalação Oracle, sem `/login`, `/api` ou outro caminho |
| `SGA_CLIENT_ID` | Seção `mangati.client_id` do arquivo privado `credenciais.json` da VM |
| `SGA_CLIENT_SECRET` | Seção `mangati.client_secret` do mesmo arquivo |
| `SGA_USERNAME` | `totem` |
| `SGA_PASSWORD` | Senha do usuário `totem` em `credenciais.json` |
| `SGA_UNIT_ID` | ID da unidade Laboratório Rio Branco no NovoSGA |
| `SGA_SERVICE_ID` | ID do serviço Recepção |
| `SGA_NORMAL_PRIORITY_ID` | ID da prioridade Normal |
| `SGA_PRIORITY_ID` | ID da prioridade Prioridade |
| `KIOSK_ACCESS_CODE` | Código forte, aleatório, com pelo menos 16 caracteres, guardado pela equipe |
| `COOKIE_SECRET` | Outro segredo aleatório, com pelo menos 32 caracteres |

O cliente OAuth criado pelo pacote pode atender a ambas as interfaces com usuários diferentes. Se preferir isolar as integrações, crie um cliente OAuth específico na administração `/admin/api/` e use seus dados na Vercel. Não use o login `admin` no totem.

Os IDs são os números exibidos nos cadastros da instalação; **não presuma que todos serão 1**. Na VM, o marcador `metadata` de namespace `riobranco`, nome `instalacao.v1`, também guarda os IDs de unidade e serviços após a instalação.

Para gerar os dois segredos no PowerShell do seu computador, execute duas vezes e guarde cada resultado em sua variável correspondente:

```powershell
[guid]::NewGuid().ToString('N')
```

Não envie os segredos pelo chat nem os coloque no GitHub. Cadastre diretamente na Vercel. Os valores são acessados somente pela função do servidor; o navegador recebe um cookie de autorização assinado, sem senha do NovoSGA ou Client Secret.

Após salvar as variáveis, vá a **Deployments → último deploy → Redeploy**. Alterar variáveis não atualiza um deploy já publicado. Para testar Preview com o backend, as variáveis precisam existir também no ambiente Preview; caso contrário, essa prévia continua sem emissão.

## 5. Ativar o computador do totem

1. No Windows dedicado ao totem, abra a URL de produção `.vercel.app`.
2. Clique em **Ativar este totem** e digite o valor de `KIOSK_ACCESS_CODE`.
3. A aplicação confere a autenticação no NovoSGA antes de autorizar o equipamento. A autorização desse navegador dura até 30 dias; não use navegação anônima se precisar preservá-la.
4. Instale o driver Elgin correto e escolha a impressora térmica padrão do Windows. Configure largura e corte conforme o modelo.
5. Emita uma senha de teste. O número vem do NovoSGA e a impressão usa o navegador. A opção **Imprimir novamente** reaproveita o número emitido, sem gerar outra senha.
6. Para impressão sem caixa de diálogo, teste depois o Chrome em perfil dedicado com `--kiosk-printing`. O modelo Elgin e a impressão real ainda precisam ser homologados.

Se mudar `KIOSK_ACCESS_CODE` ou `COOKIE_SECRET`, os navegadores terão de ser autorizados novamente. Em falha de comunicação durante uma emissão, a tela bloqueia novas emissões até a equipe conferir a fila e recarregar: a senha pode ter sido criada mesmo se a resposta não chegou. Não há repetição automática de emissão nem garantia de operação offline.

## 6. Conferir a chamada na TV

Configure o Mangati conforme o [guia principal](COMECE-AQUI.md), apontando para a URL **do backend Oracle**, com o usuário `painel`. A URL `.vercel.app` é usada pelo totem; ela não substitui a URL da API NovoSGA no Mangati.

Emita pelo totem, chame na recepção e confira número, guichê e áudio na TV. Depois teste encaminhamento para coleta e a chamada da sala.

## Se aparecer erro

| Situação | Conferir |
|---|---|
| Repositório não aparece | Permissão da integração GitHub/Vercel para o repositório privado |
| Build procura Docker/PHP ou não encontra `package.json` | Root Directory precisa ser `frontend` |
| Página ou `/api/atendimento` retorna 404 | Framework Other, saída `public`, raiz `frontend`; depois Redeploy |
| Tela abre, mas emissão está desativada | Variáveis completas em Production, HTTPS, IDs positivos, tamanhos dos dois segredos e novo deploy |
| Código é aceito, mas ativação falha | Credenciais OAuth/usuário e acesso HTTPS ao backend Oracle |
| Senha aparece sem imprimir | Impressora padrão, driver Windows e permissões de impressão do navegador |
| Falha após clicar para emitir | Conferir a fila no NovoSGA antes de recarregar e tentar novamente |

## Verificação e manutenção

Na pasta `frontend`, `npm test` executa os testes da API e `npm run build` verifica os arquivos necessários à publicação. O teste usa um backend simulado; a homologação completa depende da Oracle e dos equipamentos.

Novos commits na branch de produção vinculada podem gerar publicação automática pela integração GitHub/Vercel. Não é necessário reenviar o ZIP.

Referências: [importação GitHub](https://vercel.com/docs/git/vercel-for-github), [Root Directory e build](https://vercel.com/docs/builds/configure-a-build), [variáveis de ambiente](https://vercel.com/docs/environment-variables), [Node Functions](https://vercel.com/docs/functions/runtimes/node-js).
