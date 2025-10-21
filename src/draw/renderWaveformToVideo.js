import createCanvasContext from "canvas-context";
import { drawWaveform, mixToMono } from "./drawWaveform.js";
import { RecorderStatus, Encoders, Recorder } from "canvas-record";
import { AVC } from "media-codecs";

export async function renderWaveformToVideo({
  audioFile,
  duration,
  width,
  height,
  fps = 1,
}) {
  const ac = new AudioContext({ sampleRate: 48000 });
  const arrayBuf = audioFile.buffer;
  const audioBuf = await ac.decodeAudioData(arrayBuf);
  const pixelRatio = devicePixelRatio;
  const { context, canvas } = createCanvasContext("2d", {
    width: width * pixelRatio,
    height: height * pixelRatio,
    contextAttributes: { willReadFrequently: true },
  });
  Object.assign(canvas.style, { width: `${width}px`, height: `${height}px` });
  // First, draw the waveform on the canvas
  const samples = mixToMono(audioBuf);
  const { context: waveformContext, canvas: waveFormCanvas } =
    createCanvasContext("2d", {
      width: width * pixelRatio,
      height: height * pixelRatio,
      contextAttributes: { willReadFrequently: true },
    });
  drawWaveform(
    samples,
    width * pixelRatio,
    height * pixelRatio,
    waveformContext,
  );
  const totalFrames = Math.ceil(duration * fps);

  const promise = new Promise(async (resolve) => {
    // Animation
    let canvasRecorder;

    function render() {
      const width = canvas.width;
      const height = canvas.height;

      const t = (canvasRecorder.frame / totalFrames) * width;

      context.clearRect(0, 0, width, height);
      context.drawImage(waveFormCanvas, 0, 0);
      context.fillStyle = "red";
      context.fillRect(t, 0, 2, height);
    }

    const tick = async () => {
      render();

      if (canvasRecorder.status !== RecorderStatus.Recording) return;
      await canvasRecorder.step();
      console.log(`Recorded frame ${canvasRecorder.frame} / ${totalFrames}`);
      if (canvasRecorder.frame >= totalFrames) {
        const blob = await canvasRecorder.stop();
        resolve(blob);
      } else {
        requestAnimationFrame(() => tick());
      }
    };

    canvasRecorder = new Recorder(context, {
      name: "canvas-record-example",
      duration,
      download: false,
      frameRate: fps,
      encoderOptions: {
        codec: AVC.getCodec({ profile: "Main", level: "5.2" }),
      },
      encoder: new Encoders["WebCodecsEncoder"]({
        enableHardwareAcceleration: true,
        hardwareAcceleration: "prefer-hardware",
      }),
    });
    requestAnimationFrame(async () => {
      await canvasRecorder.start();
      await tick(canvasRecorder);
    });
  });

  return { promise, canvas };
}
