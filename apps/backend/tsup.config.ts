import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  clean: true,
  // 打包成单文件，避免相对 import 扩展名问题
  splitting: false,
  // external native 模块和 telegram（避免动态 require 问题）
  external: [
    'better-sqlite3', // native 模块
    'bufferutil', // telegram 的 optional native 依赖
    'utf-8-validate', // telegram 的 optional native 依赖
    'telegram', // 主包外置
    /^telegram\//, // 所有子路径外置（如 telegram/sessions）
  ],
  // 把 workspace packages 打包进来
  noExternal: ['@omniknight/db', '@omniknight/shared'],
});
