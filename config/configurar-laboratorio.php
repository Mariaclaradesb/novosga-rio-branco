<?php
declare(strict_types=1);

try {
    require '/app/vendor/autoload.php';
    require __DIR__ . '/laboratorio.php';
    (new Symfony\Component\Dotenv\Dotenv())->bootEnv('/app/.env');
    $kernel = new App\Kernel('prod', false);
    $kernel->boot();
    $container = $kernel->getContainer();
    $config = json_decode(file_get_contents('php://stdin'), true, 512, JSON_THROW_ON_ERROR);
    $resultado = configurarLaboratorio($container->get('riobranco.deploy.em'), $container->get('riobranco.deploy.oauth'),
        $container->get('riobranco.deploy.hasher'), $config);
    echo 'Cadastros do laboratorio prontos. Unidade ' . $resultado['unidade_id'] . "; senhas preservadas em reexecucoes.\n";
    $kernel->shutdown();
} catch (Throwable $erro) {
    fwrite(STDERR, 'Configuracao do laboratorio falhou: ' . $erro->getMessage() . "\n");
    exit(1);
}
