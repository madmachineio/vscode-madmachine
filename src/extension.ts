// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let buildCommand = vscode.commands.registerCommand('madmachine.build', async () => {
		console.log('madmachine build');
		vscode.workspace.saveAll();
		const sdkPath = getSdkPath();
		const cmd = 'python3 ' + sdkPath + '/mm/src/mm.py build';
		madmachineExec(cmd);
	});
	context.subscriptions.push(buildCommand);


	let downloadCommand = vscode.commands.registerCommand('madmachine.download', async () => {
		console.log('madmachine download');
		const sdkPath = getSdkPath();
		const cmd = 'python3 ' + sdkPath + '/mm/src/mm.py download';
		madmachineExec(cmd);
	});
	context.subscriptions.push(downloadCommand);

	let newCommand = vscode.commands.registerCommand('madmachine.new', () => {
		console.log('madmachine new project');
		const sdkPath = getSdkPath();
		const cmd = 'python3 ' + sdkPath + '/mm/src/mm.py download';
	});
	context.subscriptions.push(newCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function getMadMachineTerminal(): vscode.Terminal {
	const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;

	const terminal = terminals.find(t => 
		t.name === 'MadMachine'
	);

	if (terminal === undefined) {
		return vscode.window.createTerminal('MadMachine');
	}

	return terminal;
}


function madmachineExec(cmd: string) {
	const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;

	let terminal = terminals.find(t => 
		t.name === 'MadMachine'
	);

	if (terminal === undefined) {
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
	let path: string = '';

	if (platform === 'darwin')	{
		path = workspaceSettings.sdk.mac;
	} else if (platform === 'linux') {
		path = workspaceSettings.sdk.linux;
	}

	return path;
}

function getRootPath(): string {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders) {
		return workspaceFolders[0].uri.path;
	} else {
		return '';
	}
}