/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { Instance } from './Instance';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedInstances = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Instance>;
    });
});

