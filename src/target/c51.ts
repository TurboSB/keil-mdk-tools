import Target from "./target";

export default class C51Target extends Target {
  get exe() {
    return this.config.get('C51.Uv4Path') as string;
  }

  protected getDefCppProperties(): any {
    return {
      configurations: [
        {
          name: this.label,
          includePath: undefined,
          defines: undefined,
          intelliSenseMode: '${default}'
        }
      ],
      version: 4
    };
  }

  protected getIncString(target: any): string {
    const target51 = target['TargetOption']['Target51']['C51'];
    return target51['VariousControls']['IncludePath'];
  }

  protected getDefineString(target: any): string {
    const target51 = target['TargetOption']['Target51']['C51'];
    return target51['VariousControls']['Define'];
  }

  protected getSysDefines(_target: any): string[] {
    return [
      '__C51__',
      '__VSCODE_C51__',
      'reentrant=',
      'compact=',
      'small=',
      'large=',
      'data=',
      'idata=',
      'pdata=',
      'bdata=',
      'xdata=',
      'code=',
      'bit=char',
      'sbit=char',
      'sfr=char',
      'sfr16=int',
      'sfr32=int',
      'interrupt=',
      'using=',
      '_at_=',
      '_priority_=',
      '_task_='
    ];
  }

  protected getGroups(target: any): any[] {
    return target['Groups']['Group'] || [];
  }

  protected getOutputFolder(_target: any): string | undefined {
    return undefined;
  }

  protected parseRefLines(_target: any, _lines: string[]): string[] {
    return [];
  }
}