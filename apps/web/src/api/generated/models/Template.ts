/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Template = {
    id?: string;
    tenantScope?: string;
    name?: string;
    templateType?: string;
    specCode?: Template.specCode;
    status?: string;
    configJson?: Record<string, any>;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
};
export namespace Template {
    export enum specCode {
        S = 'S',
        M = 'M',
        L = 'L',
    }
}

