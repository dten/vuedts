import assert = require('power-assert')
import path = require('path')
import fs = require('fs')
import rimraf = require('rimraf')
import chokidar = require('chokidar')
import ts = require('typescript')
import { watch } from '../../src/lib/watch'

const p = (_path: string) => path.resolve(__dirname, '../.tmp', _path)
const vueFileName = 'test.vue' as const
const dFileName = `${vueFileName}${ts.Extension.Dts}`

describe('watch', () => {
  let vueFileWatcher: chokidar.FSWatcher
  let distFileWatcher: chokidar.FSWatcher

  beforeEach(done => {
    fs.mkdir(p('./'), () => {
      vueFileWatcher = watch([p('./**')], {
        jsx: ts.JsxEmit.Preserve,
        jsxFactory: 'h',
        emitDeclarationOnly: true,
        declaration: true,
        experimentalDecorators: true
      }, true).on('ready', done)
      distFileWatcher = chokidar.watch([p(`./**${ts.Extension.Dts}`)], {
        usePolling: true
      })
    })
  })

  afterEach((done) => {
    Promise.all([
      vueFileWatcher.close(),
      distFileWatcher.close()
    ]).then(() => rimraf(p('./'), done))
  })

  it('generates d.ts if .vue file is added', done => {
    distFileWatcher.on('add', once(() => {
      test(p(dFileName), 'export declare const test: string;')
      done()
    }))

    fs.writeFileSync(p(vueFileName), vue('export const test: string = ""'))
  })

  it('updates d.ts if .vue file is updated', done => {
    distFileWatcher.on('add', once(() => {
      test(p(dFileName), 'export declare const test: string;')
      fs.writeFileSync(p(vueFileName), vue('export const foo: number = 1'))
    }))

    distFileWatcher.on('change', once(() => {
      test(p(dFileName), 'export declare const foo: number;')
      done()
    }))

    fs.writeFileSync(p(vueFileName), vue('export const test: string = ""'))
  })

  it('removes d.ts if corresponding .vue file is removed', done => {
    distFileWatcher.on('add', once(() => {
      assert.ok(fs.existsSync(p(dFileName)))
      fs.unlinkSync(p(vueFileName))
    }))

    distFileWatcher.on('unlink', once(() => {
      assert.equal(fs.existsSync(p(dFileName)), false)
      done()
    }))

    fs.writeFileSync(p(vueFileName), vue('export const test: string = ""'))
  })

  it('allows re-add .vue file', done => {
    fs.writeFileSync(p(vueFileName), vue('export declare let a: string'))
    fs.unlinkSync(p(vueFileName))

    distFileWatcher.on('add', once(() => {
      test(p(dFileName), 'export declare let b: boolean;')
      done()
    }))

    fs.writeFileSync(p(vueFileName), vue('export declare let b: boolean'))
  })

  it('watches addition of derived ts file via .vue file', done => {
    fs.writeFileSync(p(vueFileName), vue('', { src: 'test-src.ts' }))

    distFileWatcher.on('add', once(() => {
      test(p(dFileName), 'export declare const test: string;')
      done()
    }))

    fs.writeFileSync(p('test-src.ts'), 'export const test: string = ""')
  })

  it('watches changes of derived ts file via .vue file', done => {
    const src = 'test-src.ts'

    distFileWatcher.on('add', once(() => {
      test(p(dFileName), 'export declare const b: string;')
      fs.writeFileSync(p(src), 'export const a: number = 123')
      test(p(src), 'export const a: number = 123')
    }))

    distFileWatcher.on('change', once(() => {
      test(p(src), 'export const a: number = 123')
      test(p(dFileName), 'export declare const a: number;')
      done()
    }))

    fs.writeFileSync(p(vueFileName), vue('', { src }))
    fs.writeFileSync(p(src), 'export const b: string = ""')
  })
})

function once (fn: () => void): (p: string) => void {
  let done = false
  return () => {
    if (done) return
    fn()
    done = true
  }
}

function test (file: string, expected: string) {
  const data = fs.readFileSync(file, 'utf8')
  const [a, b] = [data.trim(), expected.trim()]
  assert.equal(a, b)
}

function vue (code: string, attrs: Record<string, string> = {}): string {
  const attrsStr = Object.keys(attrs)
    .map(key => {
      return `${key}="${attrs[key]}"`
    })
    .join(' ')

  return '<script lang="ts" ' + attrsStr + '>' + code + '</script>'
}
