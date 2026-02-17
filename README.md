# discord-bridge

Claude Code と Discord の双方向通信ブリッジ。スマホから Claude Code を操作できます。

## 機能

- **質問 & 返答** - Discord で質問して返答を待つ
- **通知** - 進捗・成功・警告・エラーを通知
- **ファイル共有** - ファイルを Discord に送信
- **メッセージ取得** - ユーザーからの指示を取得
- **リアルタイム待機** - SSE 接続で次の指示を待機
- **離席モード** - ターミナルを離れても Discord 経由で操作
- **Hooks** - 通知・停止イベントを自動で Discord に転送

## インストール

```bash
npm install -g discord-bridge
```

## セットアップ

### 1. Discord Bot 作成

1. https://discord.com/developers/applications にアクセス
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

### 3. 環境変数の設定

`~/.zshrc` に追加:

```bash
export DISCORD_BRIDGE_TOKEN="your_bot_token_here"
export DISCORD_BRIDGE_USER_ID="your_user_id_here"
export DISCORD_BRIDGE_API_KEY="generate_a_long_random_string"
# Optional: bind HTTP API to a specific host (default: 127.0.0.1)
# export DISCORD_BRIDGE_HOST="127.0.0.1"
```

設定後: `source ~/.zshrc`

### 4. プロジェクト設定

Claude Code を使うプロジェクトのルートに `.discord-bridge.json` を作成:

```json
{
  "channelId": "your_channel_id_here"
}
```

### 5. Claude Code プラグインのインストール

```bash
discord-bridge install
```

Claude Code を再起動してプラグインを読み込みます。

## 使い方

### サーバーの起動

```bash
discord-bridge start
```

### ヘルスチェック

```bash
discord-bridge status
```

## セキュリティ

- すべての HTTP エンドポイントは `Authorization: Bearer <DISCORD_BRIDGE_API_KEY>` ヘッダーでの認証が必須です。`DISCORD_BRIDGE_API_KEY` には十分に長いランダム文字列を設定してください。
- HTTP サーバーはデフォルトで `127.0.0.1` にバインドされ、ローカルホスト経由のアクセスのみを受け付けます。リッスンアドレスを変える場合は `DISCORD_BRIDGE_HOST` を明示的に設定してください。

### Claude Code での利用

Claude Code で以下のように話しかけてください:

- 「Discord にテスト通知を送って」 - 通知テスト
- 「離席する」 - 離席モード（Discord 経由で操作）

## トラブルシューティング

- **Bot がオフライン**: `DISCORD_BRIDGE_TOKEN` が正しいか確認
- **メッセージが届かない**: MESSAGE CONTENT INTENT が有効か確認
- **チャンネルが見つからない**: `.discord-bridge.json` の `channelId` が正しいか確認
- **返答が受信されない**: `DISCORD_BRIDGE_USER_ID` が正しいか確認

## ライセンス

MIT
