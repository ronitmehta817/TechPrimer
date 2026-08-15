import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/pwa",
  use: {
    baseURL: "http://127.0.0.1:8787",
    serviceWorkers: "allow",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --port 8787",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
