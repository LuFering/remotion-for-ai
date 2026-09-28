# AlbumStack

一个 Remotion 合成：五张卡片依次飞入堆叠 → 英雄镜头展开铺满画面 → CRT 关机 → `Token` 收尾并停留 5 秒。

- 画布：**1920 × 1080 @ 60fps**
- 时长：797 帧 ≈ **13.28s**
- 两个 composition：
  - `AlbumStack` — 不透明，输出 H.264 mp4（带 AAC 音轨）
  - `AlbumStackAlpha` — 透明通道，输出 ProRes 4444 `.mov`（约 330 MB）

## 本地渲染

需要 **Node 24** 和 **ffmpeg**（`render.mjs` 用 ffmpeg 重挂音轨，见下）。

```bash
npm ci

npm run studio        # 打开 Remotion Studio 预览
npm run typecheck     # tsc --noEmit

npm run render:mp4    # -> out/AlbumStack.mp4（单机）
npm run render:alpha  # -> out/AlbumStackAlpha.mov
```

分布式渲染的三个步骤也能在本地跑（CI 就是这么调的）：

```bash
npm run plan                          # 打印分块方案
CHUNK_INDEX=0 CHUNK_START=0 CHUNK_END=99 npm run render:chunk
CHUNKS_DIR=out FRAMES_PER_CHUNK=100 DURATION_IN_FRAMES=797 FPS=60 npm run stitch
```

`REMOTION_CONCURRENCY` 控制并行渲染的浏览器标签数，默认是 CPU 线程数的一半：

```bash
REMOTION_CONCURRENCY=100% npm run render:mp4   # 用满所有线程
REMOTION_CONCURRENCY=4 npm run render:mp4      # 固定 4 个
```

## 在 GitHub Actions 上渲染

`.github/workflows/render.yml`，手动触发（Actions 标签页 → `render` → **Run workflow**）：

| 输入 | 说明 |
| --- | --- |
| `target` | `mp4` / `alpha` / `both` |
| `chunks` | 分块数 = 并行 runner 数，默认 `8`（`1` = 退回单机渲染） |
| `render_concurrency` | 每台 runner 内部的并发，默认 `50%`（4 vCPU 上 = 2 个标签） |
| `retention_days` | artifact 保留天数，默认 7 |

渲染完成后在 run 页面的 **Artifacts** 里下载。

### mp4 是分块并行渲染的

一台 4 vCPU 的 runner 渲这 797 帧要 ~30 分钟，所以 mp4 走的是分布式渲染 —— 把时间轴切成等长的块，每块扔给一台独立的 runner，最后拼起来：

```
plan   ──►  chunk 0..N-1 (矩阵，每块一台 4 vCPU runner，并行)
       └─►  stitch (下载所有块，拼接 + 对齐音频，上传成片)
```

- 每个 job 都是**一台独立的机器**，8 块 = 8 台同时跑，总吞吐量 32 vCPU
- 墙上时间的下限是**单个 job 的准备开销**（checkout + `npm ci` + 缓存里恢复 Chrome ≈ 1 分钟），不是渲染本身，所以块数堆到 16 以上收益就很小了
- Free 计划的并发上限是 20 个 job，矩阵上限 256

实现照的是 Remotion 的 [distributed rendering 规范](https://www.remotion.dev/docs/distributed-rendering)：每块帧数必须等长（最后一块除外）、codec 用 `h264-ts`、音频跟着块一起渲（`forSeamlessAacConcatenation`）、最后用 Remotion 自己的 `combineChunks()` 拼。

**踩到的坑**：`combineChunks()` 用 `-c:a copy` 直接封装 AAC，于是第一块的编码器 priming（2048 采样 @48kHz = 43ms）会留在成片里，整条音轨比画面晚 43ms。`render.mjs` 里那段注释说的就是同一个毛病（单机渲染时 Remotion 的 mp4 muxer 会写出 `media_time = 0` 的 edit list）。所以 `scripts/stitch.mjs` 拼接完会再做一次和 `render.mjs` 一样的处理：砍掉 2048 个采样重新编码音频。实测修完以后音轨和单机渲染的版本完全对齐（对 `main.wav` 的互相关 lag 都是 `+0ms`）。

`alpha` 那条路**没有**分块：`combineChunks()` 只能无重编码地拼 h264，而带 alpha 的 ProRes 重编码不敢赌，所以透明母版还是单机渲染。

### 为什么用公开仓库

### 为什么用公开仓库

GitHub 托管的 runner 规格按仓库可见性区分（[官方文档](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)）：

| 仓库 | `ubuntu-24.04` | 计费 |
| --- | --- | --- |
| **公开** | **4 vCPU / 16 GB** | 免费，无分钟数上限 |
| 私有 | 2 vCPU / 8 GB | 扣付费分钟数 |

所以这个 workflow 是冲着公开仓库的 4 核免费额度写的。如果把它搬进私有仓库，记得把 `render_concurrency` 降到 `25%` 左右（2 vCPU）。

并发不要盲目拉满：这个合成是 1080p60、纯软件 GL 渲染，Token 收尾还有一层 30px 的高斯模糊，实测并发 4 时整台机器会同时有约 9 个线程在跑（多个渲染进程 + 合成器里的 ffmpeg 编码）。在 4 vCPU 的 runner 上开 4 个标签只会让它们和编码器互相抢 CPU。想调就用 `npx remotion benchmark` 先量一下。

其他注意事项：

- 单个 job 上限 6 小时；chunk job 设了 `timeout-minutes: 120`，alpha 设了 300。
- 每块的产物（`.ts` + `.aac`，100 帧约 0.2–1.7 MB）作为 artifact 传给 stitch job，公开仓库的 artifact 存储不另计费。
- runner 上没有 GPU，Remotion 默认用 Chrome Headless Shell 做纯 CPU 渲染，这个合成不需要 GPU。
- `node_modules/.remotion`（Chrome Headless Shell，约 150 MB）在 workflow 里做了缓存。
- `alpha` 版 mov 约 330 MB，artifact 上传会比较慢，只在真的需要透明素材时才选它。
- 想改成 push 自动渲染，在 `on:` 下加：

  ```yaml
  push:
    paths:
      - 'src/**'
      - 'public/**'
  ```

## 和 OpenChatCut 里那份的关系

这个仓库是 `OpenChatCut/remotion-album/` 的副本，为了能在公开仓库上跑 CI 渲染单独拆出来的。差异：

1. **`package.json` 补全了依赖** —— 原来那份靠父仓库 hoist 的 `node_modules`，独立成仓库后必须自己声明 Remotion / React / TypeScript。
2. **字体固定住了** —— `TokenOutro` 用的是 `Inter` 900。开发机上装了 Inter，GitHub runner 上没有，不固定的话 CI 会悄悄回退到 DejaVu Sans，"Token" 的字形和字重都会变。现在 `src/fonts.ts` 用 `@font-face` 注入 `public/fonts/Inter-Black.woff2`（SIL OFL 1.1，见 `public/fonts/OFL.txt`），并且由 `npm run font:build` 把字体内联成 data URL 写进 `src/font-data.ts`。

   这里有个坑值得记一下：一开始用的是 `@remotion/fonts` 的 `loadFont()`，它会用 `delayRender()` 包住字体加载。而 handle 是在模块作用域创建的 —— 也就是 Remotion 开的**每一个**浏览器标签里都会创建，包括那些从没渲染过帧的标签；那些标签永远不会清掉 handle，于是 28 秒后它的计时器会在一次长渲染中途把整个 render 打死：

   ```
   A delayRender() "Loading font Inter (…)" was called but not cleared after 28000ms
   ```

   短于 28 秒的渲染（比如 `remotion still`）完全看不出来，所以很容易误判。换成普通 `@font-face` 就没有这个死线了 —— Remotion 在 seek 到每一帧之后都会 `await document.fonts.ready`，照样不会拍到字体没就绪的帧。
3. **`render.mjs` 多读一个 `REMOTION_CONCURRENCY` 环境变量**，用来把并发从"线程数一半"提到 4 核跑满。

改完这里的 `src/` 之后，记得同步回 `OpenChatCut/remotion-album/`（或者反过来），否则两边会漂移。

## 关于素材

`public/` 下的视频和截图是从原始素材裁切/转码出来的（原始文件没有进仓库）。如果这个仓库是公开的，注意这些素材的版权 —— 公开仓库等于把成片素材一起发布出去了。
