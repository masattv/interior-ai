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
  mode?: 'auto' | 'manual'
  roomTypeHint?: string
  numVariations?: number
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
        const prompt = this.generatePromptFromFurniture(
          request.furniture,
          request.imageWidth,
          request.imageHeight,
          {
            mode: request.mode,
            roomTypeHint: request.roomTypeHint,
            numVariations: request.numVariations,
          }
        )
        const expectsImagePath = API_CONFIG.EXPECTS_IMAGE_PATH

        console.log('API呼び出し開始:', {
          endpoint: apiUrl,
          prompt,
          imageSize: request.image.length
        })

        const postJson = async (promptArg: string) => {
          // 期待に応じて JSON 送信の形を分岐
          const requestData = expectsImagePath
            ? { imagePath: API_CONFIG.FALLBACK_IMAGE_PATH, prompt: promptArg }
            : { imageBase64: request.image, prompt: promptArg }

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

        const postFormDataWithField = async (fieldName: string, promptArg: string) => {
          const blob = await this.base64ToBlob(request.image)
          const formData = new FormData()
          formData.append('prompt', promptArg)
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
                description: '生成されたデザイン'
              }
            ]
            if (jsonData.notPlaced?.length) {
              this.notPlaced = jsonData.notPlaced
              this.notice = `配置できなかった家具: ${jsonData.notPlaced.join('、')}`
            } else if (jsonData.report) {
              this.notice = jsonData.report
            }
            return results
          }
          if (contentType.includes('image/')) {
            const blob: Blob = response.data
            const imageUrl = URL.createObjectURL(blob)
            const results: InteriorResult[] = [
              { image: imageUrl, description: '生成されたデザイン' }
            ]
            return results
          }
          console.error('予期しないレスポンス形式:', contentType)
          throw new Error('予期しないレスポンス形式です')
        }

        const runOne = async (promptArg: string): Promise<InteriorResult[]> => {
          // 1) まずは Upload → imageMake（ユーザー画像を確実に使用）
          try {
            const uploadRes = await postFormDataWithField('file', promptArg)
            const text = await (uploadRes.data as Blob).text()
            const data = JSON.parse(text)
            if (!data?.filename) {
              throw new Error('Upload API did not return filename')
            }
            const imagePath = `images/${data.filename}`
            const imageMakeRes = await axios.post(apiUrl, { imagePath, prompt: promptArg }, {
              headers: { 'Content-Type': 'application/json' },
              timeout: API_CONFIG.TIMEOUT,
              responseType: 'blob',
            })
            return await handleResponse(imageMakeRes)
          } catch (uploadErr: any) {
            console.warn('Upload 経由での生成に失敗。フォールバックを試行します。', {
              status: axios.isAxiosError(uploadErr) ? uploadErr.response?.status : undefined,
              message: (uploadErr as Error).message,
            })
            // 2) expectsImagePath=true: サーバー既存画像パスでJSON直送
            if (expectsImagePath) {
              try {
                const currentPath = API_CONFIG.FALLBACK_IMAGE_PATH
                const response = await axios.post(apiUrl, { imagePath: currentPath, prompt: promptArg }, {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: API_CONFIG.TIMEOUT,
                  responseType: 'blob',
                })
                return await handleResponse(response)
              } catch (e) {
                // jpg→png 自動切替
                const currentPath = API_CONFIG.FALLBACK_IMAGE_PATH
                const pngFallbackPath = currentPath.replace(/\.jpe?g$/i, '.png')
                if (pngFallbackPath !== currentPath) {
                  const response = await axios.post(apiUrl, { imagePath: pngFallbackPath, prompt: promptArg }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: API_CONFIG.TIMEOUT,
                    responseType: 'blob',
                  })
                  return await handleResponse(response)
                }
                throw e
              }
            }
            // 3) それ以外は Base64 JSON 直送
            const response = await postJson(promptArg)
            return await handleResponse(response)
          }
        }

        const num = Math.min(3, Math.max(1, Number(request.numVariations ?? 1)))
        const aggregated: InteriorResult[] = []
        // サーバー側の同時実行制限を考慮し逐次生成
        for (let i = 1; i <= num; i++) {
          const promptForCall = `${prompt}\n（バリエーション ${i}）`
          try {
            const one = await runOne(promptForCall)
            aggregated.push(...one)
          } catch (e) {
            console.warn('1件の生成に失敗しました（継続します）', e)
          }
        }
        this.results = aggregated
        return aggregated

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

    generatePromptFromFurniture(
      furniture: string[],
      imageWidth?: number,
      imageHeight?: number,
      options?: { mode?: 'auto' | 'manual'; roomTypeHint?: string; numVariations?: number }
    ): string {
      const widthText = typeof imageWidth === 'number' && imageWidth > 0 ? `${imageWidth}` : '不明'
      const heightText = typeof imageHeight === 'number' && imageHeight > 0 ? `${imageHeight}` : '不明'
      const sizeLine = `幅${widthText}px × 高さ${heightText}px`
      const roomTypeHint = (options?.roomTypeHint || '').trim() || '未指定'
      const mode = options?.mode || 'auto'
      const numVariationsRaw = options?.numVariations ?? 2
      const numVariations = Math.min(3, Math.max(1, Number(numVariationsRaw) || 2))

      let manualBlock = ''
      if (mode === 'manual' && Array.isArray(furniture) && furniture.length > 0) {
        const list = furniture.map((f) => `「${f}」`).join('、 ')
        manualBlock = `- 手動配置モード。以下の家具のみを使用し、新規追加しないこと。\n- 許可家具: ${list}`
      }

      const prompt = [
        '【役割】',
        'あなたはインテリアスタイリストです。与えられた部屋写真をもとに、',
        '「ビフォーアフターのアフター」にあたる写実的な完成イメージを生成してください。',
        '',
        '【出力ルール】',
        '- 出力は画像のみ。テキスト、透かし、ラベル、キャプションを画像に含めないこと。',
        '- カメラの視点、壁の位置、窓や建築的な固定要素は維持すること（構図や壁・床の材質/色は変更しない）。',
        '- 家具のサイズ感は現実的に。小規模〜中規模の日本の住居に収まるスケールを守ること。',
        '- 通路は可能な限り60cm以上確保し、ドアや窓をふさがないこと。',
        '- 光は自然で柔らかく、素材感も写実的に表現すること。',
        '',
        '【部屋情報】',
        `画像サイズ: ${sizeLine}`,
        `部屋の種類: ${roomTypeHint}    // 例: リビング / 寝室 / キッチン（単語のみ）`,
        '',
        '【家具ルール】',
        manualBlock,
        `- 家具ルールが指定されていない場合は、自動配置モードとし、部屋の種類（${roomTypeHint}）に基づいて適切な家具を選んで配置してください。`,
        '',
        '【禁止事項】',
        '- 部屋の広さを誇張したり、非現実的な拡張を行ってはいけません。',
        '- 窓や扉をふさぐような配置は禁止します。',
        '- 壁や床の素材・色、構図、カメラの視点を変更してはいけません。',
        '- 人物や動物を追加してはいけません。',
        '',
        '【指示】',
        `上記条件に従って、${numVariations}種類（${numVariations}枚）の異なるレイアウトを生成してください（1〜3の範囲）。`,
        '各案は色合いや家具の配置にバリエーションを持たせ、スケール感を崩さないこと。',
        '画像内にテキストを入れないこと。'
      ]
        .filter((line) => line !== '')
        .join('\n')

      return prompt
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