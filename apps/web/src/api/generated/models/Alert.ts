/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AlertSeverity } from './AlertSeverity';
import type { AlertStatus } from './AlertStatus';
export type Alert = {
    id?: string;
    instanceId?: string | null;
    alertType?: string;
    severity?: AlertSeverity;
    status?: AlertStatus;
    title?: string;
    firstTriggeredAt?: string;
    lastTriggeredAt?: string;
    tenantId?: string;
    dedupeKey?: string;
    detailJson?: Record<string, any>;
    ackedBy?: string | null;
    ackedAt?: string | null;
    resolvedBy?: string | null;
    resolvedAt?: string | null;
};

