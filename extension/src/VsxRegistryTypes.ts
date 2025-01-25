export interface SearchEntry {
    url: string;
    files: {
        additionalProp1: string;
        additionalProp2: string;
        additionalProp3: string;
    };
    name: string;
    namespace: string;
    version: string;
    timestamp: string;
    verified: boolean;
    allVersionsUrl?: string;
    averageRating?: number;
    reviewCount?: number;
    downloadCount?: number;
    displayName?: string;
    description?: string;
    deprecated?: boolean;
}

export interface SearchResult {
    success?: string;
    warning?: string;
    error?: string;
    offset: number;
    totalSize: number;
    extensions: SearchEntry[];
}
