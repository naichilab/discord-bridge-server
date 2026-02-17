#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { spawn } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

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
    const platform = process.argv[3];
    const hasUserFlag = process.argv.includes("--user");

    if (!platform || !["claude", "codex"].includes(platform)) {
      console.error("Usage: discord-bridge install <claude|codex> [--user]");
      console.error("");
      console.error("Platforms:");
      console.error("  claude  Install skill for Claude Code (.claude/skills/)");
      console.error("  codex   Install skill for Codex (.agents/skills/)");
      console.error("");
      console.error("Options:");
      console.error("  --user  Install to home directory instead of project directory");
      process.exit(1);
    }

    const home = process.env.HOME;
    if (!home) {
      console.error("HOME environment variable is not set");
      process.exit(1);
    }

    const skillDirs = {
      claude: ".claude/skills",
      codex: ".agents/skills",
    };

    const base = hasUserFlag ? home : process.cwd();
    const target = join(base, skillDirs[platform], "discord-comm");
    const source = join(packageRoot, "plugin", "skills", "discord-comm");

    if (!existsSync(source)) {
      console.error("Skill files not found");
      process.exit(1);
    }

    mkdirSync(target, { recursive: true });
    cpSync(source, target, { recursive: true });

    // Replace script path placeholders in SKILL.md
    const skillMdPath = join(target, "SKILL.md");
    if (existsSync(skillMdPath)) {
      const absoluteTarget = resolve(target);
      let content = readFileSync(skillMdPath, "utf-8");
      content = content.replaceAll(
        "$CLAUDE_PLUGIN_ROOT/skills/discord-comm",
        absoluteTarget
      );
      writeFileSync(skillMdPath, content);
    }

    const scope = hasUserFlag ? "user" : "project";
    console.log(`Skill installed to ${target}`);
    console.log(`  Platform: ${platform}`);
    console.log(`  Scope: ${scope}`);
    console.log("");
    if (platform === "claude") {
      console.log("Restart Claude Code to load the skill.");
    } else {
      console.log("Restart Codex to load the skill.");
    }
    break;
  }

  case "status": {
    const port = process.env.DISCORD_BRIDGE_PORT || "13456";
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.error("Server is not running");
      process.exit(1);
    }
    break;
  }

  default:
    console.log("discord-bridge - Claude Code / Codex <-> Discord communication bridge");
    console.log("");
    console.log("Usage: discord-bridge <command>");
    console.log("");
    console.log("Commands:");
    console.log("  start                          Start the Discord bridge server");
    console.log("  install <claude|codex> [--user] Install skill for the specified platform");
    console.log("  status                         Check server health");
    break;
}
