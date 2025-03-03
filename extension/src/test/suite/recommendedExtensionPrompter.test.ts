import { expect } from 'chai';
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
        const installedExtension1 = 'recommendedPublisher1.recommendedExtension1';
        const installedExtension2 = 'recommendedPublisher2.recommendedExtension1';

        const registryProvider = sinon.createStubInstance(RegistryProvider);
        registryProvider.getRecommendedExtensions.returns(recommendedExtensions);

        const recommendedExtensionPrompter = new RecommendedExtensionPrompter(registryProvider, () => {
            return new Set([installedExtension1]);
        });

        const runCommandFake = sinon.stub(vscode.commands, 'executeCommand');
        const showInformationMessageFake = sinon.stub(vscode.window, 'showInformationMessage');

        runCommandFake.callsFake(async (command, arg) => {
            if (command === '_privateExtensionManager.remoteHelper.getExtension') {
                if (arg === installedExtension2) {
                    return {
                        id: installedExtension2,
                        extensionKind: vscode.ExtensionKind.UI,
                        packageJSON: undefined,
                    };
                }
            }
            return undefined;
        });

        showInformationMessageFake.callsFake((message) => {
            expect(message).to.have.string('recommendedPublisher1.recommendedExtension2');
            return new Promise((resolve) => {
                resolve(undefined);
            });
        });
        await recommendedExtensionPrompter.configurationChanged();

        sinon.restore();
    });
});
