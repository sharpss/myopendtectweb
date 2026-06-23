# Seismic Web Viewer

基于 Web 的地震数据可视化与解释系统

> 复刻 OpendTect Web 版功能，提供专业的地震数据 3D 可视化、层位断层解释、属性分析的一体化 Web 平台。

## ✨ 功能特性

### 🎯 核心功能

| 模块 | 功能 | 状态 |
|------|------|------|
| **3D 可视化 | 三维地震数据体渲染 | ✅ |
| | 可拖拽切片（Inline/Crossline/Time） | ✅ |
| | 多切片联动显示 | ✅ |
| | 相机动画与预设视角 | ✅ |
| **2D 剖面 | Inline / Crossline / Timeslice 三视图 | ✅ |
| | 层位拾取与编辑 | ✅ |
| | 断层绘制 | ✅ |
| | 测量工具（距离/时间） | ✅ |
| | 光标信息显示 | ✅ |
| **解释工具** | 层位管理（创建/编辑/删除） | ✅ |
| | 层位自动追踪 | ✅ |
| | 断层管理 | ✅ |
| | 撤销 / 重做系统 | ✅ |
| **数据导入** | SEGY 文件导入向导 | ✅ |
| | SEGY 头信息解析预览 | ✅ |
| | 道头字节位置配置 | ✅ |
| **数据加载策略 | 完整加载（< 1GB） | ✅ |
| | 分块加载 + LRU 缓存（1-10GB） | ✅ |
| | 多分辨率金字塔（>10GB） | ✅ |
| | Zarr 云原生格式 | ✅ |
| **属性分析** | 振幅属性 | ✅ |
| | 相干体 | 🔧 |
| | 曲率 | 🔧 |
| **用户体验** | 快捷键系统 | ✅ |
| | 主题切换（亮/暗） | ✅ |
| | 加载进度指示 | ✅ |
| | 错误边界与优雅降级 | ✅ |

## 🏗️ 技术架构

### 前端技术栈

```
┌─────────────────────────────────────────────────────────────┐
│                   React 18 + TypeScript              │
├─────────────────────────────────────────────────────────────┘
┌─────────────┬─────────────┬─────────────┐
│  Zustand    │  Three.js  │ TailwindCSS │
│  状态管理  │  3D 渲染   │   UI 样式   │
├─────────────┼─────────────┼─────────────┤
│ @react-three/fiber       │  lucide-react │
│ @react-three/drei       │  react-router │
└─────────────┴──────────────┴─────────────┘
```

### 后端技术栈

- **Express** + TypeScript
- **SEGY 解析与转换
- **Zarr 数据服务
- **RESTful API

### 数据加载策略

| 策略 | 适用规模 | 核心技术 | 内存占用 |
|------|---------|----------|----------|
| **完整加载** | < 1GB | 全量内存加载 | 全量 |
| **分块加载** | 1-10GB | 分块 + LRU 缓存 | 可配置（默认 512MB） |
| **金字塔** | >10GB | 多分辨率 + 按需加载 | 动态 |
| **Zarr** | 任意大小 | 服务端分块压缩 + 流式读取 | 可配置缓存 |

## 📁 项目结构

```
/workspace
├── api/                          # 后端服务
│   ├── routes/
│   │   ├── auth.ts             # 认证路由
│   │   ├── seismic.ts          # 地震数据路由
│   │   ├── segy.ts             # SEGY 导入路由
│   │   ├── attributes.ts       # 属性计算路由
│   │   └── zarr.ts              # Zarr 数据服务
│   ├── utils/
│   │   ├── zarr.ts              # Zarr 读写器
│   │   └── segyToZarr.ts     # SEGY → Zarr 转换器
│   ├── app.ts                 # Express 应用
│   └── server.ts              # 服务入口
├── src/                          # 前端应用
│   ├── components/
│   │   ├── layout/              # 布局组件
│   │   │   ├── MenuBar.tsx      # 菜单栏
│   │   │   ├── ToolBar.tsx      # 工具栏
│   │   │   ├── LeftPanel.tsx      # 左侧面板
│   │   │   ├── RightPanel.tsx   # 右侧面板
│   │   │   └── StatusBar.tsx     # 状态栏
│   │   ├── viewer/              # 视图组件
│   │   │   ├── Viewer3D.tsx      # 3D 视图
│   │   │   └── SliceView.tsx    # 2D 剖面视图
│   │   └── common/              # 通用组件
│   │       ├── Modal.tsx          # 模态框
│   │       ├── SegyImportModal.tsx # SEGY 导入向导
│   │       └── KeyboardShortcutsModal.tsx
│   ├── data/                     # 数据层
│   │   ├── providers/            # 数据提供者
│   │   │   ├── BaseDataProvider.ts   # 抽象基类
│   │   │   ├── FullVolumeDataProvider.ts
│   │   │   ├── ChunkedDataProvider.ts
│   │   │   ├── PyramidDataProvider.ts
│   │   │   ├── ZarrDataProvider.ts
│   │   │   └── dataProviderFactory.ts
│   │   └── mockSeismic.ts      # 模拟数据生成
│   ├── store/                    # 状态管理
│   │   ├── seismicStore.ts     # 地震数据状态
│   │   ├── viewerStore.ts    # 视图状态
│   │   ├── interpretationStore.ts # 解释工具状态
│   │   └── themeStore.ts   # 主题状态
│   ├── utils/                    # 工具函数
│   │   ├── lruCache.ts        # LRU 缓存
│   │   ├── zarrClient.ts      # Zarr 客户端
│   │   ├── dataStrategy.ts   # 数据策略
│   │   ├── resample.ts        # 重采样工具
│   │   └── colormap.ts       # 色标
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useTheme.ts
│   ├── pages/                    # 页面
│   │   ├── Home.tsx
│   │   └── Workbench.tsx
│   └── lib/                      # 库
│       └── utils.ts
├── shared/                       # 共享类型
│   └── types.ts
└── ...配置文件
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm 或 npm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 同时启动前端和后端
npm run dev

# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev
```

### 构建

```bash
npm run build
```

### 代码检查

```bash
npm run lint
npm run check
```

## 🎮 快捷键

| 快捷键 | 功能 |
|--------|------|
| `1` | 选择工具 |
| `2` | 层位工具 |
| `3` | 断层工具 |
| `4` | 缩放工具 |
| `5` | 平移工具 |
| `6` | 旋转工具 |
| `7` | 测量工具 |
| `V` | 3D 视图 |
| `I` | Inline 视图 |
| `X` | Crossline 视图 |
| `T` | Time 切片视图 |
| `Q` | 四视图 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Backspace` | 删除最后拾取点 |
| `Enter` | 完成拾取 |
| `Esc` | 取消拾取 |
| `?` | 显示快捷键帮助 |

## 📊 数据加载策略详解

### 方案对比

| 特性 | 完整加载 | 分块加载 | 金字塔 | Zarr |
|------|---------|----------|--------|------|
| 初始加载速度 | 慢 | 中 | 极快 | 快 |
| 随机访问 | 最快 | 较快 | 中 | 快 |
| 内存占用 | 最高 | 可控 | 低 | 可控 |
| 支持数据大小 | <1GB | 1-10GB | >10GB | 任意 |
| 服务端依赖 | 否 | 否 | 可选 | 是 |
| 压缩存储 | 无 | - | - | Gzip 3-5x |

### Zarr 格式优势

- **分块存储**：64×64×128 分块，适合切片浏览
- **流式读取**：HTTP 范围请求，按需加载
- **多分辨率金字塔**：4 级分辨率，初始加载极快
- **压缩**：Gzip 压缩，节省存储 3-5 倍
- **云原生**：支持对象存储和 CDN

## 🔧 API 接口

### SEGY 导入

```
POST /api/segy/upload          # 上传 SEGY 文件
POST /api/segy/parse-header    # 解析 SEGY 头
```

### 地震数据

```
GET  /api/seismic/datasets     # 数据集列表
GET  /api/seismic/datasets/:id
GET  /api/seismic/slice         # 获取切片
```

### Zarr 服务

```
GET  /api/zarr/datasets                              # Zarr 数据集列表
GET  /api/zarr/datasets/:id
GET  /api/zarr/datasets/:id/levels/:level/slice/:type/:index
GET  /api/zarr/datasets/:id/levels/:level/chunk/:ci/:cx/:ct
POST /api/zarr/convert/segy-to-zarr              # SEGY 转 Zarr
```

### 属性计算

```
POST /api/attributes/compute
```

## 🧩 架构设计

### 状态管理

使用 Zustand 进行状态管理，分为四个 Store：

- **seismicStore**：地震数据加载与数据提供者管理
- **viewerStore**：视图模式、切片索引、可视化参数
- **interpretationStore**：层位、断层、拾取状态、撤销/重做
- **themeStore**：主题切换

### 数据提供者模式

采用 Provider 模式，统一接口 `BaseDataProvider 抽象基类，四种实现：

```typescript
interface DataProvider {
  load(options)
  unload()
  getSlice(type, index)
  getValue(inline, crossline, time)
  getStats()
}
```

## 📝 开发说明

本项目为学习和研究目的，复刻 OpendTect Web 版的核心功能，使用现代 Web 技术构建地震数据可视化平台。

## 📄 许可证

MIT License
