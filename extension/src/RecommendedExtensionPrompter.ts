import * as vscode from 'vscode';
import * as nls from 'vscode-nls/node';

import * as install from './install';
import { getLogger } from './logger';
import { RegistryProvider } from './RegistryProvider';
import { toString } from './util';

const localize = nls.loadMessageBundle();

interface RemoteHelperExtensionInfo {
    id: string;
    extensionKind: vscode.ExtensionKind;
    packageJSON: any;
}

export class RecommendedExtensionPrompter implements vscode.Disposable {
    private readonly disposable: vscode.Disposable;

    public async isInstalledRemote(extension: string): Promise<boolean> {
        try {
            const extensionInfo = await vscode.commands.executeCommand<RemoteHelperExtensionInfo>(
                '_privateExtensionMarketplace.remoteHelper.getExtension',
                extension,
            );
            return extensionInfo !== undefined;
        } catch (ex) {
            getLogger().log(localize('warn.remote.helper.fail', 'Failed to call remote helper:\n{0}', toString(ex)));
            return false;
        }
    }

    public async removeInstalledExtensions(extensions: string[]): Promise<string[]> {
        const allLocallyInstalledExtensions = this.installedExtensionsProvider();
        const noLocalExtensions = extensions.filter((ext) => !allLocallyInstalledExtensions.has(ext));

        const remoteExtensionInstallInfo = await Promise.all(
            noLocalExtensions.map(async (ext) => {
                return {
                    name: ext,
                    installed: await this.isInstalledRemote(ext),
                };
            }),
        );

        const noExtensions = remoteExtensionInstallInfo.filter((ext) => !ext.installed).map((ext) => ext.name);

        return noExtensions;
    }

    public async configurationChanged() {
        const recommendedExtensions = [...this.registryProvider.getRecommendedExtensions()];
        const recommendedButNotInstalled = await this.removeInstalledExtensions(recommendedExtensions);
        if (recommendedButNotInstalled.length > 0) {
            const reply = await vscode.window.showInformationMessage(
                `Do you want to install the recommended extensions ${recommendedButNotInstalled.join(
                    ', ',
                )} for this repository`,
                'Install',
                'Show Recommendations',
            );
            if (reply === 'Install') {
                void vscode.window.showInformationMessage(`Installing ${recommendedButNotInstalled.join(', ')}`);
                await Promise.all(
                    recommendedButNotInstalled.map((ext) => install.installExtension(this.registryProvider, ext)),
                );
            } else if (reply === 'Show Recommendations') {
                await vscode.commands.executeCommand('privateExtensions.recommended.focus');
            }
        }
    }

    constructor(
        private readonly registryProvider: RegistryProvider,
        private readonly installedExtensionsProvider: () => Set<string>,
    ) {
        this.disposable = vscode.workspace.onDidChangeConfiguration(async (changeEvent) => {
            if (
                changeEvent.affectsConfiguration('privateExtensions') &&
                !vscode.workspace.getConfiguration('extensions').get<boolean>('ignoreRecommendations', false)
            ) {
                await this.configurationChanged();
            }
        });
        if (!vscode.workspace.getConfiguration('extensions').get<boolean>('ignoreRecommendations', false)) {
            void this.configurationChanged();
        }
    }

    public dispose(): void {
        this.disposable.dispose();
    }
}
