# Interior AI フロントエンド 基本設計

## 1. 目的・スコープ
- **目的**: 部屋の写真からAIでインテリアプランを生成し、結果を閲覧・保存・共有できるUIを提供する。
- **スコープ(フロント)**: 画像アップロード、家具選択、利用規約同意、生成進捗表示、結果表示/保存/共有、エラーハンドリング。
- **前提(バックエンド)**: `/api/upload` と `/api/imageMake` を提供。

## 2. 全体構成
- フレームワーク: Vue 3 (Composition API) + TypeScript + Vite
- 状態管理: Pinia (`stores/interior.ts`)
- ルーティング: Vue Router（トップ `/` のみ）
- HTTP: Axios
- ビルド/開発: Vite（ポート `3001`、`/api` を `http://localhost:3000` にプロキシ）

## 3. 画面とユーザーフロー
1) ユーザーはトップ（`/`）で写真をD&D/選択
2) 家具候補をチェック（詳細選択可）
3) 規約同意にチェック → 生成をクリック
4) 進捗（疑似）を表示しつつバックエンドに依頼
5) 生成結果をギャラリー表示、モーダルで拡大/保存/共有

## 4. モジュール分割
- `src/views/HomeView.vue`: UIと入力、生成ボタン、進捗/結果/モーダル表示
- `src/stores/interior.ts`: ドメインロジック（API呼び出し、レート制限、レスポンス解釈、結果保持、エラー整形）
- `src/config/api.ts`: APIエンドポイント、タイムアウト、互換挙動フラグ（`EXPECTS_IMAGE_PATH`）
- `src/router/index.ts`: 画面遷移定義
- `src/App.vue`/`src/main.ts`: レイアウト/エントリ

## 5. データモデル（要約）
- Request: `{ image: Base64DataURL, furniture: string[], imageWidth?: number, imageHeight?: number }`
- Result: `{ image: string, description: string }[]`
- Store State: `isLoading`, `error`, `notice`, `notPlaced[]`, `results[]`, `apiCallCount`, `lastApiCall`

## 6. API 仕様（フロント視点）
- `POST /api/upload`: フォーム `file` で画像を送付 → `{ filename }`
- `POST /api/imageMake`: JSON `{ imagePath, prompt }` もしくは（互換）`{ imageBase64, prompt }`
- タイムアウト: 30秒、画像/JSONいずれのレスポンスにも対応

## 7. 設定・環境変数
- `VITE_API_EXPECTS_PATH`（既定 true 相当）: imagePath直指定モード
- `VITE_API_IMAGE_PATH`: 旧仕様利用時のサーバー上画像パス（例: `images/sample.png`）
- Vite Proxy: `/api → http://localhost:3000`

## 8. 非機能要件（フロント側）
- パフォーマンス: 初回生成までの体感をプログレスで補助
- 可用性: 単一フロントのSPA
- セキュリティ: 画像は必要最小限で扱い、機微情報はバックエンドで管理

## 9. エラーポリシー（概要）
- HTTP 429/400/500/Timeout/Network を文言で出し分け
- BlobエラーもJSONパースを試み詳細表示
- バックエンド未起動時の案内（ECONNREFUSED 等）

## 10. 拡張余地
- 画像前処理（圧縮）
- 生成履歴/復元
- 家具パラメータ高度化（色/素材/予算）


