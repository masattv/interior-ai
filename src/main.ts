// アプリケーションのエントリーポイント。
// Vue インスタンスの作成、状態管理(Pinia)とルーターの登録、
// グローバルスタイルの読み込みを行う。
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app') 