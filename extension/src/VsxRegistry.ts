import * as decompress from 'decompress';
import { isLeft } from 'fp-ts/lib/Either';
import * as fs from 'fs';
import * as fspromises from 'fs/promises';
import { PathReporter } from 'io-ts/lib/PathReporter';
import * as fetch from 'node-fetch';
import path = require('path');
import { SemVer } from 'semver';
import { CancellationToken, Uri } from 'vscode';

import { ExtensionInfoService } from './extensionInfo';
import { Package } from './Package';
import { Registry, RegistrySource, VersionInfo, VersionMissingError } from './Registry';
import { getNpmDownloadDir } from './util';
import {
    SearchResult,
    SearchResultRT,
    QueryResult,
    QueryResultRT,
    VersionsResult,
    VersionsResultRT,
} from './VsxRegistryTypes';

async function pathAccessible(path: string) {
    try {
        await fspromises.access(path);
        return true;
    } catch {
        return false;
    }
}

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
        return Uri.parse(this.registryUrl);
    }

    /**
     * Download a package and return the Uri of the directory where it was
     * extracted.
     *
     * @param packageOrSpec A package to download, or an NPM package specifier.
     */
    async downloadPackage(packageOrSpec: Package | string): Promise<Uri> {
        const spec = packageOrSpec instanceof Package ? packageOrSpec.spec : packageOrSpec;
        const [name, version] = spec.split('@');
        const pkg = await this.getPackage(name, version);

        if (!pkg.vsixFile) {
            throw new Error(`No VSIX file found for ${name}@${version}`);
        }

        const dir = getNpmDownloadDir();
        const filePath = path.join(dir, path.basename(pkg.vsixFile));
        if (!(await pathAccessible(filePath))) {
            await fspromises.mkdir(dir, { recursive: true });
            const fileStream = fs.createWriteStream(filePath);

            const data = await fetch.default(pkg.vsixFile);
            await new Promise((resolve, reject) => {
                data.body.pipe(fileStream);
                data.body.on('error', reject);
                fileStream.on('finish', resolve);
            });
        }

        const extractedPath = path.join(dir, path.basename(name)) + 'extracted';

        if (!(await pathAccessible(extractedPath))) {
            await new Promise((resolve, reject) => {
                decompress(filePath, extractedPath).then(resolve).catch(reject);
            });

            // Copy the vsix file to be compatible with the NPM registry.
            // TODO: Refactor logic to avoid copying the file.
            await fspromises.copyFile(filePath, path.join(extractedPath, 'extension', path.basename(filePath)));
        }

        return Uri.file(path.join(extractedPath, 'extension'));
    }

    /**
     * Gets all packages matching the registry options.
     *
     * @param _token Token to use to cancel the search.
     */
    async getPackages(_token?: CancellationToken): Promise<Package[]> {
        const reply = await fetch.default(`${this.registryUrl}/api/-/search?text=${this.query}`);
        const searchResult = await reply.json();

        const result = SearchResultRT.decode(searchResult);

        if (isLeft(result)) {
            throw new Error(`Invalid response in getPackages ${PathReporter.report(result).join(',')}`);
        }
        const typedResult: SearchResult = result.right;

        return typedResult.extensions.map(
            (entry) =>
                new Package(this, {
                    name: entry.name,
                    version: entry.version,
                    displayName: entry.displayName,
                    publisher: entry.namespace,
                    description: entry.description,
                    files: Object.values(entry.files),
                }),
        );
    }

    /**
     * Gets the release channels available for a package.
     *
     * This is a dictionary with channel names as keys and the latest version
     * in each channel as values.
     */
    async getPackageChannels(name: string): Promise<Record<string, VersionInfo>> {
        const versions = await this.getPackageVersions(name);
        versions.sort((a, b) => b.version.compare(a.version));
        return { release: versions[0] };
    }

    /**
     * Gets the list of available versions for a package.
     */
    async getPackageVersions(name: string): Promise<VersionInfo[]> {
        const [namespace, extension] = name.split('.');
        const reply = await fetch.default(`${this.registryUrl}/api/${namespace}/${extension}/versions`);
        const versionsResult = await reply.json();

        const result = VersionsResultRT.decode(versionsResult);

        if (isLeft(result)) {
            throw new Error(`Invalid response in getPackageVersions ${PathReporter.report(result).join(',')}`);
        }
        const typedResult: VersionsResult = result.right;

        const versions = Object.keys(typedResult.versions);
        return versions.map((version) => {
            return {
                version: new SemVer(version),
            };
        });
    }

    /**
     * Gets the version-specific metadata for a specific version of a package.
     *
     * If `version` is the name of a release channel, this gets the latest version in that channel.
     * If `version` is omitted, this gets the latest version for the user's selected channel.
     * @throws VersionMissingError if the given version does not exist.
     */
    async getPackage(name: string, version?: string): Promise<Package> {
        let query = `${this.registryUrl}/api/-/query?extensionName=${name}`;
        if (version) {
            query += `&extensionVersion=${version}`;
        }
        const reply = await fetch.default(query);
        const queryResult = await reply.json();

        const result = QueryResultRT.decode(queryResult);

        if (isLeft(result)) {
            throw new Error(`Invalid response in getPackage ${PathReporter.report(result).join(',')}`);
        }
        const typedResult: QueryResult = result.right;

        if (typedResult.extensions.length === 0) {
            throw new VersionMissingError(name, version ?? 'latest');
        }

        const packageInfo = {
            name: typedResult.extensions[0].name,
            version: typedResult.extensions[0].version,
            displayName: typedResult.extensions[0].displayName,
            publisher: typedResult.extensions[0].namespace,
            description: typedResult.extensions[0].description,
            files: typedResult.extensions[0].files ? Object.values(typedResult.extensions[0].files) : [],
        };
        return new Package(this, packageInfo);
    }

    /**
     * Gets whether this registry has the same Uri and filtering options as
     * another registry.
     */
    equals(other: Registry): boolean {
        return other.query === this.query && other.uri?.toString() === this.uri?.toString();
    }
}
