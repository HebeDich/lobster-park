/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Usage = {
    requests?: number;
    activeSessions?: number;
    tokenInput?: number | null;
    tokenOutput?: number | null;
    estimatedCost?: number | null;
    points?: Array<{
        date?: string;
        requests?: number;
        tokenInput?: number;
        tokenOutput?: number;
        estimatedCost?: number;
    }>;
};

