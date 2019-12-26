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
  .parse(process.argv)

function getConfig() {
  const root = path.resolve(deepestSharedRoot(program.args))
  const configPath = findConfig(root)
  const config = configPath && readConfig(configPath)
  if (configPath) {
    console.log(`use this tsconfig.json: ${configPath}`)
  } else {
    console.log(`tsconfig.json not found in your project`)
  }

  if (!config) {
    return {
      strict: false,
      allowNonTsExtensions: true,
      allowJs: true,
      emitDeclarationOnly: true,
      declaration: true,
      experimentalDecorators: true,
      noImplicitAny: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      checkJs: true
    }
  }

  delete config.options.noEmit

  return {
    ...config.options,
    allowNonTsExtensions: true,
    allowJs: true,
    emitDeclarationOnly: true,
    declaration: true,
    experimentalDecorators: true,
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    checkJs: true
  }
}

if (program.args.length === 0) {
  program.help()
} else {
  const options = getConfig()

  if (program['watch']) {
    watch(program.args.map(arg => path.join(arg, '**/*.vue')), options)
  } else {
    const files = globSync(program.args.map(arg => path.join(arg, '**/*.vue')))
    generate([...program.args, ...files], options)
  }
}
