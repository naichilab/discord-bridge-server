---
name: discord-communication
description: This skill should be used when the user asks to "communicate via Discord", "send a message to Discord", "check Discord for instructions", "ask a question on Discord", "notify on Discord", "share a file on Discord", "離席する", "離席モード", "Discord で待機して", "Discord待機", or when Claude Code needs to reach the user who is away from the terminal.
version: 3.0.0
---

# Discord Communication Bridge

Discord 専用チャンネルを通じてユーザーとやりとりするためのスキル。
HTTP API サーバー (`localhost:13456`) 経由で Discord Bot と通信する。

## 前提条件

サーバーが別プロセスで起動済みであること。
起動していない場合は `discord-bridge start` で起動を促す。

## ヘルパースクリプト

`$CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/` にラッパースクリプトを用意。
Bash ツールで直接実行する。

## 使用方法

### ヘルスチェック

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-status.sh
```

### 通知（一方向）

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-notify.sh "ビルド完了しました" success
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-notify.sh "エラーが発生しました" error
```

レベル: `info`（既定）, `success`, `warning`, `error`

### 質問（返答待ち）

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-ask.sh "続行しますか？"
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-ask.sh "どの方法で進めますか？" 300 "方法A" "方法B" "方法C"
```

### メッセージ取得

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-messages.sh
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-messages.sh 20 true
```

### メッセージ待機 (SSE)

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-wait.sh
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-wait.sh 21600
```

デフォルトタイムアウト: 6時間 (21600秒)。SSE接続でメッセージをリアルタイム受信する。

### ファイル送信

```bash
bash $CLAUDE_PLUGIN_ROOT/skills/discord-comm/scripts/discord-send-file.sh /path/to/file.png "スクリーンショット"
```

## パターン

### 長時間タスク

1. `discord-notify.sh` (info) で開始を通知
2. 定期的に `discord-messages.sh` で指示変更を確認
3. `discord-notify.sh` (success) で完了通知
4. 判断が必要な場合は `discord-ask.sh`

### エラー発生時

1. `discord-notify.sh` (error) でエラー報告
2. `discord-ask.sh` で対応方針を確認
3. タイムアウト時は返答が来るまで再度 `discord-ask.sh` を呼んで待機する

### 待機モード

1. `discord-notify.sh` で状況をまとめて報告
2. `discord-wait.sh` で次の指示を待つ
3. 受信した指示を実行

## 離席モード（Discord 待受ループ）

ユーザーが「離席する」「Discord で待機して」等と言った場合、以下のループに入る。

### 開始手順

1. ヘルスチェックでサーバー接続を確認
2. Discord に「離席モード開始」を通知
3. ループ開始

### ループ動作

以下を繰り返す。**タイムアウトしても勝手に終了せず、再度待機する。**

```
loop:
  1. discord-wait.sh (timeout: 21600) でメッセージを待つ（SSE接続、6時間）
     ※ SSE接続時にサーバーが自動で「クライアント接続」をDebug通知する
     レスポンス形式: {"status":"received","messages":[...]} （配列で複数件返る可能性あり）
  2. タイムアウトした場合 → 1 に戻る
  4. メッセージを受信した場合:
     a. 全メッセージを確認し、最新のメッセージを指示として扱う
     b. ただし「戻ったよ」「終了」「おわり」「bye」等の終了指示が含まれていれば → ループ終了
     c. 「やめて」「中断」「ストップ」等のキャンセル指示が含まれていれば → その前の指示は無視
     d. それ以外なら → 最新のメッセージを指示として処理を実行（下記「処理中の動作ルール」参照）
  5. 処理完了後 → 1 に戻る
```

### 処理中の動作ルール

離席モードではターミナルが見えないため、**すべての発言・思考・行動を Discord に送る。**

#### 全出力転送

通常ターミナルに表示するテキスト出力は、すべて `discord-notify.sh` で Discord にも送る。

- ※ 指示の受信・伝達は中継サーバーが自動通知するため手動通知は不要
- 指示の解釈と対応方針 → `"〇〇と解釈。△△で対応します"` (info) **← 必須**
- 処理の各ステップ → `"〇〇を実行中..."` (info)
- ツール実行結果の要約 → `"コンパイル結果: エラー0件"` (info)
- 判断・方針の説明 → `"〇〇のため、△△の方法で進めます"` (info)
- 処理完了 → 結果のまとめ (success) **← 必須**
- エラー発生 → エラー内容 (error) → `discord-ask.sh` で対応を確認

メッセージは簡潔にまとめつつ、何をしているか追えるレベルの粒度で送る。
1つのツール実行ごとに1通知が目安。ただし連続する軽微な操作はまとめてよい。

#### 中断チェック（割り込み検知）

処理中、ユーザーが Discord で「止まって」「ストップ」「中断」等を送る可能性がある。
**各ステップの合間に `discord-messages.sh` でキューをチェック**し、中断指示がないか確認する。

```
チェックタイミング:
  - ツール実行の前（Bash, Edit, Write 等を呼ぶ直前）
  - 長いループの各イテレーション
  - 判断ポイント（次に何をするか考える時）
```

中断指示を検出した場合:
1. 現在の処理を安全な状態で止める
2. `discord-notify.sh` (warning) で「中断しました。現在の状態: 〇〇」を報告
3. `discord-wait.sh` で次の指示を待つ

中断と判定するキーワード: 「止まって」「ストップ」「stop」「中断」「待って」「やめて」

#### ユーザー判断が必要な場合

- `discord-ask.sh` で質問し、選択肢を提示する
- 破壊的な操作（git push, ファイル削除等）は必ず確認を取る
- 不明確な指示は処理を始める前に明確化する

### 終了時

1. 離席モード中に行った作業のまとめを作成する
2. そのまとめを Discord に `discord-notify.sh` で送信する
3. 同じまとめをターミナルにもテキスト出力する
4. Discord に「離席モード終了。ターミナルに戻ります。」を通知し、通常のターミナル入力待ちに戻る。

### 注意事項

- 離席モード中もターミナルの作業ディレクトリは維持される
- 1回の指示で処理が完結するよう心がける
- Discord のメッセージ上限（2000文字）を超える場合は分割して送信する
