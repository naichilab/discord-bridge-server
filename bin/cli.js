#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { spawn } from "child_process";
import { cpSync, existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");

const command = process.argv[2];

switch (command) {
  case "start": {
    const serverPath = join(packageRoot, "server", "index.js");
    const child = spawn("node", [serverPath], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => process.exit(code ?? 0));
    break;
  }

  case "install": {
    const home = process.env.HOME;
    if (!home) {
      console.error("HOME environment variable is not set");
      process.exit(1);
    }
    const target = join(home, ".claude", "plugins", "discord-bridge");
    const source = join(packageRoot, "plugin");

    if (!existsSync(source)) {
      console.error("Plugin files not found");
      process.exit(1);
    }

    mkdirSync(target, { recursive: true });
    cpSync(source, target, { recursive: true });
    console.log(`Plugin installed to ${target}`);
    console.log("");
    console.log("Restart Claude Code to load the plugin.");
    break;
  }

  case "status": {
    const port = process.env.DISCORD_BRIDGE_PORT || "13456";
    const host = process.env.DISCORD_BRIDGE_HOST || "127.0.0.1";
    const apiKey = process.env.DISCORD_BRIDGE_API_KEY;
    if (!apiKey) {
      console.error("DISCORD_BRIDGE_API_KEY is required to call status");
      process.exit(1);
    }
    try {
      const res = await fetch(`http://${host}:${port}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.error("Server is not running");
      process.exit(1);
    }
    break;
  }

  default:
    console.log("discord-bridge - Claude Code <-> Discord communication bridge");
    console.log("");
    console.log("Usage: discord-bridge <command>");
    console.log("");
    console.log("Commands:");
    console.log("  start     Start the Discord bridge server");
    console.log("  install   Install Claude Code plugin to ~/.claude/plugins/");
    console.log("  status    Check server health");
    break;
}
