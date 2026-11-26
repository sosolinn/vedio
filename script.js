const webcam = document.getElementById("webcam");
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const recordBtn = document.getElementById("recordBtn");
const recordText = document.getElementById("recordText");
const timerEl = document.getElementById("timer");

// 粒子池（存放星尘和爱心）
const particles = [];
let magicAngle = 0;

// ================== 1. 粒子与魔法阵特效 ==================

function spawnSparkle(x, y) {
  const hue = Math.random() * 60 + 280; // 紫粉到金黄渐变
  particles.push({
    type: "sparkle",
    x,
    y,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4 - 1,
    size: Math.random() * 6 + 3,
    alpha: 1,
    color: `hsl(${hue}, 100%, 70%)`
  });
}

function spawnHeart(x, y) {
  particles.push({
    type: "heart",
    x: x + (Math.random() - 0.5) * 20,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: -Math.random() * 3 - 2,
    size: Math.random() * 14 + 18,
    alpha: 1
  });
}

function drawMagicCircle(x, y, radius) {
  magicAngle += 0.04;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(magicAngle);

  ctx.strokeStyle = "#00f2fe";
  ctx.shadowColor = "#00f2fe";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 3;

  // 外圈与内圈
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
  ctx.stroke();

  // 旋转六芒星（两个三角形）
  for (let t = 0; t < 2; t++) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 + t * Math.PI;
      const px = Math.cos(a) * radius * 0.78;
      const py = Math.sin(a) * radius * 0.78;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    if (p.type === "sparkle") {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "heart") {
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("❤️", p.x, p.y);
    }
    ctx.restore();
  }
}

// ================== 2. MediaPipe 手势识别与画面合成 ==================

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults((results) => {
  // 计算居中裁剪参数（避免横屏摄像头在 9:16 竖屏上被压扁）
  const imgW = results.image.width;
  const imgH = results.image.height;
  const scale = Math.max(canvas.width / imgW, canvas.height / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (canvas.width - drawW) / 2;
  const offsetY = (canvas.height - drawH) / 2;

  // 1) 绘制镜像后的摄像头画面
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, offsetX, offsetY, drawW, drawH);
  ctx.restore();

  // 把 MediaPipe 归一化坐标精准映射到竖屏画布坐标
  const toCanvasPos = (lm) => ({
    x: canvas.width - (offsetX + lm.x * drawW),
    y: offsetY + lm.y * drawH
  });

  // 2) 遍历识别到的每一只手，触发对应特效
  if (results.multiHandLandmarks) {
    for (const lm of results.multiHandLandmarks) {
      const thumbTip = lm[4];
      const indexTip = lm[8];
      const palm = lm[9];

      // 判断 1：大拇指 + 食指捏合 -> 冒爱心
      const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      if (pinchDist < 0.06) {
        const pos = toCanvasPos(indexTip);
        if (Math.random() < 0.4) spawnHeart(pos.x, pos.y);
        continue;
      }

      // 判断 2：四指伸直（张开手掌） -> 掌心魔法阵
      const isOpenPalm =
        lm[8].y < lm[6].y &&
        lm[12].y < lm[10].y &&
        lm[16].y < lm[14].y &&
        lm[20].y < lm[18].y;

      if (isOpenPalm) {
        const palmPos = toCanvasPos(palm);
        drawMagicCircle(palmPos.x, palmPos.y, 95);
        spawnSparkle(palmPos.x + (Math.random() - 0.5) * 140, palmPos.y + (Math.random() - 0.5) * 140);
        continue;
      }

      // 判断 3：默认伸出食指 -> 仙女棒星尘拖尾
      if (lm[8].y < lm[6].y) {
        const tipPos = toCanvasPos(indexTip);
        for (let i = 0; i < 3; i++) {
          spawnSparkle(tipPos.x, tipPos.y);
        }
      }
    }
  }

  // 3) 渲染所有动态粒子
  updateAndDrawParticles();
});

// 启动摄像头
const camera = new Camera(webcam, {
  onFrame: async () => {
    await hands.send({ image: webcam });
  },
  width: 1280,
  height: 720
});
camera.start();

// ================== 3. 录制并下载小视频 ==================

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let timerInterval = null;
let seconds = 0;

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `● ${m}:${s}`;
}

recordBtn.addEventListener("click", () => {
  if (!isRecording) {
    // 开始录制画布（30fps）
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ar-video-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    isRecording = true;
    seconds = 0;
    timerEl.textContent = formatTime(0);
    timerEl.classList.remove("hidden");
    recordBtn.classList.add("recording");
    recordText.textContent = "录制中，点击结束并保存";

    timerInterval = setInterval(() => {
      seconds++;
      timerEl.textContent = formatTime(seconds);
    }, 1000);
  } else {
    // 停止录制并触发下载
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(timerInterval);
    timerEl.classList.add("hidden");
    recordBtn.classList.remove("recording");
    recordText.textContent = "已保存！点击再次拍摄";
  }
});
