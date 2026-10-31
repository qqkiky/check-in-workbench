import { Capacitor, registerPlugin } from '@capacitor/core'

const NativeStorage = registerPlugin<{
  load(): Promise<{ values: Record<string, string> }>
  save(options: { values: Record<string, string> }): Promise<void>
}>('PrivateStorage')
const native = Capacitor.getPlatform() === 'android'
let values: Record<string, string> = Object.create(null)
let ready = !native
let queue = Promise.resolve()
let writeError: unknown = null

function persist() {
  const snapshot = { ...values }
  queue = queue.catch(() => {}).then(() => NativeStorage.save({ values: snapshot }))
  queue.then(() => { writeError = null }, (error) => {
    writeError = error
    window.dispatchEvent(new Event('private-storage-error'))
  })
}

export const appStorage: Storage = {
  get length() { return native ? Object.keys(values).length : localStorage.length },
  key(index) { return native ? Object.keys(values)[index] ?? null : localStorage.key(index) },
  getItem(key) {
    if (!ready) throw new Error('Private storage has not been initialized')
    return native ? values[key] ?? null : localStorage.getItem(key)
  },
  setItem(key, value) {
    if (!ready) throw new Error('Private storage has not been initialized')
    if (!native) { localStorage.setItem(key, value); return }
    values[key] = String(value); persist()
  },
  removeItem(key) {
    if (!ready) throw new Error('Private storage has not been initialized')
    if (!native) { localStorage.removeItem(key); return }
    delete values[key]; persist()
  },
  clear() {
    if (!ready) throw new Error('Private storage has not been initialized')
    if (!native) { localStorage.clear(); return }
    values = Object.create(null); persist()
  },
}

export async function initPrivateStorage() {
  if (!native) return
  const loaded = await NativeStorage.load()
  values = Object.assign(Object.create(null), loaded.values)
  let migrated = false
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('wb.') && !(key in values)) {
      values[key] = localStorage.getItem(key) ?? ''; migrated = true
    }
  }
  // Clear plaintext only after the encrypted write succeeds.
  if (migrated) await NativeStorage.save({ values })
  const oldKeys = Object.keys(localStorage).filter(key => key.startsWith('wb.'))
  for (const key of oldKeys) localStorage.removeItem(key)
  ready = true
}
export async function flushPrivateStorage() {
  await queue
  if (writeError) throw writeError
}

// NativeStorage.save replaces one encrypted AtomicFile, including the sync baseline.
export async function saveStorageBatch(updates: Record<string,string>) {
  if(!ready)throw new Error('Private storage has not been initialized')
  if(native){values=Object.assign(Object.create(null),values,updates);persist();await flushPrivateStorage()}
  else for(const [key,value] of Object.entries(updates))localStorage.setItem(key,value)
}
