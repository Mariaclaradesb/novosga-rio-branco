<?php
declare(strict_types=1);

// Executado somente pelo servico init, antes da aplicacao e do worker.
function executar(array $argumentos, ?string $entrada = null): void
{
    $processo = proc_open($argumentos, [$entrada === null ? STDIN : ['pipe', 'r'], STDOUT, STDERR], $pipes, '/app');
    if (!is_resource($processo)) {
        throw new RuntimeException('Falha ao iniciar uma etapa da inicializacao.');
    }
    if ($entrada !== null) {
        $restante = $entrada;
        while ($restante !== '') {
            $gravados = fwrite($pipes[0], $restante);
            if ($gravados === false || $gravados === 0) {
                throw new RuntimeException('Falha ao enviar a configuracao privada para o inicializador.');
            }
            $restante = substr($restante, $gravados);
        }
        fclose($pipes[0]);
    }
    if (proc_close($processo) !== 0) {
        throw new RuntimeException('Falha em uma etapa da inicializacao. Consulte o log acima.');
    }
}

try {
    $pasta = '/run/novosga-jwt';
    foreach ([$pasta, '/app/public/uploads', '/var/lib/novosga'] as $diretorio) {
        if (!is_dir($diretorio) && !mkdir($diretorio, 0755, true)) {
            throw new RuntimeException('Nao foi possivel criar o armazenamento persistente.');
        }
        if (!chown($diretorio, 65534) || !chgrp($diretorio, 65534)) {
            throw new RuntimeException('Nao foi possivel ajustar o proprietario dos volumes.');
        }
    }

    $privado = $pasta . '/private.pem';
    $publico = $pasta . '/public.pem';
    // Reutilizar as mesmas chaves preserva a autenticacao depois de reinicios.
    if (is_file($privado)) {
        $chave = openssl_pkey_get_private(file_get_contents($privado), getenv('OAUTH_PASSPHRASE'));
        if ($chave === false) {
            throw new RuntimeException('A chave OAuth existente nao abre com a configuracao atual.');
        }
    } else {
        if (is_file($publico)) {
            throw new RuntimeException('Chave privada ausente. Restaure o backup antes de continuar.');
        }
        $chave = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        if ($chave === false || !openssl_pkey_export($chave, $pem, getenv('OAUTH_PASSPHRASE'))) {
            throw new RuntimeException('Falha ao gerar as chaves OAuth.');
        }
        $anterior = umask(0077);
        if (file_put_contents($privado, $pem, LOCK_EX) === false) {
            throw new RuntimeException('Falha ao salvar a chave privada.');
        }
        umask($anterior);
    }
    $detalhes = openssl_pkey_get_details($chave);
    if ($detalhes === false || file_put_contents($publico, $detalhes['key'], LOCK_EX) === false) {
        throw new RuntimeException('Falha ao salvar a chave publica.');
    }
    foreach ([$privado, $publico] as $arquivo) {
        if (!chown($arquivo, 65534) || !chgrp($arquivo, 65534) || !chmod($arquivo, 0600)) {
            throw new RuntimeException('Falha ao proteger as chaves OAuth.');
        }
    }

    // O bind privado tem modo 600 e pertence ao administrador da VM.
    // Ler antes de reduzir privilegios e enviar ao filho por stdin, sem arquivo intermediario.
    $credenciais = file_get_contents('/deploy/credenciais.json');
    if ($credenciais === false) {
        throw new RuntimeException('Nao foi possivel ler credenciais.json.');
    }
    // Criar os caches com o mesmo usuario que executa web/worker, sem arquivos de root.
    if (!function_exists('posix_setgroups') || !posix_setgroups([]) || !posix_setgid(65534) || !posix_setuid(65534)) {
        throw new RuntimeException('Nao foi possivel executar a inicializacao como UID 65534.');
    }
    executar(['php', 'bin/console', 'cache:clear', '--no-warmup', '--no-interaction']);
    executar(['php', 'bin/console', 'novosga:install', '--no-interaction']);
    executar(['php', 'bin/console', 'messenger:setup-transports', '--no-interaction']);
    executar(['php', '/deploy/configurar-laboratorio.php'], $credenciais);
    echo "Unidade Laboratorio Rio Branco inicializada.\n";
} catch (Throwable $erro) {
    fwrite(STDERR, $erro->getMessage() . "\n");
    exit(1);
}
