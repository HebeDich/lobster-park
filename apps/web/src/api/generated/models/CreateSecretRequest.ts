/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * [V1.4] Create a new secret for an instance
 */
export type CreateSecretRequest = {
    /**
     * Unique identifier within the instance
     */
    secretKey: string;
    /**
     * Plain-text secret value (encrypted at rest, never returned)
     */
    secretValue: string;
    /**
     * Optional expiration timestamp
     */
    expiresAt?: string | null;
};

