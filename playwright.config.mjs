import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "pruebas/ui",
  timeout: 120000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WEB_URL || "http://localhost:3000",
    viewport: { width: 1366, height: 800 },
    locale: "es-CO",
  },
});
