import { defineConfig } from "vite";
import path from "path";

export default defineConfig(() => ({
  base: process.env.GITHUB_ACTIONS
    ? "/FullStack-Task-Managment-application/"
    : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
