import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/main/index.html'),
          // Later tasks add builder:
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          // builder: resolve(__dirname, 'src/renderer/builder/index.html')
        }
      }
    }
  }
})
