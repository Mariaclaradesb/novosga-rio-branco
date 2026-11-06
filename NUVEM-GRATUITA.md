# Infraestrutura proposta com custo zero

## Serviços

| Parte | Opção |
|---|---|
| Servidor | Oracle Cloud Always Free, Ampere A1 ARM64 |
| Aplicação e banco | NovoSGA open source + PostgreSQL na própria VM |
| Endereço | Subdomínio DuckDNS gratuito, a escolher conforme disponibilidade |
| Certificado | Caddy com emissão automática de HTTPS |
| TV | Mangati Painel, opção gratuita para um painel/dispositivo |

As condições da Oracle consultadas em 06/11/2026 permitem, em uma conta Always Free, **2 OCPUs e 12 GB de RAM no total em A1**, com **200 GB de volumes no total** na região principal. A capacidade pode faltar, e instâncias ociosas podem ser recolhidas. [Limites oficiais](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

O cadastro exige verificação de identidade, inclusive cartão aceito pela Oracle, e pode gerar autorização temporária. A faixa gratuita não oferece SLA. [FAQ oficial](https://www.oracle.com/cloud/free/faq/).

## Etapas na conta Oracle

1. Concluir o [cadastro Oracle Cloud Free Tier](https://signup.cloud.oracle.com/) e acessar o console. Preencher os dados de identidade e cartão diretamente na Oracle.
2. Selecionar a região principal e verificar capacidade A1 elegível. A instância ainda não foi criada nesta sessão.
3. Proposta de VM: `VM.Standard.A1.Flex`, 2 OCPUs, **6 GB de RAM**, Ubuntu 24.04 ARM64 e volume de boot de 50 GB. Confirmar no console que os recursos escolhidos são elegíveis à gratuidade e não adicionar serviços pagos. A memória proposta é uma estimativa para o piloto, a confirmar no teste de operação.
4. Usar uma sub-rede pública com acesso à internet e IPv4 público; liberar TCP 80/443 e SSH administrativo. Os containers de banco e aplicação permanecem sem portas públicas próprias.
5. Guardar a chave SSH no computador autorizado para administração. Não enviar a chave privada pelo chat.
6. Com a VM acessível, instalar Docker Engine, Compose e Python 3 conforme o guia principal.

Uma autorização temporária de cartão pode contrariar a necessidade de nenhum desembolso inicial, mesmo sem mensalidade. Se o cadastro não for viável ou não houver capacidade gratuita, a implantação em nuvem continuará pendente; não há servidor gratuito reservado ou garantido.

## Endereço gratuito e publicação

No [DuckDNS](https://www.duckdns.org/), escolher um nome disponível e apontá-lo ao IPv4 público. O serviço oferece subdomínios gratuitos. [Descrição oficial](https://www.duckdns.org/about.jsp).

Exemplo ilustrativo: `labriobranco.duckdns.org`. O nome **não foi reservado nem verificado como disponível**.

Enviar o pacote à VM e executar nele, com endereço e e-mail reais:

```sh
sudo python3 gerenciar.py preparar --dominio SEU-NOME.duckdns.org --email SEU-EMAIL
sudo python3 gerenciar.py publicar
```

O gerenciador seleciona ARM64 automaticamente e compila o código incluído, pois a imagem pronta do NovoSGA não publica ARM. O build ARM ainda precisa ser executado e testado no servidor.

Antes desses comandos, na VM Ubuntu 24.04, execute `sudo sh instalar-requisitos.sh`. Para ajustar a configuração de piloto, acrescente `--guiches N --salas N` ao comando `preparar`. O roteiro resumido está em `COMECE-AQUI.md`.

O painel da TV seguirá o [tutorial de integração da Mangati](https://mangati.com/posts/configurar-painel-novosga-parte-1/), apontando à instalação própria em HTTPS. Verifique a [opção gratuita do Painel](https://painel.mangati.com/) ao ativar.

O laboratório precisa manter acesso à internet para usar os serviços na nuvem. Defina cópias de backup externas à VM antes de colocar a fila em uso diário; o comando de backup está no guia principal.
