# Procedência do código para compilação ARM

- Projeto: [novosga/novosga](https://github.com/novosga/novosga).
- Versão: `v2.3.4`.
- Commit: `d22ee22296f8e35d6bfd4b14bd38e9aec93f1cdb`.
- Arquivo: `source/novosga-2.3.4.tar.gz`.
- SHA256: `41c6489947a390c8ca7e9343c11b0558d4e97a7d357a1186cc25a9c56064db24`.

O arquivo foi gerado com `git archive` do commit acima, sem alterações no código da aplicação. Contém a licença MIT e os avisos de direitos autorais originais. A compilação confere o SHA256 antes de extrair o conteúdo.

A imagem oficial `novosga/novosga:2.3.4` e sua base `mangati/frankenphp:1.13-php8.5-alpine` publicam somente a arquitetura AMD64, conforme os manifestos consultados nesta sessão. A variante ARM usa a base multi-arquitetura `dunglas/frankenphp:1.13-php8.5-alpine`, o Composer e as extensões PHP necessárias ao PostgreSQL.

É uma adaptação do empacotamento para ARM64, não uma imagem ARM oficial do NovoSGA. O build e a inicialização em ARM ainda precisam ser executados e homologados na VM gratuita. O pacote não usa emulação de CPU.

## Identidade visual da triagem

O arquivo `frontend/public/brand/logo-rio-branco.png` é o logotipo fornecido pelo usuário, preservado sem alterações. A referência de identidade é o [site do Laboratório Rio Branco](https://labriobranco.com.br/), com verde escuro `#043b24` e detalhes em verde claro `#6dcca3`. O favicon reutiliza o símbolo desse mesmo arquivo, enquadrado em SVG.
