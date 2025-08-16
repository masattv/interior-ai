# Interior AI フロントエンド 詳細設計

## 1. 依存関係/設定
- Vue 3, TypeScript, Pinia, Vue Router, Axios, Vite
- `vite.config.ts` で alias `@ → src/`、`/api` プロキシ（3001→3000）
- `src/config/api.ts` に API 設定（エンドポイント/タイムアウト/挙動切替）

## 2. 主要コンポーネント
### 2.1 `src/views/HomeView.vue`
- 入力: 画像（Base64 DataURLとして state 管理）、家具選択（文字列配列）、詳細（Map）
- UI: アップロード領域、チェックボックス群、進捗バー、結果ギャラリー、モーダル
- 振る舞い:
  - `processImageFile(file)` で Base64 取得＋ `naturalWidth/Height` を計測
  - `generateInterior()` でストアの `generateInterior` 呼び出し
  - 進捗は疑似（interval で 90% まで）
  - 保存/共有/原寸オープン操作

### 2.2 `src/stores/interior.ts`
- State: `isLoading`, `error`, `notice`, `notPlaced[]`, `results[]`, `apiCallCount`, `lastApiCall`
- Getters: `hasResults`, `canMakeApiCall`（1分間/最大5回）
- Actions:
  - `generateInterior(request)`
    - prompt生成: `generatePromptFromFurniture(furniture, imageWidth, imageHeight)`
    - 送信モード:
      - 既定フロー: `POST /api/upload(file)` → `{ filename }` → `POST /api/imageMake({ imagePath, prompt })`
      - 互換: `EXPECTS_IMAGE_PATH=true` なら JSON `{ imagePath, prompt }` 直送、もしくは `{ imageBase64, prompt }`
    - レスポンス処理: `Content-Type` を判定し、画像 or JSON を `InteriorResult[]` に正規化
    - 例外処理: Axios/HTTPコード/タイムアウト/ネットワーク/Blobエラーの各分岐
  - `generatePromptFromFurniture(furniture, w, h)`
  - `clearResults()`, `resetApiCount()`, `base64ToBlob(base64)`

## 3. データモデル
```ts
type InteriorRequest = {
  image: string;
  furniture: string[];
  imageWidth?: number;
  imageHeight?: number;
}

type InteriorResult = {
  image: string;
  description: string;
}
```

## 4. UI詳細（HomeView）
- ボタン活性: `canGenerate = !!image && agreed && !isGenerating && furniture.length > 0`
- エラーバナー: `error` 非空時に表示、再試行ボタンで `generateInterior()`
- 通知バナー: ストアの `notice` に応じて表示（`notPlaced` など）
- モーダル: クリックで選択、`download/share/openOriginal` 提供

## 5. エラーハンドリング詳細
- HTTP 429: レート制限文言
- HTTP 400: 画像形式エラー
- HTTP 500: バックエンド内部エラー（追加ログ出力）
- `ECONNABORTED`: タイムアウト文言
- `ECONNREFUSED`/Network Error: API未起動/ネットワーク文言
- Blobレスポンス時の JSON パース試行と詳細ログ

## 6. レート制限
- 1分あたり5回まで。`apiCallCount/lastApiCall` で判定、失敗時カウント戻し。

## 7. テスト観点（フロント）
- ユニット: プロンプト生成、canGenerate判定、エラーメッセージ分岐
- 結合: アップロード→imageMake の二段階フロー（モック）
- E2E: 画像選択→生成→表示→保存/共有（Web Share API フォールバック含む）

## 8. セキュリティ/パフォーマンス
- 画像はフロントで保持し必要時のみ送信。APIキーはバックエンドで保持。
- 必要に応じて画像圧縮/リサイズを追加可能。


