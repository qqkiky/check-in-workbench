import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// 将 src/version.ts 中的 APP_VERSION 注入 public/sw.js 的缓存名占位符。
// 这样每次部署版本号变化时，Service Worker 缓存名随之改变，手机端旧缓存被清除，
// 从而根治「白屏」（旧 SW 一直返回早已删除的旧 index.html）。
function injectSwVersion() {
  return {
    name: 'inject-sw-version',
    apply: 'build' as const,
    closeBundle() {
      const versionMatch = fs
        .readFileSync(path.resolve(__dirname, 'src/version.ts'), 'utf8')
        .match(/APP_VERSION\s*=\s*'([^']+)'/)
      const version = versionMatch ? versionMatch[1] : 'unknown'
      const distSw = path.resolve(__dirname, 'dist/sw.js')
      const src = fs.existsSync(distSw)
        ? fs.readFileSync(distSw, 'utf8')
        : fs.readFileSync(path.resolve(__dirname, 'public/sw.js'), 'utf8')
      fs.writeFileSync(distSw, src.replace('__APP_VERSION__', version))
    },
  }
}

export default defineConfig({
  plugins: [react(), injectSwVersion()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2018',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        widget: path.resolve(__dirname, 'widget.html'),
      },
    },
  },
})
