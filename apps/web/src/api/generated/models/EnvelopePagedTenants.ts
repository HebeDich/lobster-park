/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { PagedMeta } from './PagedMeta';
import type { Tenant } from './Tenant';
export type EnvelopePagedTenants = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Tenant>;
    });
});

