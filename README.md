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
  - Bot に指示を出すユーザー（自分自身）の ID です。Bot があなたからのメッセージだけを処理するために使います

### 3. 環境変数の設定

`~/.zshrc` に追加:

```bash
export DISCORD_BRIDGE_TOKEN="your_bot_token_here"
export DISCORD_BRIDGE_USER_ID="your_user_id_here"
```

設定後、現在のターミナルに反映するには `source ~/.zshrc` を実行してください（新しいターミナルを開く場合は不要です）。

### 4. プロジェクト設定

Claude Code を使うプロジェクトのルートに `.discord-bridge.json` を作成:

```json
{
  "channelId": "your_channel_id_here"
}
```

> **Note**: チャンネル ID は秘密情報ではありませんが、プロジェクト固有の設定です。チームで共有する場合はそのままコミットし、個人用の場合は `.gitignore` に追加してください。

### 5. Claude Code プラグインのインストール

```bash
discord-bridge install
```

`~/.claude/plugins/discord-bridge/` にスキル（Discord 通知・質問・待機など）と Hooks（イベント自動転送）が配置されます。

Claude Code を再起動してプラグインを読み込みます。

### 6. 動作確認

サーバーを起動して接続を確認します:

```bash
discord-bridge start
```

別のターミナルでヘルスチェック:

```bash
discord-bridge status
```

`{"status":"ok","bot":"BotName#1234",...}` のようなレスポンスが返れば成功です。

## 使い方

### サーバーの起動

```bash
discord-bridge start
```

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
