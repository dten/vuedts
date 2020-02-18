import ts = require('typescript')
import chokidar = require('chokidar')
import { writeFile, unlink } from './file-util'
import { LanguageService } from './language-service'
import { logEmitted, logRemoved, logError } from './logger'
import { getTypeRootsDts } from './type-roots'

export function watch (
  dirs: string[],
  options: ts.CompilerOptions = {},
  usePolling: boolean = false
): chokidar.FSWatcher {
  const targets = [
    ...getTypeRootsDts(options),
    ...dirs
  ]

  const watcher = chokidar.watch(targets, {
    usePolling
  })

  const service = new LanguageService(targets, options)

  watcher
    .on('add', rawFile => {
      service.getHostVueFilePaths(rawFile).map(file => {
        service.updateFile(file)
        setImmediate(() => saveDts(file, service))
      })
    })
    .on('change', rawFile => {
      service.getHostVueFilePaths(rawFile).map(file => {
        service.updateFile(file)
        setImmediate(() => saveDts(file, service))
      })
    })
    .on('unlink', rawFile => {
      service.getHostVueFilePaths(rawFile).map(file => {
        service.updateFile(file)
        removeDts(file)
      })
    })

  return watcher
}

async function saveDts(fileName: string, service: LanguageService): Promise<void> {
  const dts = service.getDts(fileName)
  const dtsName = `${fileName}${ts.Extension.Dts}`

  if (dts.errors.length > 0) {
    logError(dtsName, dts.errors)
    return
  }

  if (dts.result === null) return

  try {
    await writeFile(dtsName, dts.result)
    logEmitted(dtsName)
  } catch (e) {
    logError(dtsName, [e.message])
  }
}

async function removeDts (fileName: string): Promise<void> {
  const dtsName = `${fileName}${ts.Extension.Dts}`
  try {
    await unlink(dtsName)
    logRemoved(dtsName)
  } catch (e) {
    logError(dtsName, [e.message])
  }
}
