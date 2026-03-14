/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OpenClawChannelCatalogField } from './OpenClawChannelCatalogField';
export type OpenClawChannelCatalogItem = {
    channelType?: string;
    displayName?: string;
    description?: string;
    tier?: OpenClawChannelCatalogItem.tier;
    connectionMode?: OpenClawChannelCatalogItem.connectionMode;
    onboardingType?: OpenClawChannelCatalogItem.onboardingType;
    pairingSupported?: boolean;
    directoryLookupSupported?: boolean;
    official?: boolean;
    enabledByPlatform?: boolean;
    requiredSecrets?: Array<string>;
    requiredFields?: Array<OpenClawChannelCatalogField>;
    connectivityCheckMode?: OpenClawChannelCatalogItem.connectivityCheckMode;
    messageTestMode?: OpenClawChannelCatalogItem.messageTestMode;
};
export namespace OpenClawChannelCatalogItem {
    export enum tier {
        L1 = 'L1',
        L2 = 'L2',
    }
    export enum connectionMode {
        QR = 'qr',
        CREDENTIALS = 'credentials',
        PLUGIN = 'plugin',
    }
    export enum onboardingType {
        QR_SESSION = 'qr_session',
        BOT_TOKEN = 'bot_token',
        WEBHOOK_SECRET = 'webhook_secret',
        PLUGIN_REQUIRED = 'plugin_required',
    }
    export enum connectivityCheckMode {
        GATEWAY_HEALTH = 'gateway_health',
        MESSAGE_SEND_DRY_RUN = 'message_send_dry_run',
        SESSION_STATUS = 'session_status',
    }
    export enum messageTestMode {
        GATEWAY_AGENT = 'gateway_agent',
        CHANNEL_MESSAGE_SEND = 'channel_message_send',
        QR_SESSION_PROBE = 'qr_session_probe',
    }
}

