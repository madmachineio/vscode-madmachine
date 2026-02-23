// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from "child_process";
import * as util from "util";


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('activating...');

	const supportedVersion = '0.9.3';
	const suggestedVersion = '2.0.0';

	let currentVersion = '';
	try {
		currentVersion = await getCurrentSdkVersion();
	} catch (error) {
		vscode.window.showErrorMessage('Failed to detect MadMachine SDK version. Please verify your SDK path.');
		throw error;
	}

	if (!checkSdkVersion(currentVersion, supportedVersion)) {
		vscode.window.showErrorMessage('Please update the MadMachine SDK to ' + supportedVersion + ' or newer');
		throw new vscode.CancellationError();
	}

	let newCommand = vscode.commands.registerCommand('madmachine.new', async () => {
		try {
			console.log('madmachine new project');
			const toolchainPath = getToolchainPath();

			const projectType = await projectTypePick();
			if (!projectType) {
				return;
			}
			console.log(projectType);

			let boardName: string | undefined;
			if (projectType === 'executable') {
				boardName = await boardPick();
				if (!boardName) {
					return;
				}
				console.log(boardName);
			}

			const projectName = await projectNameInput();
			if (!projectName) {
				return;
			}
			console.log(projectName);

			const uris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true
			});
			if (!uris || uris.length === 0) {
				return;
			}

			const projectPath = vscode.Uri.joinPath(uris[0], projectName).fsPath;
			console.log(projectPath);
			if (fs.existsSync(projectPath)) {
				vscode.window.showErrorMessage(projectPath + ' already exists');
				throw vscode.FileSystemError.FileExists(projectPath);
			}

			await fs.promises.mkdir(projectPath);

			const args = ['init', '-t', projectType];
			if (projectType === 'executable' && boardName) {
				args.push('-b', boardName);
			}
			if (checkSdkVersion(currentVersion, suggestedVersion) && toolchainPath) {
				args.push('--toolchain', toolchainPath);
			}

			await execMmCommand(args, projectPath);
			vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
		} catch (error) {
			console.error(error);
			if (error instanceof vscode.CancellationError) return;
			vscode.window.showErrorMessage('Failed to create project. Check the output and settings.');
			throw error;
		}
	});
	context.subscriptions.push(newCommand);

	let buildCommand = vscode.commands.registerCommand('madmachine.build', async () => {
		console.log('madmachine build');
		vscode.workspace.saveAll();
		const toolchainPath = getToolchainPath();

		const args = ['build'];

		if (checkSdkVersion(currentVersion, suggestedVersion)) {
			if (toolchainPath) {
				args.push('--toolchain', toolchainPath);
			}
		}

		terminalExec(buildMmCommand(args));
	});
	context.subscriptions.push(buildCommand);


	let downloadCommand = vscode.commands.registerCommand('madmachine.download', async () => {
		console.log('madmachine download');
		terminalExec(buildMmCommand(['download']));
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

		const args = ['copy'];

		var copyMode = await copyModePick();
		if (!copyMode) {
			throw vscode.CancellationError;
		}
		console.log(copyMode);
		
		copyMode = copyMode.toLowerCase();
		if (copyMode.includes('merge')) {
			args.push('-m', 'merge');
		} else if (copyMode.includes('sync')) {
			args.push('-m', 'sync');
		} else {
			throw new vscode.CancellationError();
		}

		if (copyMode.includes('lfs')) {
			args.push('-d', '/lfs');
		} else if (copyMode.includes('sd')) {
			args.push('-d', '/SD:');
		} else {
			throw new vscode.CancellationError();
		}

		console.log(buildMmCommand(args));
		terminalExec(buildMmCommand(args));
	});
	context.subscriptions.push(copyCommand);
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

const execFileAsync = util.promisify(cp.execFile);

function getMmPath(): string {
	const sdkPath = getSdkPath();
	return path.join(sdkPath, 'usr', 'mm', 'mm');
}

async function execMmCommand(args: string[], cwd?: string): Promise<string> {
	const mmPath = getMmPath();
	const result = await execFileAsync(mmPath, args, { cwd });
	return result.stdout.toString().trim();
}

function quoteForShell(value: string): string {
	const escaped = value.replace(/(["\\$`])/g, '\\$1');
	return `"${escaped}"`;
}

function buildMmCommand(args: string[]): string {
	const mmPath = getMmPath();
	const parts = [quoteForShell(mmPath), ...args.map(quoteForShell)];
	return parts.join(' ');
}

function getSdkPath(): string {
  const platform = process.platform;
  const config = vscode.workspace.getConfiguration('madmachine');

  let sdkPath = '';

  if (platform === 'darwin') {
    sdkPath = config.get<string>('sdk.mac', '');
  } else if (platform === 'linux') {
    sdkPath = config.get<string>('sdk.linux', '');
  } else if (platform === 'win32') {
    sdkPath = config.get<string>('sdk.windows', '');
  } else {
    vscode.window.showErrorMessage(`Unsupported platform: ${platform}`);
    throw new Error(`Unsupported platform: ${platform}`);
  }

  sdkPath = sdkPath.trim();
  console.log('sdk path setting:', sdkPath);

  // Empty means "not set"
  if (!sdkPath) {
    const msg = 'Please set the MadMachine SDK path in the VS Code settings.';
    vscode.window.showErrorMessage(msg);
    throw vscode.FileSystemError.FileNotFound(msg);
  }

  // Local filesystem path -> use Uri.file(), not Uri.parse()
  const sdkUri = vscode.Uri.file(sdkPath);

  // Build the expected mm path in a platform-safe way
  const mmFsPath = path.join(sdkUri.fsPath, 'usr', 'mm', 'mm');
  const mmUri = vscode.Uri.file(mmFsPath);

  // Validate: SDK directory exists, and mm exists
  if (!fs.existsSync(sdkUri.fsPath) || !fs.existsSync(mmUri.fsPath)) {
    const msg =
      'Please ensure the correct MadMachine SDK path is configured in your VS Code settings.';
    vscode.window.showErrorMessage(msg);
    throw vscode.FileSystemError.FileNotFound(msg);
  }

  return sdkUri.fsPath;
}

function getToolchainPath(): string | undefined {
  const platform = process.platform;
  const config = vscode.workspace.getConfiguration('madmachine');

  let toolchainPath = '';

  if (platform === 'darwin') {
    toolchainPath = config.get<string>('toolchain.mac', '');
  } else if (platform === 'linux') {
    toolchainPath = config.get<string>('toolchain.linux', '');
  } else if (platform === 'win32') {
    toolchainPath = config.get<string>('toolchain.windows', '');
  }

  toolchainPath = toolchainPath.trim();
  console.log('Swift toolchain path setting:', toolchainPath);

  // 1) Empty means "not set"
  if (!toolchainPath) return undefined;

  // 2) This is a local filesystem path, so use Uri.file() (NOT Uri.parse())
  const toolchainUri = vscode.Uri.file(toolchainPath);

  // 3) If the path does not exist, treat it as invalid and fall back to default
  if (!fs.existsSync(toolchainUri.fsPath)) {
    vscode.window.showWarningMessage(
      `Swift toolchain path does not exist: ${toolchainUri.fsPath}. Using the default toolchain.`
    );
    return undefined;
  }

  return toolchainUri.fsPath;
}

async function getCurrentSdkVersion(): Promise<string> {
	const output = await execMmCommand(['--version']);
	return output.trim();
}

function checkSdkVersion(current: string, support: string): boolean {

	const currentVersion = parseVersion(current);
	const supportVersion = parseVersion(support);
	const count = Math.max(currentVersion.length, supportVersion.length);

	console.log('Current sdk version: ' + String(currentVersion));
	console.log('Support sdk version: ' + String(supportVersion));

	for (let i = 0; i < count; i++) {
		const currenNum = currentVersion[i] ?? 0;
		const supportNum = supportVersion[i] ?? 0;

		if ((i === 0) && currenNum > supportNum) {
			return true;
		}

		if (currenNum < supportNum) {
			console.log('false support %d, current: %d', supportNum, currenNum);
			return false;
		}
	}

	return true;
}

function parseVersion(version: string): number[] {
	return version
		.split('.')
		.map(part => {
			const match = part.match(/^\d+/);
			return match ? Number(match[0]) : 0;
		});
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
