/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Notification = {
    id?: string;
    tenantId?: string;
    alertId?: string | null;
    eventType?: string;
    channelType?: Notification.channelType;
    recipientUserId?: string | null;
    recipient?: string;
    title?: string;
    contentJson?: Record<string, any>;
    sendStatus?: string;
    retryCount?: number;
    lastError?: string | null;
    readAt?: string | null;
    sentAt?: string | null;
    createdAt?: string;
};
export namespace Notification {
    export enum channelType {
        IN_APP = 'in_app',
        EMAIL = 'email',
    }
}

