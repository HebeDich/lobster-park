/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PairingStatus } from './PairingStatus';
export type PairingRequest = {
    id?: string;
    instanceId?: string;
    pairingStatus?: PairingStatus;
    requestedAt?: string;
    tenantId?: string;
    nodeFingerprint?: string;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reason?: string | null;
};

