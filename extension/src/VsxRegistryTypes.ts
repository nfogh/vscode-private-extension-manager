import * as t from 'io-ts';

import { options } from './typeUtil';

export const SearchEntryRT = options(
    {
        url: t.string,
        files: t.record(t.string, t.string),
        name: t.string,
        namespace: t.string,
        version: t.string,
        timestamp: t.string,
        verified: t.boolean,
    },
    {
        allVersionsUrl: t.string,
        averageRating: t.number,
        reviewCount: t.number,
        downloadCount: t.number,
        displayName: t.string,
        description: t.string,
        deprecated: t.boolean,
    },
);

export const SearchResultRT = options(
    {
        offset: t.number,
        totalSize: t.number,
        extensions: t.array(SearchEntryRT),
    },
    {
        success: t.string,
        warning: t.string,
        error: t.string,
    },
);

export type SearchEntry = t.TypeOf<typeof SearchEntryRT>;
export type SearchResult = t.TypeOf<typeof SearchResultRT>;
