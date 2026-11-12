
export interface ScreenSaverProxy {
  GetActive(): Promise<boolean>
  on(event: 'ActiveChanged', fn: (active: boolean) => void): unknown
  off(event: 'ActiveChanged', fn: (active: boolean) => void): unknown
}

export interface LockBus {
  getScreenSaver(): Promise<ScreenSaverProxy>
  disconnect(): void
}

async function connectSessionBus(): Promise<LockBus> {
  const { sessionBus } = await import('dbus-next')
  const bus = sessionBus()
  // dbus-next emits 'error' asynchronously (e.g. bus gone); unhandled it would crash main.
  bus.on('error', (err: unknown) => console.warn('[lockWatcher] dbus error:', (err as Error)?.message ?? err))
  return {
    async getScreenSaver() {
      const obj = await bus.getProxyObject('org.gnome.ScreenSaver', '/org/gnome/ScreenSaver')
      return obj.getInterface('org.gnome.ScreenSaver') as unknown as ScreenSaverProxy
    },
    disconnect: () => bus.disconnect()
  }
}

const noop = (): void => {}

/**
 * Reports the initial lock state, then every ActiveChanged. Never rejects:
 * if the bus or service is unavailable it logs once and returns a no-op.
 */
export async function watchScreenLock(
  cb: (locked: boolean) => void,
  connect: () => Promise<LockBus> = connectSessionBus
): Promise<() => void> {
  let bus: LockBus | undefined
  try {
    bus = await connect()
    const iface = await bus.getScreenSaver()
    const handler = (active: boolean): void => cb(Boolean(active))
    iface.on('ActiveChanged', handler)
    const connected = bus
    let stopped = false
    try {
      cb(Boolean(await iface.GetActive()))
    } catch (err) {
      console.warn('[lockWatcher] GetActive failed:', err)
    }
    return () => {
      if (stopped) return
      stopped = true
      iface.off('ActiveChanged', handler)
      try { connected.disconnect() } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[lockWatcher] screen lock detection unavailable:', (err as Error)?.message ?? err)
    try { bus?.disconnect() } catch { /* ignore */ }
    return noop
  }
}
