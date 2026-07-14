import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the two biggest, slowest-changing dependency groups out of the app chunk so they
        // cache independently of day-to-day App.jsx edits — TipTap (the notes rich-text editor) is
        // the single largest dependency and only matters once someone opens the Notes tab.
        manualChunks: {
          tiptap: [
            '@tiptap/react', '@tiptap/starter-kit',
            '@tiptap/extension-text-style', '@tiptap/extension-highlight', '@tiptap/extension-subscript',
            '@tiptap/extension-superscript', '@tiptap/extension-table', '@tiptap/extension-list',
            '@tiptap/extension-image', '@tiptap/extension-text-align', '@tiptap/extensions',
          ],
          vendor: ['react', 'react-dom', '@supabase/supabase-js'],
        },
      },
    },
  },
})
