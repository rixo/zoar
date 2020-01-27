import * as fs from 'fs'

// fs.createReadStream('test.log').pipe(fs.createWriteStream('newLog.log'));
export const copyFile = fs.promises.copyFile

export const exists = (...args) =>
  new Promise(resolve => fs.exists(...args, resolve))
