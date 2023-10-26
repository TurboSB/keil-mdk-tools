import Target from "./target";
import * as node_path from 'path';


export default class ArmTarget extends Target {

  private static readonly armccMacros: string[] = [
    '__CC_ARM',
    '__arm__',
    '__align(x)=',
    '__ALIGNOF__(x)=',
    '__alignof__(x)=',
    '__asm(x)=',
    '__forceinline=',
    '__restrict=',
    '__global_reg(n)=',
    '__inline=',
    '__int64=long long',
    //'__INTADDR__(expr)=0',
    '__irq=',
    '__packed=',
    '__pure=',
    '__smc(n)=',
    '__svc(n)=',
    '__svc_indirect(n)=',
    '__svc_indirect_r7(n)=',
    '__value_in_regs=',
    '__weak=',
    '__writeonly=',
    '__declspec(x)=',
    '__attribute__(x)=',
    '__nonnull__(x)=',
    '__register=',
    '__breakpoint(x)=',
    '__cdp(x,y,z)=',
    '__clrex()=',
    '__clz(x)=0U',
    '__current_pc()=0U',
    '__current_sp()=0U',
    '__disable_fiq()=',
    '__disable_irq()=',
    '__dmb(x)=',
    '__dsb(x)=',
    '__enable_fiq()=',
    '__enable_irq()=',
    '__fabs(x)=0.0',
    '__fabsf(x)=0.0f',
    '__force_loads()=',
    '__force_stores()=',
    '__isb(x)=',
    '__ldrex(x)=0U',
    '__ldrexd(x)=0U',
    '__ldrt(x)=0U',
    '__memory_changed()=',
    '__nop()=',
    '__pld(...)=',
    '__pli(...)=',
    '__qadd(x,y)=0',
    '__qdbl(x)=0',
    '__qsub(x,y)=0',
    '__rbit(x)=0U',
    '__rev(x)=0U',
    '__return_address()=0U',
    '__ror(x,y)=0U',
    '__schedule_barrier()=',
    '__semihost(x,y)=0',
    '__sev()=',
    '__sqrt(x)=0.0',
    '__sqrtf(x)=0.0f',
    '__ssat(x,y)=0',
    '__strex(x,y)=0U',
    '__strexd(x,y)=0',
    '__strt(x,y)=',
    '__swp(x,y)=0U',
    '__usat(x,y)=0U',
    '__wfe()=',
    '__wfi()=',
    '__yield()=',
    '__vfp_status(x,y)=0'
  ];

  private static readonly armclangMacros: string[] = [
    '__alignof__(x)=',
    '__asm(x)=',
    '__asm__(x)=',
    '__forceinline=',
    '__restrict=',
    '__volatile__=',
    '__inline=',
    '__inline__=',
    '__declspec(x)=',
    '__attribute__(x)=',
    '__nonnull__(x)=',
    '__unaligned=',
    '__promise(x)=',
    '__irq=',
    '__swi=',
    '__weak=',
    '__register=',
    '__pure=',
    '__value_in_regs=',
    '__breakpoint(x)=',
    '__current_pc()=0U',
    '__current_sp()=0U',
    '__disable_fiq()=',
    '__disable_irq()=',
    '__enable_fiq()=',
    '__enable_irq()=',
    '__force_stores()=',
    '__memory_changed()=',
    '__schedule_barrier()=',
    '__semihost(x,y)=0',
    '__vfp_status(x,y)=0',
    '__builtin_arm_nop()=',
    '__builtin_arm_wfi()=',
    '__builtin_arm_wfe()=',
    '__builtin_arm_sev()=',
    '__builtin_arm_sevl()=',
    '__builtin_arm_yield()=',
    '__builtin_arm_isb(x)=',
    '__builtin_arm_dsb(x)=',
    '__builtin_arm_dmb(x)=',
    '__builtin_bswap32(x)=0U',
    '__builtin_bswap16(x)=0U',
    '__builtin_arm_rbit(x)=0U',
    '__builtin_clz(x)=0U',
    '__builtin_arm_ldrex(x)=0U',
    '__builtin_arm_strex(x,y)=0U',
    '__builtin_arm_clrex()=',
    '__builtin_arm_ssat(x,y)=0U',
    '__builtin_arm_usat(x,y)=0U',
    '__builtin_arm_ldaex(x)=0U',
    '__builtin_arm_stlex(x,y)=0U'
  ];

  get exe() {
    return this.config.get('MDK.Uv4Path') as string;
  }

  protected getDefCppProperties(): any {
    return {
      configurations: [
        {
          name: this.label,
          includePath: undefined,
          defines: undefined,
          intelliSenseMode: 'clang-arm'
        }
      ],
      version: 4
    };
  }

  protected getIncString(target: any): string {
    const dat = target['TargetOption']['TargetArmAds']['Cads'];
    return dat['VariousControls']['IncludePath'];
  }

  protected getDefineString(target: any): string {
    const dat = target['TargetOption']['TargetArmAds']['Cads'];
    return dat['VariousControls']['Define'];
  }

  protected getSysDefines(target: any): string[] {
    if (target['uAC6'] === '1') { // ARMClang
      return ArmTarget.armclangMacros;
    } else { // ARMCC
      return ArmTarget.armccMacros;
    }
  }

  protected getGroups(target: any): any[] {
    return target['Groups']['Group'] || [];
  }

  protected getOutputFolder(target: any): string | undefined {
    try {
      return <string>target['TargetOption']['TargetCommonOption']['OutputDirectory'];
    } catch (error) {
      return undefined;
    }
  }

  private gnuParseRefLines(lines: string[]): string[] {

    const resultList: Set<string> = new Set();

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const _line = lines[lineIndex];

      const line = _line[_line.length - 1] === '\\' ? _line.substring(0, _line.length - 1) : _line; // remove char '\'
      const subLines = line.trim().split(/(?<![\\:]) /);

      if (lineIndex === 0) // first line
      {
        for (let i = 1; i < subLines.length; i++) // skip first sub line
        {
          resultList.add(subLines[i].trim().replace(/\\ /g, " "));
        }
      }
      else  // other lines, first char is whitespace
      {
        subLines.forEach((item) => {
          resultList.add(item.trim().replace(/\\ /g, " "));
        });
      }
    }

    return Array.from(resultList);
  }

  private ac5ParseRefLines(lines: string[], startIndex = 1): string[] {

    const resultList: Set<string> = new Set<string>();

    for (let i = startIndex; i < lines.length; i++) {
      const sepIndex = lines[i].indexOf(": ");
      if (sepIndex > 0) {
        const line: string = lines[i].substring(sepIndex + 1).trim();
        const lineDir = node_path.normalize(node_path.dirname(line));
        resultList.add(lineDir);
      }
    }

    return Array.from(resultList);
  }

  protected parseRefLines(target: any, lines: string[]): string[] {
    if (target['uAC6'] === '1') { // ARMClang
      return this.gnuParseRefLines(lines);
    } else { // ARMCC
      return this.ac5ParseRefLines(lines);
    }
  }
}