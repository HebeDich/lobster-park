/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * [V1.4] Update secret value and/or expiration
 */
export type UpdateSecretRequest = {
    /**
     * New plain-text value (omit to keep current value)
     */
    secretValue?: string;
    /**
     * New expiration (explicit null clears expiration)
     */
    expiresAt?: string | null;
};

