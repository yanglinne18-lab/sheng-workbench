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
};

export default config;
