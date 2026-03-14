/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InstanceLifecycleStatus } from './InstanceLifecycleStatus';
export type Instance = {
    id?: string;
    tenantId?: string;
    ownerUserId?: string;
    name?: string;
    specCode?: Instance.specCode;
    runtimeVersion?: string;
    lifecycleStatus?: InstanceLifecycleStatus;
    healthStatus?: string;
    currentActiveVersionId?: string | null;
    description?: string | null;
    nodeCount?: number;
    createdAt?: string;
    updatedAt?: string;
};
export namespace Instance {
    export enum specCode {
        S = 'S',
        M = 'M',
        L = 'L',
    }
}

