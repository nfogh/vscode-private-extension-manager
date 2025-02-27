import * as vscode from 'vscode';

import * as install from './install';
import { RegistryProvider } from './RegistryProvider';

export class RecommendedExtensionPrompter implements vscode.Disposable {
    private readonly disposable: vscode.Disposable;

    public async configurationChanged() {
        const recommendedExtensions = this.registryProvider.getRecommendedExtensions();
        const allExtensions = this.installedExtensionsProvider();
        const recommendedButNotInstalled = [...recommendedExtensions].filter((ext) => !allExtensions.has(ext));
        if (recommendedButNotInstalled.length > 0) {
            const reply = await vscode.window.showInformationMessage(
                `Do you want to install the recommended extensions ${recommendedButNotInstalled.join(
                    ', ',
                )} for this repository`,
                'Install',
                'Show Recommendations',
            );
            if (reply === 'Install') {
                vscode.window.showInformationMessage(`Installing ${recommendedButNotInstalled.join(', ')}`);
                for (const ext of recommendedButNotInstalled) {
                    install.installExtension(this.registryProvider, ext);
                }
            } else if (reply === 'Show Recommendations') {
                vscode.commands.executeCommand('privateExtensions.recommended.focus');
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
            this.configurationChanged();
        }
    }

    public dispose(): void {
        this.disposable.dispose();
    }
}
