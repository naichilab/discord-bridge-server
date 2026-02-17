# discord-bridge

Claude Code / Codex CLI を Discord 経由で操作するための中継サーバー。

## 対象

- Claude Code や Codex CLI を **Discord を介してリモート操作**したい人
- [OpenClaw](https://github.com/anthropics/openclaw) ほど大がかりな仕組みは不要で、**シンプルに Discord から指示を出せればいい**人
- 外出先のスマホから作業指示を出したい人

## できること

ターミナルで Claude Code / Codex を起動し、Discord の専用チャンネルを通じて Bot 経由で双方向にやりとりできます。

**Discord → エージェント（あなたからの操作）**

- **作業指示** - Discord にメッセージを送るだけでエージェントに指示を出せる
- **質問への回答** - エージェントからの確認にリアルタイムで回答
- **離席モード終了** - 「戻ったよ」と送って通常のターミナル操作に戻る

**エージェント → Discord（エージェントからの連絡）**

- **進捗通知** - 処理の進捗・成功・エラーを Discord に通知
- **質問** - 判断が必要な場面で選択肢付きの質問を送信
- **ファイル送信** - スクリーンショットやログを Discord に共有

```
┌─────────────┐     HTTP (localhost)     ┌─────────────────┐     Discord API     ┌─────────────┐
│  Claude Code │ ◄──────────────────────► │  discord-bridge  │ ◄────────────────► │   Discord    │
│  / Codex CLI │    スキル経由で通信       │  (中継サーバー)   │    Bot が中継      │  (スマホ等)   │
└─────────────┘                          └─────────────────┘                     └─────────────┘
```

## 注意事項

Discord を介した操作では、**ターミナル上の権限許可ダイアログを操作できません**。
そのため、基本的に Claude Code の **`--dangerously-skip-permissions`** モード（通称 danger モード）で動かすことになります。

> これは、エージェントがファイル編集やコマンド実行を確認なしで行うことを意味します。信頼できるプロジェクト・環境でのみ使用してください。

## インストール

```bash
npm install -g discord-bridge
```

## セットアップ

### 1. Discord Bot 作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" をクリック → 名前を入力して作成
3. 左メニュー "Bot" → "Reset Token" → トークンをコピー
4. "Privileged Gateway Intents" で **MESSAGE CONTENT INTENT** を有効化
5. 左メニュー "OAuth2" → "URL Generator"
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Attach Files`, `Embed Links`
6. 生成された URL を開いて Bot をサーバーに追加

### 2. ID の取得

Discord の設定 → 詳細設定 → **開発者モード** を有効化してから:

- **チャンネル ID**: チャンネル名を右クリック → "チャンネル ID をコピー"
- **ユーザー ID**: 自分の名前を右クリック → "ユーザー ID をコピー"
  - Bot に指示を出すユーザー（自分自身）の ID です。Bot があなたからのメッセージだけを処理するために使います

### 3. 環境変数の設定

`~/.zshrc` に追加:

```bash
export DISCORD_BRIDGE_TOKEN="your_bot_token_here"
export DISCORD_BRIDGE_USER_ID="your_user_id_here"
```

設定後、`source ~/.zshrc` で反映してください（新しいターミナルを開く場合は不要です）。

### 4. プロジェクト設定

Claude Code を使うプロジェクトのルートに `.discord-bridge.json` を作成:

```json
{
  "channelId": "your_channel_id_here"
}
```

> **Note**: チャンネル ID は秘密情報ではありませんが、プロジェクト固有の設定です。チームで共有する場合はそのままコミットし、個人用の場合は `.gitignore` に追加してください。

### 5. スキルのインストール

プラットフォームを指定してインストールします:

```bash
# Claude Code の場合
discord-bridge install claude

# Codex の場合
discord-bridge install codex
```

`--user` を付けるとホームディレクトリにインストールされ、全プロジェクトで利用できます:

```bash
discord-bridge install claude --user
discord-bridge install codex --user
```

| コマンド | インストール先 |
|---|---|
| `install claude` | `.claude/skills/discord-comm/` |
| `install claude --user` | `~/.claude/skills/discord-comm/` |
| `install codex` | `.agents/skills/discord-comm/` |
| `install codex --user` | `~/.agents/skills/discord-comm/` |

インストール後、エージェントを再起動してスキルを読み込みます。

### 6. サーバーの起動

```bash
discord-bridge start
```

別のターミナルでヘルスチェック:

```bash
discord-bridge status
```

`{"status":"ok","bot":"BotName#1234",...}` が返れば成功です。

> **Note**: サーバーは手動で起動が必要です。エージェントが自動起動することはありません。常時起動したい場合は launchd 等のサービスマネージャーに登録してください。

## 使い方

エージェントに話しかけるだけで Discord 連携が使えます:

```
離席する              → Discord 待受モードに入る（スマホから操作可能に）
戻ったよ              → 離席モード終了、ターミナルに戻る
Discord に通知して     → テスト通知の送信
```

離席モード中は、Discord で送ったメッセージがそのままエージェントへの指示になります。

## トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| Bot がオフライン | `DISCORD_BRIDGE_TOKEN` が正しいか |
| メッセージが届かない | MESSAGE CONTENT INTENT が有効か |
| チャンネルが見つからない | `.discord-bridge.json` の `channelId` が正しいか |
| 返答が受信されない | `DISCORD_BRIDGE_USER_ID` が正しいか |

## ライセンス

MIT
