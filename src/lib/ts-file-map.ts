import path = require('path')
import { normalize } from './normalize'
import vueCompiler = require('vue-template-compiler')
import { readFileSync } from './file-util'

export interface TsFile {
  rawFileName: string
  srcPath: string | undefined
  version: number
  text: string | undefined
}

function hasExtension(path: string) {
  const blocks = path.split('/')
  return /\./.test(blocks[blocks.length - 1])
}

export class TsFileMap {
  private files = new Map<string, TsFile>()

  get fileNames (): string[] {
    return Array.from(this.files.keys()).filter(file => isSupportedFile(file))
  }

  /**
   * If the file does not exists or it is unsupported type,
   * we does not try emit output or the compiler throws an error
   */
  canEmit (fileName: string): boolean {
    const file = this.getFile(fileName)
    return file != null && !!file.text
  }

  getSrc (fileName: string): string | undefined {
    let file = this.getFile(fileName)

    // If it does not processed yet,
    // register it into map with returning file data
    if (!file) {
      file = this.loadFile(fileName)
      this.registerFile(file)
    }

    return file.text
  }

  /**
   * Collect host vue file paths of input ts file.
   * If the input is a vue file, just return it.
   */
  getHostVueFilePaths (fileName: string): string[] {
    if (/\.vue$/.test(fileName)) {
      return [fileName]
    }

    const entries = Array.from(this.files.entries())
    return entries
      .filter(([key, file]) => {
        return !/\.vue$/.test(key)
          && file.srcPath === fileName
      })
      .map(([_, file]) => file.rawFileName)
  }

  getVersion (fileName: string): string | undefined {
    const file = this.getFile(fileName)
    return file && file.version.toString()
  }

  updateFile (fileName: string): void {
    const file = this.loadFile(fileName)
    this.registerFile(file)
  }

  /**
   * Load a TS file that specified by the argument
   * If .vue file is specified, it extract and retain TS code part only.
   */
  private loadFile (fileName: string): TsFile {
    const rawFileName = getRawFileName(fileName)
    const file = this.getFile(fileName) || {
      rawFileName,
      srcPath: undefined,
      version: 0,
      text: undefined
    }

    let src = readFileSync(hasExtension(fileName) ? rawFileName : `${rawFileName}.vue`)
    if (src && isVueFile(rawFileName)) {
      const extracted = extractCode(src, fileName)
      src = extracted.content
      file.srcPath = extracted.srcPath
    }

    if (src !== file.text) {
      file.version += 1
      file.text = src
    }

    return file
  }

  /**
   * Just returns a file object
   *
   * Returns undefined
   *   - Not loaded yet
   * Return TsFile but file.text is undefined
   *   - Loaded but not found or unsupported
   */
  private getFile (fileName: string): TsFile | undefined {
    return this.files.get(fileName)
  }

  private registerFile (file: TsFile): void {
    const { rawFileName } = file

    if (isVueFile(rawFileName)) {
      // To ensure the compiler can process .vue file,
      // we need to add .ts suffix to file name
      this.files.set(normalize(rawFileName), file)
    }

    this.files.set(rawFileName, file)
  }
}

/**
 * Extract TS code from single file component
 * If there are no TS code, return undefined
 */
function extractCode (
  src: string,
  fileName: string
): {
  content: string | undefined,
  srcPath: string | undefined
} {
  const script = vueCompiler.parseComponent(src, { pad: true }).script

  if (script == null || !['ts', 'tsx', 'js', 'jsx', undefined].includes(script.lang)) {
    return {
      content: 'export default {}',
      srcPath: undefined
    }
  }

  // Load an external TS file if it referred via src attribute.
  if (script.src && isSupportedFile(script.src)) {
    const srcPath = path.resolve(path.dirname(fileName), script.src)
    return {
      content: readFileSync(srcPath),
      srcPath
    }
  }

  return {
    content: script.content,
    srcPath: undefined
  }
}

function isSupportedFile (fileName: string): boolean {
  return /\.(tsx?|jsx?|d.ts)$/.test(fileName)
}

function isVueFile (fileName: string): boolean {
  return /\.vue(?:\.tsx?)?$/.test(fileName)
}

// If fileName is already suffixed by `.tsx?` remove it
function getRawFileName (fileName: string): string {
  const [_, ext] = /\.vue(\.tsx)?$/.exec(fileName) || []
  return ext ? fileName.slice(0, -ext.length) : fileName
}
