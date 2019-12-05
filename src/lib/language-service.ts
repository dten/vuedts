import ts = require('typescript')
import { TsFileMap } from './ts-file-map'
import { resolveAlias } from './resolve-tsconfig-paths'
import { normalize } from './normalize'

export interface Result<T> {
  result: T | null
  errors: string[]
}

export class LanguageService {
  private files = new TsFileMap()
  private tsService: ts.LanguageService

  constructor (rootFileNames: string[], options: ts.CompilerOptions) {
    rootFileNames.forEach(file => {
      this.files.updateFile(file)
    })

    const serviceHost = this.makeServiceHost(options)
    this.tsService = ts.createLanguageService(serviceHost, ts.createDocumentRegistry(true, process.cwd()))
  }

  updateFile (fileName: string): void {
    this.files.updateFile(fileName)
  }

  getHostVueFilePaths (fileName: string): string[] {
    return this.files.getHostVueFilePaths(fileName)
  }

  getDts (fileName: string): Result<string> {
    fileName = normalize(fileName)

    // Unsupported files or not found
    if (!this.files.canEmit(fileName)) {
      return {
        result: null,
        errors: []
      }
    }

    const output = this.tsService.getEmitOutput(fileName, true, true)
    const errors = this.collectErrorMessages(fileName)

    if (errors.length === 0 && !output.emitSkipped) {
      const result = output.outputFiles
        .filter(file => /\.d\.tsx?$/.test(file.name))[0].text

      return {
        result,
        errors: []
      }
    }

    return {
      result: null,
      errors
    }
  }

  private makeServiceHost (options: ts.CompilerOptions): ts.LanguageServiceHost {
    return {
      getScriptFileNames: () => this.files.fileNames,
      getScriptVersion: fileName => this.files.getVersion(fileName),
      getScriptSnapshot: fileName => {
        const src = this.files.getSrc(fileName)
        return src && ts.ScriptSnapshot.fromString(src)
      },
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => options,
      getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
      resolveModuleNames: (moduleNames, containingFile, _, __, options) => {
        return moduleNames.map(name => {
          if (/\.vue$/.test(name)) {
            return {
              resolvedFileName: normalize(resolveAlias(options, containingFile, name)),
              extension: ts.Extension.Tsx
            }
          }
          return ts.resolveModuleName(name, containingFile, options, ts.sys).resolvedModule
        })
      }
    } as ts.LanguageServiceHost
  }

  private collectErrorMessages (fileName: string): string[] {
    const allDiagnostics = this.tsService.getCompilerOptionsDiagnostics()
      .concat(this.tsService.getSyntacticDiagnostics(fileName))
      .concat(this.tsService.getSemanticDiagnostics(fileName))

    return allDiagnostics.map(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

      if (diagnostic.file && diagnostic.start) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        return `[${line + 1},${character + 1}] ${message}`
      }
      return message
    })
  }
}
