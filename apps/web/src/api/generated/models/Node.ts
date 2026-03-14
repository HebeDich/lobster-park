/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NodeOnlineStatus } from './NodeOnlineStatus';
import type { PairingStatus } from './PairingStatus';
export type Node = {
    id?: string;
    pairingStatus?: PairingStatus;
    onlineStatus?: NodeOnlineStatus;
    lastSeenAt?: string | null;
    tenantId?: string;
    boundInstanceId?: string | null;
    metadataJson?: Record<string, any>;
    capabilitiesJson?: Array<string>;
};

