/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConfigVersionStatus } from './ConfigVersionStatus';
export type ConfigVersion = {
    id?: string;
    versionNo?: number;
    versionStatus?: ConfigVersionStatus;
    createdAt?: string;
    activatedAt?: string | null;
    publishNote?: string | null;
    createdBy?: string;
    sourceType?: ConfigVersion.sourceType;
    normalizedConfigJson?: Record<string, any>;
    validationErrorsJson?: Array<Record<string, any>>;
};
export namespace ConfigVersion {
    export enum sourceType {
        PUBLISH = 'publish',
        ROLLBACK = 'rollback',
        FORCE_PUBLISH = 'force_publish',
    }
}

