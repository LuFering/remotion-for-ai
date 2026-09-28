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

npm run render:mp4    # -> out/AlbumStack.mp4
npm run render:alpha  # -> out/AlbumStackAlpha.mov
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
| `render_concurrency` | 并发数或百分比，默认 `50%`（4 vCPU 上 = 2 个标签） |
| `retention_days` | artifact 保留天数，默认 7 |

渲染完成后在 run 页面的 **Artifacts** 里下载。

### 为什么用公开仓库

GitHub 托管的 runner 规格按仓库可见性区分（[官方文档](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)）：

| 仓库 | `ubuntu-24.04` | 计费 |
| --- | --- | --- |
| **公开** | **4 vCPU / 16 GB** | 免费，无分钟数上限 |
| 私有 | 2 vCPU / 8 GB | 扣付费分钟数 |

所以这个 workflow 是冲着公开仓库的 4 核免费额度写的。如果把它搬进私有仓库，记得把 `render_concurrency` 降到 `25%` 左右（2 vCPU）。

并发不要盲目拉满：这个合成是 1080p60、纯软件 GL 渲染，Token 收尾还有一层 30px 的高斯模糊，实测并发 4 时整台机器会同时有约 9 个线程在跑（多个渲染进程 + 合成器里的 ffmpeg 编码）。在 4 vCPU 的 runner 上开 4 个标签只会让它们和编码器互相抢 CPU。想调就用 `npx remotion benchmark` 先量一下。

其他注意事项：

- 单个 job 上限 6 小时，workflow 里设了 `timeout-minutes: 120`。
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
