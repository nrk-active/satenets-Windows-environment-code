// src/utils/lruCache.js
// LRU (Least Recently Used) 缓存实现
export class LRUCache {
  constructor(maxSize = 50) {  // ✅ 修复: 从2改为50，匹配配置文件
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 重新设置以更新访问顺序（Map 保持插入顺序）
      this.cache.delete(key);
      this.cache.set(key, value);
      console.log(`LRU缓存命中: ${key}`);
    }
    return value;
  }

  set(key, value) {
    // 如果键已存在，先删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
      console.log(`LRU缓存更新已存在的项目: ${key}`);
    } 
    // 如果缓存已满，删除最旧的项目（Map的第一个）
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      console.log(`LRU缓存已满 (${this.cache.size}/${this.maxSize})，移除最旧的项目: ${firstKey}`);
      this.cache.delete(firstKey);
    }

    // 添加新项目
    this.cache.set(key, value);
    console.log(`LRU缓存添加: ${key}，当前缓存大小: ${this.cache.size}/${this.maxSize}`);
    console.log(`当前缓存项目: [${this.keys().join(', ')}]`);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    console.log(`清空LRU缓存，之前大小: ${this.cache.size}`);
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // 获取所有缓存的键，用于调试
  keys() {
    return Array.from(this.cache.keys());
  }
}
