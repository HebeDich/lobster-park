/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PatchTenantRequest = {
    name?: string;
    status?: PatchTenantRequest.status;
    quotaJson?: Record<string, any>;
};
export namespace PatchTenantRequest {
    export enum status {
        ACTIVE = 'active',
        SUSPENDED = 'suspended',
    }
}

