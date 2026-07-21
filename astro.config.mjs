import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://radiova-app.github.io",
  output: "static",
  build: {
    format: "directory",
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          loadPaths: ["./src/styles"],
        },
      },
    },
  },
});
