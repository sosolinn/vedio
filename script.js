const webcam = document.getElementById("webcam");
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const tipEl = document.getElementById("gestureTip");
const nextCueEl = document.getElementById("nextCue");
const countdownEl = document.getElementById("countdown");
const recordBtn = document.getElementById("recordBtn");
const recordText = document.getElementById("recordText");
const timerEl = document.getElementById("timer");
const modeBtns = document.querySelectorAll(".mode-btn");
const landscapeAtlas = new Image();
landscapeAtlas.src = "assets/landscape-atlas.webp";

function drawLandscape(index, x, y, width, height) {
  if (!landscapeAtlas.naturalWidth) return;
  const tileWidth = landscapeAtlas.naturalWidth / 2;
  const tileHeight = landscapeAtlas.naturalHeight / 2;
  const sourceWidth = Math.min(tileWidth, tileHeight * width / height);
  const sourceHeight = Math.min(tileHeight, tileWidth * height / width);
  ctx.drawImage(
    landscapeAtlas,
    (index % 2) * tileWidth + (tileWidth - sourceWidth) / 2,
    Math.floor(index / 2) * tileHeight + (tileHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height
  );
}

// ================== 自动卡点剧本（单位：秒，按你的 BGM 随时改这里） ==================
const AUTO_TIMELINE = [
  { time: 0,  mode: "mountain", name: "线条山脉", hint: "⛰️ 抬起双手，拉起 3D 线条山脉" },
  { time: 9,  mode: "halftone", name: "网点眼镜", hint: "🕶️ 卡点瞬间：黑白漫画网点 + 3D 眼镜" },
  { time: 13, mode: "portal",   name: "双手任意门", hint: "🪟 双手拇指+食指比出取景框，打开秋日风景" },
  { time: 17, mode: "skeleton", name: "骨架秋叶", hint: "🍁 张开双手，展示极细几何骨架与漫天秋叶" },
  { time: 22, mode: "cards",    name: "记忆画框", hint: "🖼️ 张开手掌横向挥动，弹出记忆画框" }
];

// 平时预览的提示文案
const MODE_TIPS = {
  mountain: "⛰️ 线条山脉：双手抬高/左右挥动，实时拉起 3D 白色网格山峰",
  halftone: "🕶️ 网点漫画风：复古黑白网点质感 + 3D 红蓝撞色眼镜",
  portal: "🪟 双手任意门：双手拇指+食指比出取景框，打开框内秋日风景",
  skeleton: "🍁 几何手骨+秋叶：张开双手展示极细几何骨架与漫天飞叶",
  cards: "🖼️ 记忆画框：张开手掌横向挥动，弹出风景画框"
};

let currentMode = "mountain";
let effectTime = 0;

function setMode(mode, customHint = MODE_TIPS[mode]) {
  if (currentMode !== mode) resetEffect();
  currentMode = mode;
  tipEl.textContent = customHint;
  modeBtns.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

// ================== 离屏小画布（用于流畅计算网点滤镜） ==================
const halftoneCanvas = document.createElement("canvas");
halftoneCanvas.width = 54;
halftoneCanvas.height = 96;
const hCtx = halftoneCanvas.getContext("2d", { willReadFrequently: true });

// ================== 特效 1：3D 白色线条山脉网格 ==================
const GRID_COLS = 26;
const GRID_ROWS = 12;
const mountainX = new Float32Array(GRID_COLS * GRID_ROWS);
const mountainY = new Float32Array(mountainX.length);
const smoothHeights = new Float32Array(mountainX.length);

for (let row = 0; row < GRID_ROWS; row++) {
  const depth = row / (GRID_ROWS - 1);
  const span = canvas.width * (0.64 + 0.8 * depth);
  for (let col = 0; col < GRID_COLS; col++) {
    mountainX[row * GRID_COLS + col] = canvas.width / 2 + span * (col / (GRID_COLS - 1) - 0.5);
  }
}

function drawMountainMesh(handsPts, dt) {
  ctx.fillStyle = "rgba(14, 26, 56, 0.28)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blend = 1 - Math.exp(-dt * 12);
  for (let r = 0; r < GRID_ROWS; r++) {
    const depth = r / (GRID_ROWS - 1);
    const yBase = canvas.height * (0.58 + 0.48 * depth ** 1.5);
    for (let c = 0; c < GRID_COLS; c++) {
      const i = r * GRID_COLS + c;
      let targetH = Math.sin(c * 0.45 + effectTime * 1.8 + r * 0.5) * 7;

      for (const h of handsPts) {
        const palm = h[9];
        const dx = mountainX[i] - palm.x;
        const dy = (depth - 0.48) * 185;
        const lift = Math.max(0, Math.min(1, (canvas.height * 0.8 - palm.y) / (canvas.height * 0.56)));
        targetH += Math.exp(-(dx * dx + dy * dy) / 9500) * lift * 295;
      }

      smoothHeights[i] += (Math.min(340, targetH) - smoothHeights[i]) * blend;
      mountainY[i] = yBase - smoothHeights[i];
    }
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255, 249, 233, 0.80)";
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  for (let r = 0; r < GRID_ROWS; r++) {
    const start = r * GRID_COLS;
    ctx.moveTo(mountainX[start], mountainY[start]);
    for (let i = start + 1; i < start + GRID_COLS; i++) {
      ctx.lineTo(mountainX[i], mountainY[i]);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  for (let c = 0; c < GRID_COLS; c += 2) {
    ctx.moveTo(mountainX[c], mountainY[c]);
    for (let i = c + GRID_COLS; i < mountainX.length; i += GRID_COLS) {
      ctx.lineTo(mountainX[i], mountainY[i]);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// ================== 特效 2：黑白网点漫画 + 红蓝 3D 眼镜 ==================
function drawHalftoneAndGlasses(image, offsetX, offsetY, drawW, drawH) {
  hCtx.save();
  hCtx.translate(halftoneCanvas.width, 0);
  hCtx.scale(-1, 1);
  const sX = halftoneCanvas.width / canvas.width;
  const sY = halftoneCanvas.height / canvas.height;
  hCtx.drawImage(image, offsetX * sX, offsetY * sY, drawW * sX, drawH * sY);
  hCtx.restore();

  const imgData = hCtx.getImageData(0, 0, halftoneCanvas.width, halftoneCanvas.height).data;

  ctx.fillStyle = "#eaecef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#18181b";

  const step = 10;
  ctx.beginPath();
  for (let y = 0; y < halftoneCanvas.height; y++) {
    for (let x = 0; x < halftoneCanvas.width; x++) {
      const idx = (y * halftoneCanvas.width + x) * 4;
      const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      const radius = ((255 - lum) / 255) * 5.2;
      if (radius > 0.6) {
        const px = x * step + 5;
        const py = y * step + 5;
        ctx.moveTo(px + radius, py);
        ctx.arc(px, py, radius, 0, Math.PI * 2);
      }
    }
  }
  ctx.fill();

  // 半透明红蓝 3D 眼镜色块
  const eyeY = canvas.height * 0.34;
  const cx = canvas.width / 2;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(65, 115, 255, 0.72)";
  ctx.fillRect(cx - 108, eyeY - 26, 98, 54);
  ctx.fillStyle = "rgba(255, 55, 145, 0.72)";
  ctx.fillRect(cx + 10, eyeY - 26, 98, 54);
  ctx.restore();
}

// ================== 特效 3：双手比框“任意门” ==================
let portalPoints = null;
let portalSeenAt = -Infinity;
let portalOpacity = 0;

function getPortalPoints(handsPts) {
  if (handsPts.length !== 2) return null;
  for (const hand of handsPts) {
    const gap = distance(hand[4], hand[8]) / Math.max(1, distance(hand[0], hand[9]));
    const extended = [12, 16, 20].filter((tip) => fingerExtended(hand, tip)).length;
    if (gap < (portalPoints ? 0.21 : 0.32) || extended > 1) return null;
  }

  const pts = handsPts.flatMap((hand) => [hand[4], hand[8]]);
  const cx = pts.reduce((sum, pt) => sum + pt.x, 0) / 4;
  const cy = pts.reduce((sum, pt) => sum + pt.y, 0) / 4;
  pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const area = pts.reduce((sum, pt, i) => {
    const next = pts[(i + 1) % 4];
    return sum + pt.x * next.y - next.x * pt.y;
  }, 0) / 2;
  return area >= (portalPoints ? 500 : 850) ? pts : null;
}

function drawPortalFrame(handsPts, dt) {
  const ptsNow = getPortalPoints(handsPts);
  if (ptsNow) {
    portalPoints = ptsNow;
    portalSeenAt = effectTime;
  }
  const visible = effectTime - portalSeenAt <= 0.12;
  portalOpacity = Math.max(0, Math.min(1, portalOpacity + dt * (visible ? 8 : -5)));
  if (!portalOpacity || !portalPoints) {
    portalPoints = null;
    return;
  }
  const pts = portalPoints;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));

  ctx.save();
  ctx.globalAlpha = portalOpacity;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();

  ctx.save();
  ctx.clip();

  ctx.fillStyle = "#ba703d";
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  drawLandscape(0, minX, minY, maxX - minX, maxY - minY);

  for (let i = 0; i < 9; i++) {
    const lx = minX + ((i * 0.377 + effectTime * 0.12) % 1) * (maxX - minX);
    const ly = minY + ((i * 0.273 + effectTime * 0.22) % 1) * (maxY - minY);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(effectTime * 1.6 + i);
    drawMapleLeaf(3 + i % 4, LEAF_COLORS[i % LEAF_COLORS.length]);
    ctx.restore();
  }
  ctx.restore();

  ctx.strokeStyle = "#fff1cf";
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "#ffba68";
  ctx.shadowBlur = 9;
  ctx.stroke();

  pts.forEach((p) => {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ================== 特效 4：极细几何手骨 + 蓝调漫天秋叶 ==================
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
  [0, 4], [0, 8], [0, 12], [0, 16], [0, 20]
];

const leaves = [];
const LEAF_COLORS = ["#d62828", "#e85d04", "#f48c06", "#ffba08", "#ffd166"];

function drawMapleLeaf(s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.25, -s * 0.4);
  ctx.lineTo(s * 0.85, -s * 0.5);
  ctx.lineTo(s * 0.45, -s * 0.05);
  ctx.lineTo(s * 0.9, s * 0.25);
  ctx.lineTo(s * 0.28, s * 0.35);
  ctx.lineTo(0, s * 0.55);
  ctx.lineTo(-s * 0.28, s * 0.35);
  ctx.lineTo(-s * 0.9, s * 0.25);
  ctx.lineTo(-s * 0.45, -s * 0.05);
  ctx.lineTo(-s * 0.85, -s * 0.5);
  ctx.lineTo(-s * 0.25, -s * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawLeaves(handsPts, dt) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "rgba(36, 68, 180, 0.78)");
  skyGrad.addColorStop(0.55, "rgba(88, 124, 209, 0.58)");
  skyGrad.addColorStop(1, "rgba(165, 183, 225, 0.20)");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (leaves.length < 55 && Math.random() < 1 - Math.exp(-dt * (8 + 5 * handsPts.length))) {
    leaves.push({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 75,
      vy: Math.random() * 70 + 75,
      size: Math.random() * 10 + 10,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 2.8,
      flip: Math.random() * Math.PI,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]
    });
  }

  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.x += (l.vx + Math.sin(effectTime * 1.8 + l.angle) * 40) * dt;
    l.y += l.vy * dt;
    l.angle += l.vAngle * dt;
    l.flip += 3.5 * dt;

    if (l.y > canvas.height + 30) {
      leaves.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);
    ctx.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(l.flip)));
    ctx.globalAlpha = 0.82;
    drawMapleLeaf(l.size, l.color);
    ctx.restore();
  }
}

function drawHandSkeleton(handsPts) {
  for (const h of handsPts) {
    if (!openPalm(h)) continue;
    ctx.save();
    ctx.strokeStyle = "#fcf1dc";
    ctx.lineWidth = 1.15;
    ctx.shadowColor = "#182755";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(h[a].x, h[a].y);
      ctx.lineTo(h[b].x, h[b].y);
    }
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    for (const pt of h) {
      ctx.moveTo(pt.x + 2.1, pt.y);
      ctx.arc(pt.x, pt.y, 2.1, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

// ================== 特效 5：悬浮记忆小画框 + 飘落花瓣 ==================
const memoryCards = [];
const petals = [];
let nextCardIndex = 0;
let lastCardSpawnTime = -Infinity;

const CARD_SLOTS = [
  { x: 22, y: 325, color: "#a96333" },
  { x: 366, y: 430, color: "#916d60" },
  { x: 366, y: 305, color: "#365f81" },
  { x: 22, y: 450, color: "#a06071" }
];

function spawnMemoryCard() {
  memoryCards[nextCardIndex] = { index: nextCardIndex, bornAt: effectTime };
  nextCardIndex = (nextCardIndex + 1) % CARD_SLOTS.length;
  lastCardSpawnTime = effectTime;
}

function drawMiniScene(card) {
  const slot = CARD_SLOTS[card.index];
  const width = 152;
  const height = 98;
  const progress = Math.min(1, (effectTime - card.bornAt) * 3.5);
  const ease = 1 - (1 - progress) ** 3;
  const direction = slot.x < canvas.width / 2 ? -1 : 1;
  const floatY = Math.sin(effectTime * 2.1 + card.index * 1.6) * 5;
  ctx.save();
  ctx.globalAlpha = ease;
  ctx.translate(slot.x + width / 2 - direction * 34 * (1 - ease), slot.y + floatY + height / 2);
  ctx.rotate(direction * 0.045);
  ctx.scale(0.76 + ease * 0.24, 0.76 + ease * 0.24);
  ctx.shadowColor = "rgba(16, 11, 22, 0.55)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#fff4e7";
  ctx.fillRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = slot.color;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  drawLandscape(card.index, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawMemoryCardsAndPetals(dt, waved) {
  if (waved && effectTime - lastCardSpawnTime > 0.6) {
    spawnMemoryCard();
  }

  for (const card of memoryCards) drawMiniScene(card);

  if (petals.length < 28 && Math.random() < 1 - Math.exp(-dt * 8)) {
    petals.push({
      x: Math.random() * canvas.width,
      y: -10,
      vy: Math.random() * 52 + 38,
      size: Math.random() * 6 + 5,
      phase: Math.random() * Math.PI * 2
    });
  }
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i];
    p.y += p.vy * dt;
    p.x += Math.sin(effectTime * 2.1 + p.phase) * 44 * dt;
    if (p.y > canvas.height + 20) {
      petals.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#ffc8dd";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, effectTime * 1.8 + p.phase, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ================== 手势跟踪 ==================
const HAND_HOLD_MS = 130;
let trackedHands = [];
let pendingWave = false;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fingerExtended(hand, tip) {
  return distance(hand[tip], hand[0]) > distance(hand[tip - 2], hand[0]) * 1.13;
}

function openPalm(hand) {
  return [8, 12, 16, 20].filter((tip) => fingerExtended(hand, tip)).length >= 3;
}

function updateWave(track, now) {
  const { points } = track;
  if (currentMode !== "cards" || !openPalm(points)) {
    track.waveStart = null;
    return;
  }

  const palm = points[9];
  const start = track.waveStart;
  if (!start || now - start.at >= 350) {
    track.waveStart = { ...palm, at: now };
    return;
  }

  const dx = Math.abs(palm.x - start.x);
  const dy = Math.abs(palm.y - start.y);
  if (dx >= Math.max(38, distance(points[0], palm) * 0.55) && dx > dy * 1.35) {
    pendingWave = true;
    track.waveStart = { ...palm, at: now };
  }
}

function updateTrackedHands(results, crop, now) {
  trackedHands = trackedHands.filter((track) => now - track.seenAt < HAND_HOLD_MS);
  const detections = (results.multiHandLandmarks || []).map((landmarks, i) => ({
    label: results.multiHandedness?.[i]?.label,
    points: landmarks.map(({ x, y }) => ({
      x: canvas.width - (crop.x + x * crop.width),
      y: crop.y + y * crop.height
    }))
  })).filter(({ points }) => {
    const palm = points[9];
    const margin = distance(points[0], palm);
    return palm.x >= -margin && palm.x <= canvas.width + margin &&
      palm.y >= -margin && palm.y <= canvas.height + margin;
  });

  // 先匹配移动量最小的组合，避免检测结果顺序改变时两只手互换。
  const candidates = [];
  for (const track of trackedHands) {
    for (const detection of detections) {
      const gap = distance(track.points[9], detection.points[9]);
      const penalty = track.label && detection.label && track.label !== detection.label ? 55 : 0;
      if (gap < 180) candidates.push({ track, detection, score: gap + penalty });
    }
  }

  const matched = new Set();
  const assigned = new Set();
  candidates.sort((a, b) => a.score - b.score);
  for (const { track, detection } of candidates) {
    if (matched.has(track) || assigned.has(detection)) continue;
    const speed = distance(track.points[9], detection.points[9]);
    const smoothing = 16 + Math.min(34, speed * 0.65);
    const blend = 1 - Math.exp(-(now - track.seenAt) / 1000 * smoothing);
    track.points = track.points.map((p, i) => ({
      x: p.x + (detection.points[i].x - p.x) * blend,
      y: p.y + (detection.points[i].y - p.y) * blend
    }));
    track.seenAt = now;
    track.label ||= detection.label;
    updateWave(track, now);
    matched.add(track);
    assigned.add(detection);
  }

  for (const detection of detections) {
    if (assigned.has(detection)) continue;
    const track = { ...detection, seenAt: now, waveStart: null };
    updateWave(track, now);
    trackedHands.push(track);
  }
  trackedHands.sort((a, b) => b.seenAt - a.seenAt);
  trackedHands.length = Math.min(2, trackedHands.length);
}

function resetEffect() {
  effectTime = 0;
  smoothHeights.fill(0);
  portalPoints = null;
  portalSeenAt = -Infinity;
  portalOpacity = 0;
  leaves.length = 0;
  petals.length = 0;
  memoryCards.length = 0;
  nextCardIndex = 0;
  lastCardSpawnTime = -Infinity;
  pendingWave = false;
  for (const track of trackedHands) track.waveStart = null;
}

// ================== 摄像头、背景分层和渲染 ==================
const HANDS_ASSETS = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240";
const SEGMENTATION_ASSETS = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747";
const mask = document.createElement("canvas");
mask.width = canvas.width / 2;
mask.height = canvas.height / 2;
const maskCtx = mask.getContext("2d");
const subject = document.createElement("canvas");
subject.width = canvas.width;
subject.height = canvas.height;
const subjectCtx = subject.getContext("2d");

let camera = null;
let previewReady = false;
let startingCamera = false;
let cameraRequest = 0;

function videoCrop() {
  const scale = Math.max(canvas.width / webcam.videoWidth, canvas.height / webcam.videoHeight);
  const width = webcam.videoWidth * scale;
  const height = webcam.videoHeight * scale;
  return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height };
}

function drawMirrored(target, image, crop, scale = 1) {
  target.save();
  target.translate(target.canvas.width, 0);
  target.scale(-scale, scale);
  target.drawImage(image, crop.x, crop.y, crop.width, crop.height);
  target.restore();
}

function backgroundEffect() {
  return currentMode === "mountain" || currentMode === "skeleton";
}

function restoreSubject(session, crop, now) {
  const maskAge = now - session.maskAt;
  if (maskAge > 260) return;
  subjectCtx.clearRect(0, 0, canvas.width, canvas.height);
  subjectCtx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  subjectCtx.globalCompositeOperation = "source-in";
  drawMirrored(subjectCtx, webcam, crop);
  subjectCtx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.globalAlpha = Math.min(1, (260 - maskAge) / 90);
  ctx.drawImage(subject, 0, 0);
  ctx.restore();
}

async function inferFrame(session, now) {
  let segment = false;
  try {
    if (previewReady && session.segmentation && backgroundEffect() &&
        session.lastMask <= session.lastHands && now - session.lastMask >= 100) {
      segment = true;
      session.lastMask = now;
      await session.segmentation.send({ image: webcam });
    } else if ((!previewReady || currentMode !== "halftone") && now - session.lastHands >= 40) {
      session.lastHands = now;
      await session.hands.send({ image: webcam });
    }
  } catch (error) {
    if (camera !== session) return;
    if (segment) {
      session.maskAt = -Infinity;
      session.lastMask = Infinity;
      console.warn("人物分割不可用，继续使用普通背景", error);
    } else {
      cameraFailed("手势模型初始化或运行失败。检查网络后点击重试。", session);
      console.warn(error);
    }
  }
}

function renderFrame(session, now) {
  if (camera !== session) return;
  session.frameId = requestAnimationFrame((time) => renderFrame(session, time));
  if (webcam.readyState < 2 || webcam.currentTime === session.videoTime) return;
  session.videoTime = webcam.currentTime;

  if (!session.inference) {
    session.inference = inferFrame(session, now).finally(() => { session.inference = null; });
  }
  if (camera !== session) return;

  const dt = Math.min(0.08, (now - session.renderAt) / 1000);
  session.renderAt = now;
  if (phase === "recording") updateTimeline(now);
  const beginRecording = phase === "countdown" && updateCountdown(now);
  effectTime += dt;

  const crop = videoCrop();
  const points = trackedHands
    .filter((track) => now - track.seenAt < HAND_HOLD_MS)
    .map((track) => track.points);
  if (currentMode === "halftone") {
    drawHalftoneAndGlasses(webcam, crop.x, crop.y, crop.width, crop.height);
  } else {
    drawMirrored(ctx, webcam, crop);
    if (currentMode === "mountain") {
      drawMountainMesh(points, dt);
      restoreSubject(session, crop, now);
    } else if (currentMode === "portal") {
      drawPortalFrame(points, dt);
    } else if (currentMode === "skeleton") {
      drawLeaves(points, dt);
      restoreSubject(session, crop, now);
      drawHandSkeleton(points);
    } else if (currentMode === "cards") {
      drawMemoryCardsAndPetals(dt, pendingWave);
      pendingWave = false;
    }
  }

  if (beginRecording) startRecording(now);
}

function stopCamera(session) {
  if (camera !== session) return;
  camera = null;
  cancelAnimationFrame(session.frameId);
  webcam.srcObject = null;
  session.stream.getTracks().forEach((track) => track.stop());
  trackedHands = [];
  resetEffect();
  Promise.resolve(session.inference).then(() => Promise.allSettled(
    [session.hands, session.segmentation].filter(Boolean).map((model) => model.close())
  )).catch(console.warn);
}

function cameraFailed(message, session = camera) {
  if (session) stopCamera(session);
  previewReady = false;
  startingCamera = false;
  if (phase === "countdown") {
    countdownEl.classList.add("hidden");
    phase = "idle";
  }
  if (phase === "recording") stopRecording();
  syncControls();
  recordText.textContent = message;
}

async function startCamera() {
  if (camera || startingCamera) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraFailed("请通过 HTTPS 或 localhost 打开页面以使用摄像头。");
    return;
  }
  if (typeof Hands !== "function") {
    cameraFailed("手势模型加载失败。检查网络后刷新页面。");
    recordBtn.disabled = true;
    return;
  }

  startingCamera = true;
  const request = ++cameraRequest;
  syncControls();
  recordText.textContent = "正在开启摄像头…";
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false
    });
    if (request !== cameraRequest) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const hands = new Hands({ locateFile: (file) => `${HANDS_ASSETS}/${file}` });
    const session = {
      hands, stream, lastHands: -Infinity, lastMask: -Infinity, maskAt: -Infinity,
      videoTime: -1, renderAt: performance.now()
    };
    camera = session;
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });
    hands.onResults((results) => {
      if (camera !== session) return;
      updateTrackedHands(results, videoCrop(), performance.now());
      if (previewReady) return;
      previewReady = true;
      startingCamera = false;
      syncControls();
      recordText.textContent = recordingSupported ? RECORD_HINT : "当前浏览器可预览特效，无法录制。";
    });

    if (typeof SelfieSegmentation === "function") {
      try {
        const segmentation = new SelfieSegmentation({ locateFile: (file) => `${SEGMENTATION_ASSETS}/${file}` });
        session.segmentation = segmentation;
        segmentation.setOptions({ modelSelection: 1 });
        segmentation.onResults(({ segmentationMask }) => {
          if (camera !== session) return;
          maskCtx.clearRect(0, 0, mask.width, mask.height);
          drawMirrored(maskCtx, segmentationMask, videoCrop(), 0.5);
          session.maskAt = performance.now();
        });
      } catch (error) {
        session.lastMask = Infinity;
        console.warn("人物分割初始化失败", error);
      }
    }

    for (const track of stream.getVideoTracks()) {
      track.addEventListener("ended", () => {
        if (camera === session) cameraFailed("摄像头已断开，点击重试。", session);
      });
    }
    webcam.srcObject = stream;
    await webcam.play();
    if (camera !== session) return;
    recordText.textContent = "正在加载手势识别…";
    session.frameId = requestAnimationFrame((now) => renderFrame(session, now));
  } catch (error) {
    if (request !== cameraRequest || !startingCamera) return;
    if (!camera) stream?.getTracks().forEach((track) => track.stop());
    const messages = {
      NotAllowedError: "摄像头权限未开启。允许访问后点击重试。",
      NotFoundError: "未找到摄像头。连接后点击重试。",
      NotReadableError: "摄像头暂不可用。关闭占用摄像头的应用后点击重试。"
    };
    cameraFailed(messages[error.name] || "无法开启摄像头，点击重试。");
    console.warn(error);
  }
}

// ================== 倒计时、卡点录制和导出 ==================
const RECORD_HINT = "点击拍摄，3 秒后按剧本切换特效";
const recordingSupported = typeof MediaRecorder === "function" && typeof canvas.captureStream === "function";
let phase = "idle";
let countdownEnd = 0;
let recording = null;
let timelineIndex = 0;

function syncControls() {
  const blocked = startingCamera || phase === "countdown" || phase === "saving";
  recordBtn.disabled = blocked || (previewReady && !recordingSupported);
  recordBtn.classList.toggle("recording", phase === "recording");
  recordBtn.setAttribute("aria-label", !previewReady ? "开启摄像头" :
    phase === "recording" ? "结束录制" : "开始自动卡点拍摄");
  modeBtns.forEach((btn) => { btn.disabled = phase !== "idle"; });
}

function updateCountdown(now) {
  const remaining = Math.ceil((countdownEnd - now) / 1000);
  if (remaining > 0) {
    const count = String(remaining);
    if (countdownEl.textContent !== count) countdownEl.textContent = count;
    return false;
  }

  countdownEl.classList.add("hidden");
  resetEffect();
  return true;
}

function updateTimeline(now) {
  const elapsed = (now - recording.startedAt) / 1000;
  const seconds = Math.floor(elapsed);
  if (seconds !== recording.lastSecond) {
    recording.lastSecond = seconds;
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    timerEl.textContent = `● ${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  const previousIndex = timelineIndex;
  while (AUTO_TIMELINE[timelineIndex + 1]?.time <= elapsed) timelineIndex++;
  if (timelineIndex !== previousIndex) {
    const step = AUTO_TIMELINE[timelineIndex];
    setMode(step.mode, step.hint);
  }

  const next = AUTO_TIMELINE[timelineIndex + 1];
  const cue = next && next.time - elapsed <= 2
    ? `⏳ ${Math.ceil(next.time - elapsed)} 秒后切到「${next.name}」` : "";
  nextCueEl.classList.toggle("hidden", !cue);
  if (cue && nextCueEl.textContent !== cue) nextCueEl.textContent = cue;
}

function finishRecording(session, exportVideo) {
  session.stream.getTracks().forEach((track) => track.stop());
  if (recording !== session) return;

  recording = null;
  phase = "idle";
  timerEl.classList.add("hidden");
  nextCueEl.classList.add("hidden");
  setMode(currentMode);
  syncControls();

  if (!exportVideo || !session.chunks.length) {
    recordText.textContent = "未能生成视频，请重新拍摄。";
    return;
  }

  const type = session.chunks[0].type || session.recorder.mimeType || session.requestedType;
  const ext = type.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(new Blob(session.chunks, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gesture-dance-${Date.now()}.${ext}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  recordText.textContent = previewReady
    ? (session.failed ? "录制中断，已发起片段下载。" : "已发起视频下载，点击可再次拍摄。")
    : "已发起视频下载。摄像头已断开，点击重试。";
}

function startRecording(now) {
  let stream;
  try {
    stream = canvas.captureStream(30);
    const formats = ["video/mp4", "video/webm;codecs=vp8", "video/webm"];
    const requestedType = formats.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
    const recorder = new MediaRecorder(stream, requestedType ? { mimeType: requestedType } : undefined);
    const session = { stream, recorder, requestedType, chunks: [], startedAt: now };
    recorder.ondataavailable = ({ data }) => { if (data.size) session.chunks.push(data); };
    recorder.onstop = () => finishRecording(session, true);
    recorder.onerror = () => {
      if (recording !== session) return;
      session.failed = true;
      phase = "saving";
      syncControls();
      recordText.textContent = "正在整理已录制的片段…";
    };
    recorder.start(1000);
    recording = session;
    phase = "recording";
    timelineIndex = 0;
    updateTimeline(now);
    timerEl.classList.remove("hidden");
    syncControls();
    recordText.textContent = "自动卡点录制中，点击结束";
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    phase = "idle";
    syncControls();
    recordText.textContent = "录制启动失败，点击重试。";
    console.warn(error);
  }
}

function stopRecording() {
  if (phase !== "recording") return;
  const session = recording;
  phase = "saving";
  syncControls();
  recordText.textContent = "正在生成视频…";
  if (session.recorder.state === "inactive") return;
  try {
    session.recorder.stop();
  } catch (error) {
    finishRecording(session, false);
    console.warn(error);
  }
}

modeBtns.forEach((btn) => btn.addEventListener("click", () => {
  if (phase === "idle") setMode(btn.dataset.mode);
}));

recordBtn.addEventListener("click", () => {
  if (phase === "recording") {
    stopRecording();
  } else if (phase === "idle") {
    if (!previewReady) {
      startCamera();
      return;
    }
    if (!recordingSupported) return;

    phase = "countdown";
    countdownEnd = performance.now() + 3000;
    const first = AUTO_TIMELINE[0];
    setMode(first.mode, first.hint);
    countdownEl.textContent = "3";
    countdownEl.classList.remove("hidden");
    recordText.textContent = "请站好位置，准备开拍…";
    syncControls();
  }
});

window.addEventListener("pagehide", () => {
  cameraRequest++;
  if (phase === "countdown") {
    countdownEl.classList.add("hidden");
    phase = "idle";
  }
  if (phase === "recording") stopRecording();
  if (camera) stopCamera(camera);
  startingCamera = false;
  previewReady = false;
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) startCamera();
});

setMode(currentMode);
startCamera();
