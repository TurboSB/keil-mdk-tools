import * as vscode from 'vscode';
import * as node_path from 'path';
import * as fs from 'fs';
import { Console } from 'console';

export default abstract class Target {
  // protected projectPath: string;
  label: string;
  protected projFile: string;
  protected targetDOM: any;
  protected includes: Set<string>;
  protected defines: Set<string>;

  // readonly targetName: string;
  abstract readonly exe: string;

  protected get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('keil-mdk-tools');
  }

  constructor(dom: any, projFile: string) {
    this.label = dom['TargetName'];
    this.targetDOM = dom;
    this.includes = new Set();
    this.defines = new Set();
    this.projFile = projFile;
  }

  async load(): Promise<void> {
    const defineListStr: string = this.getDefineString(this.targetDOM);
    const incListStr: string = this.getIncString(this.targetDOM);
    const refPath = this.getOutputFolder(this.targetDOM);

    // Add defines
    this.defines.clear();

    defineListStr.split(/,|\s+/).forEach((define) => {
      if (define.trim() !== '') {
        this.defines.add(define);
      }
    });

    // Add arm macros/sys includes
    const sysDefines = this.getSysDefines(this.targetDOM);
    for (const sDef of sysDefines) {
      this.defines.add(sDef);
    }

    // Add user defines (makefile)
    const userDefines = (this.config.get('UserDefines') as string).split(/\r\n|\n/);
    for (const uDef of userDefines) {
      this.defines.add(uDef);
    }

    // Add includes
    this.includes.clear();

    let incList = incListStr.split(';');
    incList.forEach((path) => {
      const realPath = path.trim();
      if (realPath !== '') {
        this.includes.add(node_path.normalize(realPath));
      }
    });

    if (refPath !== undefined) {
      const refPathAbs = node_path.join(node_path.dirname(this.projFile), refPath);
      let groups: any[];
      let _groups = this.getGroups(this.targetDOM);
      if (Array.isArray(_groups)) {
        groups = _groups;
      } else {
        groups = [_groups];
      }

      for (const group of groups) {

        if (group['Files'] !== undefined) {

          let isGroupExcluded = false;
          let fileList: any[];
          // console.log('GroupOption',group['GroupOption']);
          const gOption = group['GroupOption'];
          if (gOption !== undefined) { // check group is excluded
            const gComProps = gOption['CommonProperty'];
            if (gComProps !== undefined) {
              isGroupExcluded = (gComProps['IncludeInBuild'] === 0);
            }
          }

          if (isGroupExcluded === false) {
            if (Array.isArray(group['Files'])) {
              fileList = [];
              for (const files of group['Files']) {
                if (Array.isArray(files['File'])) {
                  fileList = fileList.concat(files['File']);
                }
                else if (files['File'] !== undefined) {
                  fileList.push(files['File']);
                }
              }
            } else {
              if (Array.isArray(group['Files']['File'])) {
                fileList = group['Files']['File'];
              }
              else if (group['Files']['File'] !== undefined) {
                fileList = [group['Files']['File']];
              } else {
                fileList = [];
              }
            }

            for (const file of fileList) {
              let isFileExcluded = false;
              if (file['FileOption']) { // check file is enable
                const fOption = file['FileOption']['CommonProperty'];
                if (fOption && fOption['IncludeInBuild'] === '0') {
                  isFileExcluded = true;
                }
              }

              if (isFileExcluded === false) {
                const sourceFile = file['FilePath'].trim();
                if (sourceFile !== '') {
                  //this.includes.add(node_path.normalize(sourceFile));
                  const refFile = node_path.join(refPathAbs, node_path.parse(sourceFile).name + '.d');
                  if (fs.existsSync(refFile) === true) {
                    if (fs.lstatSync(refFile).isFile() === true) {
                      const lines = fs.readFileSync(refFile, 'utf-8').split(/\r\n|\n/);
                      const refFileList = this.parseRefLines(this.targetDOM, lines);
                      for (const ref of refFileList) {
                        if (node_path.extname(ref) !== '') {
                          if (this.includes.has(node_path.normalize(node_path.dirname(ref))) === false) {
                            this.includes.add(node_path.normalize(ref));
                          }
                        }
                        else {
                          this.includes.add(node_path.normalize(ref));
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    //update cpp properties
    this.updateCppProperties();
  }

  private updateCppProperties() {
    const cppFile = node_path.join(node_path.dirname(this.projFile), '.vscode', 'c_cpp_properties.json');
    let obj: any;

    if (fs.existsSync(cppFile) === true) {
      try {
        obj = JSON.parse(fs.readFileSync(cppFile, 'utf-8'));
      }
      catch (error) {
        vscode.window.showErrorMessage(`c_cpp_properties read fail, msg: ${(error as Error).message}`);
        obj = this.getDefCppProperties();
      }
    }
    else {
      obj = this.getDefCppProperties();
    }

    const configList: any[] = obj['configurations'];
    const index = configList.findIndex((conf) => { return conf.name === this.label; });

    if (index === -1) {
      configList.push({
        name: this.label,
        includePath: Array.from(this.includes),
        defines: Array.from(this.defines),
        intelliSenseMode: 'clang-arm'
      });
    }
    else {
      configList[index]['includePath'] = Array.from(this.includes);
      configList[index]['defines'] = Array.from(this.defines);
    }

    fs.writeFileSync(cppFile, JSON.stringify(obj, undefined, 4));
  }

  protected abstract getDefCppProperties(): any;
  protected abstract getDefineString(target: any): string;
  protected abstract getSysDefines(target: any): string[];
  protected abstract getIncString(target: any): string;
  protected abstract getGroups(target: any): any[];
  protected abstract getOutputFolder(target: any): string | undefined;
  protected abstract parseRefLines(target: any, lines: string[]): string[];
}