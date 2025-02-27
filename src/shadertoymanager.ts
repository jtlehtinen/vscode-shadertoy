'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RenderStartingData, DiagnosticBatch } from './typenames';
import { WebviewContentProvider } from './webviewcontentprovider';
import { Context } from './context';
import { removeDuplicates } from './utility';

type Webview = {
  Panel: vscode.WebviewPanel;
  OnDidDispose: () => void;
};
type StaticWebview = Webview & {
  Document: vscode.TextDocument;
};

function basenameForEditor(editor: vscode.TextEditor | undefined): string {
  const basename = editor !== undefined ? path.basename(editor.document.fileName) : '';
  return basename;
}

export class ShaderToyManager {
  context: Context;

  startingData = new RenderStartingData();

  webviewPanel: Webview | undefined;
  staticWebviews: StaticWebview[] = [];

  constructor(context: Context) {
    this.context = context;
  }

  public migrateToNewContext = (context: Context) => {
    this.context = context;
    if (this.webviewPanel && this.context.activeEditor) {
      this.updateWebview(this.webviewPanel, this.context.activeEditor.document);
    }
    for (let staticWebview of this.staticWebviews) {
      this.updateWebview(staticWebview, staticWebview.Document);
    }
  };

  public showDynamicPreview = () => {
    if (this.context.getConfig<boolean>('reloadOnChangeEditor') !== true) {
      this.context.activeEditor = vscode.window.activeTextEditor;
    }

    if (this.webviewPanel) {
      this.webviewPanel.Panel.dispose();
    }

    const basename = basenameForEditor(this.context.activeEditor);
    let newWebviewPanel = this.createWebview(`Preview ${basename}`, undefined);

    this.webviewPanel = {
      Panel: newWebviewPanel,
      OnDidDispose: () => {
        this.webviewPanel = undefined;
      },
    };
    newWebviewPanel.onDidDispose(this.webviewPanel.OnDidDispose);
    if (this.context.activeEditor !== undefined) {
      this.webviewPanel = this.updateWebview(this.webviewPanel, this.context.activeEditor.document);
    } else {
      vscode.window.showErrorMessage('Select a TextEditor to show GLSL Preview.');
    }
  };

  public showStaticPreview = () => {
    if (vscode.window.activeTextEditor !== undefined) {
      let document = vscode.window.activeTextEditor.document;
      if (
        this.staticWebviews.find((webview: StaticWebview) => {
          return webview.Document === document;
        }) === undefined
      ) {
        const basename = basenameForEditor(this.context.activeEditor);
        let newWebviewPanel = this.createWebview(`Preview (static) ${basename}`, undefined);

        let onDidDispose = () => {
          const staticWebview = this.staticWebviews.find((webview: StaticWebview) => {
            return webview.Panel === newWebviewPanel;
          });
          if (staticWebview !== undefined) {
            const index = this.staticWebviews.indexOf(staticWebview);
            this.staticWebviews.splice(index, 1);
          }
        };
        this.staticWebviews.push({
          Panel: newWebviewPanel,
          OnDidDispose: onDidDispose,
          Document: document,
        });
        let staticWebview = this.staticWebviews[this.staticWebviews.length - 1];
        this.staticWebviews[this.staticWebviews.length - 1] = this.updateWebview(
          staticWebview,
          vscode.window.activeTextEditor.document,
        );
        newWebviewPanel.onDidDispose(onDidDispose);
      }
    }
  };

  public createPortablePreview = () => {
    if (vscode.window.activeTextEditor !== undefined) {
      let document = vscode.window.activeTextEditor.document;
      let webviewContentProvider = new WebviewContentProvider(
        this.context,
        document.getText(),
        document.fileName,
      );
      webviewContentProvider.parseShaderTree(false);
      let htmlContent = webviewContentProvider.generateWebviewContent(undefined, this.startingData);
      let originalFileExt = path.extname(document.fileName);
      let previewFilePath = document.fileName.replace(originalFileExt, '.html');
      fs.writeFileSync(previewFilePath, htmlContent);
    }
  };

  public onReloadDocument = (document: vscode.TextDocument) => {
    if (this.context.getConfig<boolean>('reloadAutomatically')) {
      const staticWebview = this.staticWebviews.find((webview: StaticWebview) => {
        return webview.Document === document;
      });
      const isActiveDocument =
        this.context.activeEditor !== undefined && document === this.context.activeEditor.document;
      if (isActiveDocument || staticWebview !== undefined) {
        if (this.webviewPanel !== undefined && this.context.activeEditor !== undefined) {
          this.webviewPanel = this.updateWebview(
            this.webviewPanel,
            this.context.activeEditor.document,
          );
        }

        this.staticWebviews.map((staticWebview: StaticWebview) =>
          this.updateWebview(staticWebview, staticWebview.Document),
        );
      }
    }
  };

  public onEditorChanged = (newEditor: vscode.TextEditor | undefined) => {
    if (
      newEditor !== undefined &&
      newEditor.document.getText() !== '' &&
      newEditor !== this.context.activeEditor
    ) {
      this.context.activeEditor = newEditor;

      if (
        this.context.getConfig<boolean>('reloadAutomatically') &&
        this.context.getConfig<boolean>('reloadOnChangeEditor')
      ) {
        if (this.context.getConfig<boolean>('resetStateOnChangeEditor')) {
          this.resetStartingData();
        }
        if (this.webviewPanel !== undefined) {
          this.webviewPanel = this.updateWebview(
            this.webviewPanel,
            this.context.activeEditor.document,
          );
        }
      }
    }
  };

  public postCommand = (command: string) => {
    if (this.webviewPanel !== undefined) {
      this.webviewPanel.Panel.webview.postMessage({ command: command });
    }
    this.staticWebviews.forEach((webview: StaticWebview) =>
      webview.Panel.webview.postMessage({ command: command }),
    );
  };

  private resetStartingData = () => {
    this.startingData = new RenderStartingData();
  };

  private createWebview = (title: string, localResourceRoots: vscode.Uri[] | undefined) => {
    if (localResourceRoots !== undefined) {
      let extensionRoot = vscode.Uri.file(this.context.getVscodeExtensionContext().extensionPath);
      localResourceRoots.push(extensionRoot);
    }
    let options: vscode.WebviewOptions = {
      enableScripts: true,
      localResourceRoots: localResourceRoots,
    };
    let newWebviewPanel = vscode.window.createWebviewPanel(
      'shadertoy',
      title,
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      options,
    );
    newWebviewPanel.iconPath = this.context.getResourceUri('thumb.png');
    newWebviewPanel.webview.onDidReceiveMessage(
      (message: any) => {
        switch (message.command) {
          case 'reloadWebview': {
            if (
              this.webviewPanel !== undefined &&
              this.webviewPanel.Panel === newWebviewPanel &&
              this.context.activeEditor !== undefined
            ) {
              this.updateWebview(this.webviewPanel, this.context.activeEditor.document);
            } else {
              this.staticWebviews.forEach((staticWebview: StaticWebview) => {
                if (staticWebview.Panel === newWebviewPanel) {
                  this.updateWebview(staticWebview, staticWebview.Document);
                }
              });
            }
            return;
          }
          case 'updateTime': {
            this.startingData.Time = message.time;
            return;
          }
          case 'updateMouse': {
            this.startingData.Mouse = message.mouse;
            this.startingData.NormalizedMouse = message.normalizedMouse;
            return;
          }
          case 'updateKeyboard': {
            this.startingData.Keys = message.keys;
            return;
          }
          case 'updateUniformsGuiOpen': {
            this.startingData.UniformsGui.Open = message.value;
            return;
          }
          case 'updateUniformsGuiValue': {
            this.startingData.UniformsGui.Values.set(message.name, message.value);
            return;
          }
          case 'showGlslDiagnostic': {
            let diagnosticBatch: DiagnosticBatch = message.diagnosticBatch;
            let severity: vscode.DiagnosticSeverity;

            switch (message.type) {
              case 'error': {
                severity = vscode.DiagnosticSeverity.Error;
                break;
              }
              case 'warning': {
                severity = vscode.DiagnosticSeverity.Warning;
                break;
              }
              case 'hint': {
                severity = vscode.DiagnosticSeverity.Hint;
                break;
              }
              case 'information':
              default: {
                severity = vscode.DiagnosticSeverity.Information;
                break;
              }
            }

            this.context.showDiagnostics(diagnosticBatch, severity);
            return;
          }
          case 'showGlslsError': {
            let file: string = message.file;
            let line: number = message.line;

            this.context.revealLine(file, line);
            return;
          }
          case 'errorMessage': {
            vscode.window.showErrorMessage(message.message);
            return;
          }
        }
      },
      undefined,
      this.context.getVscodeExtensionContext().subscriptions,
    );
    return newWebviewPanel;
  };

  private updateWebview = <T extends Webview | StaticWebview>(
    webviewPanel: T,
    document: vscode.TextDocument,
  ): T => {
    this.context.clearDiagnostics();
    let webviewContentProvider = new WebviewContentProvider(
      this.context,
      document.getText(),
      document.fileName,
    );
    let localResources = webviewContentProvider.parseShaderTree(false);

    let localResourceRoots: string[] = [];
    for (let localResource of localResources) {
      let localResourceRoot = path.dirname(localResource);
      localResourceRoots.push(localResourceRoot);
    }
    localResourceRoots = removeDuplicates(localResourceRoots);

    // Recreate webview if allowed resource roots are not part of the current resource roots
    let previousLocalResourceRoots = webviewPanel.Panel.webview.options.localResourceRoots || [];
    let previousHadLocalResourceRoot = (localResourceRootAsUri: string) => {
      let foundElement = previousLocalResourceRoots.find(
        (uri) => uri.toString() === localResourceRootAsUri,
      );
      return foundElement !== undefined;
    };
    let previousHadAllLocalResourceRoots = localResourceRoots.every((localResourceRoot) =>
      previousHadLocalResourceRoot(vscode.Uri.file(localResourceRoot).toString()),
    );
    if (!previousHadAllLocalResourceRoots) {
      let localResourceRootsUri = localResourceRoots.map((localResourceRoot) =>
        vscode.Uri.file(localResourceRoot),
      );
      let newWebviewPanel = this.createWebview(webviewPanel.Panel.title, localResourceRootsUri);
      webviewPanel.Panel.dispose();
      newWebviewPanel.onDidDispose(webviewPanel.OnDidDispose);
      webviewPanel.Panel = newWebviewPanel;
    }

    webviewPanel.Panel.webview.html = webviewContentProvider.generateWebviewContent(
      webviewPanel.Panel.webview,
      this.startingData,
    );
    return webviewPanel;
  };
}
