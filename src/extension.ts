// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from "child_process";


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('activating...');
	if (!checkSdkVersion('0.9.3')) {
		vscode.window.showErrorMessage('Please update the MadMachine SDK');
		throw vscode.CancellationError;
	}

	let buildCommand = vscode.commands.registerCommand('madmachine.build', async () => {
		console.log('madmachine build');
		vscode.workspace.saveAll();
		const sdkPath = getSdkPath();
		const cmd = sdkPath + '/usr/mm/mm build';
		terminalExec(cmd);
	});
	context.subscriptions.push(buildCommand);


	let downloadCommand = vscode.commands.registerCommand('madmachine.download', async () => {
		console.log('madmachine download');
		const sdkPath = getSdkPath();
		const cmd = sdkPath + '/usr/mm/mm download';
		terminalExec(cmd);
	});
	context.subscriptions.push(downloadCommand);




	let copyCommand = vscode.commands.registerCommand('madmachine.copy', async () => {
		console.log('madmachine copy');

		const resourcePath = path.join(getRootPath(), './Resources');
		if (!fs.existsSync(resourcePath)) {
			vscode.window.showErrorMessage('This project does not include a Resources directory!');
			throw vscode.FileSystemError.FileNotFound();
		}
		console.log(resourcePath);

		const hasFile = containsFilesRecursiveSync(resourcePath);
		if (!hasFile) {
			vscode.window.showErrorMessage('No files exist in the Resources directory!');
			throw vscode.FileSystemError.FileNotFound();
		}

		const sdkPath = getSdkPath();
		var cmd = sdkPath + '/usr/mm/mm copy';

		var copyMode = await copyModePick();
		if (!copyMode) {
			throw vscode.CancellationError;
		}
		console.log(copyMode);
		
		copyMode = copyMode.toLowerCase();
		if (copyMode.includes('merge')) {
			cmd += ' -m merge';
		} else if (copyMode.includes('sync')) {
			cmd += ' -m sync';
		} else {
			throw vscode.CancellationError;
		}

		if (copyMode.includes('lfs')) {
			cmd += ' -d /lfs';
		} else if (copyMode.includes('sd')) {
			cmd += ' -d /SD:';
		} else {
			throw vscode.CancellationError;
		}

		console.log(cmd);
		terminalExec(cmd);
	});
	context.subscriptions.push(copyCommand);

	let newCommand = vscode.commands.registerCommand('madmachine.new', async () => {
		console.log('madmachine new project');
		const sdkPath = getSdkPath();
		const cmd = sdkPath + '/usr/mm/mm init';

		const projectType = await projectTypePick();
		if (!projectType) {
			throw vscode.CancellationError;
		}
		console.log(projectType);

		var boardName: string;
		if (projectType === 'executable') {
			boardName = await boardPick();
			if (!boardName) {
				throw vscode.CancellationError;
			}
			console.log(boardName);
		}

		const projectName = await projectNameInput();
		if (!projectName) {
			throw vscode.CancellationError;
		}
		console.log(projectName);

		vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true
		}).then( uris => {
			if (uris) {
				const projectPath = vscode.Uri.joinPath(uris[0], projectName).fsPath;
				console.log(projectPath);
				if (fs.existsSync(projectPath)) {
					vscode.window.showErrorMessage(projectPath + ' already exists');
					throw vscode.FileSystemError.FileExists(projectPath);
				}
				cp.execSync('mkdir ' + projectPath);

				var newCommand: string;
				if (projectType === 'executable') {
					newCommand = ('cd ' + projectPath + '; ' +
					cmd + ' -b ' + boardName + ' -t ' + projectType);
				} else {
					newCommand = ('cd ' + projectPath + '; ' +
					cmd + ' -t ' + projectType);
				}

				cp.execSync(newCommand);

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
		vscode.window.showErrorMessage('Only support macOS and Linux currently');
		throw vscode.CancellationError;
	}

	const sdkUri = vscode.Uri.parse(sdkPath);
	if (sdkPath === ''  || !fs.existsSync(sdkUri.fsPath)) {
		const errorMessage = 'Please specify the correct MadMachine SDK path in the VSCode settings';
		throw vscode.FileSystemError.FileNotADirectory(errorMessage);
	}
	return sdkUri.fsPath;
}

function checkSdkVersion(support: string): boolean {
	const sdkPath = getSdkPath();
	const cmd = sdkPath + '/usr/mm/mm --version';

	const current = cp.execSync(cmd).toString().trim();

	const supportVersion = support.split('.');
	const currentVersion = current.split('.');
	const count = supportVersion.length;

	console.log('Support sdk version: ' + String(supportVersion));
	console.log('Current sdk version: ' + String(currentVersion));

	for (let i = 0; i < count; i++) {
		let currenNum = Number(currentVersion[i]);
		let supportNum = Number(supportVersion[i]);

		if ((i === 0) && currenNum !== supportNum) {
			return false;
		}

		if (currenNum < supportNum) {
			return false;
		}
	}

	return true;
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

async function copyModePick() {
	const result = await vscode.window.showQuickPick(['Sync Resources to /lfs',
														'Merge Resources to /lfs',
														'Sync Resources to /SD:',
														'Merge Resources to /SD:'], {
		placeHolder: 'Select the copy mode and destination',
	});
    return <string>result;
}


async function projectTypePick() {
	const result = await vscode.window.showQuickPick(['executable', 'library'], {
		placeHolder: 'Select the project type',
	});
    return <string>result;
}

async function boardPick() {
	const result = await vscode.window.showQuickPick(['SwiftIOMicro', 'SwiftIOBoard'], {
		placeHolder: 'Select the board, you can change it later in the Package.mmp file',
	});
    return <string>result;
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

/**
 * Recursively checks whether the specified path and all its subdirectories contain any files.
 * @param folderPath The path of the folder to check.
 * @returns boolean Returns true if any file is found in the path or its subdirectories, otherwise false.
 */
const containsFilesRecursiveSync = (folderPath: string): boolean => {
	// Read the directory contents synchronously, including details of the entries
	const items = fs.readdirSync(folderPath, { withFileTypes: true });
  
	for (const item of items) {
	  if (item.isFile()) {
		// If an item is a file, return true immediately
		return true;
	  } else if (item.isDirectory()) {
		// If an item is a directory, recursively call this function
		const foundInSubdir = containsFilesRecursiveSync(path.join(folderPath, item.name));
		if (foundInSubdir) {
		  // If a file is found in a subdirectory, return true immediately
		  return true;
		}
	  }
	}
  
	// After checking all items and subdirectories, if no file is found, return false
	return false;
  };