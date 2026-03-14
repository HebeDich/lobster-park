/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvelopeBase } from './EnvelopeBase';
import type { Node } from './Node';
import type { PagedMeta } from './PagedMeta';
export type EnvelopePagedNodes = (EnvelopeBase & {
    data?: (PagedMeta & {
        items?: Array<Node>;
    });
});

