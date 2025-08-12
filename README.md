# Interior AI Frontend

Interior AIプロジェクトのフロントエンドアプリケーションです。Vue 3 + TypeScript + Viteを使用して構築されています。

## 機能

- 📸 部屋の写真アップロード（ドラッグ&ドロップ対応）
- 🎨 インテリアテイスト選択（モダン、スカンジナビア、和風など）
- 🤖 AIによるインテリアプラン生成
- 📱 レスポンシブデザイン
- 💾 生成画像の保存機能
- 📤 SNSシェア機能
- ⚡ プログレスバー表示
- 🔒 利用規約同意機能

## 技術スタック

- **フレームワーク**: Vue 3 (Composition API)
- **言語**: TypeScript
- **ビルドツール**: Vite
- **状態管理**: Pinia
- **ルーティング**: Vue Router
- **HTTP クライアント**: Axios
- **スタイリング**: CSS3 (カスタム)

## セットアップ

### 前提条件

- Node.js 18.0.0以上
- npm または yarn

### インストール

1. 依存関係をインストール:
```bash
npm install
```

2. 開発サーバーを起動:
```bash
npm run dev
```

3. ブラウザで `http://localhost:3001` を開く

### ビルド

本番用ビルド:
```bash
npm run build
```

ビルド結果のプレビュー:
```bash
npm run preview
```

## API連携

このフロントエンドは以下のAPIエンドポイントと連携します:

- `POST /api/imageMake` - インテリアプラン生成

### API設定

`vite.config.ts`でAPIプロキシが設定されています:

```typescript
server: {
  port: 3001,
  proxy: {
    '/api': {
      target: 'http://localhost:3000', // バックエンドAPIのURL
      changeOrigin: true,
    },
  },
}
```

## プロジェクト構造

```
src/
├── components/          # Vueコンポーネント
├── views/              # ページコンポーネント
│   └── HomeView.vue    # メインページ
├── stores/             # Piniaストア
│   └── interior.ts     # インテリア関連の状態管理
├── router/             # Vue Router設定
│   └── index.ts
├── style.css           # グローバルスタイル
├── main.ts             # アプリケーションエントリーポイント
└── App.vue             # ルートコンポーネント
```

## 環境変数

必要に応じて以下の環境変数を設定できます:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_APP_TITLE=Interior AI
```

## 開発ガイドライン

### コーディング規約

- TypeScriptの厳密な型チェックを有効化
- Vue 3 Composition APIを使用
- ESLint + Prettierでコードフォーマット統一

### コンポーネント設計

- 単一責任の原則に従う
- PropsとEmitsで明確なインターフェース定義
- 再利用可能なコンポーネント設計

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## サポート

問題や質問がある場合は、GitHubのIssuesページでお知らせください。 