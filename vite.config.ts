import { defineConfig } from 'vite'

/**
 * Defines the Vite development and production-bundle behavior for the prototype.
 *
 * @returns {import('vite').UserConfig} Vite configuration with a deterministic local host.
 */
export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
  test: {
    environment: 'node',
  },
})
