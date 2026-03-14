/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { Job } from './Job';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedJobs = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Job>;
    });
});

