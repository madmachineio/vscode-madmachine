// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as cp from "child_process";



// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	getSdkPath();

	let buildCommand = vscode.commands.registerCommand('madmachine.build', async () => {
		console.log('madmachine build');
		vscode.workspace.saveAll();
		const sdkPath = getSdkPath();
		const cmd = 'python3 ' + sdkPath + '/mm/src/mm.py build';
		terminalExec(cmd);
	});
	context.subscriptions.push(buildCommand);


	let downloadCommand = vscode.commands.registerCommand('madmachine.download', async () => {
		console.log('madmachine download');
		const sdkPath = getSdkPath();
		const cmd = 'python3 ' + sdkPath + '/mm/src/mm.py download';
		terminalExec(cmd);
	});
	context.subscriptions.push(downloadCommand);

	let newCommand = vscode.commands.registerCommand('madmachine.new', async () => {
		console.log('madmachine new project');
		const sdkPath = getSdkPath();
		const cmd = 'python3 ' + sdkPath + '/mm/src/mm.py init';

		const projectType = await projectTypePick();
		console.log(projectType)
		if (!projectType) {
			throw vscode.CancellationError;
		}

		const boardName = await boardPick();
		console.log(boardName);
		if (!boardName) {
			throw vscode.CancellationError;
		}

		const projectName = await projectNameInput();
		console.log(projectName);
		if (!projectName) {
			throw vscode.CancellationError;
		}

		vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true
		}).then( uris => {
			if (uris) {
				const projectPath = vscode.Uri.joinPath(uris[0], projectName).fsPath;
				console.log(projectPath);
				cp.execSync('mkdir ' + projectPath);
				cp.execSync('cd ' + projectPath + '; ' +
						cmd + ' -b ' + boardName + ' -t ' + projectType);

				vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.parse(projectPath), true);
			}
		});
	});
	context.subscriptions.push(newCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function terminalExec(cmd: string) {
	const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;

	let terminal = terminals.find(t => 
		t.name === 'MadMachine'
	);

	if (!terminal) {
		terminal = vscode.window.createTerminal('MadMachine');
	} else {
		const rootPath = getRootPath();
		terminal.sendText('cd ' + rootPath);
	}

	terminal.sendText('clear');
	terminal.sendText(cmd);
	terminal.show();
}

function getSdkPath(): string {
	const platform = process.platform;
	const workspaceSettings = vscode.workspace.getConfiguration('madmachine');
	let sdkPath: string = '';

	if (platform === 'darwin')	{
		sdkPath = workspaceSettings.sdk.mac;
	} else if (platform === 'linux') {
		sdkPath = workspaceSettings.sdk.linux;
	} else {
		sdkPath = '';
	}

	const sdkUri = vscode.Uri.parse(sdkPath);
	if (sdkPath === ''  || !fs.existsSync(sdkUri.fsPath)) {
		const errorMessage = 'Please specify the correct MadMachine SDK path in the VSCode settings';
		throw vscode.FileSystemError.FileNotADirectory(errorMessage);
	}
	return sdkUri.fsPath;
}

function getRootPath(): string {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	let rootPath;

	if (workspaceFolders) {
		rootPath = workspaceFolders[0].uri.fsPath;
	} else {
		const errorMessage = 'Not a MadMachine project path';
		throw vscode.FileSystemError.Unavailable(errorMessage);
	}

	return rootPath;
}


async function projectTypePick() {
	const result = await vscode.window.showQuickPick(['executable', 'library'], {
		placeHolder: 'Choose the project type',
	});
    return result;
}

async function boardPick() {
	const result = await vscode.window.showQuickPick(['SwiftIOFeather', 'SwiftIOBoard'], {
		placeHolder: 'Choose the board, you could change it in the Packae.mmp later',
	});
    return result;
}

async function projectNameInput() {
	const result = await vscode.window.showInputBox({
		prompt: 'Project Name',
		validateInput: text => {
			return text.indexOf(' ') !== -1  ? 'Space is not allowed' : null;
		}
	});

	return result;
}