import * as vscode from 'vscode';
import * as nls from 'vscode-nls/node';

import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import { setContext } from './context';
import { ExtensionInfoService } from './extensionInfo';
import { ExtensionsFileFeatures } from './extensionsFileFeatures';
import { RecommendedExtensionPrompter } from './RecommendedExtensionPrompter';
import { RegistryProvider } from './RegistryProvider';
import { UpdateChecker } from './UpdateChecker';
import { deleteNpmDownloads } from './util';
import { RegistryView } from './views/registryView';

nls.config({ messageFormat: nls.MessageFormat.file })();

let isActive = false;

async function setActive(active: boolean): Promise<void> {
    isActive = active;
    await vscode.commands.executeCommand('setContext', 'privateExtensions:active', active);
}

async function doActivate(context: vscode.ExtensionContext) {
    const extensionInfo = new ExtensionInfoService();
    const registryProvider = new RegistryProvider(extensionInfo);
    const registryView = new RegistryView(registryProvider, extensionInfo);
    const updateChecker = new UpdateChecker(registryProvider, extensionInfo);
    const recommendedExtensionPrompter = new RecommendedExtensionPrompter(registryProvider, () => {
        return new Set(vscode.extensions.all.map((ext) => ext.id));
    });

    context.subscriptions.push(
        extensionInfo,
        registryProvider,
        registryView,
        updateChecker,
        registerCommands(registryProvider, registryView, updateChecker, extensionInfo),
        registerLanguageFeatures(registryProvider),
        recommendedExtensionPrompter,
    );

    await setActive(true);
}

async function doDeactivate() {
    await setActive(false);
    // TODO: should we have some sort of lock file or ref count so we don't
    // delete the cache if another instance of vscode is still active?
    await deleteNpmDownloads();
}

async function shouldBeActive(): Promise<boolean> {
    return (
        vscode.workspace.getConfiguration('privateExtensions').has('registries') ||
        (await vscode.workspace.findFiles('.vscode/extensions.private.json')).length !== 0
    );
}

async function handleActivation(context: vscode.ExtensionContext) {
    if (!isActive && (await shouldBeActive())) {
        await doActivate(context);
    } else if (isActive && !(await shouldBeActive())) {
        await doDeactivate();
    }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    setContext(context);

    await handleActivation(context);
    vscode.workspace.onDidChangeConfiguration(async (configurationChangedEvent) => {
        if (configurationChangedEvent.affectsConfiguration('privateExtensions')) {
            await handleActivation(context);
        }
    });
}

export async function deactivate(): Promise<void> {
    await doDeactivate();
}

function registerCommands(
    registryProvider: RegistryProvider,
    registryView: RegistryView,
    updateChecker: UpdateChecker,
    extensionInfo: ExtensionInfoService,
): vscode.Disposable {
    const commandManager = new CommandManager();

    commandManager.register(
        // Update commands
        new commands.CheckForUpdatesCommand(updateChecker),
        new commands.UpdateAllExtensionsCommand(updateChecker),

        // Extension commands
        new commands.ShowExtensionCommand(registryView),
        new commands.InstallExtensionCommand(registryProvider, extensionInfo),
        new commands.UpdateExtensionCommand(registryProvider, extensionInfo),
        new commands.UninstallExtensionCommand(extensionInfo),
        new commands.InstallAnotherVersionCommand(registryProvider),
        new commands.SwitchChannelsCommand(registryProvider),
        new commands.CopyExtensionInformationCommand(),

        // Registry commands
        new commands.AddUserRegistryCommand(registryProvider),
        new commands.RemoveUserRegistryCommand(registryProvider),

        // Tree view commands
        new commands.RefreshCommand(registryView),

        // Configuration commands
        new commands.ConfigureWorkspaceRegistries(),
        new commands.ConfigureRecommendedExtensions(),

        // Other commands
        new commands.DeleteCacheCommand(),
        new commands.GarbageCollectCacheCommand(),
    );

    return commandManager;
}

function registerLanguageFeatures(registryProvider: RegistryProvider): vscode.Disposable {
    return vscode.Disposable.from(new ExtensionsFileFeatures(registryProvider));
}
