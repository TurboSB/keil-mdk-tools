import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { readdirSync, readFileSync, statSync, unwatchFile, watchFile, writeFileSync } from 'fs';
import { join } from 'path';
import * as node_path from 'path';
import * as vscode from 'vscode';
import KeilProject from './project';
import Target from './target/target';

export default class Explorer extends EventEmitter {
  private projects: Map<string, KeilProject> = new Map();
  private currentProject: KeilProject | undefined;
  private currentTarget: Target | undefined;
  private channel: vscode.OutputChannel;

  get targetLabel() {
    return `${this.currentTarget?.label}`;
  }

  constructor(private localize: any = {}) {
    super();
    this.channel = vscode.window.createOutputChannel('keil-mdk-tools');
  }

  async loadWorkspace() {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const wsFilePath: string = vscode.workspace.workspaceFile && /^file:/.test(vscode.workspace.workspaceFile.toString()) ?
        node_path.dirname(vscode.workspace.workspaceFile.fsPath) : vscode.workspace.workspaceFolders[0].uri.fsPath;
      if (!statSync(wsFilePath).isDirectory()) {
        return;
      }
      const uvList = this.lookFor(wsFilePath);
      for (const uvFile of uvList) {
        try {
          await this.open(uvFile);
        } catch (error) {
          console.log((error as Error).stack);
          vscode.window.showErrorMessage(this.localize?.['extension.text.explorer.open']?.replace('${path}', uvFile) || `Open project: '${uvFile}' failed.`);
        }
      }
      this.emit('update');
    }
  }

  async switch() {
    const targets = Array.from(this.projects.values()).map(p => p.targets.map(t => `${t.label} ${p.id} ${p.projectPath}`)).flat();
    const targetName = await vscode.window.showQuickPick(targets, {
      canPickMany: false,
      placeHolder: this.localize?.['extension.text.switch.placeholder'] || 'Please select a target name for keil project'
    });
    if (!targetName) {
      return;
    }
    const labels = targetName.split(' ');
    this.currentProject = this.projects.get(labels[1]);
    this.currentTarget = this.currentProject?.targets.find(t => t.label === labels[0]);
    vscode.workspace.getConfiguration('keil-mdk-tools').update('ActiveTarget', this.targetLabel);
    vscode.commands.executeCommand('C_Cpp.ConfigurationSelect');
    this.emit('update');
  }

  async build(re = false) {
    if (re) {
      await this.runTask('rebuild', 'r');
    } else {
      await this.runTask('build', 'b');
    }
  }

  async download() {
    await this.runTask('flash', 'f');
  }

  async open(path: string): Promise<KeilProject | undefined> {
    const project = new KeilProject(path);
    if (!this.projects.has(project.id)) {
      await project.load();
      project.on('update', () => this.emit('update'));
      this.projects.set(project.id, project);

      if (!this.currentProject) {
        this.currentProject = project;
        if (!this.currentTarget || !project.targets.includes(this.currentTarget)) {
          const activeTarget = vscode.workspace.getConfiguration('keil-mdk-tools').get('ActiveTarget') as string;
          for (const tgt of project.targets) {
            if (activeTarget === tgt.label) {
              this.currentTarget = tgt;
            }
          }
          if (!this.currentTarget || !project.targets.includes(this.currentTarget)) {
            this.currentTarget = project.targets[0];
          }

        }
      }

      this.emit('update');

      return project;
    }
  }

  private lookFor(root: string) {
    const pfList = [] as string[];
    for (const fname of readdirSync(root)) {
      if (statSync(join(root, fname)).isDirectory()) {
        pfList.push(...this.lookFor(join(root, fname)));
      } else if (/\.uvproj[x]?$/i.test(fname)) {
        pfList.push(join(root, fname));
      }
    }
    return pfList;
  }

  private async runTask(name: string, type: 'b' | 'r' | 'f' = 'b') {
    this.currentProject = this.currentProject || Array.from(this.projects.values())[0];
    this.currentTarget = this.currentTarget || this.currentProject?.targets[0];

    if (!this.currentProject || !this.currentTarget) {
      vscode.window.showErrorMessage(this.localize?.['extension.text.task.noproject'] || 'No project and target active.');
      return;
    }
    let targetValid = false;
    for (const target of this.currentProject.targets) {
      if ((this.currentTarget.exe === target.exe) && (this.currentTarget.label === target.label)) {
        targetValid = true;
      }
    }
    if (!targetValid) {
      let str = "Project Targets:\n";
      for (const target of this.currentProject.targets) {
        str = str + " - exe: " + target.exe + "\n - label: " + target.label + "\n\n";
      }
      vscode.window.showErrorMessage(this.localize?.['extension.text.task.notarget'] + "\n - exe: " + this.currentTarget.exe + "\n - label: " + this.currentTarget.label + "\n - project: " + this.currentProject.projectPath + "\n - log: " + this.currentProject.logPath + str || 'Target does not belong to project.');
      return;
    }
    //if (!this.currentProject.targets.includes(this.currentTarget)) {
    //  let str = "Project Targets:\n";
    //  for (const target of this.currentProject.targets) {
    //    str = str + " - exe: " + target.exe + "\n - label: " + target.label + "\n\n";
    //  }
    //  vscode.window.showErrorMessage(this.localize?.['extension.text.task.notarget'] + "\n - exe: " + this.currentTarget.exe + "\n - label: " + this.currentTarget.label + "\n - project: " + this.currentProject.projectPath + "\n - log: " + this.currentProject.logPath + str || 'Target does not belong to project.');
    //  return;
    //}

    writeFileSync(this.currentProject!.logPath, '');
    const command = `"${this.currentTarget.exe}" -${type} "${this.currentProject.projectPath}" -j0 -t ${this.currentTarget.label} -o "${this.currentProject.logPath}"`;
    this.channel.show();
    this.channel.appendLine('$: ' + name + ' target ' + this.currentProject.label);

    let dots = 0;
    const timer = setInterval(() => {
      this.channel.replace(`${'$: ' + name + ' target ' + this.currentProject?.label}${new Array(Math.floor(++dots / 3) % 4 + 1).fill('.').join('')}\n${readFileSync(this.currentProject!.logPath, 'utf-8')}`);
    }, 200);

    return new Promise<void>(res => {
      setTimeout(() => {
        exec(command).once('exit', () => {
          setTimeout(() => clearInterval(timer), 100);
          res();
        });
      }, 500);
    });
  }
}