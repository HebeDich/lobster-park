/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Documentation schema for 302 redirect handoff. Actual response is an HTTP redirect.
 */
export type SsoAuthorizeResponse = {
    redirectTo?: string;
    /**
     * PKCE state/cache ttl in seconds
     */
    expiresIn?: number;
};

