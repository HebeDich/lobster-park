/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Audit = {
    id?: string;
    actionType?: string;
    actionResult?: string;
    operatorUserId?: string;
    targetType?: string;
    targetId?: string;
    createdAt?: string;
    tenantId?: string;
    summary?: string | null;
    traceId?: string;
    riskLevel?: string;
    beforeJson?: Record<string, any>;
    afterJson?: Record<string, any>;
    metadataJson?: Record<string, any>;
};

