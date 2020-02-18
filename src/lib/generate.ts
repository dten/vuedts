import path = require('path')
import ts = require('typescript')
import allSettled = require('promise.allsettled')
import { LanguageService } from './language-service'
import { writeFile } from './file-util'
import { logEmitted, logError } from './logger'
import { getTypeRootsDts } from './type-roots'

export async function generate (filenames: string[], options: ts.CompilerOptions): Promise<void> {
  const vueFiles = filenames
    .filter(file => /\.vue$/.test(file))
    .map(file => path.resolve(file))

  // Should not emit if some errors are occurred
  const service = new LanguageService([
    ...getTypeRootsDts(options),
    ...vueFiles
  ], options)

  await allSettled(
    vueFiles.map(file => {
      const dts = service.getDts(file)
      const dtsPath = `${file}${ts.Extension.Dts}`

      if (dts.errors.length > 0) {
        logError(dtsPath, dts.errors)
        return
      }
      const { result } = dts

      if (result === null) return

      return setImmediate(() => {
        writeFile(dtsPath, result)
          .then(() => logEmitted(dtsPath))
          .catch(e => logError(dtsPath, [e.message]))
      })
    })
  )
}
