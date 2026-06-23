export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private accessOrder: K[];
  private onEvict?: (key: K, value: V) => void;
  private sizeFn?: (value: V) => number;
  private currentSize: number;
  private maxSize: number;
  private hits: number;
  private misses: number;

  constructor(options: {
    maxSize: number;
    sizeFn?: (value: V) => number;
    onEvict?: (key: K, value: V) => void;
  }) {
    this.maxSize = options.maxSize;
    this.capacity = options.maxSize;
    this.cache = new Map();
    this.accessOrder = [];
    this.onEvict = options.onEvict;
    this.sizeFn = options.sizeFn || (() => 1);
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      this.hits++;
      this.touch(key);
      return this.cache.get(key);
    }
    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    const valueSize = this.sizeFn(value);
    
    if (this.cache.has(key)) {
      const oldValue = this.cache.get(key)!;
      this.currentSize -= this.sizeFn(oldValue);
      this.removeFromOrder(key);
    }

    while (this.currentSize + valueSize > this.maxSize && this.accessOrder.length > 0) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.currentSize += valueSize;
    this.accessOrder.push(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      this.currentSize -= this.sizeFn(value);
      this.cache.delete(key);
      this.removeFromOrder(key);
      if (this.onEvict) {
        this.onEvict(key, value);
      }
      return true;
    }
    return false;
  }

  clear(): void {
    if (this.onEvict) {
      this.cache.forEach((value, key) => {
        this.onEvict!(key, value);
      });
    }
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.currentSize;
  }

  get count(): number {
    return this.cache.size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  get stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate,
      size: this.currentSize,
      count: this.count,
      maxSize: this.maxSize,
    };
  }

  private touch(key: K): void {
    this.removeFromOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromOrder(key: K): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }

  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;
    const oldestKey = this.accessOrder.shift()!;
    const value = this.cache.get(oldestKey)!;
    this.currentSize -= this.sizeFn(value);
    this.cache.delete(oldestKey);
    if (this.onEvict) {
      this.onEvict(oldestKey, value);
    }
  }
}
