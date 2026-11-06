# Validação do pacote

Data: 06/11/2026.

## Verificado nesta sessão

- Fonte oficial do NovoSGA conferida na tag `v2.3.4`, commit `d22ee22296f8e35d6bfd4b14bd38e9aec93f1cdb`.
- Configuração processada pelo Docker Compose oficial **v5.7.0**, usando `config --format json`, com variáveis geradas em uma pasta de teste. O SHA256 do executável foi comparado ao checksum publicado pelo projeto.
- Confirmados os seis serviços, as dependências de inicialização, os arquivos montados, a rede interna e a publicação exclusiva das portas 80/443.
- Sintaxe dos três scripts POSIX de execução e do instalador Ubuntu conferida com `sh -n`. O instalador apt não foi executado no Windows.
- Sintaxe dos comandos `RUN` do Dockerfile nativo conferida com `sh -n`; o trecho PHP de geração de chaves do build também passou por `php -l`. Isso não executa o build nem instala dependências.
- Sintaxe dos três arquivos PHP de implantação conferida com PHP **8.5.12-1**, sem erros. O runtime temporário teve seu SHA256 comparado ao publicado pelo PHP.
- Dez testes automatizados locais aprovados: geração de segredos e preservação de configuração existente; rejeição de entradas inválidas; estrutura do Compose AMD64; seleção de ARM64 e integridade do código-fonte; bloqueio do deploy no Windows; detecção de CORS incorreto; identificação de backup incompleto; configuração de múltiplos postos e senhas exclusivas; rejeição de quantidades inválidas; sequência de verificação HTTPS/CORS/OAuth sem segredos na URL ou na saída.
- SHA256 do arquivo de código oficial conferido, incluindo presença da licença MIT e do `composer.lock`.
- Manifestos públicos do Docker Registry conferidos: NovoSGA e base Mangati somente AMD64; base `dunglas/frankenphp:1.13-php8.5-alpine` com ARM64 disponível. A variante ARM usa compilação local, e a configuração dessa variante também passou pelo validador Compose.

Os testes de rede e backup usaram simulações nos cenários de erro. Nenhuma conta real, senha real de operador ou dado de paciente foi usado.

## Teste de integração local dos cadastros

Uma cópia temporária da fonte oficial recebeu as **125 dependências de produção fixadas no composer.lock**, usando Composer e PHP portáteis, sem instalação no sistema Windows. O kernel Symfony carregou a configuração de produção e os aliases de implantação corretamente.

Em SQLite em memória, com schema criado pelo ORM apenas para teste, foram verificados:

- 39 mapeamentos ORM, sem erros de validação.
- Criação de Recepção/Coleta e seus contadores, locais, perfis e vínculos à unidade.
- Sete usuários em um cenário de 2 guichês e 3 salas, mais triagem e painel; senhas verificadas pelo hasher original e nenhum administrador adicional.
- Correspondência dos números dos postos e cliente OAuth com os grants `password`/`refresh_token`.
- Reexecução preservando senha modificada e unidade renomeada, sem duplicar usuários ou unidades.
- Emissão de token OAuth pelo endpoint `/api/token` e consulta autenticada de `/api/unidades`, processados pelo kernel local. Nenhum token foi incluído no pacote.

O factory original não suporta SQLite. Para o teste HTTP de OAuth, **somente a cópia temporária de teste** selecionou explicitamente o adaptador PostgreSQL para as consultas ORM; o kernel usou ambiente `prod` com debug habilitado. O pacote de produção permanece com o factory oficial. Não foram exercitados SQL específico de PostgreSQL, migrações ou operações da fila nesse teste. Isso valida os cadastros e a autenticação no código, sem equivaler a um teste da stack Docker ou do Mangati real.

## Pendente no servidor

Não havia Docker Engine, VPS ou domínio configurados. Não foram executados nesta sessão: build nativo ARM, pull/inicialização das imagens, migrações em PostgreSQL, emissão de certificado, teste do hub Mercure, autenticação da conta Mangati, chamada de senha na TV, teste de carga, impressão Elgin ou recuperação de backup.

O backend foi preparado para Oracle Always Free + DuckDNS, com Mangati para a TV, dentro das condições dos provedores. O usuário escolheu publicar manualmente o frontend na Vercel. O cadastro e a disponibilidade da VM ainda precisam ser confirmados. O modelo da impressora e as quantidades reais de postos continuam em aberto. Os testes locais não substituem a homologação na VM, nos postos, no totem e na TV.

## Frontend Vercel

- Tela de emissão Normal/Prioritário na pasta `frontend`, com impressão/reimpressão pelo navegador e mensagem explícita de indisponibilidade quando o backend ainda não está configurado.
- Dez testes Node aprovados: configuração ausente/inválida; origem e código inválidos; autenticação de equipamento; cookie protegido sem credenciais; cookie/CSRF ausentes ou inválidos; emissão Normal e Prioritário somente nos IDs autorizados; falha de comunicação sem repetição automática; sessão adulterada/expirada e rotação de código; resposta inválida sem número fictício.
- `npm run build` aprovado e arquivos necessários à publicação verificados. Sem dependências externas de produção.
- Prévia local conferida visualmente no navegador: tela do laboratório, botões desativados e mensagem de emissão não ativada sem backend configurado.
- A API do frontend foi exercitada com backend simulado. Emissões e impressão reais ainda não foram executadas contra a Oracle/Elgin.
- O deploy Vercel será realizado manualmente pelo usuário, conforme `VERCEL.md`. Não há URL Vercel publicada nesta sessão.
