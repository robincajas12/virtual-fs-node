const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'virtual-fs.toggleMode';
    statusBarItem.text = '$(edit) VFS: Edit';
    statusBarItem.show();

    // 1. Seleccionar Carpeta del Proyecto y autodetectar Mount Point
    let selectConfigDisposable = vscode.commands.registerCommand('virtual-fs.selectConfig', async function () {
        const projectUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Seleccionar Carpeta del Proyecto'
        });

        if (!projectUri || !projectUri[0]) return;
        const projectPath = projectUri[0].fsPath;
        const configPath = path.join(projectPath, '.super_md', 'config.json');

        if (!fs.existsSync(configPath)) {
            vscode.window.showErrorMessage('No se encontró .super_md/config.json. Ejecuta el motor en la terminal primero para configurar el proyecto.');
            return;
        }

        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const mountPoint = config.mountPoint;

            if (!mountPoint) {
                vscode.window.showErrorMessage('El config.json no tiene definido un mountPoint.');
                return;
            }

            await context.globalState.update('vfsMountPoint', mountPoint);

            // Abrir la carpeta de montaje
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(mountPoint));
            vscode.window.showInformationMessage(`VFS Inteligente cargado: ${mountPoint}`);
        } catch (err) {
            vscode.window.showErrorMessage('Error al leer la configuración: ' + err.message);
        }
    });

    let toggleModeDisposable = vscode.commands.registerCommand('virtual-fs.toggleMode', async function () {
        const mountPoint = context.globalState.get('vfsMountPoint');
        if (!mountPoint) {
            vscode.window.showErrorMessage('Primero selecciona un proyecto con "VFS: Select Config File"');
            return;
        }

        const modeFilePath = path.join(mountPoint, '.mode');
        try {
            const currentMode = fs.readFileSync(modeFilePath, 'utf8').trim();
            const newMode = currentMode === 'edit' ? 'exec' : 'edit';
            fs.writeFileSync(modeFilePath, newMode);
            
            statusBarItem.text = newMode === 'edit' ? '$(edit) VFS: Edit' : '$(zap) VFS: Exec';
            
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.fileName.endsWith('.super.md')) {
                await vscode.commands.executeCommand('workbench.action.files.revert');
            }
            vscode.window.showInformationMessage(`Modo VFS: ${newMode.toUpperCase()}`);
        } catch (err) {
            vscode.window.showErrorMessage('Error al cambiar modo: ' + err.message);
        }
    });

    context.subscriptions.push(selectConfigDisposable, toggleModeDisposable, statusBarItem);
}

module.exports = { activate, deactivate: () => {} }
