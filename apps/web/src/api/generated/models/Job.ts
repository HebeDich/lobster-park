/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Job = {
    id?: string;
    tenantId?: string | null;
    instanceId?: string | null;
    jobType?: string;
    jobStatus?: Job.jobStatus;
    progress?: number;
    errorCode?: number | null;
    errorMessage?: string | null;
    requestId?: string;
    payloadJson?: Record<string, any> | null;
    createdAt?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
};
export namespace Job {
    export enum jobStatus {
        PENDING = 'pending',
        RUNNING = 'running',
        SUCCESS = 'success',
        FAILED = 'failed',
        CANCELLED = 'cancelled',
        DEAD_LETTER = 'dead_letter',
    }
}

