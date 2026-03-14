/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Health = {
    runtimeStatus?: string;
    healthStatus?: string;
    lastCheckedAt?: string;
    channels?: Array<{
        name?: string;
        status?: string;
    }>;
    models?: Array<{
        name?: string;
        status?: string;
    }>;
    errors?: Array<string>;
};

