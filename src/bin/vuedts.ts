#!/usr/bin/env node

import path = require('path')
import program = require('commander')
import { globSync, deepestSharedRoot } from '../lib/file-util'
import { findConfig, readConfig } from '../lib/config'
import { generate } from '../lib/generate'
import { watch } from '../lib/watch'

// tslint:disable-next-line
const meta = require('../../package.json')

program
  .version(meta.version)
  .usage('<directory...>')
  .option('-w, --watch', 'watch file changes')
  .option('-c, --config <path>', 'pass your tsconfig.json path')
  .parse(process.argv)

function getConfig(configPath?: string) {
  let config: ReturnType<typeof readConfig>
  if (configPath) {
    configPath = path.resolve(configPath)
    config = readConfig(configPath)
  } else {
    const root = path.resolve(deepestSharedRoot(program.args))
    configPath = findConfig(root)
    if (configPath) {
      config = readConfig(configPath)
    }
  }

  if (configPath && config) {
    console.log(`use this tsconfig.json: ${configPath}`)
  } else {
    console.log(`tsconfig.json not found in your project`)
  }

  const base = {
    allowNonTsExtensions: true,
    emitDeclarationOnly: true,
    declaration: true,
    experimentalDecorators: true,
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    noEmitOnError: false
  }

  if (!config) {
    return {
      strict: false,
      ...base
    }
  }

  delete config.options.noEmit

  return {
    ...config.options,
    ...base
  }
}

if (program.args.length === 0) {
  program.help()
} else {
  const options = getConfig(program['config'])
  const files = globSync(program.args.map(arg => path.join(arg, '**/*.vue')))
  const targets = [...program.args, ...files]

  if (program['watch']) {
    watch(targets, options)
  } else {
    generate(targets, options)
  }
}
