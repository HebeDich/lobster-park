/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SkillPackage = {
    id?: string;
    sourceType?: string;
    sourceUri?: string;
    version?: string;
    reviewStatus?: string;
    riskLevel?: string;
    metadataJson?: Record<string, any>;
    tenantPolicyEffect?: SkillPackage.tenantPolicyEffect | null;
};
export namespace SkillPackage {
    export enum tenantPolicyEffect {
        ALLOW = 'allow',
        DENY = 'deny',
    }
}

