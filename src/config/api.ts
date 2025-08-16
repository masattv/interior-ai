// API設定
// - /api/upload: ファイルアップロード（file フィールド、PNG以外は 400）
// - /api/imageMake: JSON { imagePath, prompt } を受理
export const API_CONFIG = {
  // 本番では VITE_API_BASE_URL にフルURLを設定（例: https://api.example.com）。
  // 未設定時は '' とし、開発時は相対パスで Vite のプロキシ `/api` を利用する。
  BASE_URL: (import.meta.env.VITE_API_BASE_URL ?? '').toString().trim(),
  ENDPOINTS: {
    IMAGE_MAKE: '/api/imageMake',
    UPLOAD: '/api/upload'
  },
  TIMEOUT: 30000,
  // バックエンドがファイルパスを期待する場合の設定（READMEに準拠）
  EXPECTS_IMAGE_PATH: (import.meta.env.VITE_API_EXPECTS_PATH ?? 'true') === 'true',
  // サーバー側に存在する画像パス（例: backend/images/sample.png -> 'images/sample.png'）
  FALLBACK_IMAGE_PATH: import.meta.env.VITE_API_IMAGE_PATH || 'images/sample.png'
}

// CORS設定
export const CORS_CONFIG = {
  credentials: false,
  headers: {
    'Content-Type': 'application/json'  // JSON形式で送信するため修正
  }
} 