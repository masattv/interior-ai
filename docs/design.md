Interior AI フロントエンド 設計資料
=================================

1. プロダクト概要
-----------------
- 目的: 部屋の写真と希望テイストから、AIがインテリア案を生成して提示する
- フロント技術: Vue 3 + TypeScript + Vite + Pinia + vue-router
- API 連携: バックエンド `POST /api/upload` → `POST /api/imageMake`

2. 開発・実行環境
-----------------
- Node.js: 18 以上推奨（22 でも可）
- 主要パッケージ: `vue`, `pinia`, `vue-router`, `axios`, `vite`, `vue-tsc`
- 型定義: `@types/node`, `vite/client`

3. ディレクトリ構成（抜粋）
-------------------------
```
src/
  config/api.ts            API関連の定数（エンドポイント、タイムアウト、挙動切替）
  stores/interior.ts       生成ロジックを内包した Pinia ストア
  views/HomeView.vue       画面本体（画像アップロード、進捗、結果UI）
  router/index.ts          ルーティング定義
  App.vue                  レイアウト（Header/Main/Footer）
  main.ts                  エントリーポイント
  style.css                共通スタイル
```

4. アプリ構成図（最新フロー）
--------------
```mermaid
flowchart LR
  A[ユーザー] -->|画像選択/テイスト選択| B[HomeView]
  B -->|アクション呼出| S[Pinia: useInteriorStore]
  S -->|FormData(file)| U[/POST /api/upload/]
  U -->|{ filename }| S
  S -->|JSON { imagePath, prompt }| M[/POST /api/imageMake/]
  M -->|画像 or JSON| S
  S -->|結果配列を更新| B
  B -->|ギャラリー表示/保存/シェア| A
```

5. データフロー（生成処理・最新）
----------------------
1. 画像選択 + テイスト選択 + 規約合意 → [生成]
2. `HomeView.vue` が `useInteriorStore().generateInterior()` を実行
3. `stores/interior.ts` にてアップロード対応:
   - 通常: `FormData(file)` で `/api/upload` に送信 → 返却 `{ filename }`
   - 続けて `/api/imageMake` へ `{ imagePath: 'images/<filename>', prompt }` を送信
   - フラグで旧仕様（imagePath直指定）にも切替可能
4. レスポンスの Content-Type を判定（JSON or 画像）→ 結果格納
5. UI に反映し、保存/共有などの操作を提供

6. API 連携仕様（フロント視点・最新版）
---------------------------
- エンドポイント:
  - `/api/upload`: FormData の `file` を PNG のみ受理（`.png` 以外は 400）
  - `/api/imageMake`: JSON `{ imagePath, prompt }` を受理
- 送信方式
  - 通常: アップロード → 返却 `filename` → `imageMake` に `images/<filename>` を渡す
  - 互換モード（旧仕様）: `VITE_API_EXPECTS_PATH=true` のとき、`imagePath` を直接送る
- タイムアウト: `API_CONFIG.TIMEOUT`（既定 30 秒）

7. 環境変数（.env）
-----------------
```
VITE_API_BASE_URL=http://localhost:3000
# 通常は false（アップロード運用）。true にすると旧仕様: imagePath を直接送る
VITE_API_EXPECTS_PATH=false
# 旧仕様でのみ利用（サーバー上の実在ファイルパス）
VITE_API_IMAGE_PATH=images/sample.png
```

8. エラーハンドリング
------------------
- ステータスコード（429/400/500 等）で文言出し分け
- Blob エラーも JSON パースを試みて詳細をログ出力
- `.png` 以外をアップロードすると `/api/upload` は 400 を返す設計
- タイムアウト・ネットワークエラーも明示

9. UI/UX 仕様（抜粋）
----------------
- 画像アップロード: D&D とクリック
- 家具選択: チェックボックス（複数選択）＋各項目の詳細テキスト（例: ベッド=セミダブル）
- 進捗表示: プログレスバー
- 結果表示: ギャラリー/モーダル/保存/共有

10. ビルドと起動
----------------
- 開発: `npm run dev`
- 本番ビルド: `npm run build`
- バックエンドの起動と `.env` の設定を事前に行う

11. セキュリティ/パフォーマンス
--------------------------
- 画像は必要最小限の保持。API キーはバックエンドで管理
- 大きな画像はアップロード前圧縮の拡張余地

12. 今後の拡張
-------------
- Base64 直接受付（サーバー側で保存→既存処理）
- 生成履歴の保存/復元
- パラメータ高度化（色/素材/予算 等）


