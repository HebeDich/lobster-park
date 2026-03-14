/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * [V1.4] Confirm secret deletion
 */
export type DeleteSecretRequest = {
    /**
     * Must be DELETE to confirm
     */
    confirmText: DeleteSecretRequest.confirmText;
};
export namespace DeleteSecretRequest {
    /**
     * Must be DELETE to confirm
     */
    export enum confirmText {
        DELETE = 'DELETE',
    }
}

