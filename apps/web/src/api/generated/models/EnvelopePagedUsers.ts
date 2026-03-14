/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { PagedMeta } from './PagedMeta';
import type { User } from './User';
export type EnvelopePagedUsers = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<User>;
    });
});

