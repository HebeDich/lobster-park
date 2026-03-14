/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { PagedMeta } from './PagedMeta';
import type { SecretListItem } from './SecretListItem';
export type EnvelopePagedSecrets = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<SecretListItem>;
    });
});

