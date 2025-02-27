import sinon = require('sinon');
import * as vscode from 'vscode';

import { RecommendedExtensionPrompter } from '../../RecommendedExtensionPrompter';
import { RegistryProvider } from '../../RegistryProvider';

// Test suite should be run inside workspace test-fixtures/fixture1
suite('RecommendedExtensionPrompter', function () {
    test('Shall suggest recommended extensions that are not installed', async function () {
        const recommendedExtensions = new Set([
            'recommendedPublisher1.recommendedExtension1',
            'recommendedPublisher1.recommendedExtension2',
            'recommendedPublisher2.recommendedExtension1',
        ]);
        const installedExtensions = new Set(['recommendedPublisher1.recommendedExtension1']);

        const registryProvider = sinon.createStubInstance(RegistryProvider);
        registryProvider.getRecommendedExtensions.returns(recommendedExtensions);
        const installedExtensionsProvider = () => {
            return installedExtensions;
        };

        const recommendedExtensionPrompter = new RecommendedExtensionPrompter(
            registryProvider,
            installedExtensionsProvider,
        );

        sinon
            .mock(vscode.window)
            .expects('showInformationMessage')
            .withArgs(
                sinon
                    .match('recommendedPublisher1.recommendedExtension2')
                    .and(sinon.match('recommendedPublisher2.recommendedExtension1')),
            );

        await recommendedExtensionPrompter.configurationChanged();
    });
});
