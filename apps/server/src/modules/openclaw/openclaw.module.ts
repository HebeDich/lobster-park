import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConfigCenterModule } from '../config/config-center.module';
import { InstanceModule } from '../instance/instance.module';
import { NodeCenterModule } from '../node/node.module';
import { PlatformModule } from '../platform/platform.module';
import { OpenClawBasicConfigService } from './openclaw-basic-config.service';
import { OpenClawChannelService } from './openclaw-channel.service';
import { OpenClawConnectivityService } from './openclaw-connectivity.service';
import { OpenClawController } from './openclaw.controller';
import { OpenClawGatewayProxyService } from './openclaw-gateway-proxy.service';
import { OpenClawNativePairingService } from './openclaw-native-pairing.service';
import { OpenClawSetupWizardController } from './openclaw-setup-wizard.controller';
import { OpenClawSetupWizardService } from './openclaw-setup-wizard.service';
import { OpenClawTerminalRealtimeService } from './openclaw-terminal-realtime.service';
import { OpenClawTerminalService } from './openclaw-terminal.service';
import { OpenClawWebUIProxyController } from './openclaw-webui-proxy.controller';
import { OpenClawWorkspaceExportService } from './openclaw-workspace-export.service';

@Module({
  imports: [AuditModule, ConfigCenterModule, NodeCenterModule, PlatformModule, forwardRef(() => InstanceModule)],
  controllers: [OpenClawController, OpenClawWebUIProxyController, OpenClawSetupWizardController],
  providers: [OpenClawBasicConfigService, OpenClawChannelService, OpenClawConnectivityService, OpenClawGatewayProxyService, OpenClawNativePairingService, OpenClawSetupWizardService, OpenClawTerminalService, OpenClawTerminalRealtimeService, OpenClawWorkspaceExportService],
  exports: [OpenClawBasicConfigService, OpenClawChannelService, OpenClawConnectivityService, OpenClawGatewayProxyService, OpenClawNativePairingService, OpenClawSetupWizardService, OpenClawTerminalService, OpenClawTerminalRealtimeService, OpenClawWorkspaceExportService],
})
export class OpenClawModule {}
