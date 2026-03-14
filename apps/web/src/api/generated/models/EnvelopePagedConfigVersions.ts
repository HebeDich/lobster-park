/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConfigVersion } from './ConfigVersion';
import type { EnvelopeBase } from './EnvelopeBase';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedConfigVersions = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<ConfigVersion>;
    });
});

