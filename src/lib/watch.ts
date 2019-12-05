import path = require('path')
import ts = require('typescript')
import chokidar = require('chokidar')
import { writeFile, unlink } from './file-util'
import { LanguageService } from './language-service'
import { logEmitted, logRemoved, logError } from './logger'
import allSettled = require('promise.allsettled')

export function watch (
  dirs: string[],
  compilerOptions: ts.CompilerOptions = {},
  usePolling: boolean = false
): chokidar.FSWatcher {
  const watcher = chokidar.watch(dirs, {
    usePolling
  })

  const service = new LanguageService([], {
    ...compilerOptions,
    noEmitOnError: true
  })

  watcher
    .on('add', async rawFile => {
      await allSettled(
        service.getHostVueFilePaths(rawFile).map(file => {
          service.updateFile(file)
          return saveDts(file, service)
        })
      )
    })
    .on('change', async rawFile => {
      await allSettled(
        service.getHostVueFilePaths(rawFile).map(file => {
          service.updateFile(file)
          return saveDts(file, service)
        })
      )
    })
    .on('unlink', async rawFile => {
      await allSettled(
        service.getHostVueFilePaths(rawFile).map(file => {
          service.updateFile(file)
          return removeDts(file)
        })
      )
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
