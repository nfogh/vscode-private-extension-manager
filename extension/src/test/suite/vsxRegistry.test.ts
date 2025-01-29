import { assert } from 'chai';
import * as inspector from 'inspector';
import { before, after } from 'mocha';
import * as nock from 'nock';
import { SemVer } from 'semver';
import * as vscode from 'vscode';

import { VsxRegistry } from '../../VsxRegistry';
import { SearchEntry, SearchResult, QueryEntry, QueryResult, VersionsResult } from '../../VsxRegistryTypes';

import 'source-map-support/register';

const REGISTRY_URL = 'https://registry.local';

function createFakeVSXServer(registryUrl: string): nock.Scope {
    const mock = nock(registryUrl);
    mock.persist();

    mock.get('/api/-/search')
        .query((query) => query.text === '')
        .reply(200, () => {
            return makeSearchResult([FOOEXTENSION, BAREXTENSION]);
        });

    mock.get('/api/-/search')
        .query((query) => query.text === 'foo')
        .reply(200, () => {
            return makeSearchResult([FOOEXTENSION]);
        });

    mock.get('/api/-/search')
        .query((query) => query.text === 'bar')
        .reply(200, () => {
            return makeSearchResult([BAREXTENSION]);
        });

    mock.get('/api/-/search')
        .query((query) => query.text !== 'bar' && query.text !== 'foo' && query.text !== '')
        .reply(200, () => {
            return makeSearchResult([]);
        });

    mock.get('/api/-/query')
        .query((query) => query.extensionName === 'foo')
        .reply(200, () => {
            return makeQueryResult(FOOEXTENSION_QUERY);
        });

    mock.get('/api/baz/foo/versions').reply(200, () => {
        const versions: VersionsResult = {
            offset: 0,
            totalSize: 2,
            versions: {
                '1.0.0': 'https://example.com/foo/1.0.0',
                '1.0.1': 'https://example.com/foo/1.0.1',
            },
        };
        return versions;
    });

    return mock;
}

suite('VSX Registry Package Search', function () {
    vscode.window.showInformationMessage(`Start ${this.title} tests`);

    let fakeVsxRegistry: nock.Scope;

    before(() => {
        fakeVsxRegistry = createFakeVSXServer(REGISTRY_URL);
        if (inspector.url() !== undefined) {
            this.timeout(Infinity);
        }
    });

    after(() => {
        fakeVsxRegistry.removeAllListeners();
    });

    test('search for all packages shall return all packages', async function () {
        const registry = new VsxRegistry('FakeRegistry', '', REGISTRY_URL);
        const packages = await registry.getPackages();
        assert.equal(packages.length, 2);
    });

    test('search for packages with the query foo shall return only foo', async function () {
        const registry = new VsxRegistry('FakeRegistry', 'foo', REGISTRY_URL);
        const packages = await registry.getPackages();
        assert.equal(packages.length, 1);
        assert.equal(packages[0].name, 'foo');
    });

    test('search for packages with the query for unknown package shall return empty set', async function () {
        const registry = new VsxRegistry('FakeRegistry', 'unknown', REGISTRY_URL);
        const packages = await registry.getPackages();
        assert.equal(packages.length, 0);
    });

    test('get metadata for a package shall return the metadata', async function () {
        const registry = new VsxRegistry('FakeRegistry', 'unknown', REGISTRY_URL);
        const packageData = await registry.getPackage('foo', '1.0.0');
        assert.equal(packageData.name, 'foo');
    });

    test('get versions of a package', async function () {
        const registry = new VsxRegistry('FakeRegistry', 'unknown', REGISTRY_URL);
        const versions = await registry.getPackageVersions('baz.foo');
        assert.equal(versions.length, 2);
        assert.containSubset(versions, [{ version: new SemVer('1.0.1') }, { version: new SemVer('1.0.0') }]);
    });

    test('getPackageChannels shall return latest version for release and prerelease channels', async function () {
        const registry = new VsxRegistry('FakeRegistry', 'unknown', REGISTRY_URL);
        const channels = await registry.getPackageChannels('baz.foo');
        assert.containSubset(channels, { release: { version: new SemVer('1.0.1') } });
    });
});

/**
 * Mock search results for each package.
 */
const FOOEXTENSION: SearchEntry = {
    url: '/foo',
    files: {
        download: 'https://example.com/foo',
        icon: 'https://example.com/foo/icon.png',
        sha256: 'https://example.com/foo/sha256',
    },
    name: 'foo',
    namespace: 'baz',
    version: '1.0.0',
    timestamp: '2021-01-01T00:00:00.000Z',
    verified: true,
};

const BAREXTENSION: SearchEntry = {
    url: '/bar',
    files: {
        download: 'https://example.com/bar',
        icon: 'https://example.com/bar/icon.png',
        sha256: 'https://example.com/bar/sha256',
    },
    name: 'bar',
    namespace: 'baz',
    version: '2.0.0',
    timestamp: '2024-01-01T00:00:00.000Z',
    verified: true,
};

function makeSearchResult(searchEntries: SearchEntry[]): SearchResult {
    return {
        offset: 0,
        totalSize: searchEntries.length,
        extensions: searchEntries,
    };
}

const FOOEXTENSION_QUERY: QueryEntry = {
    name: 'foo',
    namespaceUrl: 'https://example.com/foo/namespace',
    reviewsUrl: 'https://example.com/foo/reviews',
    publishedBy: { loginName: 'foo' },
    namespaceDisplayName: 'Foo',
    namespace: 'baz',
    version: '1.0.0',
    timestamp: '2021-01-01T00:00:00.000Z',
    verified: true,
    allVersionsUrl: '/foo/all',
    averageRating: 5.0,
    reviewCount: 1,
    downloadCount: 100,
    displayName: 'Foo Extension',
    description: 'This is a foo extension',
    deprecated: false,
};

function makeQueryResult(extension: QueryEntry): QueryResult {
    return {
        offset: 0,
        totalSize: 1,
        extensions: [extension],
    };
}
