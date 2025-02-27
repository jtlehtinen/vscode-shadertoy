import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  shims: false,
  dts: false,
  clean: true,
  env: { NODE_ENV: process.env.NODE_ENV || 'production' },
  external: ['vscode'],
});
