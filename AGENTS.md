# AGENTS.md

## プロジェクト概要

discord-bridge - Claude Code と Discord の双方向通信ブリッジ（npm パッケージ）

## 技術スタック

- Node.js (ESM)
- discord.js v14
- Express v5

## プロジェクト構成

- `bin/` - CLI エントリーポイント
- `server/` - HTTP API サーバー・Discord Bot
- `plugin/` - Claude Code プラグイン（`discord-bridge install` で配置されるファイル群）

## バージョニング

- 変更を加えたら `package.json` の `version` を更新する
- 毎回 patch バージョンを上げる（例: `0.1.2` → `0.1.3`）
- npm publish は手動で行うため、バージョン更新のみ行えばよい

## コーディング規約

- 作業・コメント・PR は日本語で記載する
- コミットメッセージは日本語で簡潔に
