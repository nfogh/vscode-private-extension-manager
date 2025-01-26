import { assert } from 'chai';
import * as inspector from 'inspector';
import * as nock from 'nock';
import * as vscode from 'vscode';

import { VsxRegistry } from '../../VsxRegistry';
import { SearchResult } from '../../VsxRegistryTypes';

import 'source-map-support/register';

const REGISTRY_URL = 'https://registry.local';

function createFakeVSXServer(registryUrl: string): nock.Scope {
    const mock = nock(registryUrl);
    mock.persist();

    mock.get('/api/-/search')
        .query((query) => query.text === '')
        .reply(200, () => {
            return VSXSEARCH;
        });

    return mock;
}

suite('VSX Registry Package Search', function () {
    vscode.window.showInformationMessage(`Start ${this.title} tests`);

    test('search for all packages shall return all packages', async function () {
        if (inspector.url() !== undefined) {
            this.timeout(Infinity);
        }
        const fakeVsxRegistry = createFakeVSXServer(REGISTRY_URL);

        const registry = new VsxRegistry('FakeRegistry', '', REGISTRY_URL);
        const packages = await registry.getPackages();
        assert.equal(packages.length, 2);
        fakeVsxRegistry.done();
    });
});

/**
 * Mock search results for each package.
 */
const VSXSEARCH: SearchResult = {
    offset: 0,
    totalSize: 2,
    extensions: [
        {
            url: '/foo',
            files: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
            },
            name: 'foo',
            namespace: 'baz',
            version: '1.0.0',
            timestamp: '2021-01-01T00:00:00.000Z',
            verified: true,
        },
        {
            url: '/bar',
            files: {
                additionalProp1: 'string',
                additionalProp2: 'string',
                additionalProp3: 'string',
            },
            name: 'bar',
            namespace: 'baz',
            version: '2.0.0',
            timestamp: '2024-01-01T00:00:00.000Z',
            verified: true,
        },
    ],
};
