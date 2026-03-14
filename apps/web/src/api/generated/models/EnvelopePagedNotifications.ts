/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { Notification } from './Notification';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedNotifications = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Notification>;
    });
});

