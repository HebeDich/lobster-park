/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * [V1.4] Masked secret item — cipher_value is never exposed
 */
export type SecretListItem = {
    /**
     * ULID with sec_ prefix
     */
    id?: string;
    /**
     * Unique key within instance, e.g. "openai_api_key"
     */
    secretKey?: string;
    /**
     * Masked preview, e.g. "sk-****7890"
     */
    maskedPreview?: string;
    /**
     * Incremented on each value update
     */
    secretVersion?: number;
    /**
     * Optional expiration time for credential rotation tracking
     */
    expiresAt?: string | null;
    createdBy?: string;
    updatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
};

