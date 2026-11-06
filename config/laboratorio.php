<?php
declare(strict_types=1);

use App\Entity\{Contador, Local, Lotacao, Metadata, Perfil, Servico, ServicoUnidade, ServicoUsuario, Unidade, Usuario, UsuarioMeta};
use Doctrine\ORM\EntityManagerInterface;
use League\Bundle\OAuth2ServerBundle\Manager\ClientManagerInterface;
use League\Bundle\OAuth2ServerBundle\Model\Client;
use League\Bundle\OAuth2ServerBundle\ValueObject\Grant;
use Novosga\Service\{FilaServiceInterface, UsuarioServiceInterface};
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/** Configura apenas a primeira instalacao. O marcador no banco preserva edicoes futuras. */
function configurarLaboratorio(
    EntityManagerInterface $em,
    ClientManagerInterface $oauth,
    UserPasswordHasherInterface $hasher,
    array $config,
): array {
    // Depois da primeira instalacao, senhas podem ter sido trocadas pela equipe.
    // O estado no banco prevalece sobre as credenciais iniciais do arquivo.
    $existente = $em->getRepository(Metadata::class)->findOneBy([
        'namespace' => 'riobranco', 'name' => 'instalacao.v1',
    ]);
    if ($existente) {
        return $existente->getValue();
    }
    if (($config['schema'] ?? null) !== 1 || empty($config['usuarios']) ||
        !preg_match('/^[a-f0-9]{32}$/D', $config['mangati']['client_id'] ?? '') ||
        !preg_match('/^[a-f0-9]{128}$/D', $config['mangati']['client_secret'] ?? '')) {
        throw new RuntimeException('credenciais.json invalido. Use gerenciar.py preparar.');
    }
    foreach ($config['usuarios'] as $item) {
        if (!preg_match('/^[a-z][a-z0-9]{2,29}$/D', $item['login'] ?? '') ||
            !preg_match('/^[a-f0-9]{32}$/D', $item['senha'] ?? '') ||
            !in_array($item['tipo'] ?? '', ['recepcao', 'coleta', 'totem', 'painel'], true) ||
            !is_int($item['numero'] ?? null) || $item['numero'] < 1 || $item['numero'] > 50) {
            throw new RuntimeException('Usuario inicial invalido em credenciais.json.');
        }
    }

    return $em->wrapInTransaction(function () use ($em, $oauth, $hasher, $config): array {
        $marcador = $em->getRepository(Metadata::class)->findOneBy([
            'namespace' => 'riobranco', 'name' => 'instalacao.v1',
        ]);
        if ($marcador) {
            return $marcador->getValue();
        }
        $unidade = $em->getRepository(Unidade::class)->findOneBy(['nome' => 'Laboratório Rio Branco']);
        if (!$unidade) {
            throw new RuntimeException('Unidade inicial ausente. Execute primeiro novosga:install.');
        }
        $locais = [];
        foreach (['recepcao' => 'Guichê', 'coleta' => 'Sala de coleta'] as $tipo => $nome) {
            $local = $em->getRepository(Local::class)->findOneBy(['nome' => $nome]);
            if (!$local) {
                $local = (new Local())->setNome($nome);
                $em->persist($local);
            }
            $locais[$tipo] = $local;
        }
        $servicos = [];
        foreach (['recepcao' => ['Recepção', 'R'], 'coleta' => ['Coleta', 'C']] as $tipo => [$nome, $sigla]) {
            $servico = $em->getRepository(Servico::class)->findOneBy(['nome' => $nome]);
            if (!$servico) {
                $servico = (new Servico())->setNome($nome)->setDescricao($nome . ' do laboratório')->setPeso(1)->setAtivo(true);
                $em->persist($servico);
                $em->flush();
            }
            if (!$em->getRepository(ServicoUnidade::class)->findOneBy(['unidade' => $unidade, 'servico' => $servico])) {
                $su = (new ServicoUnidade())->setUnidade($unidade)->setServico($servico)->setSigla($sigla);
                $em->persist($su);
            }
            if (!$em->getRepository(Contador::class)->findOneBy(['unidade' => $unidade, 'servico' => $servico])) {
                $em->persist((new Contador())->setUnidade($unidade)->setServico($servico)->setNumero(0));
            }
            $servicos[$tipo] = $servico;
        }
        $perfis = [];
        $modulos = [
            'recepcao' => ['novosga.attendance', 'novosga.triage', 'novosga.monitor'],
            'coleta' => ['novosga.attendance', 'novosga.monitor'],
            'totem' => ['novosga.triage'],
            'painel' => [],
        ];
        foreach ($modulos as $tipo => $acessos) {
            $nome = 'Rio Branco - ' . $tipo;
            $perfil = $em->getRepository(Perfil::class)->findOneBy(['nome' => $nome]);
            if (!$perfil) {
                $perfil = (new Perfil())->setNome($nome)->setDescricao('Perfil inicial do laboratório')->setModulos($acessos);
                $em->persist($perfil);
            }
            $perfis[$tipo] = $perfil;
        }
        $em->flush();
        foreach ($config['usuarios'] as $item) {
            if ($em->getRepository(Usuario::class)->findOneBy(['login' => $item['login']])) {
                throw new RuntimeException('Login inicial ja existe sem marcador de instalacao: ' . $item['login']);
            }
            $tipo = $item['tipo'];
            $usuario = (new Usuario())->setLogin($item['login'])->setNome(ucfirst($tipo))
                ->setSobrenome('Rio Branco ' . $item['numero'])->setAlgorithm('bcrypt')->setAdmin(false)->setAtivo(true);
            $usuario->setSenha($hasher->hashPassword($usuario, $item['senha']));
            $em->persist($usuario);
            $em->persist((new Lotacao())->setUsuario($usuario)->setUnidade($unidade)->setPerfil($perfis[$tipo]));
            if (isset($servicos[$tipo])) {
                $em->persist((new ServicoUsuario())->setUsuario($usuario)->setUnidade($unidade)
                    ->setServico($servicos[$tipo])->setPeso(1));
            }
            $metas = [UsuarioServiceInterface::ATTR_SESSION_UNIDADE => $unidade->getId()];
            if (isset($locais[$tipo])) {
                $metas += [
                    UsuarioServiceInterface::ATTR_ATENDIMENTO_LOCAL => $locais[$tipo]->getId(),
                    UsuarioServiceInterface::ATTR_ATENDIMENTO_NUM_LOCAL => $item['numero'],
                    UsuarioServiceInterface::ATTR_ATENDIMENTO_TIPO => FilaServiceInterface::TIPO_TODOS,
                ];
            }
            foreach ($metas as $nome => $valor) {
                $em->persist((new UsuarioMeta())->setEntity($usuario)->setNamespace(UsuarioServiceInterface::ATTR_NAMESPACE)
                    ->setName($nome)->setValue($valor));
            }
        }
        $cliente = new Client('Painel Mangati Rio Branco', $config['mangati']['client_id'], $config['mangati']['client_secret']);
        $cliente->setGrants(new Grant('password'), new Grant('refresh_token'));
        $oauth->save($cliente);
        $resultado = [
            'unidade_id' => $unidade->getId(),
            'servicos' => array_map(static fn (Servico $s): int => $s->getId(), $servicos),
            'guiches' => $config['guiches'],
            'salas_coleta' => $config['salas_coleta'],
        ];
        $em->persist((new Metadata())->setNamespace('riobranco')->setName('instalacao.v1')->setValue($resultado));
        return $resultado;
    });
}
