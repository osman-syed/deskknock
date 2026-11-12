import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { watchScreenLock, type LockBus } from '../../src/main/lockWatcher'

function fakeBus(initial: boolean) {
  const iface = new EventEmitter() as EventEmitter & { GetActive(): Promise<boolean> }
  iface.GetActive = async () => initial
  let disconnected = false
  const bus: LockBus = {
    getScreenSaver: async () => iface,
    disconnect: () => { disconnected = true }
  }
  return { bus, iface, isDisconnected: () => disconnected }
}

describe('watchScreenLock', () => {
  it('watchScreenLock reports initial state and ActiveChanged', async () => {
    const { bus, iface, isDisconnected } = fakeBus(true)
    const seen: boolean[] = []
    const stop = await watchScreenLock((l) => seen.push(l), async () => bus)
    expect(seen).toEqual([true])
    iface.emit('ActiveChanged', false)
    iface.emit('ActiveChanged', true)
    expect(seen).toEqual([true, false, true])
    stop()
    iface.emit('ActiveChanged', false)
    expect(seen).toEqual([true, false, true])
    expect(isDisconnected()).toBe(true)
  })

  it('watchScreenLock resolves to no-op when service missing', async () => {
    const seen: boolean[] = []
    const bus: LockBus = {
      getScreenSaver: async () => { throw new Error('service not found') },
      disconnect: () => {}
    }
    const stop = await watchScreenLock((l) => seen.push(l), async () => bus)
    expect(seen).toEqual([])
    expect(() => stop()).not.toThrow()
    const stop2 = await watchScreenLock((l) => seen.push(l), async () => { throw new Error('no bus') })
    expect(() => stop2()).not.toThrow()
  })
})
