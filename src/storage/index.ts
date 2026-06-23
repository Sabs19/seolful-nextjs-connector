import { getStorageDir } from '../config.js'
import { FileAdapter } from './file-adapter.js'
import type { StorageAdapter } from '../types.js'

let instance: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = new FileAdapter(getStorageDir())
  }
  return instance
}

export function setStorage(adapter: StorageAdapter): void {
  instance = adapter
}
