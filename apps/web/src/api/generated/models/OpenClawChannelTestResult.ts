/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OpenClawChannelTestResult = {
    instanceId?: string;
    channelType?: string;
    success?: boolean;
    simulated?: boolean;
    testMode?: string;
    deliveryMode?: OpenClawChannelTestResult.deliveryMode;
    relayMode?: OpenClawChannelTestResult.relayMode;
    target?: string;
    message?: string;
    errorMessage?: string | null;
    relay?: Record<string, any> | null;
    checkedAt?: string;
};
export namespace OpenClawChannelTestResult {
    export enum deliveryMode {
        DRY_RUN = 'dry_run',
        REAL = 'real',
    }
    export enum relayMode {
        GATEWAY = 'gateway',
        LOCAL_CONFIG = 'local_config',
    }
}

