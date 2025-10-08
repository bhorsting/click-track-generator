import { ref, computed, nextTick } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { renderWaveformToVideo } from "../draw/renderWaveformToVideo.js";

export function useClickTrackGenerator() {
  const selectedFiles = ref([]);
  const isProcessing = ref(false);
  const isDragOver = ref(false);
  const error = ref("");
  const success = ref(false);
  const generatedVideoUrl = ref("");
  const processingStep = ref("");
  const ffmpeg = ref(null);
  const progress = ref(0);
  const progressMessage = ref("");
  const clickTrackDuration = ref(0);
  let progressInterval = null;

  const startProgressSimulation = (message, duration = 5000) => {
    progress.value = 0;
    progressMessage.value = message;
    let currentProgress = 0;

    progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5; // Random increment between 5-20
      if (currentProgress > 90) currentProgress = 90; // Don't reach 100% until operation completes
      progress.value = Math.min(currentProgress, 90);
    }, 200);
  };

  const stopProgressSimulation = (message) => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    progress.value = 100;
    progressMessage.value = message;
  };

  const sortedFiles = computed(() => {
    return [...selectedFiles.value].sort((a, b) => {
      const aNum = extractNumber(a.name);
      const bNum = extractNumber(b.name);
      return aNum - bNum;
    });
  });

  const formattedDuration = computed(() => {
    if (clickTrackDuration.value === 0) return "0:00";
    const minutes = Math.floor(clickTrackDuration.value / 60);
    const seconds = Math.floor(clickTrackDuration.value % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  });

  const extractNumber = (filename) => {
    const match = filename.match(/(\d+)\.wav$/);
    return match ? parseInt(match[1]) : 0;
  };

  const getAudioDuration = (file) => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener("loadedmetadata", () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        resolve(0);
      });

      audio.src = url;
    });
  };

  const triggerFileInput = () => {
    // This will be handled by the parent component
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files).filter((file) =>
      file.name.toLowerCase().endsWith(".wav")
    );
    selectedFiles.value = files;
    error.value = "";
    success.value = false;
    generatedVideoUrl.value = "";

    // Extract click track duration if we have files
    if (files.length > 0) {
      const sortedFilesList = [...files].sort((a, b) => {
        const aNum = extractNumber(a.name);
        const bNum = extractNumber(b.name);
        return aNum - bNum;
      });
      const clickTrackFile = sortedFilesList[sortedFilesList.length - 1];
      clickTrackDuration.value = await getAudioDuration(clickTrackFile);
    }
  };

  const handleDragOver = (event) => {
    isDragOver.value = true;
  };

  const handleDragLeave = (event) => {
    isDragOver.value = false;
  };

  const handleDrop = async (event) => {
    isDragOver.value = false;
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.name.toLowerCase().endsWith(".wav")
    );
    selectedFiles.value = files;
    error.value = "";
    success.value = false;
    generatedVideoUrl.value = "";

    // Extract click track duration if we have files
    if (files.length > 0) {
      const sortedFilesList = [...files].sort((a, b) => {
        const aNum = extractNumber(a.name);
        const bNum = extractNumber(b.name);
        return aNum - bNum;
      });
      const clickTrackFile = sortedFilesList[sortedFilesList.length - 1];
      clickTrackDuration.value = await getAudioDuration(clickTrackFile);
    }
  };

  const clearFiles = () => {
    selectedFiles.value = [];
    error.value = "";
    success.value = false;
    generatedVideoUrl.value = "";
    clickTrackDuration.value = 0;
  };

  const initializeFFmpeg = async () => {
    if (ffmpeg.value) return;

    processingStep.value = "Loading FFmpeg...";
    ffmpeg.value = new FFmpeg();

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.value.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
  };

  const processFiles = async (canvasRef = null) => {
    if (selectedFiles.value.length === 0) return;

    try {
      isProcessing.value = true;
      error.value = "";
      success.value = false;
      generatedVideoUrl.value = "";

      console.log("🎬 Starting video processing...");
      await initializeFFmpeg();

      const sortedFilesList = sortedFiles.value;
      console.log(
        `📁 Processing ${sortedFilesList.length} files:`,
        sortedFilesList.map((f) => f.name)
      );

      if (sortedFilesList.length < 2) {
        throw new Error("Need at least 2 WAV files to process");
      }

      // Separate the click track (last file) from the mix files
      const clickTrackFile = sortedFilesList[sortedFilesList.length - 1];
      const mixFiles = sortedFilesList.slice(0, -1);

      console.log(
        "🎵 Mix files:",
        mixFiles.map((f) => f.name)
      );
      console.log("🎯 Click track:", clickTrackFile.name);

      processingStep.value = "Uploading files to FFmpeg...";
      console.log("📤 Uploading files to FFmpeg...");

      // Clean up any existing files first
      try {
        console.log("🧹 Cleaning up existing files...");
        await ffmpeg.value.deleteFile("output.mp4");
        await ffmpeg.value.deleteFile("mixed_audio.wav");
        await ffmpeg.value.deleteFile("waveform_video.mp4");
      } catch (e) {
        console.log("ℹ️ No existing files to clean up");
      }

      // Write all files to FFmpeg with sanitized names
      const fileMap = new Map();
      for (let i = 0; i < sortedFilesList.length; i++) {
        const file = sortedFilesList[i];
        const sanitizedName = `input${i}.wav`;
        console.log(`📝 Writing ${file.name} as ${sanitizedName}`);
        const data = await fetchFile(file);
        await ffmpeg.value.writeFile(sanitizedName, data);
        fileMap.set(file, sanitizedName);
      }

      processingStep.value = "Creating mixed audio track...";
      console.log("🎼 Creating mixed audio track...");

      // First, create the mixed audio track
      const mixedAudioFile = "mixed_audio.wav";
      let mixCommand = [];

      if (mixFiles.length === 1) {
        // Single mix file - just copy it
        mixCommand = [
          "-i",
          fileMap.get(mixFiles[0]),
          "-c:a",
          "pcm_s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
          mixedAudioFile,
        ];
      } else {
        // Multiple mix files - create filter complex
        const inputArgs = [];
        const filterInputs = [];

        for (let i = 0; i < mixFiles.length; i++) {
          const fileName = fileMap.get(mixFiles[i]);
          inputArgs.push("-i", fileName);
          filterInputs.push(`[${i}:a]`);
        }

        const filterComplex = `${filterInputs.join("")}amix=inputs=${
          mixFiles.length
        }[mixed]`;

        mixCommand = [
          ...inputArgs,
          "-filter_complex",
          filterComplex,
          "-map",
          "[mixed]",
          "-c:a",
          "pcm_s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
          mixedAudioFile,
        ];
      }

      console.log("🔧 Mix command:", mixCommand);
      startProgressSimulation("Mixing audio...");
      await ffmpeg.value.exec(mixCommand);

      processingStep.value = "Rendering waveform...";
      console.log("🎨 Rendering waveform...");

      const fileData = await ffmpeg.value.readFile(mixedAudioFile);

      const result = await renderWaveformToVideo({
        audioFile: fileData,
        duration: clickTrackDuration.value,
        width: 320,
        height: 240,
        fps: 1,
      });

      // draw the result.canvas to the screen
      const canvas = result.canvas;

      // Canvas element is always in DOM, so ref should be available

      // Show the canvas container
      const container = document.getElementById("progressCanvas");

      // Clear the canvas container and append the new canvas
      container.innerHTML = "";
      container.appendChild(canvas);
      console.log("Canvas appended to ref");

      stopProgressSimulation("Mixed audio complete");
      const waveformVideoFile = "waveform_video.mp4";
      const file = await result.promise;
      console.log("file", file);

      ffmpeg.value.writeFile(waveformVideoFile, new Uint8Array(file));

      console.log("✅ Mixed audio created successfully");

      /*processingStep.value = "Generating waveform video...";
      console.log("📊 Generating waveform video...");

      // Create waveform video using the mixed audio
      const waveformVideoFile = "waveform_video.mp4";
      const waveformCommand = [
        "-i",
        mixedAudioFile,
        "-filter_complex",
        "showwaves=s=320x240:mode=line:draw=full:colors=0xffffff|0xff6600:scale=sqrt",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        waveformVideoFile,
      ];

      console.log("🔧 Waveform command:", waveformCommand);
      startProgressSimulation("Generating waveform...");
      await ffmpeg.value.exec(waveformCommand);
      */
      stopProgressSimulation("Waveform complete");
      console.log("✅ Waveform video created successfully");

      processingStep.value = "Combining video with audio tracks...";
      console.log("🎬 Combining video with audio tracks...");

      // Now combine the waveform video with both audio tracks
      const outputFileName = "output.mp4";
      const clickFileName = fileMap.get(clickTrackFile);

      const finalCommand = [
        "-i",
        waveformVideoFile,
        "-i",
        mixedAudioFile,
        "-i",
        clickFileName,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "320k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-map",
        "2:a",
        "-metadata:s:a:0",
        "title=Mixed Audio",
        "-metadata:s:a:1",
        "title=Click Track",
        "-shortest",
        outputFileName,
      ];

      console.log("🔧 Final command:", finalCommand);
      startProgressSimulation("Finalizing video...");
      await ffmpeg.value.exec(finalCommand);
      stopProgressSimulation("Video complete");
      console.log("✅ Final video created successfully");

      processingStep.value = "Finalizing video...";
      console.log("📦 Reading output file...");

      // Read the output file
      const data = await ffmpeg.value.readFile(outputFileName);
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      console.log("✅ Video processing complete!");
      generatedVideoUrl.value = url;
      success.value = true;
      processingStep.value = "Complete!";

      // Clean up files
      try {
        console.log("🧹 Cleaning up temporary files...");
        await ffmpeg.value.deleteFile(outputFileName);
        await ffmpeg.value.deleteFile(mixedAudioFile);
        await ffmpeg.value.deleteFile(waveformVideoFile);
        for (const [_, fileName] of fileMap) {
          await ffmpeg.value.deleteFile(fileName);
        }
        console.log("✅ Cleanup complete");
      } catch (e) {
        console.warn("⚠️ Cleanup error:", e);
      }
    } catch (err) {
      console.error("❌ Processing error:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      error.value = err.message || "An error occurred during processing";
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      isProcessing.value = false;
    }
  };

  const downloadVideo = () => {
    if (!generatedVideoUrl.value) return;

    const link = document.createElement("a");
    link.href = generatedVideoUrl.value;
    link.download = "click-track-video.mp4";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    // State
    selectedFiles,
    isProcessing,
    isDragOver,
    error,
    success,
    generatedVideoUrl,
    processingStep,
    progress,
    progressMessage,
    clickTrackDuration,

    // Computed
    sortedFiles,
    formattedDuration,

    // Methods
    triggerFileInput,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearFiles,
    processFiles,
    downloadVideo,
  };
}
