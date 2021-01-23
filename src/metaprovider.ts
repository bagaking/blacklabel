// import * as vscode from "vscode";
// import * as fs from "fs";
// import * as path from "path";

// export class DepNodeProvider implements vscode.TreeDataProvider<Meta> {
//   constructor(private workspaceRoot: string) {}
// }

// export class Meta extends vscode.TreeItem {
//   constructor(
//     public readonly label: string,
//     private readonly version: string,
//     public readonly collapsibleState: vscode.TreeItemCollapsibleState,
//     public readonly command?: vscode.Command
//   ) {
//     super(label, collapsibleState);

//     this.tooltip = `${this.label}-${this.version}`;
//     this.description = this.version;
//   }

//   iconPath = {
//     light: path.join(
//       __filename,
//       "..",
//       "..",
//       "resources",
//       "light",
//       "dependency.svg"
//     ),
//     dark: path.join(
//       __filename,
//       "..",
//       "..",
//       "resources",
//       "dark",
//       "dependency.svg"
//     ),
//   };

//   contextValue = "dependency";
// }
