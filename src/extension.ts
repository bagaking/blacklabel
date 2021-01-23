// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { RepoExplorer } from "./repoExplorer";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "blacklabel" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand("blacklabel.helloWorld", () => {
      // The code you place here will be executed every time your command is executed

      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from blacklabel!");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("blacklabel.ask", async () => {
      const answer = await vscode.window.showInformationMessage(
        "Make a choice?",
        "a",
        "b"
      );
      if (answer === "a") {
        vscode.window.showInformationMessage(answer);
      } else {
        vscode.window.showInformationMessage("sorry for that");
      }
    })
  );

  new RepoExplorer(context);
  console.log("Congratulations, exporter is now active!");
}

// this method is called when your extension is deactivated
export function deactivate() {}
