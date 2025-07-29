<template>
  <!-- 空模板，或者可以完全删除这个文件 -->
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

// 跳转到登录页面
function openLogin() {
  router.push({ name: 'login', query: { mode: 'login' } });
}

// 跳转到注册页面
function openRegister() {
  router.push({ name: 'login', query: { mode: 'register' } });
}

// 暴露方法给父组件调用
defineExpose({ openLogin, openRegister });
</script>