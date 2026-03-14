/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OpenClawChannelCatalogItem } from './OpenClawChannelCatalogItem';
import type { OpenClawChannelConfig } from './OpenClawChannelConfig';
export type OpenClawInstanceChannel = (OpenClawChannelCatalogItem & {
    configured?: boolean;
    enabled?: boolean;
    pendingPairingCount?: number;
    sessionStatus?: string | null;
    statusHint?: string | null;
    config?: OpenClawChannelConfig | null;
});

