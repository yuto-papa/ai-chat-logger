import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          globals: true,
        }
      },
      {
        test: {
          name: 'ipc',
          include: ['tests/ipc/**/*.test.ts'],
          environment: 'node',
          globals: true,
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'electron/fileOps.js'],
    }
  }
})
