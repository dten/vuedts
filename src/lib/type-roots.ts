import ts = require('typescript')
import { globSync } from '../lib/file-util'

export function getTypeRootsDts(options: ts.CompilerOptions) {
  const targets = options.typeRoots ? [
    ...options.typeRoots,
    ...globSync(options.typeRoots.map(root => `${root}${root[root.length - 1] === '/' ? '' : '/'}**/*.d.ts`))
  ] : []
  return targets
}
