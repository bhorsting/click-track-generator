<template>
  <div class="container">
    <div class="header">
      <h1>Click Track Generator</h1>
      <p>
        Upload a folder of WAV files to create a mixed audio track with click
        track
      </p>
    </div>

    <div class="card">
      <div
        class="upload-area"
        :class="{ dragover: isDragOver }"
        @click="triggerFileInput"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div class="upload-icon">📁</div>
        <div class="upload-text">
          {{
            selectedFiles.length > 0
              ? "Files Selected"
              : "Click or drag files here"
          }}
        </div>
        <div class="upload-subtext">
          Select multiple WAV files or a folder containing WAV files with
          numbered names
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          accept=".wav"
          @change="handleFileSelect"
          style="display: none"
        />
      </div>

      <div v-if="selectedFiles.length > 0" class="file-list">
        <h3>Selected Files ({{ selectedFiles.length }}):</h3>
        <div v-for="file in sortedFiles" :key="file.name" class="file-item">
          <span class="file-icon">🎵</span>
          {{ file.name }}
        </div>
        <div v-if="clickTrackDuration > 0" class="duration-info">
          <span class="duration-label">Click Track Duration:</span>
          <span class="duration-value">{{ formattedDuration }}</span>
        </div>
      </div>

      <div v-if="selectedFiles.length > 0" style="margin-top: 1.5rem">
        <button
          class="btn"
          @click="() => processFiles(progressCanvas)"
          :disabled="isProcessing"
        >
          {{ isProcessing ? "Processing..." : "Generate Video" }}
        </button>
        <button
          class="btn btn-secondary"
          @click="clearFiles"
          :disabled="isProcessing"
        >
          Clear Files
        </button>
      </div>
    </div>

    <div v-if="isProcessing" class="card">
      <div class="processing">
        <div class="spinner"></div>
        <div class="processing-text">{{ processingStep }}</div>
        <div class="processing-subtext">{{ progressMessage }}</div>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="progress-text">{{ progress }}%</div>
        </div>
      </div>
    </div>

    <!-- Canvas container - always in DOM -->
    <div class="canvas-container" id="progressCanvas"></div>

    <div v-if="error" class="card">
      <div class="error"><strong>Error:</strong> {{ error }}</div>
    </div>

    <div v-if="success" class="card">
      <div class="success">
        <strong>Success!</strong> Video generated successfully.
      </div>
    </div>

    <div v-if="generatedVideoUrl" class="card">
      <div class="video-container">
        <h3>Generated Video</h3>
        <video
          ref="videoPlayer"
          class="video-player"
          :src="generatedVideoUrl"
          controls
          preload="metadata"
        ></video>

        <div class="download-section">
          <button
            class="btn"
            @click="downloadVideo"
            :disabled="!generatedVideoUrl"
          >
            Download All (Video + Audio)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { useClickTrackGenerator } from "./composables/useClickTrackGenerator.js";

export default {
  name: "App",
  setup() {
    const fileInput = ref(null);
    const videoPlayer = ref(null);
    const progressCanvas = ref(null);

    const {
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
      formattedDuration,
      sortedFiles,
      handleFileSelect,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      clearFiles,
      processFiles,
      downloadVideo,
    } = useClickTrackGenerator();

    const triggerFileInput = () => {
      fileInput.value?.click();
    };

    const handleClearFiles = () => {
      clearFiles();
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    };

    return {
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
      formattedDuration,
      fileInput,
      videoPlayer,
      progressCanvas,
      sortedFiles,
      triggerFileInput,
      handleFileSelect,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      clearFiles: handleClearFiles,
      processFiles,
      downloadVideo,
    };
  },
};
</script>
