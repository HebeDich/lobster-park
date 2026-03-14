const CONTAINER_HOME_PATH = '/home/node';
const CONTAINER_WORKSPACE_PATH = '/runtime/workspace';
const CONTAINER_CONFIG_PATH = '/runtime/config';
const CONTAINER_GATEWAY_PORT = 18789;

export function buildContainerName(instanceId: string) {
  return 'lobster-openclaw-' + instanceId;
}

export function getContainerRuntimePaths(instanceId: string) {
  const profileDirPath = CONTAINER_HOME_PATH + '/.openclaw-' + instanceId;
  return {
    containerGatewayPort: CONTAINER_GATEWAY_PORT,
    containerHomePath: CONTAINER_HOME_PATH,
    containerWorkspacePath: CONTAINER_WORKSPACE_PATH,
    profileDirPath,
    profileConfigPath: profileDirPath + '/openclaw.json',
  };
}

export function buildContainerConfigRefreshCommand(instanceId: string) {
  const paths = getContainerRuntimePaths(instanceId);
  return [
    'set -e',
    'mkdir -p "' + paths.profileDirPath + '" "' + paths.containerWorkspacePath + '"',
    'cp ' + CONTAINER_CONFIG_PATH + '/config.json "' + paths.profileConfigPath + '"',
  ].join(' && ');
}

export function buildContainerCreateArgs(input: {
  containerName: string;
  image: string;
  instanceId: string;
  hostGatewayPort: number;
  hostConfigPath: string;
  hostWorkspacePath: string;
  hostHomePath: string;
  hostPluginPaths?: string[];
  gatewayToken?: string;
  runtimeUser?: string;
}) {
  const paths = getContainerRuntimePaths(input.instanceId);
  const token = input.gatewayToken || input.instanceId;
  const pluginMounts = [...new Set((input.hostPluginPaths ?? []).filter((item) => item.trim()))]
    .flatMap((pluginPath) => ['-v', `${pluginPath}:${pluginPath}:ro`]);
  const launchCommand = [
    buildContainerConfigRefreshCommand(input.instanceId),
    'exec openclaw --profile "' + input.instanceId + '" gateway run --allow-unconfigured --auth token --token "' + token + '" --port "' + String(paths.containerGatewayPort) + '" --bind lan',
  ].join(' && ');

  return [
    'create',
    '--name',
    input.containerName,
    '--restart',
    'unless-stopped',
    '--entrypoint',
    'sh',
    ...(input.runtimeUser ? ['--user', input.runtimeUser] : []),
    '-p',
    String(input.hostGatewayPort) + ':' + String(paths.containerGatewayPort),
    '-v',
    input.hostConfigPath + ':' + CONTAINER_CONFIG_PATH,
    '-v',
    input.hostWorkspacePath + ':' + paths.containerWorkspacePath,
    '-v',
    input.hostHomePath + ':' + paths.containerHomePath,
    ...pluginMounts,
    '-e',
    'HOME=' + paths.containerHomePath,
    '-e',
    'OPENCLAW_WORKSPACE_DIR=' + paths.containerWorkspacePath,
    input.image,
    '-lc',
    launchCommand,
  ];
}
