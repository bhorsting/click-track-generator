export function mixToMono(audioBuf) {
  const len = audioBuf.length;
  const chs = audioBuf.numberOfChannels;
  if (chs === 1) return audioBuf.getChannelData(0);

  const out = new Float32Array(len);
  for (let c = 0; c < chs; c++) {
    const data = audioBuf.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const scale = 1 / chs;
  for (let i = 0; i < len; i++) out[i] *= scale;
  return out;
}

export function drawWaveform(samples, width, height, ctx) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  // grid and midline
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, height / 2 + 0.5);
  ctx.lineTo(width, height / 2 + 0.5);
  ctx.stroke();

  // compute min/max per column
  const bucketSize = Math.max(1, Math.floor(samples.length / width));
  const amp = height * 0.45; // 90% of canvas height
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1;

  // draw as vertical min/max lines for stability
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const start = x * bucketSize;
    let min = 1.0,
      max = -1.0;
    for (let i = 0; i < bucketSize; i++) {
      const s = samples[start + i] || 0;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    const y1 = height / 2 - max * amp;
    const y2 = height / 2 - min * amp;
    ctx.moveTo(x + 0.5, y1);
    ctx.lineTo(x + 0.5, y2);
  }
  ctx.stroke();

  // optional RMS envelope overlay
  ctx.strokeStyle = "#4a90e2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  let first = true;
  for (let x = 0; x < width; x++) {
    const start = x * bucketSize;
    let sum = 0;
    for (let i = 0; i < bucketSize; i++) {
      const s = samples[start + i] || 0;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / bucketSize);
    const yTop = height / 2 - rms * amp;
    const yBot = height / 2 + rms * amp;
    if (first) {
      ctx.moveTo(0, yTop);
      first = false;
    }
    ctx.lineTo(x, yTop);
  }
  ctx.stroke();

  ctx.strokeStyle = "#4a90e2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  let first2 = true;
  for (let x = 0; x < width; x++) {
    const start = x * bucketSize;
    let sum = 0;
    for (let i = 0; i < bucketSize; i++) {
      const s = samples[start + i] || 0;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / bucketSize);
    const yBot = height / 2 + rms * amp;
    if (first2) {
      ctx.moveTo(0, yBot);
      first2 = false;
    }
    ctx.lineTo(x, yBot);
  }
  ctx.stroke();
}
