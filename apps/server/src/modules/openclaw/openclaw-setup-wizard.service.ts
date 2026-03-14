import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigCenterService } from '../config/config.service';
import { InstanceService } from '../instance/instance.service';
import { OpenClawBasicConfigService } from './openclaw-basic-config.service';
import { OpenClawChannelService } from './openclaw-channel.service';
import { maskSecretPreview } from './openclaw-secret-mask';

const DEFAULT_AGENT_ID = 'agent_default';
const DEFAULT_AGENT_NAME = '默认 Agent';
const DEFAULT_AGENT_TOOL_POLICY = {
  allowExec: true,
  allowBrowser: true,
  allowWrite: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export interface SetupWizardInput {
  model: {
    provider: string;
    modelName: string;
    apiKey: string;
    baseUrl?: string;
  };
  agent?: {
    systemPrompt?: string;
    toolPolicy?: {
      allowExec?: boolean;
      allowBrowser?: boolean;
      allowWrite?: boolean;
    };
  };
  channel?: {
    channelType: string;
    fields: Record<string, string>;
  };
  autoPublish?: boolean;
  autoStart?: boolean;
}

export interface SetupWizardResult {
  instanceId: string;
  steps: {
    modelConfigured: boolean;
    agentConfigured: boolean;
    channelConnected: boolean;
    published: boolean;
    started: boolean;
  };
  publishJobId?: string;
  startJobId?: string;
}

@Injectable()
export class OpenClawSetupWizardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
    private readonly basicConfigService: OpenClawBasicConfigService,
    private readonly channelService: OpenClawChannelService,
    private readonly configCenterService: ConfigCenterService,
    private readonly instanceService: InstanceService,
  ) {}

  async runSetupWizard(
    currentUser: RequestUserContext,
    instanceId: string,
    body: SetupWizardInput,
  ): Promise<SetupWizardResult> {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);

    const autoPublish = body.autoPublish !== false;
    const autoStart = body.autoStart !== false;

    const steps = {
      modelConfigured: false,
      agentConfigured: false,
      channelConnected: false,
      published: false,
      started: false,
    };

    // Step 1: Upsert API Key as secret
    const secretKey = 'openclaw.model.apiKey';
    const existing = await this.prisma.instanceSecret.findUnique({
      where: { instanceId_secretKey: { instanceId, secretKey } },
    });
    if (existing) {
      await this.prisma.instanceSecret.update({
        where: { instanceId_secretKey: { instanceId, secretKey } },
        data: {
          cipherValue: `enc:${Buffer.from(body.model.apiKey).toString('base64')}`,
          maskedPreview: maskSecretPreview(body.model.apiKey),
          secretVersion: existing.secretVersion + 1,
          updatedBy: currentUser.id,
        },
      });
    } else {
      await this.prisma.instanceSecret.create({
        data: {
          id: `sec_${Date.now()}_${secretKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
          instanceId,
          secretKey,
          cipherValue: `enc:${Buffer.from(body.model.apiKey).toString('base64')}`,
          maskedPreview: maskSecretPreview(body.model.apiKey),
          secretVersion: 1,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      });
    }

    const currentConfig = await this.basicConfigService.getBasicConfig(currentUser, instanceId).catch(() => ({}));
    const existingDefaultAgent = isRecord((currentConfig as Record<string, unknown>).defaultAgent)
      ? (currentConfig as Record<string, unknown>).defaultAgent as Record<string, unknown>
      : null;
    const explicitToolPolicy = isRecord(body.agent?.toolPolicy) ? body.agent?.toolPolicy : null;

    // Step 2: Build basic config input and call updateBasicConfig
    const basicConfigInput: Record<string, unknown> = {
      defaultModel: {
        id: 'model_default',
        provider: body.model.provider,
        model: body.model.modelName,
        apiKeyRef: secretKey,
        ...(body.model.baseUrl ? { baseUrl: body.model.baseUrl } : {}),
      },
      defaultAgent: {
        id: readString(existingDefaultAgent?.id) ?? DEFAULT_AGENT_ID,
        name: readString(existingDefaultAgent?.name) ?? DEFAULT_AGENT_NAME,
        modelId: 'model_default',
        ...(readString(body.agent?.systemPrompt) ? { systemPrompt: body.agent?.systemPrompt } : {}),
      },
      advanced: { experienceProfile: 'personal_open' },
      channelDefaults: { pairingPolicy: 'open', allowFrom: '*' },
    };
    if (explicitToolPolicy) {
      basicConfigInput.toolPolicy = {
        allowExec: explicitToolPolicy.allowExec ?? false,
        allowBrowser: explicitToolPolicy.allowBrowser ?? false,
        allowWrite: explicitToolPolicy.allowWrite ?? false,
      };
    } else if (!existingDefaultAgent) {
      basicConfigInput.toolPolicy = DEFAULT_AGENT_TOOL_POLICY;
    }
    await this.basicConfigService.updateBasicConfig(currentUser, instanceId, basicConfigInput);
    steps.modelConfigured = true;
    steps.agentConfigured = true;

    // Step 3: Connect channel if provided
    let publishJobId: string | undefined;
    if (body.channel) {
      const channelResult = await this.channelService.connectChannel(
        currentUser,
        instanceId,
        body.channel.channelType,
        { fields: body.channel.fields },
      );
      steps.channelConnected = true;
      // connectChannel auto-publishes
      steps.published = true;
      publishJobId = channelResult.publishResult?.jobId;
    } else if (autoPublish) {
      // No channel: publish manually
      const publishResult = await this.configCenterService.publish(
        currentUser,
        instanceId,
        'Setup wizard',
      );
      steps.published = true;
      publishJobId = publishResult.jobId;
    }

    // Step 4: Auto-start if requested and instance not running
    let startJobId: string | undefined;
    if (autoStart) {
      const instance = await this.prisma.instance.findUnique({ where: { id: instanceId } });
      if (instance && instance.lifecycleStatus !== 'running') {
        const startResult = await this.instanceService.transition(currentUser, instanceId, 'running');
        steps.started = true;
        startJobId = startResult.jobId;
      } else if (instance?.lifecycleStatus === 'running') {
        steps.started = true;
      }
    }

    // Step 5: Audit
    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'openclaw.setup_wizard.completed',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'instance',
      targetId: instanceId,
      summary: `Setup wizard completed for ${instanceId}`,
      riskLevel: 'medium',
      metadataJson: {
        provider: body.model.provider,
        modelName: body.model.modelName,
        channelType: body.channel?.channelType ?? null,
        autoPublish,
        autoStart,
      } as any,
    });

    return {
      instanceId,
      steps,
      publishJobId,
      startJobId,
    };
  }
}
