import * as vscode from 'vscode';
import Explorer from './explorer';

let localize = {} as any;
try {
  try {
    localize = eval(`require("../package.nls.${JSON.parse(process.env.VSCODE_NLS_CONFIG as string).locale.toLowerCase()}.json")`);
  } catch {
    localize = eval(`require("../package.nls.json")`);
  }
} catch { }

export function activate(context: vscode.ExtensionContext) {
  const explorer = new Explorer(localize);
  const subscriber = context.subscriptions;

  let running = false;
  const prevent = async (action: () => Promise<void>) => {
    if (running) {
      vscode.window.showWarningMessage(localize?.['extension.text.explorer.busy'] || 'Task is running, plase wait.');
      return;
    }
    running = true;
    try {
      await action.call(explorer);
    } finally {
      running = false;
    }
  };

  subscriber.push(vscode.commands.registerCommand('keil-mdk-tools.project.build', () => prevent(explorer.build)));
  subscriber.push(vscode.commands.registerCommand('keil-mdk-tools.project.rebuild', () => prevent(explorer.build.bind(explorer, true))));
  subscriber.push(vscode.commands.registerCommand('keil-mdk-tools.project.download', () => prevent(explorer.download)));
  subscriber.push(vscode.commands.registerCommand('keil-mdk-tools.project.switch', () => prevent(explorer.switch)));

  const targetStatusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  targetStatusbar.tooltip = localize?.['extension.statusbar.switch.tips'] || 'Switch Keil Project Target';
  targetStatusbar.command = 'keil-mdk-tools.project.switch';
  targetStatusbar.text = `$(keil-mdk-switch) []`;
  targetStatusbar.show();

  explorer.on('update', () => {
    targetStatusbar.text = `$(keil-mdk-switch) [${explorer.targetLabel}]`;
  });

  const buildStatusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  buildStatusbar.tooltip = localize?.['extension.statusbar.build.tips'] || 'Build Keil Project';
  buildStatusbar.command = 'keil-mdk-tools.project.build';
  buildStatusbar.text = '$(keil-mdk-build)';
  buildStatusbar.show();

  const rebuildStatusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  rebuildStatusbar.tooltip = localize?.['extension.statusbar.rebuild.tips'] || 'Rebuild Keil Project';
  rebuildStatusbar.command = 'keil-mdk-tools.project.rebuild';
  rebuildStatusbar.text = '$(keil-mdk-rebuild) ';
  rebuildStatusbar.show();

  const downloadStatusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  downloadStatusbar.tooltip = localize?.['extension.statusbar.download.tips'] || 'Download HEX to Board';
  downloadStatusbar.command = 'keil-mdk-tools.project.download';
  downloadStatusbar.text = '$(keil-mdk-download) ';
  downloadStatusbar.show();

  explorer.loadWorkspace();
}
