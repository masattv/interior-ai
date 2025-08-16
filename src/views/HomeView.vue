<template>
  <div class="container">
    <div class="upload-section">
      <h2>部屋の写真をアップロード</h2>
      <p>AIが部屋の寸法を推定し、最適なインテリアプランを提案します</p>
      
      <div class="upload-area" 
           :class="{ 'dragover': isDragOver, 'has-image': selectedImage }"
           @drop="handleDrop"
           @dragover.prevent="isDragOver = true"
           @dragleave.prevent="isDragOver = false">
        
        <div v-if="!selectedImage" class="upload-placeholder">
          <div class="upload-icon">📷</div>
          <p>写真をドラッグ&ドロップまたはクリックして選択</p>
          <input 
            ref="fileInput"
            type="file" 
            accept="image/*" 
            @change="handleFileSelect"
            style="display: none"
          />
          <button class="btn" @click="triggerFileSelect">
            写真を選択
          </button>
        </div>
        
        <div v-else class="image-preview">
          <img :src="selectedImage" alt="選択された画像" />
          <button class="btn btn-secondary" @click="clearImage">
            別の写真を選択
          </button>
        </div>
      </div>
      
      <div class="taste-selection" v-if="selectedImage">
        <h3>生成設定</h3>
        <div class="gen-controls">
          <div class="control-row">
            <label class="control-label">モード</label>
            <div class="control-field">
              <label><input type="radio" value="auto" v-model="mode" /> 自動</label>
              <label style="margin-left:1rem;"><input type="radio" value="manual" v-model="mode" /> 手動（家具固定）</label>
            </div>
          </div>
          <div class="control-row">
            <label class="control-label">部屋の種類</label>
            <div class="control-field">
              <label><input type="radio" value="リビング" v-model="roomTypeHint" /> リビング</label>
              <label style="margin-left:1rem;"><input type="radio" value="寝室" v-model="roomTypeHint" /> 寝室</label>
              <label style="margin-left:1rem;"><input type="radio" value="キッチン" v-model="roomTypeHint" /> キッチン</label>
            </div>
          </div>
          <div class="control-row">
            <label class="control-label">バリエーション数</label>
            <div class="control-field">
              <input class="num-input" type="number" min="1" max="3" v-model.number="numVariations" />
              <span class="hint">（1〜3）</span>
            </div>
          </div>
        </div>

        <h3 v-if="mode === 'manual'">配置したい家具を選択</h3>
        <div class="taste-options">
          <label v-for="item in furnitureOptions" :key="item.name" class="taste-option" v-if="mode === 'manual'">
            <input 
              type="checkbox"
              :value="item.name"
              v-model="selectedFurniture"
            />
            <span class="taste-label">{{ item.name }}</span>
            <select 
              v-if="mode === 'manual' && selectedFurniture.includes(item.name)"
              class="detail-select"
              v-model="furnitureDetails[item.name]"
            >
              <option value="">指定なし</option>
              <option v-for="opt in item.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </label>
        </div>

        <div class="agreement-section">
          <label class="agreement-checkbox">
            <input type="checkbox" v-model="agreedToTerms" />
            <span>利用規約とプライバシーポリシーに同意します</span>
          </label>
        </div>

        <button 
          class="btn generate-btn" 
          :disabled="!canGenerate"
          @click="generateInterior"
        >
          <span v-if="isGenerating">生成中...</span>
          <span v-else>インテリア画像を生成</span>
        </button>
      </div>
    </div>
    
    <!-- プログレスバー -->
    <div v-if="isGenerating" class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="progress-text">{{ progressText }}</p>
    </div>
    
    <!-- 結果表示 -->
      <div v-if="results.length > 0" class="results-section">
        <h2>生成されたインテリア画像</h2>
        <div class="gallery">
          <div 
            v-for="(result, index) in results" 
            :key="index"
            class="gallery-card"
          >
            <div class="gallery-image" @click="openModal(result)">
              <img :src="result.image" alt="" />
            </div>
            <div class="gallery-caption">
              
              <div class="gallery-actions">
                <button class="btn btn-secondary" @click.stop="downloadImage(result)">保存</button>
                <button class="btn btn-secondary" @click.stop="shareImage(result)">シェア</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    
    <!-- エラーメッセージ -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button class="btn" @click="retryGeneration">再試行</button>
    </div>

    <!-- 通知: 配置できなかった家具など -->
    <div v-if="interiorStore.notice" class="error-message" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;">
      <p>{{ interiorStore.notice }}</p>
    </div>
    
    <!-- モーダル -->
    <div v-if="selectedResult" class="modal" @click="closeModal">
      <div class="modal-content" @click.stop>
        <button class="modal-close" @click="closeModal">&times;</button>
        <img :src="selectedResult.image" alt="" />
        <div class="modal-info">
          <div class="modal-actions">
            <button class="btn" @click="downloadImage(selectedResult)">
              画像を保存
            </button>
            <button class="btn btn-secondary" @click="openOriginal(selectedResult)">
              原寸で開く
            </button>
            <button class="btn btn-secondary" @click="shareImage(selectedResult)">
              SNSでシェア
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 画像の選択/ドロップ、生成ボタン、進捗・結果表示など
// 画面全体の振る舞いを定義するコンポーネント。
import { ref, computed } from 'vue'
import { useInteriorStore } from '@/stores/interior'

interface InteriorResult {
  image: string
  description: string
}

const interiorStore = useInteriorStore()

// リアクティブな状態
const selectedImage = ref<string>('')
const selectedFurniture = ref<string[]>([])
const furnitureDetails = ref<Record<string, string>>({})
const mode = ref<'auto' | 'manual'>('auto')
const roomTypeHint = ref<string>('')
const numVariations = ref<number>(2)
const agreedToTerms = ref(false)
const isGenerating = ref(false)
const isDragOver = ref(false)
const progress = ref(0)
const progressText = ref('')
const results = ref<InteriorResult[]>([])
const error = ref('')
const selectedResult = ref<InteriorResult | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const imageWidth = ref<number | undefined>(undefined)
const imageHeight = ref<number | undefined>(undefined)

// 家具オプション（表示用）
const furnitureOptions = [
  { name: 'ソファ', options: ['1人掛け', '2人掛け', '3人掛け', 'カウチ'] },
  { name: 'テーブル', options: ['ローテーブル', 'ダイニング(2人)', 'ダイニング(4人)'] },
  { name: 'テレビ台', options: ['小型(〜120cm)', '中型(〜160cm)', '大型(160cm〜)'] },
  { name: '本棚', options: ['小型', '中型', '大型'] },
  { name: 'ベッド', options: ['シングル', 'セミダブル', 'ダブル', 'クイーン'] },
  { name: 'デスク', options: ['PCデスク', '学習机', 'L字デスク'] },
  { name: 'チェア', options: ['オフィスチェア', 'ダイニングチェア', 'アームチェア'] },
  { name: 'ラグ', options: ['小型', '中型', '大型', '円形'] },
  { name: '観葉植物', options: ['小型', '中型', '大型'] },
]

// 生成ボタンの活性制御
const canGenerate = computed(() => {
  const hasImage = Boolean(selectedImage.value)
  const manualOk = mode.value === 'auto' || selectedFurniture.value.length > 0
  return hasImage && agreedToTerms.value && !isGenerating.value && manualOk
})

// ファイル選択（`<input type="file">`）での読み込み
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    processImageFile(file)
  }
}

// ドロップでの読み込み
const handleDrop = (event: DragEvent) => {
  isDragOver.value = false
  if (event.dataTransfer?.files) {
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      processImageFile(file)
    }
  }
}

// ファイルを Base64 DataURL として読み込む
const processImageFile = (file: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    selectedImage.value = e.target?.result as string
    error.value = ''
    // 元画像の実寸を取得
    const img = new Image()
    img.onload = () => {
      imageWidth.value = img.naturalWidth
      imageHeight.value = img.naturalHeight
    }
    img.src = selectedImage.value
  }
  reader.readAsDataURL(file)
}

// 選択状態のクリア
const clearImage = () => {
  selectedImage.value = ''
  results.value = []
  error.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

// 生成アクション本体
const generateInterior = async () => {
  if (!canGenerate.value) return
  
  isGenerating.value = true
  progress.value = 0
  progressText.value = '画像を分析中...'
  error.value = ''
  results.value = []
  
  try {
    // プログレスをシミュレート
    const progressInterval = setInterval(() => {
      if (progress.value < 90) {
        progress.value += 10
        if (progress.value < 30) {
          progressText.value = '部屋の寸法を推定中...'
        } else if (progress.value < 60) {
          progressText.value = 'インテリアプランを生成中...'
        } else {
          progressText.value = '最終調整中...'
        }
      }
    }, 500)
    
    // API呼び出し
    const furnitureWithDetails = selectedFurniture.value.map(item => {
      const detail = furnitureDetails.value[item]?.trim()
      return detail ? `${item}(${detail})` : item
    })
    const result = await interiorStore.generateInterior({
      image: selectedImage.value,
      furniture: furnitureWithDetails,
      imageWidth: imageWidth.value,
      imageHeight: imageHeight.value,
      mode: mode.value,
      roomTypeHint: roomTypeHint.value,
      numVariations: numVariations.value
    })
    
    clearInterval(progressInterval)
    progress.value = 100
    progressText.value = '完了！'
    
    // 結果を設定
    results.value = result
    
    setTimeout(() => {
      isGenerating.value = false
      progress.value = 0
    }, 1000)
    
  } catch (err) {
    isGenerating.value = false
    progress.value = 0
    error.value = err instanceof Error ? err.message : '生成中にエラーが発生しました'
  }
}

// 再試行（エラー文言を消して再実行）
const retryGeneration = () => {
  error.value = ''
  generateInterior()
}

// モーダルの開閉
const openModal = (result: InteriorResult) => {
  selectedResult.value = result
}

const closeModal = () => {
  selectedResult.value = null
}

// 画像をローカル保存
const downloadImage = (result: InteriorResult) => {
  const link = document.createElement('a')
  link.href = result.image
  link.download = `interior-design-${Date.now()}.png`
  link.click()
}

// SNS共有（Web Share API がない場合は URL コピー）
const shareImage = (result: InteriorResult) => {
  if (navigator.share) {
    navigator.share({
      title: 'Interior AI で生成されたインテリアプラン',
      text: result.description,
      url: window.location.href
    })
  } else {
    // フォールバック: URLをクリップボードにコピー
    navigator.clipboard.writeText(window.location.href)
    alert('URLをクリップボードにコピーしました')
  }
}

// 原寸を新しいタブで開く
const openOriginal = (result: InteriorResult) => {
  window.open(result.image, '_blank')
}
// 非表示 input をクリックして選択ダイアログを開く
const triggerFileSelect = () => {
  fileInput.value?.click()
}
</script>

<style scoped>
.upload-section {
  text-align: center;
  margin-bottom: 2rem;
}

.upload-section h2 {
  margin-bottom: 0.5rem;
  color: #333;
}

.upload-section p {
  color: #666;
  margin-bottom: 2rem;
}

.upload-area {
  border: 2px dashed #ddd;
  border-radius: 1rem;
  padding: 3rem 2rem;
  margin-bottom: 2rem;
  transition: all 0.3s ease;
  background: #fafafa;
}

.upload-area.dragover {
  border-color: #007bff;
  background: #f0f8ff;
}

.upload-area.has-image {
  border-style: solid;
  border-color: #28a745;
  background: white;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.image-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.image-preview img {
  width: 100%;
  height: auto;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.taste-selection {
  margin-top: 2rem;
  padding: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.taste-selection h3 {
  margin-bottom: 1rem;
  color: #333;
}

.taste-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.taste-option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.taste-option:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.taste-option input[type="radio"],
.taste-option input[type="checkbox"] {
  margin: 0;
}

.taste-label {
  font-weight: 500;
}

.agreement-section {
  margin-bottom: 2rem;
}

.agreement-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.agreement-checkbox input[type="checkbox"] {
  margin: 0;
}

.generate-btn {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.progress-section {
  margin: 2rem 0;
  text-align: center;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
}

.progress-text {
  color: #666;
  font-weight: 500;
}

.results-section {
  margin-top: 3rem;
}

.results-section h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.gallery-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #eee;
}

.gallery-image {
  width: 100%;
}

.gallery-image img {
  display: block;
  width: 100%;
  height: auto;
}

.gallery-caption {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.gallery-title {
  margin: 0;
  font-size: 0.95rem;
  color: #333;
}

.gallery-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.gallery-actions .btn {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.error-message {
  text-align: center;
  padding: 2rem;
  background: #f8d7da;
  color: #721c24;
  border-radius: 0.5rem;
  margin: 2rem 0;
}

.error-message p {
  margin-bottom: 1rem;
}

.modal-info {
  padding: 1.5rem;
}

.modal-info h3 {
  margin-bottom: 1rem;
  color: #333;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.modal-content img {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
</style> 