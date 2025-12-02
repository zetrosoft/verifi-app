import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss' // Import tailwindcss
import autoprefixer from 'autoprefixer' // Import autoprefixer

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(), // Add tailwindcss to PostCSS plugins
        autoprefixer(), // Add autoprefixer
      ],
    },
  },
})
