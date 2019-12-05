import ts = require('typescript')

// .ts suffix is needed since the compiler skips compile
// if the file name seems to be not supported types
export function normalize(fileName: string): string {
  if (/\.vue$/.test(fileName)) {
    return `${fileName}${ts.Extension.Tsx}`
  }
  return fileName
}
