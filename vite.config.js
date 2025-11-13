import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 添加公共路径配置，匹配你的 GitHub Pages 地址
  base: '/Internship-Program/'    // 公共路径需与仓库名一致，对应站点地址：https://nali-svg.github.io/Internship-Program
})