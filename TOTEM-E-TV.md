# Totem Windows, postos e TV

O frontend para o totem está em `frontend` e pode ser publicado na Vercel conforme [VERCEL.md](VERCEL.md). Ele oferece somente as opções de emissão Normal/Prioritário para Recepção e impressão, sem formulário de dados de pacientes. As instruções abaixo para o módulo Triagem descrevem a alternativa operacional integrada ao backend.

## Postos de atendimento

Cada guichê recebe um login `recepcaoNN` associado ao serviço Recepção e local Guichê N. Cada sala recebe um login `coletaNN`, serviço Coleta e local Sala de coleta N. A quantidade é escolhida com `preparar --guiches N --salas N` na implantação.

Fluxo inicial proposto: emitir para **Recepção**, chamar no guichê, atender e encaminhar para **Coleta**, chamar na sala e encerrar. O NovoSGA mantém o atendimento e as chamadas; confirme com a equipe a forma de encaminhamento e a prioridade aplicável ao laboratório.

Os logins por posto são uma configuração inicial. Na entrada em operação, crie usuários individuais por funcionário e associe-os aos postos e serviços correspondentes.

## Emissão no Windows

1. Instale o driver Elgin correto e faça uma impressão de teste pelo Windows. Defina a térmica como impressora padrão.
2. Configure no driver a largura real de papel e o corte conforme o modelo. Ainda não conhecemos o modelo da impressora; não há driver específico incluído.
3. No Chrome, entre com `totem` no NovoSGA e abra `/novosga.triage/`. Esse perfil tem acesso ao módulo de triagem, sem administração.
4. Na configuração da triagem, exiba apenas **Recepção**, para que a coleta seja acessada pelo encaminhamento da equipe. Ative a opção de imprimir; ela é guardada no navegador.
5. Emita uma senha Normal e uma Prioridade e confirme papel, legibilidade e corte. A priorização efetiva deve ser aprovada pelo laboratório.

A triagem integrada chama a impressão do navegador. Em uma máquina dedicada, é possível iniciar o Chrome com `--kiosk-printing` para imprimir na impressora padrão sem a caixa de diálogo. Use essa opção somente depois do teste com diálogo e apenas no perfil dedicado do totem. O driver e a configuração do Windows controlam o equipamento USB; a VM não acessa a impressora diretamente.

O módulo oficial de triagem contém controles de operação e consulta de clientes. Para uso direto pelos pacientes, use o frontend Vercel e homologue o bloqueio do Windows, a emissão e a impressão no equipamento dedicado. Colocar o navegador em tela cheia, por si só, não bloqueia o sistema operacional.

## TV com PC

Configure o app e dispositivo na conta Mangati como descrito em COMECE-AQUI.md. No PC da TV, abra o endereço do cliente fornecido pelo Mangati, associe o dispositivo, ative tela cheia e autorize o áudio se solicitado. Escolha a saída de som ligada à TV.

Teste a chamada e a repetição de chamada de cada serviço, número da senha, guichê/sala, histórico e volume. Teste também após reiniciar o PC e após uma queda de internet. Totem, postos e TV precisam de internet para acessar a instalação na nuvem.

## Roteiro de aceite

- [ ] Emissão de senha Normal e Prioridade para Recepção.
- [ ] Impressão Elgin correta e tratamento de falta de papel.
- [ ] Chamada e repetição no Guichê 1 aparecem e soam na TV.
- [ ] Encaminhamento para Coleta e chamada na Sala de coleta 1.
- [ ] Duas chamadas de postos diferentes, quando houver mais postos.
- [ ] Encerramento do atendimento e numeração após a virada do dia.
- [ ] Reinício dos containers sem perda de filas, senhas de acesso ou chaves OAuth.
- [ ] Backup completo e recuperação testada em ambiente separado.
- [ ] Homologação da interface e do bloqueio do totem para uso direto por pacientes, se aplicável.
