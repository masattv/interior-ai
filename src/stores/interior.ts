// インテリア生成のドメインロジックを担う Pinia ストア。
// - レート制限
// - API 呼び出し
//   - 通常: FormData(file) で `/api/upload` → 返却 filename を `/api/imageMake` へ渡す
//   - 旧仕様(互換): `EXPECTS_IMAGE_PATH=true` のときは JSON `{ imagePath, prompt }`
// - レスポンスの Content-Type 判定
// - 結果の保持/エラー文言の整形
import { defineStore } from 'pinia'
import axios from 'axios'
import { API_CONFIG } from '@/config/api'

interface InteriorRequest {
  image: string
  furniture: string[]
  imageWidth?: number
  imageHeight?: number
}

interface InteriorResult {
  image: string
  description: string
}

interface ApiResponse {
  result?: string
  error?: string
  message?: string
}

export const useInteriorStore = defineStore('interior', {
  state: () => ({
    isLoading: false,
    error: null as string | null,
    notice: null as string | null,
    notPlaced: [] as string[],
    results: [] as InteriorResult[],
    apiCallCount: 0,
    lastApiCall: null as Date | null,
  }),

  getters: {
    hasResults: (state) => state.results.length > 0,
    canMakeApiCall: (state) => {
      // レート制限: 1分間に5回まで
      if (!state.lastApiCall) return true
      const timeDiff = Date.now() - state.lastApiCall.getTime()
      return timeDiff > 60000 || state.apiCallCount < 5
    }
  },

  actions: {
    async generateInterior(request: InteriorRequest): Promise<InteriorResult[]> {
      if (!this.canMakeApiCall) {
        throw new Error('API呼び出し制限に達しました。1分後に再試行してください。')
      }

      this.isLoading = true
      this.error = null
      this.notice = null
      this.notPlaced = []
      this.apiCallCount++
      this.lastApiCall = new Date()

      try {
        // プロキシ経由でAPIを呼び出し
        const apiUrl = API_CONFIG.ENDPOINTS.IMAGE_MAKE
        const prompt = this.generatePromptFromFurniture(request.furniture, request.imageWidth, request.imageHeight)
        const expectsImagePath = API_CONFIG.EXPECTS_IMAGE_PATH

        console.log('API呼び出し開始:', {
          endpoint: apiUrl,
          prompt,
          imageSize: request.image.length
        })

        const postJson = async () => {
          // 期待に応じて JSON 送信の形を分岐
          const requestData = expectsImagePath
            ? { imagePath: API_CONFIG.FALLBACK_IMAGE_PATH, prompt }
            : { imageBase64: request.image, prompt }

          console.log('JSON送信:', {
            expectsImagePath,
            keys: Object.keys(requestData),
            sample: expectsImagePath ? requestData.imagePath : (requestData as any).imageBase64?.substring(0, 30) + '...'
          })
          return axios.post(apiUrl, requestData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: API_CONFIG.TIMEOUT,
            responseType: 'blob',
          })
        }

        const postFormDataWithField = async (fieldName: string) => {
          const blob = await this.base64ToBlob(request.image)
          const formData = new FormData()
          formData.append('prompt', prompt)
          // 元画像のMIMEに合わせて拡張子を調整
          const mime = blob.type || 'image/png'
          const ext = mime.includes('jpeg') ? 'jpg' : mime.split('/')[1] || 'png'
          const filename = `upload.${ext}`
          formData.append(fieldName, blob, filename)
          console.log(`FormData送信: { prompt, ${fieldName}: Blob }`, { size: blob.size, type: mime })
          return axios.post(API_CONFIG.ENDPOINTS.UPLOAD, formData, {
            timeout: API_CONFIG.TIMEOUT,
            responseType: 'blob',
          })
        }

        // レスポンスを Content-Type に応じて InteriorResult[] に変換
        const handleResponse = async (response: any): Promise<InteriorResult[]> => {
          console.log('APIレスポンス:', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers['content-type'],
          })
          const contentType = response.headers['content-type'] || ''
          if (contentType.includes('application/json')) {
            const jsonText = await response.data.text()
            const jsonData = JSON.parse(jsonText) as ApiResponse & { notPlaced?: string[], report?: string }
            console.log('JSONレスポンス:', jsonData)
            if (jsonData.error || jsonData.message) {
              throw new Error(jsonData.error || jsonData.message || '生成に失敗しました')
            }
            if (!jsonData.result) {
              throw new Error('レスポンスに結果が含まれていません')
            }
            const resultImage = jsonData.result
            const results: InteriorResult[] = [
              {
                image: resultImage.startsWith('data:') ? resultImage : `data:image/jpeg;base64,${resultImage}`,
                description: `${prompt} - 生成されたデザイン`
              }
            ]
            if (jsonData.notPlaced?.length) {
              this.notPlaced = jsonData.notPlaced
              this.notice = `配置できなかった家具: ${jsonData.notPlaced.join('、')}`
            } else if (jsonData.report) {
              this.notice = jsonData.report
            }
            this.results = results
            return results
          }
          if (contentType.includes('image/')) {
            const blob: Blob = response.data
            const imageUrl = URL.createObjectURL(blob)
            const results: InteriorResult[] = [
              { image: imageUrl, description: `${prompt} - 生成されたデザイン` }
            ]
            this.results = results
            return results
          }
          console.error('予期しないレスポンス形式:', contentType)
          throw new Error('予期しないレスポンス形式です')
        }

        // まずは JSON で送信
        try {
          const response = await postJson()
          return await handleResponse(response)
        } catch (jsonErr: any) {
          // バックエンド仕様が imagePath(JSON) 固定の場合は FormData リトライせずエラーを返す
          if (expectsImagePath) {
            const currentPath = API_CONFIG.FALLBACK_IMAGE_PATH
            const pngFallbackPath = currentPath.replace(/\.jpe?g$/i, '.png')
            // .jpg 指定時のみ .png に自動フォールバック（READMEの例に準拠）
            if (pngFallbackPath !== currentPath) {
              console.warn('JSON送信失敗。imagePath を .jpg -> .png に切り替えて再試行します。', {
                status: axios.isAxiosError(jsonErr) ? jsonErr.response?.status : undefined,
                from: currentPath,
                to: pngFallbackPath,
              })
              const requestData = { imagePath: pngFallbackPath, prompt }
              const response = await axios.post(apiUrl, requestData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: API_CONFIG.TIMEOUT,
                responseType: 'blob',
              })
              return await handleResponse(response)
            }
            console.error('JSON送信失敗（imagePath要求モード）', {
              status: axios.isAxiosError(jsonErr) ? jsonErr.response?.status : undefined,
              message: (jsonErr as Error).message,
            })
            throw jsonErr
          }
          // それ以外は FormData で再試行（まず 'image'、失敗なら 'file'）
          if (axios.isAxiosError(jsonErr)) {
            console.warn('JSON送信失敗。FormData(image)で再試行します。', {
              status: jsonErr.response?.status,
              message: jsonErr.message,
            })
            try {
              // 1) まず /api/upload にアップロード
              const uploadRes = await postFormDataWithField('file')
              const text = await (uploadRes.data as Blob).text()
              const data = JSON.parse(text)
              if (!data?.filename) {
                throw new Error('Upload API did not return filename')
              }
              // 2) アップロード後のファイルを imageMake に渡す
              const imagePath = `images/${data.filename}`
              const imageMakeRes = await axios.post(apiUrl, { imagePath, prompt }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: API_CONFIG.TIMEOUT,
                responseType: 'blob',
              })
              return await handleResponse(imageMakeRes)
            } catch (fdErr: any) {
              console.error('アップロード→imageMake 連携に失敗', {
                status: axios.isAxiosError(fdErr) ? fdErr.response?.status : undefined,
                message: (fdErr as Error).message,
              })
              throw fdErr
            }
          }
          throw jsonErr
        }

      } catch (error) {
        this.apiCallCount-- // エラー時はカウントを戻す
        this.lastApiCall = null
        
        if (axios.isAxiosError(error)) {
          console.error('Axiosエラー詳細:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              headers: error.config?.headers
            }
          })

          if (error.response?.status === 429) {
            this.error = 'API呼び出し制限に達しました。しばらく待ってから再試行してください。'
          } else if (error.response?.status === 400) {
            this.error = '画像の形式が正しくありません。別の画像をお試しください。'
          } else if (error.response?.status === 500) {
            this.error = 'バックエンドで内部エラーが発生しました。サーバーログを確認してください。'
            console.error('500エラー詳細:', {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data,
              headers: error.response.headers
            })
          } else if (error.code === 'ECONNABORTED') {
            this.error = 'タイムアウトしました。画像サイズを小さくして再試行してください。'
          } else if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
            this.error = 'バックエンドAPIサーバーが起動していません。APIサーバーを起動してから再試行してください。'
          } else if (error.message.includes('Network Error')) {
            this.error = 'ネットワークエラーが発生しました。バックエンドAPIサーバーが起動しているか確認してください。'
            console.error('ネットワークエラー詳細:', error)
          } else if (error.response?.data) {
            // Blobレスポンスの場合のエラーハンドリング
            try {
              const errorText = await error.response.data.text()
              const errorData = JSON.parse(errorText)
              
              if (errorData.error || errorData.message) {
                this.error = `バックエンドエラー: ${errorData.error || errorData.message}`
                console.error('バックエンドエラー詳細:', errorData)
              } else {
                this.error = `バックエンドエラー: ${errorText}`
                console.error('バックエンドエラーテキスト:', errorText)
              }
            } catch (parseError) {
              // JSONパースに失敗した場合
              this.error = `バックエンドエラー: ${error.response.status} ${error.response.statusText}`
              console.error('エラーレスポンスのパースに失敗:', parseError)
            }
            
            console.error('バックエンドレスポンス全体:', error.response)
            console.error('リクエストデータ:', {
              imagePathOrBase64: request.image.substring(0, 100) + '...',
              prompt
            })
            console.error('HTTPステータス:', error.response.status)
            console.error('レスポンスヘッダー:', error.response.headers)
          } else {
            this.error = `APIエラー: ${error.message}`
          }
        } else {
          this.error = error instanceof Error ? error.message : '予期しないエラーが発生しました'
        }
        
        throw new Error(this.error)
      } finally {
        this.isLoading = false
      }
    },

    generatePromptFromFurniture(furniture: string[], imageWidth?: number, imageHeight?: number): string {
      const sizePart = imageWidth && imageHeight ? `元画像サイズは幅${imageWidth}px×高さ${imageHeight}pxです。` : ''
      const basePrompt = `${sizePart}現在の写真に合う家具を適切に配置してください。各家具は一般的な寸法を想定し、スケール感を一致させてください。生成画像には文字やテキストを入れないでください。`
      if (!Array.isArray(furniture) || furniture.length === 0) return basePrompt
      const list = furniture.map((f) => `「${f}」`).join('、')
      return `${basePrompt}配置対象は${list}です。`
    },

    clearResults() {
      this.results = []
      this.error = null
      this.notice = null
      this.notPlaced = []
    },

    resetApiCount() {
      this.apiCallCount = 0
      this.lastApiCall = null
    },

    // Base64画像データをBlobに変換するヘルパー関数
    async base64ToBlob(base64: string): Promise<Blob> {
      const response = await fetch(base64)
      return response.blob()
    }
  }
}) 