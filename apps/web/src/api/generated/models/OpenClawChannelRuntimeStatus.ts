/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OpenClawChannelRuntimeStatus = {
    instanceId?: string;
    channelType?: string;
    connectionMode?: string;
    configured?: boolean;
    linked?: boolean;
    running?: boolean;
    connected?: boolean;
    sessionStatus?: string;
    lastError?: string | null;
    self?: Record<string, any> | null;
    accounts?: Array<Record<string, any>>;
    statusSource?: string;
    qrSupported?: boolean;
    qrHint?: string | null;
};

