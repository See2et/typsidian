# 技術スタック

## アーキテクチャ
- Obsidian Plugin API を直接利用するシングルエントリの TypeScript プラグイン。
- `src/main.ts` を主制御点として、イベント登録・コンテキストメニュー・拡張子登録・ログの3点に集中。

## コア技術
- **言語**: TypeScript
- **実行環境**: Node.js 20+
- **フレームワーク**: なし（React 等の UI フレームワークは未導入）
- **対象ランタイム**: Obsidian Desktop（`manifest.json` / `versions.json`）

## 主要依存
- `obsidian`（型定義と API）
- `esbuild`（単一エントリのバンドル）
- TypeScript 標準型/`@types/node`

## 開発基準
- **型安全**: `noImplicitAny`, `strictNullChecks` を有効。
- **実行環境ポリシー**: Node API は `node:` スキームで import。
- **品質**: 変更点は `npm run typecheck` と `npm run build` を実行して検証。

## 開発環境 / コマンド
- 開発: `npm run dev`
- ビルド: `npm run build`
- 型チェック: `npm run typecheck`
- デバッグ vault 構築: `npm run setup:vault`
- Hot-reload 導入: `npm run setup:hot-reload`

## 技術上の判断
- プラグイン規模が小さいため、現在は分割より `src/main.ts` の集中管理が運用上の簡潔さと保守性を優先。
- スクリプトは本体実装と分離し、開発補助処理だけを `scripts/*.mjs` に置く。
