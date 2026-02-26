# プロジェクト構造

## 組織方針
- 機能は小さく保ち、既存の単一エントリ構成を崩さない。
- 変更は `src/` と `scripts/` の役割を明確に分離する。

## ディレクトリ規約
### プラグイン本体
- **場所**: `/src/main.ts`
- **役割**: `TypsidianPlugin` のライフサイクル、イベント登録、拡張子登録、通知・ロギングの実装を担当。

### 開発支援スクリプト
- **場所**: `/scripts/*.mjs`
- **役割**: デバッグ vault の準備、hot-reload 導入、ビルド/起動前提条件の整備。

### 配布/実行成果物
- **場所**: `/manifest.json`, `/versions.json`, `/main.js`, `/styles.css`
- **役割**: Obsidian へのロード/リリース要件。

### 開発用 Vault
- **場所**: `/debug-vault/`
- **役割**: 検証ループの再現環境。個人ノート混在禁止。

## 命名規約
- ファイル: `kebab-case` を優先（例: `setup-debug-vault.mjs`）
- 定数: `UPPER_SNAKE_CASE`（例: `TYP_EXTENSION`）
- クラス: `PascalCase`
- メソッド: `camelCase`
- メッセージ: ユーザー通知は日本語、内部ログは `[typsidian]` 接頭辞付き英語を基本。

## インポート規則
- Obsidian API は名前付き import を `obsidian` から直接。
- Node 組み込みモジュールは `node:` プレフィックスで明示。
- 外部 alias は現時点で不使用。

## 追加原則
- 変更は既存パターンに従う限り、`steering` の都度更新が不要。
- テスト・CI 設定が未導入のため、最小検証は `npm run build` と LSP 診断で担保。
