/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Alert } from './Alert';
import type { EnvelopeBase } from './EnvelopeBase';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedAlerts = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Alert>;
    });
});

