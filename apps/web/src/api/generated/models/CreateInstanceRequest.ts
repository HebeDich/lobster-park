/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateInstanceRequest = {
    name: string;
    description?: string;
    specCode: CreateInstanceRequest.specCode;
    templateId?: string | null;
    runtimeVersion?: string | null;
    autoStart?: boolean;
};
export namespace CreateInstanceRequest {
    export enum specCode {
        S = 'S',
        M = 'M',
        L = 'L',
    }
}

