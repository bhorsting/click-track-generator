<template>
  <div class="container">
    <div class="header">
      <h1>Click Track Generator</h1>
      <p>Upload a folder of WAV files to create a mixed audio track with click track</p>
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
          {{ selectedFiles.length > 0 ? 'Files Selected' : 'Click or drag folder here' }}
        </div>
        <div class="upload-subtext">
          Select a folder containing WAV files with numbered names
        </div>
        <input
          ref="fileInput"
          type="file"
          webkitdirectory
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
      </div>

      <div v-if="selectedFiles.length > 0" style="margin-top: 1.5rem;">
        <button 
          class="btn" 
          @click="processFiles"
          :disabled="isProcessing"
        >
          {{ isProcessing ? 'Processing...' : 'Generate Video' }}
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
        <div class="processing-text">Processing audio files...</div>
        <div class="processing-subtext">{{ processingStep }}</div>
      </div>
    </div>

    <div v-if="error" class="card">
      <div class="error">
        <strong>Error:</strong> {{ error }}
      </div>
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
          > Download MP4</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export default {
  name: 'App',
  setup() {
    const selectedFiles = ref([])
    const isProcessing = ref(false)
    const isDragOver = ref(false)
    const error = ref('')
    const success = ref(false)
    const generatedVideoUrl = ref('')
    const processingStep = ref('')
    const fileInput = ref(null)
    const videoPlayer = ref(null)
    const ffmpeg = ref(null)

    const sortedFiles = computed(() => {
      return [...selectedFiles.value].sort((a, b) => {
        const aNum = extractNumber(a.name)
        const bNum = extractNumber(b.name)
        return aNum - bNum
      })
    })

    const extractNumber = (filename) => {
      const match = filename.match(/(\d+)\.wav$/)
      return match ? parseInt(match[1]) : 0
    }

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files).filter(file => 
        file.name.toLowerCase().endsWith('.wav')
      )
      selectedFiles.value = files
      error.value = ''
      success.value = false
      generatedVideoUrl.value = ''
    }

    const handleDragOver = (event) => {
      isDragOver.value = true
    }

    const handleDragLeave = (event) => {
      isDragOver.value = false
    }

    const handleDrop = (event) => {
      isDragOver.value = false
      const files = Array.from(event.dataTransfer.files).filter(file => 
        file.name.toLowerCase().endsWith('.wav')
      )
      selectedFiles.value = files
      error.value = ''
      success.value = false
      generatedVideoUrl.value = ''
    }

    const clearFiles = () => {
      selectedFiles.value = []
      error.value = ''
      success.value = false
      generatedVideoUrl.value = ''
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }

    const initializeFFmpeg = async () => {
      if (ffmpeg.value) return

      processingStep.value = 'Loading FFmpeg...'
      ffmpeg.value = new FFmpeg()
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ffmpeg.value.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
    }

    const processFiles = async () => {
      if (selectedFiles.value.length === 0) return

      try {
        isProcessing.value = true
        error.value = ''
        success.value = false
        generatedVideoUrl.value = ''

        await initializeFFmpeg()

        const sortedFilesList = sortedFiles.value
        if (sortedFilesList.length < 2) {
          throw new Error('Need at least 2 WAV files to process')
        }

        // Separate the click track (last file) from the mix files
        const clickTrackFile = sortedFilesList[sortedFilesList.length - 1]
        const mixFiles = sortedFilesList.slice(0, -1)

        processingStep.value = 'Uploading files to FFmpeg...'

        // Clean up any existing files first
        try {
          await ffmpeg.value.deleteFile('output.mp4')
        } catch (e) {
          // File doesn't exist, that's fine
        }

        // Write all files to FFmpeg with sanitized names
        const fileMap = new Map()
        for (let i = 0; i < sortedFilesList.length; i++) {
          const file = sortedFilesList[i]
          const sanitizedName = `input${i}.wav`
          const data = await fetchFile(file)
          await ffmpeg.value.writeFile(sanitizedName, data)
          fileMap.set(file, sanitizedName)
        }

        processingStep.value = 'Mixing audio tracks...'

        // Create the final video with both mixed audio and click track
        const outputFileName = 'output.mp4'
        const mixFileName = fileMap.get(mixFiles[0])
        const clickFileName = fileMap.get(clickTrackFile)

        let ffmpegArgs = [
          '-f', 'lavfi',
          '-i', 'color=c=black:s=320x240:r=30'
        ]

        if (mixFiles.length === 1) {
          // Single mix file
          ffmpegArgs.push(
            '-i', mixFileName,
            '-i', clickFileName,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '320k',
            '-ar', '48000',
            '-ac', '2',
            '-map', '1:a',
            '-map', '2:a',
            '-metadata:s:a:0', 'title=Mixed Audio',
            '-metadata:s:a:1', 'title=Click Track',
            '-shortest',
            outputFileName
          )
        } else {
          // Multiple mix files - create filter complex
          const inputArgs = []
          const filterInputs = []
          
          for (let i = 0; i < mixFiles.length; i++) {
            const fileName = fileMap.get(mixFiles[i])
            inputArgs.push('-i', fileName)
            filterInputs.push(`[${i + 1}:a]`)
          }
          
          inputArgs.push('-i', clickFileName)
          
          const filterComplex = `${filterInputs.join('')}amix=inputs=${mixFiles.length}[mixed]`
          const clickTrackIndex = mixFiles.length + 1
          
          ffmpegArgs.push(
            ...inputArgs,
            '-filter_complex', filterComplex,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '320k',
            '-ar', '48000',
            '-ac', '2',
            '-map', '[mixed]',
            '-map', `${clickTrackIndex}:a`,
            '-metadata:s:a:0', 'title=Mixed Audio',
            '-metadata:s:a:1', 'title=Click Track',
            '-shortest',
            outputFileName
          )
        }

        processingStep.value = 'Creating video with audio tracks...'

        await ffmpeg.value.exec(ffmpegArgs)

        processingStep.value = 'Finalizing video...'

        // Read the output file
        const data = await ffmpeg.value.readFile(outputFileName)
        const blob = new Blob([data.buffer], { type: 'video/mp4' })
        const url = URL.createObjectURL(blob)
        
        generatedVideoUrl.value = url
        success.value = true
        processingStep.value = 'Complete!'

        // Clean up files
        try {
          await ffmpeg.value.deleteFile(outputFileName)
          for (const [_, fileName] of fileMap) {
            await ffmpeg.value.deleteFile(fileName)
          }
        } catch (e) {
          console.warn('Cleanup error:', e)
        }

      } catch (err) {
        console.error('Processing error:', err)
        error.value = err.message || 'An error occurred during processing'
      } finally {
        isProcessing.value = false
      }
    }

    const downloadVideo = () => {
      if (!generatedVideoUrl.value) return

      const link = document.createElement('a')
      link.href = generatedVideoUrl.value
      link.download = 'click-track-video.mp4'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    onMounted(() => {
      // Initialize any setup if needed
    })

    return {
      selectedFiles,
      isProcessing,
      isDragOver,
      error,
      success,
      generatedVideoUrl,
      processingStep,
      fileInput,
      videoPlayer,
      sortedFiles,
      triggerFileInput,
      handleFileSelect,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      clearFiles,
      processFiles,
      downloadVideo
    }
  }
}
</script>
