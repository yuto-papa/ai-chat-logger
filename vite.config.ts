import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

const isDebug = !!process.env.VSCODE_DEBUG

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart(args) {
          if (isDebug) {
            args.startup(['--inspect=5858', '.'])
          } else {
            args.startup()
          }
        },
        vite: {
          build: {
            rollupOptions: {
              external: ['node-pty']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts'
      },
      renderer: {}
    })
  ]
})
