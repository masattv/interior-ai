<template>
  <div id="app">
    <header class="header">
      <h1>Interior AI</h1>
      <p>AIがあなたの部屋に最適なインテリアを提案します</p>
    </header>
    
    <main class="main">
      <router-view />
    </main>
    
    <footer class="footer">
      <div class="disclaimer">
        <p>※ このサービスはAIによる推定結果です。実際の寸法とは誤差が生じる場合があります。</p>
        <p>※ アップロードされた画像は一時的に保存され、処理後に削除されます。</p>
        <p>※ <a href="#" @click.prevent="showTerms">利用規約</a>に同意の上ご利用ください。</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const showTerms = () => {
  alert('利用規約は現在準備中です。')
}
</script>

<style scoped>
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  padding: 2rem 1rem;
}

.header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.header p {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.main {
  min-height: calc(100vh - 200px);
  padding: 2rem 1rem;
}

.footer {
  background: #f8f9fa;
  padding: 1rem;
  border-top: 1px solid #e9ecef;
}

.disclaimer {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  font-size: 0.9rem;
  color: #6c757d;
}

.disclaimer p {
  margin: 0.25rem 0;
}

.disclaimer a {
  color: #007bff;
  text-decoration: none;
}

.disclaimer a:hover {
  text-decoration: underline;
}
</style> 