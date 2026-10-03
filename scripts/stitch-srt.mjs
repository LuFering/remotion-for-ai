#!/usr/bin/env node
/**
 * 把分块转写的 SRT 拼回一份。
 *
 * ══ 两个必须处理的东西 ══
 *
 * ① **时间戳要加偏移**。whisper 吐出来的是"块内相对时间"，
 *    每块的 SRT 都从 00:00 开始。所以要把块起点加上去。
 *
 * ② **重叠区要去重**。相邻两块故意重叠了 `overlap` 秒（防止切口处的词
 *    因上下文断裂而识别错），合并时重叠区的字幕会出现两遍 ——
 *    必须按"谁的时间戳更靠近它所在块的中心"来留下一条。
 *
 * 用法：node scripts/stitch-srt.mjs <chunksDir> <overlapSec>
 */
import fs from 'node:fs';
import path from 'node:path';

const chunksDir = process.argv[2] ?? '/tmp/chunks';
const OVERLAP = parseFloat(process.argv[3] ?? '5');
const OUT = '/tmp/out';
fs.mkdirSync(OUT, {recursive: true});

const toSec = (t) => {
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t.trim());
  if (!m) return NaN;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
};
const fmt = (s) => {
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const t = Math.floor(s);
  const hh = String(Math.floor(t / 3600)).padStart(2, '0');
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss},${String(ms).padStart(3, '0')}`;
};

/** 读一块的 SRT */
const parseSrt = (file, offset) => {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const out = [];
  for (const block of raw.split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    // ⚠️ 时间行形如 `00:00:03,000 --> 00:00:06,000`
    // （.exec 的捕获组里已经含箭头，所以这里直接对整行 split）
    const [a, b] = lines[timeIdx].split('-->').map((x) => x.trim());
    if (!a || !b) continue;
    const text = lines.slice(timeIdx + 1).join(' ').trim();
    if (!text) continue;
    const sa = toSec(a);
    const sb = toSec(b);
    if (Number.isNaN(sa) || Number.isNaN(sb)) continue;
    out.push({start: sa + offset, end: sb + offset, text});
  }
  return out;
};

/** 每块的目录名形如 chunk-0、chunk-1 —— 按序号排 */
const dirs = fs
  .readdirSync(chunksDir)
  .filter((d) => d.startsWith('chunk-'))
  .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));

if (dirs.length === 0) {
  console.error('没有找到任何 chunk-* 目录');
  process.exit(1);
}

let all = [];
for (const d of dirs) {
  const dir = path.join(chunksDir, d);
  const srt = path.join(dir, 'chunk.srt');
  const offFile = path.join(dir, 'chunk-start.txt');
  if (!fs.existsSync(srt)) {
    console.warn(`⚠️ ${d} 没有 chunk.srt，跳过`);
    continue;
  }
  const offset = fs.existsSync(offFile) ? parseFloat(fs.readFileSync(offFile, 'utf8')) : 0;
  const items = parseSrt(srt, offset);
  console.log(`${d}: 偏移 ${offset.toFixed(1)}s，${items.length} 条`);
  all.push(...items);
}

all.sort((a, b) => a.start - b.start);

/**
 * 去重。
 *
 * ⚠️⚠️ 这里我第一版写错过，而且错得很隐蔽：
 * 我用"两条的**时间中点**距离 < overlap"来判断重复 ——
 * 结果把**相邻但不重叠**的两条也当成重复删掉了
 * （实测：「10.0–13.0 第二句话」和「13.5–15.0 第三句话」被误判成一条）。
 *
 * 正确要**同时满足两个条件**：
 *   ① 时间区间**真的重叠**（cur.start 落在 prev.end 之前）
 *   ② 文字**相似**（重叠区的识别结果可能有细微差别，所以按相似度判，不是全等）
 *
 * 只满足①（时间接壤但内容不同）→ 是两条不同的字幕，都留。
 */
const norm = (t) => t.replace(/[\s，。、！？：；,.!?:;'"”"‘’（）()《》【】—-]/g, '');
const similar = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // 一条是另一条的前缀（切口处被截断），也算同一条
  if (x.startsWith(y) || y.startsWith(x)) return true;
  // 否则按公共字符占比粗判
  const setB = new Set(y);
  const hit = [...x].filter((c) => setB.has(c)).length;
  return hit / Math.max(x.length, y.length) > 0.8;
};

const dedup = [];
for (const cur of all) {
  const prev = dedup[dedup.length - 1];
  if (prev && cur.start < prev.end - 0.3 && similar(prev.text, cur.text)) {
    // 同一条的重叠副本：留文字更长的那版
    if (cur.text.length > prev.text.length) dedup[dedup.length - 1] = cur;
    continue;
  }
  dedup.push(cur);
}

// 写 SRT
const srt = dedup
  .map((it, i) => `${i + 1}\n${fmt(it.start)} --> ${fmt(it.end)}\n${it.text}\n`)
  .join('\n');
fs.writeFileSync(path.join(OUT, 'transcript.srt'), srt);
// 写纯文本（按句子断行）
fs.writeFileSync(path.join(OUT, 'transcript.txt'), dedup.map((d) => d.text).join('\n'));
// 写带时间戳的 markdown —— 方便对着看画面
fs.writeFileSync(
  path.join(OUT, 'transcript.md'),
  dedup.map((d) => `- \`${fmt(d.start)}\`  ${d.text}`).join('\n'),
);

console.log(`\n合并完成：${dedup.length} 条 → ${OUT}/transcript.{srt,txt,md}`);
