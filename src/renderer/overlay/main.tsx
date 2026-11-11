import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay, type OverlayPayload } from './Overlay'

declare global {
  interface Window {
    overlay: { onShow(cb: (p: OverlayPayload) => void): void; answer(id: string, a: 'coming' | 'busy5' | 'dismissed'): void }
  }
}

function App(): JSX.Element | null {
  const [payload, setPayload] = useState<OverlayPayload | null>(null)
  useEffect(() => { window.overlay.onShow(setPayload) }, [])
  return payload ? <Overlay payload={payload} onAnswer={(id, a) => window.overlay.answer(id, a)} /> : null
}

createRoot(document.getElementById('root')!).render(<App />)
