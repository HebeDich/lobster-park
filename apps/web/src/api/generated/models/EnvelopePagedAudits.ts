/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Audit } from './Audit';
import type { EnvelopeBase } from './EnvelopeBase';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedAudits = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Audit>;
    });
});

