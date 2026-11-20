// import react from '@vitejs/plugin-react'
// import { defineConfig } from 'vite'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },

  esbuild:
    mode === "production"
      ? {
          drop: ["console", "debugger"],
        }
      : {},
}));
// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite'
// import path from "path"

// export default defineConfig(({ mode }) => ({
//   plugins: [react(), tailwindcss()],

//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },

//   server: {
//     host: "0.0.0.0",
//      allowedHosts: [".ngrok-free.app"],
//     // allowedHosts: [
//     //   //"5691-2405-201-8025-5070-d5b3-e77a-b736-9cf4.ngrok-free.app",
//     //   "2f50-115-187-48-18.ngrok-free.app",
//     // ],
//   },

//   esbuild: mode === "production" ? {
//     drop: ["console", "debugger"],
//   } : {},
// }))
