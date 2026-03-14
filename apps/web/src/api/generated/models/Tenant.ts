/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Tenant = {
    id?: string;
    name?: string;
    status?: string;
    /**
     * [V1.4] Tenant quota config, e.g. { maxInstances, maxUsers, maxNodes }
     */
    quotaJson?: Record<string, any> | null;
    createdAt?: string;
    updatedAt?: string;
};

