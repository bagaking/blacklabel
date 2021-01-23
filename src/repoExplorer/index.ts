import * as vscode from "vscode";
import * as path from "path";
import { FileStat } from "../fileprovider";
import * as fileop from "../common/fileop";

export class RepoExplorer {
  constructor(context: vscode.ExtensionContext) {
    const treeDataProvider = new TreeDataProvider();

    [
      vscode.window.createTreeView("view-blacklabel", {
        treeDataProvider: treeDataProvider,
      }),
      vscode.window.registerTreeDataProvider(
        "view-blacklabel",
        treeDataProvider
      ),
      vscode.commands.registerCommand("fileExplorer.openFile", (resource) =>
        this.openResource(resource)
      ),
    ].forEach((v) => context.subscriptions.push(v));

    console.log("bind all");
  }

  private openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }
}

class Entry {

  public uri: vscode.Uri;
  public ext: string;
  public isDraftFolder: boolean;




  public stat: FileStat | null = null;
  public assetsPath: string | null = null;
  public inDraftFolder: boolean = false;


  constructor(public name: string, fsPath: string) {
    this.ext = path.extname(fsPath).toLowerCase();
    this.uri = vscode.Uri.file(fsPath);
    this.isDraftFolder = path.basename(fsPath).toLowerCase() === "draft"
  }

  async BuildInfo(): Promise<Entry> {
    this.stat = new FileStat(await fileop.stat(this.uri.fsPath));
    if(this.ext === ".md") {
      const assetsPath = this.uri.fsPath.slice(0, this.uri.fsPath.length - 3) + ".assets";
      if(await fileop.exists(assetsPath)) {
        this.assetsPath = assetsPath
      }
    }
    return this
  }
}

export class TreeDataProvider implements vscode.TreeDataProvider<Entry> {
  constructor() {}

  async readDirectory(uri: vscode.Uri, opt: {
      showOnlyMD? : boolean ,
      hideAssetsFolder?: boolean,
      upgradeShowDraft?: boolean
  } | null = null): Promise<Entry[]> {
    opt = opt || {};

    const children = await fileop.readdir(uri.fsPath);

    console.log("_readDirectory " + uri);
    const result: Entry[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const entry = await (new Entry(child, path.join(uri.fsPath, child))).BuildInfo();
      if (opt.showOnlyMD && entry.stat && entry.stat.type === vscode.FileType.File && entry.ext !== ".md") {
        continue // only show .md
      }
      if (opt.hideAssetsFolder && entry.stat && entry.stat.type === vscode.FileType.Directory && path.basename(entry.uri.fsPath).endsWith(".assets")) {
        continue
      }
      if (opt.upgradeShowDraft && entry.isDraftFolder) {
        result.push(... (await this.readDirectory(vscode.Uri.file(entry.uri.fsPath), opt)).map(v => (v.inDraftFolder = true) && v));
        continue
      }
      result.push(entry)
    }

    return Promise.resolve(result);
  }

  async _getEntryByWorkspace(wf: vscode.WorkspaceFolder): Promise<Entry> {
      return await (new Entry(wf.name, wf.uri.fsPath)).BuildInfo()
  }

  async getWorkSpaceChildren(): Promise<Entry[]> {
      const workspaceFolders: vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders
          ? vscode.workspace.workspaceFolders.filter(
              (folder) => folder.uri.scheme === "file"
          ): [];

      const result: Entry[] = [];

      if(workspaceFolders.length = 1) {
        let entWorkspace =  await this._getEntryByWorkspace(workspaceFolders[0]);
        let children = await this.getChildren(entWorkspace);
        entWorkspace.name += "[Workspace Root]";
        entWorkspace.stat = null;
        return [ entWorkspace, ... children ]
      }
      for (let i in workspaceFolders) {
        result.push(await this._getEntryByWorkspace(workspaceFolders[i]))
      }
      console.log("workspaces", workspaceFolders.map(wf => wf.uri.fsPath))
      return result
  }

  // tree data provider
  async getChildren(element?: Entry): Promise<Entry[]> {
    let children: Entry[] = [];
    if (element) {
      if(element.stat && element.stat.type === vscode.FileType.Directory) {
          children = await this.readDirectory(element.uri, {
            showOnlyMD:true,
            hideAssetsFolder:true,
            upgradeShowDraft: true
          });
      } else if(element.assetsPath) {
          children.push(... await this.readDirectory(vscode.Uri.file(element.assetsPath)))
      }
    } else {
      children = await this.getWorkSpaceChildren();
    }

    return children;
  }

  getTreeItem(element: Entry): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.uri,
        element.stat && (element.stat.type === vscode.FileType.Directory || element.assetsPath)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    treeItem.label = element.name;
    if(element.inDraftFolder) {
        treeItem.label += "[DRAFT]"
    }

    if (element.stat && element.stat.type === vscode.FileType.File) {
      treeItem.command = {
        command: "fileExplorer.openFile",
        title: "Open File",
        arguments: [element.uri],
      };
      treeItem.contextValue = "file";
    }
    return treeItem;
  }
}
