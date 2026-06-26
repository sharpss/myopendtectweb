# Seismic Web Viewer

基于 Web 的地震数据可视化与解释系统

> 复刻 OpendTect Web 版核心功能，提供专业的地震数据 3D 可视化、层位断层解释、属性分析的一体化 Web 平台。支持 SEGY 数据导入、多分辨率加载、2D/3D 联动解释等专业功能。

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.160-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ 功能特性

### 🎯 核心功能

| 模块 | 功能 | 状态 |
|------|------|:----:|
| **3D 可视化** | 三维地震数据体渲染 | ✅ |
| | 可拖拽切片（Inline/Crossline/Time） | ✅ |
| | 多切片联动显示 | ✅ |
| | 相机动画与预设视角（透视/正交/顶视等） | ✅ |
| | 坐标轴标签与网格显示 | ✅ |
| | 切片边框高亮 | ✅ |
| **2D 剖面** | Inline / Crossline / Timeslice 三视图 | ✅ |
| | 缩放与平移（Ctrl+滚轮/中键拖拽） | ✅ |
| | 十字光标定位 | ✅ |
| | 色标（Colorbar）显示 | ✅ |
| | 坐标轴刻度与单位标注 | ✅ |
| | 切片导航按钮（±1/±10） | ✅ |
| | 实际地震道编号显示 | ✅ |
| **解释工具** | 层位拾取与编辑 | ✅ |
| | 层位自动追踪 | ✅ |
| | 断层绘制 | ✅ |
| | 层位/断层可见性控制 | ✅ |
| | 距离/时间测量工具 | ✅ |
| | 撤销 / 重做系统 | ✅ |
| **SEGY 导入** | SEGY 文件导入向导 | ✅ |
| | EBCDIC 文本头预览 | ✅ |
| | 二进制头参数解析 | ✅ |
| | 道头字节位置自动检测 | ✅ |
| | 字节序自动识别（大端/小端） | ✅ |
| | 多种数据格式支持（IBM Float/IEEE Float） | ✅ |
| | 导入进度实时反馈 | ✅ |
| | 导入参数安全校验 | ✅ |
| **数据加载策略** | 完整加载（< 1GB） | ✅ |
| | LRU 切片缓存优化 | ✅ |
| | 分块加载 + LRU 缓存（1-10GB） | 🔧 |
| | 多分辨率金字塔（>10GB） | 🔧 |
| | Zarr 云原生格式支持 | 🔧 |
| **显示控制** | 多种色带（Seismic/Gray/Rainbow/Hot/Cool/Viridis/Plasma） | ✅ |
| | 亮度/对比度/不透明度调节 | ✅ |
| | 切片动画播放 | ✅ |
| **用户体验** | 完整快捷键系统 | ✅ |
| | 四视图/单视图切换 | ✅ |
| | 深色主题 | ✅ |
| | 全局加载进度指示 | ✅ |
| | 错误边界与友好提示 | ✅ |
| | 左右面板可折叠 | ✅ |
| **属性分析** | 振幅属性 | ✅ |
| | 相干体 | 🔧 |
| | 曲率属性 | 🔧 |
| | 瞬时相位/频率 | 🔧 |

> ✅ = 已实现，🔧 = 开发中

## 🏗️ 技术架构

### 前端技术栈

```
┌─────────────────────────────────────────────────────────────┐
│                  React 18 + TypeScript                       │
├─────────────────────────────────────────────────────────────┤
│  Zustand    │  Three.js     │  TailwindCSS  │  lucide-react  │
│  状态管理   │  3D 渲染      │   UI 样式      │   图标库       │
├─────────────┼───────────────┼───────────────┼────────────────┤
│ @react-three/fiber        │  @react-three/drei              │
│ React Three.js 绑定       │  3D 辅助组件                    │
└───────────────────────────┴─────────────────────────────────┘
```

### 后端技术栈

- **Express** + TypeScript - API 服务框架
- **Multer** - 文件上传处理
- **SEGY 解析器** - 自研 SEGY 格式解析（支持 Rev 0/1）
- **Zarr 转换器** - SEGY 转 Zarr 分块格式（开发中）
- **CORS** - 跨域支持

### 数据加载策略

| 策略 | 适用规模 | 核心技术 | 内存占用 | 状态 |
|------|---------|----------|----------|:----:|
| **完整加载** | < 1GB | 全量内存加载 + LRU 切片缓存 | 全量 | ✅ |
| **分块加载** | 1-10GB | 分块读取 + LRU 缓存 | 可配置（默认 64MB） | 🔧 |
| **金字塔** | >10GB | 多分辨率 + 按需加载 | 动态 | 🔧 |
| **Zarr** | 任意大小 | 服务端分块压缩 + 流式读取 | 可配置缓存 | 🔧 |

## 📁 项目结构

```
/workspace
├── api/                          # 后端服务
│   ├── routes/
│   │   ├── auth.ts               # 认证路由
│   │   ├── seismic.ts            # 地震数据 API
│   │   ├── segy.ts               # SEGY 导入/解析 API
│   │   ├── attributes.ts         # 属性计算 API
│   │   └── zarr.ts               # Zarr 数据服务
│   ├── utils/
│   │   ├── zarr.ts               # Zarr 读写工具
│   │   └── segyToZarr.ts         # SEGY → Zarr 转换器
│   ├── app.ts                    # Express 应用配置
│   ├── index.ts                  # 应用入口
│   └── server.ts                 # 服务启动入口
├── shared/
│   └── types.ts                  # 前后端共享类型定义
├── src/                          # 前端应用
│   ├── components/
│   │   ├── layout/               # 布局组件
│   │   │   ├── MenuBar.tsx       # 菜单栏
│   │   │   ├── ToolBar.tsx       # 工具栏
│   │   │   ├── LeftPanel.tsx     # 左侧面板（数据/层位/断层）
│   │   │   ├── RightPanel.tsx    # 右侧面板（显示/色带/属性/设置）
│   │   │   └── StatusBar.tsx     # 状态栏（坐标/值显示）
│   │   ├── viewer/               # 视图组件
│   │   │   ├── Viewer3D.tsx      # 3D 可视化视图
│   │   │   └── SliceView.tsx     # 2D 剖面视图
│   │   └── common/               # 通用组件
│   │       ├── Modal.tsx         # 基础模态框
│   │       ├── LoadingOverlay.tsx # 全局加载遮罩
│   │       ├── SegyImportModal.tsx # SEGY 导入向导
│   │       └── KeyboardShortcutsModal.tsx # 快捷键帮助
│   ├── data/
│   │   ├── providers/            # 数据提供者（策略模式）
│   │   │   ├── BaseDataProvider.ts    # 抽象基类
│   │   │   ├── FullVolumeDataProvider.ts # 完整加载策略
│   │   │   ├── ChunkedDataProvider.ts    # 分块加载策略
│   │   │   ├── PyramidDataProvider.ts   # 金字塔策略
│   │   │   ├── ZarrDataProvider.ts      # Zarr 策略
│   │   │   └── dataProviderFactory.ts  # 工厂函数
│   │   └── mockSeismic.ts        # 模拟演示数据生成
│   ├── store/                    # Zustand 状态管理
│   │   ├── seismicStore.ts       # 地震数据与数据提供者状态
│   │   ├── viewerStore.ts        # 视图状态（切片索引/相机/色带）
│   │   ├── interpretationStore.ts # 解释工具状态（层位/断层/拾取）
│   │   └── themeStore.ts         # 主题状态
│   ├── utils/                    # 工具函数
│   │   ├── lruCache.ts           # LRU 缓存实现
│   │   ├── zarrClient.ts         # Zarr HTTP 客户端
│   │   ├── dataStrategy.ts       # 数据策略推荐
│   │   ├── resample.ts           # 重采样/降采样工具
│   │   ├── segyUtils.ts          # SEGY 解析工具
│   │   └── colormap.ts           # 色带颜色映射
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useKeyboardShortcuts.ts # 快捷键 Hook
│   │   └── useTheme.ts           # 主题 Hook
│   ├── pages/
│   │   ├── Home.tsx              # 首页
│   │   └── Workbench.tsx         # 主工作台
│   ├── lib/
│   │   └── utils.ts              # 通用工具（cn 等）
│   ├── App.tsx                   # 应用根组件
│   ├── main.tsx                  # 前端入口
│   └── index.css                 # 全局样式（Tailwind）
├── uploads/                      # SEGY 文件上传目录
├── public/                       # 静态资源
├── scripts/
│   └── generate_test_segy.js     # 测试 SEGY 生成脚本
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── nodemon.json
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm 或 pnpm
- 现代浏览器（支持 WebGL 2.0）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 同时启动前端 (Vite, http://localhost:5173) 和后端 (Express, http://localhost:3001)
npm run dev

# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev
```

启动后访问 http://localhost:5173 即可使用系统。默认加载模拟地震数据，可直接体验所有功能。

### 构建生产版本

```bash
npm run build
```

### 代码检查

```bash
npm run lint       # ESLint 检查
npm run check      # TypeScript 类型检查
```

### 生成测试数据

```bash
node scripts/generate_test_segy.js
```

## 🎮 操作指南

### 3D 视图操作

- **鼠标左键拖拽**：旋转视角
- **鼠标右键拖拽**：平移视图
- **鼠标滚轮**：缩放
- **拖拽切片**：直接在 3D 视图中拖动切片平面调整位置

### 2D 剖面操作

- **鼠标滚轮**：切换切片
- **Ctrl + 鼠标滚轮**：缩放视图
- **鼠标中键拖拽**：平移视图
- **单击**：拾取层位/断层点，或添加测量点
- **双击 / Enter**：完成层位/断层拾取
- **右键 / Esc**：取消拾取，或清除测量点
- **Backspace / Delete**：撤销最后一个拾取/测量点
- **快捷键 + - 0**：放大、缩小、重置视图

### SEGY 导入步骤

1. 点击工具栏 **上传** 按钮（或菜单 File → Import SEGY）
2. 选择 `.sgy` / `.segy` 文件
3. 查看 EBCDIC 文本头信息，确认数据信息
4. 系统自动检测字节序和 inline/crossline 字节位置
5. 必要时手动调整字节位置和数据格式
6. 点击 **导入** 等待加载完成
7. 导入后自动激活数据集

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `1` | 切换到 3D 视图 |
| `2` | 切换到 Inline 剖面 |
| `3` | 切换到 Crossline 剖面 |
| `4` | 切换到 Time 切片 |
| `5` | 切换到四视图 |
| `V` | 选择工具 |
| `T` | 层位拾取工具 |
| `Y` | 断层拾取工具 |
| `M` | 测量工具 |
| `Z` | 缩放工具 |
| `H` | 平移工具 |
| `R` | 旋转工具（3D） |
| `Q` | 折叠/展开左侧面板 |
| `W` | 折叠/展开右侧面板 |
| `+` / `=` | 放大 2D 剖面 |
| `-` | 缩小 2D 剖面 |
| `0` | 重置 2D 视图缩放 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Backspace` | 删除最后拾取点/测量点 |
| `Enter` | 完成拾取 |
| `Esc` | 取消操作 |
| `?` / `/` | 显示快捷键帮助 |

## 📊 数据加载策略详解

### LRU 缓存机制

2D 剖面切片获取采用 LRU（最近最少使用）缓存策略：

- **缓存上限**：64MB（按 Float32Array 4 字节/样本计算）
- **缓存键**：切片类型 + 索引 + 分辨率
- **淘汰策略**：访问时更新热度，超限时自动淘汰最久未使用的切片
- **效果**：连续滚动切片时无需重复计算，大幅提升交互流畅度

### SEGY 解析安全措施

为防止异常 SEGY 文件导致崩溃，实现了多层安全校验：

1. **字节序自动检测**：基于数据合理性评分选择大端/小端序
2. **参数范围校验**：inline/crossline 值过滤（0 < val < 100,000,000）
3. **内存安全限制**：
   - 数据体最大样本数：256M
   - 单切片最大样本数：64M
4. **扩展文本头处理**：正确计算 3200 字节/个的扩展头偏移
5. **动态字节计算**：根据数据格式码动态计算 bytesPerSample（IBM Float 为 4 字节等）

## 🔌 API 接口

后端服务运行在 `http://localhost:3001`，Vite 开发服务器已配置代理，前端可直接通过 `/api/` 访问。

### 健康检查

```http
GET /api/health
```

### SEGY 导入

```http
POST /api/segy/import          # 上传并导入 SEGY 文件（multipart/form-data）
  - file: SEGY 文件
  - datasetName: 数据集名称
  - inlineByte: Inline 道头字节位置（默认 189）
  - crosslineByte: Crossline 道头字节位置（默认 193）
  - byteOrder: 字节序（auto/big-endian/little-endian）
  - dataFormatCode: 数据格式码
```

### 地震数据访问

```http
GET  /api/segy/datasets                # 数据集列表
GET  /api/segy/datasets/:id/volume     # 获取完整数据体（Float32 二进制）
GET  /api/segy/datasets/:id/slice      # 获取切片
  Query: type=inline|crossline|timeslice&index=0
```

### Zarr 数据服务（开发中）

```http
GET  /api/zarr/datasets/:id/.zgroup
GET  /api/zarr/datasets/:id/levels/:level/.zarray
GET  /api/zarr/datasets/:id/levels/:level/chunk/:ci/:cx/:ct
POST /api/zarr/convert/segy-to-zarr    # SEGY 转 Zarr
```

### 属性计算（开发中）

```http
POST /api/attributes/compute
  Body: { datasetId, type: 'amplitude'|'coherence'|'curvature', parameters }
```

## 🧩 架构设计

### 状态管理

使用 Zustand 进行状态管理，分为四个独立 Store：

- **[seismicStore.ts](file:///workspace/src/store/seismicStore.ts)**：地震数据集列表、当前激活数据集、数据提供者（DataProvider）实例、加载进度、错误信息
- **[viewerStore.ts](file:///workspace/src/store/viewerStore.ts)**：视图模式、切片索引、色带选择、亮度/对比度/不透明度、切片可见性、相机预设、动画控制、光标位置
- **[interpretationStore.ts](file:///workspace/src/store/interpretationStore.ts)**：活动工具、层位列表、断层列表、拾取状态、撤销/重做栈、自动追踪
- **[themeStore.ts](file:///workspace/src/store/themeStore.ts)**：亮/暗主题切换

### 数据提供者模式（Provider Pattern）

采用策略模式 + 工厂模式统一数据访问接口，核心抽象在 [BaseDataProvider.ts](file:///workspace/src/data/providers/BaseDataProvider.ts)：

```typescript
interface DataProvider {
  dataset: SeismicDataset;
  isLoaded: boolean;
  load(options?: DataLoadOptions): Promise<void>;
  unload(): void;
  getSlice(type: SliceType, index: number): SeismicSliceData;
  getValue(inline: number, crossline: number, time: number): number;
  getStats(): DataStats;
  onProgress(callback: (progress: DataLoadProgress) => void): () => void;
}
```

[数据提供者工厂](file:///workspace/src/data/providers/dataProviderFactory.ts) 根据数据集大小自动选择最优加载策略。

### 颜色映射

[colormap.ts](file:///workspace/src/utils/colormap.ts) 支持多种地震可视化色带：

- **Seismic**：蓝-白-红（标准地震振幅显示，正值红色、负值蓝色）
- **Gray**：黑-白灰度
- **Rainbow**：彩虹色
- **Hot**：黑-红-黄-白热力图
- **Cool**：青-品红冷色
- **Viridis / Plasma**：感知均匀的科学可视化色带

色带支持亮度/对比度实时调节，通过 Canvas 逐像素或 ImageData 批量处理。

## 🔧 配置说明

### Vite 代理配置

[vite.config.ts](file:///workspace/vite.config.ts) 中已配置 API 代理：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

### Nodemon 配置

[nodemon.json](file:///workspace/nodemon.json) 配置后端自动重启：

```json
{
  "watch": ["api/**/*"],
  "ext": "ts,mts,js,json",
  "exec": "tsx --no-cache api/server.ts"
}
```

## 📝 SEGY 格式支持

当前支持的 SEGY 特性：

- **SEGY Rev 0 / Rev 1**
- **EBCDIC 文本头**（3200 字节，自动转 ASCII）
- **扩展文本头**（自动识别并跳过）
- **二进制头**：采样间隔、采样点数、数据格式码等
- **道头字段**：
  - Inline 号（默认字节 189-192，可配置）
  - Crossline 号（默认字节 193-196，可配置）
  - X/Y 坐标（字节 73-80）
  - 道起始时间（字节 109-110）
  - 采样点数/间隔（道头覆盖）
- **数据格式**：
  - IBM 浮点数（格式码 1）
  - 4 字节 IEEE 浮点数（格式码 5）
  - 1/2/4 字节整数（格式码 2/3/4，实验性支持）
- **字节序**：自动检测大端（Motorola）/ 小端（Intel）

## 📄 许可证

MIT License

## 🙏 致谢

本项目参考 [OpendTect](https://opendtect.org/) 的功能设计，使用开源 Web 技术栈构建，仅用于学习和研究目的。
