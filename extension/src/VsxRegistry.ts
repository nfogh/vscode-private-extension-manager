import { CancellationToken, Uri } from 'vscode';

import { ExtensionInfoService } from './extensionInfo';
import { Package } from './Package';
import { Registry, RegistrySource, VersionInfo } from './Registry';
//import { SearchEntry, SearchResult } from './VsxRegistryTypes';

/**
 * Represents a registry.
 */
export class VsxRegistry implements Registry {
    readonly query: string | string[];
    readonly enablePagination: boolean;
    readonly extensionInfo: ExtensionInfoService;
    readonly name: string;
    readonly source: RegistrySource;
    readonly registryUrl: string;

    constructor(name: string, query: string | string[], registryUrl: string) {
        this.query = query;
        this.enablePagination = true;
        this.registryUrl = registryUrl;
        this.extensionInfo = new ExtensionInfoService();
        this.name = name;
        this.source = RegistrySource.User;
    }
    /**
     * The Uri of the registry, if configured. If this is `undefined`, NPM's
     * normal resolution scheme is used to find the registry.
     */
    get uri(): Uri | undefined {
        return undefined;
    }

    /**
     * Download a package and return the Uri of the directory where it was
     * extracted.
     *
     * @param _packageOrSpec A package to download, or an NPM package specifier.
     */
    downloadPackage(_packageOrSpec: Package | string): Promise<Uri> {
        throw new Error('Method not implemented.');
    }

    /**
     * Gets all packages matching the registry options.
     *
     * @param _token Token to use to cancel the search.
     */
    async getPackages(_token?: CancellationToken): Promise<Package[]> {
        //const reply = await fetch(`${this.registryUrl}/api/-/search?text={this.query}`);
        //const searchResult: SearchResult = await reply.json();

        return [];

        //return searchResult.extensions.map((entry: SearchEntry) => new Package(this, {}));
    }

    /**
     * Gets the full package metadata for a package.
     */
    getPackageMetadata(_name: string): Promise<Record<string, unknown>> {
        throw new Error('Method not implemented.');
    }

    /**
     * Gets the release channels available for a package.
     *
     * This is a dictionary with channel names as keys and the latest version
     * in each channel as values.
     */
    getPackageChannels(_name: string): Promise<Record<string, VersionInfo>> {
        throw new Error('Method not implemented.');
    }

    /**
     * Gets the list of available versions for a package.
     */
    getPackageVersions(_name: string): Promise<VersionInfo[]> {
        throw new Error('Method not implemented.');
    }

    /**
     * Gets the version-specific metadata for a specific version of a package.
     *
     * If `version` is the name of a release channel, this gets the latest version in that channel.
     * If `version` is omitted, this gets the latest version for the user's selected channel.
     * @throws VersionMissingError if the given version does not exist.
     */
    getPackage(_name: string, _version?: string): Promise<Package> {
        throw new Error('Method not implemented.');
    }

    /**
     * Gets whether this registry has the same Uri and filtering options as
     * another registry.
     */
    equals(_other: Registry): boolean {
        throw new Error('Method not implemented.');
    }
}
