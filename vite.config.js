import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 添加公共路径配置，匹配你的 GitHub Pages 地址
  base: '/github.io/'  // 对应你的站点路径：https://nali-svg.github.io/github.io/
})