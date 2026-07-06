/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sheng.workbench",
  appName: "盛老师工作台",
  webDir: "dist",
  server: {
    url: "https://yanglinne18-lab.github.io/sheng-workbench/",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    LocalNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
