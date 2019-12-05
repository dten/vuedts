import ts = require('typescript')
import path = require('path')
import globToRegExp = require('glob-to-regexp')

function isAlias(glob: string, moduleName: string): boolean {
  return globToRegExp(glob).test(moduleName)
}

export function resolveAlias(options: ts.CompilerOptions, containingFile: string, moduleName: string) {
  if (!(options.paths && options.baseUrl)) {
    return path.resolve(path.dirname(containingFile), moduleName)
  }

  let baseUrl = options.baseUrl
  if (!/\/$/.test(baseUrl)) {
    baseUrl = `${baseUrl}/`
  }

  for (const glob in options.paths) {
    if (isAlias(glob, moduleName)) {
      const before = glob.replace('*', '')
      const after = options.paths[glob][0].replace('*', '')
      return `${baseUrl}${after}${moduleName.replace(before, '')}`
    }
  }

  return path.resolve(path.dirname(containingFile), moduleName)
}
