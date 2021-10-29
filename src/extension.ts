// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as cp from "child_process";

const execShell = (cmd: string) =>
  new Promise<string>((resolve, reject) => {
	cp.exec(cmd, (err, stdout, stderr) => {
	  if (err) {
		//return resolve(cmd + ' error!');
		return resolve(stderr);
	  }
	  return resolve(stdout);
	});
  });

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const channel = vscode.window.createOutputChannel('MadMachine');
	const terminal = vscode.window.createTerminal('MadMachine');
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "madmachine" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('madmachine.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from madmachine!');
	});
	context.subscriptions.push(disposable);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let buildCommand = vscode.commands.registerCommand('madmachine.build', async () => {

		//channel.clear();
		//channel.show();
		//const output = await execShell('python3 /Users/andy/swift-project/mm-sdk/mm/src/mm.py build');
		//const output = await execShell('pwd');
		//channel.append(output);	
		console.log('madmachine build')
		terminal.sendText('python3 /Users/andy/swift-project/mm-sdk/mm/src/mm.py build');
		//terminal.dispose();

	});
	context.subscriptions.push(buildCommand);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let downloadCommand = vscode.commands.registerCommand('madmachine.download', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Download from madmachine!');
	});
	context.subscriptions.push(downloadCommand);

}

// this method is called when your extension is deactivated
export function deactivate() {}
