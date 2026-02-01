#!/usr/bin/env node
// Railway startup script - creates config and starts gateway
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";

const homeDir = os.homedir();
const configDir = path.join(homeDir, ".openclaw");
const configPath = path.join(configDir, "openclaw.json");

// Ensure config directory exists
fs.mkdirSync(configDir, { recursive: true });

// Build config from environment variables
const config = {
  agents: {
    defaults: {
      maxConcurrent: 4,
      subagents: { maxConcurrent: 8 },
      compaction: { mode: "safeguard" },
      workspace: path.join(configDir, "workspace"),
      model: {
        primary: process.env.OPENCLAW_MODEL || "anthropic/claude-3-5-haiku-20241022",
      },
    },
  },
  gateway: {
    mode: "local",
    auth: {
      mode: process.env.OPENCLAW_GATEWAY_TOKEN ? "token" : "none",
      ...(process.env.OPENCLAW_GATEWAY_TOKEN && {
        token: process.env.OPENCLAW_GATEWAY_TOKEN,
      }),
    },
    port: parseInt(process.env.PORT || "18789", 10),
    bind: "all", // Railway needs external access
  },
  auth: {
    profiles: {
      "anthropic:default": {
        provider: "anthropic",
        mode: "api_key",
      },
    },
  },
  plugins: {
    entries: {
      telegram: { enabled: true },
    },
  },
  channels: {
    telegram: {
      enabled: true,
      // botToken comes from TELEGRAM_BOT_TOKEN env var automatically
      allowFrom: process.env.TELEGRAM_ALLOW_FROM
        ? process.env.TELEGRAM_ALLOW_FROM.split(",").map((s) => s.trim())
        : ["*"],
    },
  },
};

// Write config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`[railway-start] Config written to ${configPath}`);
console.log(`[railway-start] Gateway port: ${config.gateway.port}`);
console.log(`[railway-start] Telegram allowFrom: ${JSON.stringify(config.channels.telegram.allowFrom)}`);

// Start gateway using compiled dist (Dockerfile builds to dist/)
const gateway = spawn(
  "node",
  ["dist/index.js", "gateway", "--port", String(config.gateway.port), "--bind", "lan"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      OPENCLAW_CONFIG_PATH: configPath,
    },
  }
);

gateway.on("exit", (code) => {
  process.exit(code ?? 1);
});
