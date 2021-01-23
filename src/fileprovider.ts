import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";
import * as fileop from "./common/fileop";

export class FileStat implements vscode.FileStat {
  constructor(private fsStat: fs.Stats) {}

  get type(): vscode.FileType {
    return this.fsStat.isFile()
      ? vscode.FileType.File
      : this.fsStat.isDirectory()
      ? vscode.FileType.Directory
      : this.fsStat.isSymbolicLink()
      ? vscode.FileType.SymbolicLink
      : vscode.FileType.Unknown;
  }

  get isFile(): boolean | undefined {
    return this.fsStat.isFile();
  }

  get isDirectory(): boolean | undefined {
    return this.fsStat.isDirectory();
  }

  get isSymbolicLink(): boolean | undefined {
    return this.fsStat.isSymbolicLink();
  }

  get size(): number {
    return this.fsStat.size;
  }

  get ctime(): number {
    return this.fsStat.ctime.getTime();
  }

  get mtime(): number {
    return this.fsStat.mtime.getTime();
  }
}

interface Entry {
  uri: vscode.Uri;
  type: vscode.FileType;
}

export class FileSystemProvider
  implements vscode.TreeDataProvider<Entry>, vscode.FileSystemProvider {
  private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;

  constructor() {
    this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  }

  get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  watch(
    uri: vscode.Uri,
    options: { recursive: boolean; excludes: string[] }
  ): vscode.Disposable {
    const watcher = fs.watch(
      uri.fsPath,
      { recursive: options.recursive },
      async (event: string, filename: string | Buffer) => {
        const filepath = path.join(
          uri.fsPath,
          fileop.normalizeNFC(filename.toString())
        );
        console.log("watch for " + filepath);

        // TODO support excludes (using minimatch library?)

        this._onDidChangeFile.fire([
          {
            type:
              event === "change"
                ? vscode.FileChangeType.Changed
                : (await fileop.exists(filepath))
                ? vscode.FileChangeType.Created
                : vscode.FileChangeType.Deleted,
            uri: uri.with({ path: filepath }),
          } as vscode.FileChangeEvent,
        ]);
      }
    );

    return { dispose: () => watcher.close() };
  }

  stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
    return this._stat(uri.fsPath);
  }

  async _stat(path: string): Promise<vscode.FileStat> {
    return new FileStat(await fileop.stat(path));
  }

  readDirectory(
    uri: vscode.Uri
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    return this._readDirectory(uri);
  }

  async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const children = await fileop.readdir(uri.fsPath);

    console.log("_readDirectory " + uri);

    const result: [string, vscode.FileType][] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const stat = await this._stat(path.join(uri.fsPath, child));
      result.push([child, stat.type]);
    }

    return Promise.resolve(result);
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    return fileop.mkdir(uri.fsPath);
  }

  readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
    return fileop.readfile(uri.fsPath);
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void | Thenable<void> {
    return this._writeFile(uri, content, options);
  }

  async _writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    const exists = await fileop.exists(uri.fsPath);
    if (!exists) {
      if (!options.create) {
        throw vscode.FileSystemError.FileNotFound();
      }

      await fileop.mkdir(path.dirname(uri.fsPath));
    } else {
      if (!options.overwrite) {
        throw vscode.FileSystemError.FileExists();
      }
    }

    return fileop.writefile(uri.fsPath, content as Buffer);
  }

  delete(
    uri: vscode.Uri,
    options: { recursive: boolean }
  ): void | Thenable<void> {
    if (options.recursive) {
      return fileop.rmrf(uri.fsPath);
    }

    return fileop.unlink(uri.fsPath);
  }

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): void | Thenable<void> {
    return this._rename(oldUri, newUri, options);
  }

  async _rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { overwrite: boolean }
  ): Promise<void> {
    const exists = await fileop.exists(newUri.fsPath);
    if (exists) {
      if (!options.overwrite) {
        throw vscode.FileSystemError.FileExists();
      } else {
        await fileop.rmrf(newUri.fsPath);
      }
    }

    const parentExists = await fileop.exists(path.dirname(newUri.fsPath));
    if (!parentExists) {
      await fileop.mkdir(path.dirname(newUri.fsPath));
    }

    return fileop.rename(oldUri.fsPath, newUri.fsPath);
  }

  // tree data provider

  async getChildren(element?: Entry): Promise<Entry[]> {
    if (element) {
      const children = await this.readDirectory(element.uri);
      return children.map(([name, type]) => ({
        uri: vscode.Uri.file(path.join(element.uri.fsPath, name)),
        type,
      }));
    }

    const workspaceFolder = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders.filter(
          (folder) => folder.uri.scheme === "file"
        )[0]
      : undefined;

    console.log(`workspaceFolder is ${workspaceFolder}`);

    if (workspaceFolder) {
      const children = await this.readDirectory(workspaceFolder.uri);
      children.sort((a, b) => {
        if (a[1] === b[1]) {
          return a[0].localeCompare(b[0]);
        }
        return a[1] === vscode.FileType.Directory ? -1 : 1;
      });
      return children.map(([name, type]) => ({
        uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)),
        type,
      }));
    }

    return [];
  }

  getTreeItem(element: Entry): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.uri,
      element.type === vscode.FileType.Directory
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    if (element.type === vscode.FileType.File) {
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

export class FileExplorer {
  constructor(context: vscode.ExtensionContext) {
    const treeDataProvider = new FileSystemProvider();
    context.subscriptions.push(
      vscode.window.createTreeView("panel-blacklabel", { treeDataProvider })
    );
    vscode.commands.registerCommand("fileExplorer.openFile", (resource) =>
      this.openResource(resource)
    );
  }

  private openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }
}
