import express from "express";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { readFile, stat } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  token: process.env.DISCORD_BRIDGE_TOKEN,
  userId: process.env.DISCORD_BRIDGE_USER_ID,
  port: parseInt(process.env.DISCORD_BRIDGE_PORT || "13456", 10),
  defaultTimeout: 5 * 60 * 1000,
  maxTimeout: 30 * 60 * 1000,
  maxFileSize: 8 * 1024 * 1024,
  maxMessageHistory: 50,
  sseKeepAliveInterval: 30 * 1000,
};

function validateConfig() {
  const missing = [];
  if (!CONFIG.token) missing.push("DISCORD_BRIDGE_TOKEN");
  if (!CONFIG.userId) missing.push("DISCORD_BRIDGE_USER_ID");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// ---------------------------------------------------------------------------
// Discord Bot
// ---------------------------------------------------------------------------

let discordClient = null;

// Per-channel state
const channelCache = new Map();
const messageQueues = new Map();
const pendingQuestions = new Map();
const sseSubscribers = new Map();

function getMessageQueue(channelId) {
  if (!messageQueues.has(channelId)) {
    messageQueues.set(channelId, []);
  }
  return messageQueues.get(channelId);
}

function getSseSubscribers(channelId) {
  if (!sseSubscribers.has(channelId)) {
    sseSubscribers.set(channelId, new Set());
  }
  return sseSubscribers.get(channelId);
}

function broadcastSseEvent(channelId, event, data) {
  const subscribers = sseSubscribers.get(channelId);
  if (!subscribers || subscribers.size === 0) return false;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of subscribers) {
    res.write(payload);
  }
  return true;
}

async function fetchChannel(channelId) {
  if (channelCache.has(channelId)) {
    return channelCache.get(channelId);
  }
  const ch = await discordClient.channels.fetch(channelId);
  if (!ch || !ch.isTextBased()) {
    throw new Error(
      `Channel ${channelId} not found or is not a text channel`
    );
  }
  channelCache.set(channelId, ch);
  return ch;
}

async function initDiscord() {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.on("messageCreate", (message) => {
    if (message.author.id !== CONFIG.userId) return;
    if (message.author.bot) return;

    const chId = message.channel.id;

    const parsed = {
      content: message.content,
      attachments: message.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        size: a.size,
        contentType: a.contentType,
      })),
      timestamp: message.createdAt.toISOString(),
      id: message.id,
    };

    // Priority: pendingQuestion (/ask) > SSE subscribers > queue
    const pending = pendingQuestions.get(chId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingQuestions.delete(chId);
      pending.resolve(parsed);
    } else if (broadcastSseEvent(chId, "message", parsed)) {
      // Delivered to SSE subscribers — send auto-ack to Discord
      const preview = parsed.content.length > 20
        ? parsed.content.slice(0, 20) + "..."
        : parsed.content;
      message.reply(`受信しました (${preview})`).catch(() => {});
    } else {
      const queue = getMessageQueue(chId);
      queue.push(parsed);
      if (queue.length > CONFIG.maxMessageHistory) {
        queue.shift();
      }
    }
  });

  await discordClient.login(CONFIG.token);

  await new Promise((resolve, reject) => {
    if (discordClient.isReady()) {
      resolve();
      return;
    }
    discordClient.once("ready", resolve);
    discordClient.once("error", reject);
  });

  console.log(`[discord-bridge] Bot connected as ${discordClient.user.tag}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmbed({ title, description, color = 0x7c3aed, fields = [] }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
  for (const field of fields) {
    embed.addFields(field);
  }
  return embed;
}

async function sendMessage(channelId, content, embeds = [], files = []) {
  const ch = await fetchChannel(channelId);
  return ch.send({ content, embeds, files });
}

function waitForReply(channelId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingQuestions.delete(channelId);
      reject(
        new Error(`No reply received within ${timeoutMs / 1000} seconds`)
      );
    }, timeoutMs);
    pendingQuestions.set(channelId, { resolve, reject, timeoutId });
  });
}

function resolveChannelId(req) {
  return req.body?.channelId || req.query?.channelId || null;
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// ---- GET /health ----
app.get("/health", (_req, res) => {
  const botReady = discordClient?.isReady() ?? false;
  const channelId = _req.query.channelId;
  const response = {
    status: botReady ? "ok" : "disconnected",
    bot: discordClient?.user?.tag ?? null,
  };
  if (channelId) {
    response.channel = channelId;
    response.queuedMessages = getMessageQueue(channelId).length;
    response.sseSubscribers = getSseSubscribers(channelId).size;
  }
  res.json(response);
});

// ---- GET /events (SSE) ----
app.get("/events", (req, res) => {
  const channelId = req.query.channelId;
  if (!channelId) {
    return res.status(400).json({ status: "error", error: "channelId is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ channelId })}\n\n`);

  // Flush any queued messages
  const queue = getMessageQueue(channelId);
  while (queue.length > 0) {
    const msg = queue.shift();
    res.write(`event: message\ndata: ${JSON.stringify(msg)}\n\n`);
  }

  // Register subscriber
  const subscribers = getSseSubscribers(channelId);
  subscribers.add(res);

  // Keep-alive ping
  const pingInterval = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, CONFIG.sseKeepAliveInterval);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(pingInterval);
    subscribers.delete(res);
    if (subscribers.size === 0) {
      sseSubscribers.delete(channelId);
    }
  });
});

// ---- POST /ask ----
app.post("/ask", async (req, res) => {
  const { question, context, timeout_seconds = 300, options } = req.body;
  const channelId = resolveChannelId(req);
  if (!channelId) {
    return res.status(400).json({ status: "error", error: "channelId is required" });
  }
  if (!question) {
    return res.status(400).json({ status: "error", error: "question is required" });
  }

  const timeoutMs = Math.min(timeout_seconds * 1000, CONFIG.maxTimeout);
  const fields = [];

  if (context) {
    fields.push({ name: "Context", value: context.slice(0, 1024) });
  }
  if (options && options.length > 0) {
    fields.push({
      name: "Suggested Replies",
      value: options.map((opt, i) => `**${i + 1}.** ${opt}`).join("\n"),
    });
  }
  fields.push({
    name: "Timeout",
    value: `${timeout_seconds}s`,
    inline: true,
  });
  const embed = createEmbed({
    title: "Question from Claude Code",
    description: question,
    color: 0xe84393,
    fields,
  });

  await sendMessage(channelId, `<@${CONFIG.userId}>`, [embed]);

  try {
    const reply = await waitForReply(channelId, timeoutMs);
    res.json({
      status: "replied",
      reply: reply.content,
      attachments: reply.attachments,
      timestamp: reply.timestamp,
    });
  } catch (err) {
    res.status(408).json({ status: "timeout", error: err.message });
  }
});

// ---- POST /notify ----
app.post("/notify", async (req, res) => {
  const { message, level = "info", title } = req.body;
  const channelId = resolveChannelId(req);
  if (!channelId) {
    return res.status(400).json({ status: "error", error: "channelId is required" });
  }
  if (!message) {
    return res.status(400).json({ status: "error", error: "message is required" });
  }

  const colorMap = {
    info: 0x3498db,
    success: 0x2ecc71,
    warning: 0xf39c12,
    error: 0xe74c3c,
  };
  const iconMap = {
    info: "\u2139\ufe0f",
    success: "\u2705",
    warning: "\u26a0\ufe0f",
    error: "\u274c",
  };

  if (level === "info") {
    await sendMessage(channelId, message);
  } else {
    const embed = createEmbed({
      title:
        title || `${iconMap[level]} ${level.charAt(0).toUpperCase() + level.slice(1)}`,
      description: message,
      color: colorMap[level] ?? colorMap.info,
    });
    await sendMessage(channelId, null, [embed]);
  }
  res.json({ status: "sent", level });
});

// ---- POST /send-file ----
app.post("/send-file", async (req, res) => {
  const { file_path, message } = req.body;
  const channelId = resolveChannelId(req);
  if (!channelId) {
    return res.status(400).json({ status: "error", error: "channelId is required" });
  }
  if (!file_path) {
    return res.status(400).json({ status: "error", error: "file_path is required" });
  }

  try {
    const stats = await stat(file_path);
    if (stats.size > CONFIG.maxFileSize) {
      return res.status(413).json({
        status: "error",
        error: `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB exceeds 8MB limit`,
      });
    }
  } catch {
    return res.status(404).json({
      status: "error",
      error: `File not found: ${file_path}`,
    });
  }

  const fileBuffer = await readFile(file_path);
  const fileName = path.basename(file_path);
  const attachment = new AttachmentBuilder(fileBuffer, { name: fileName });

  const embed = createEmbed({
    title: "File from Claude Code",
    description: message || `\`${fileName}\``,
    color: 0x9b59b6,
  });

  await sendMessage(channelId, null, [embed], [attachment]);
  res.json({ status: "sent", fileName });
});

// ---- GET /messages ----
app.get("/messages", async (req, res) => {
  const channelId = resolveChannelId(req);
  if (!channelId) {
    return res.status(400).json({ status: "error", error: "channelId is required" });
  }

  const count = Math.min(
    parseInt(req.query.count || "10", 10),
    CONFIG.maxMessageHistory
  );
  const includeHistory = req.query.include_history === "true";
  const messages = [];

  const queue = getMessageQueue(channelId);
  const queued = queue.splice(0, count);
  messages.push(...queued.map((m) => ({ ...m, source: "queued" })));

  if (includeHistory && messages.length < count) {
    const remaining = count - messages.length;
    const ch = await fetchChannel(channelId);
    const fetched = await ch.messages.fetch({ limit: remaining });
    const history = fetched
      .filter((m) => m.author.id === CONFIG.userId && !m.author.bot)
      .map((m) => ({
        content: m.content,
        attachments: m.attachments.map((a) => ({
          name: a.name,
          url: a.url,
          size: a.size,
          contentType: a.contentType,
        })),
        timestamp: m.createdAt.toISOString(),
        id: m.id,
        source: "history",
      }));
    messages.push(...history);
  }

  res.json({ status: "ok", count: messages.length, messages });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function main() {
  validateConfig();
  await initDiscord();

  app.listen(CONFIG.port, () => {
    console.log(
      `[discord-bridge] HTTP server listening on http://localhost:${CONFIG.port}`
    );
  });
}

process.on("SIGINT", () => {
  if (discordClient) discordClient.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (discordClient) discordClient.destroy();
  process.exit(0);
});

main().catch((err) => {
  console.error(`[discord-bridge] Fatal: ${err.message}`);
  process.exit(1);
});
