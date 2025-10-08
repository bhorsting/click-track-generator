import { ref, computed } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export function useClickTrackGenerator() {
  const selectedFiles = ref([])
  const isProcessing = ref(false)
  const isDragOver = ref(false)
  const error = ref('')
  const success = ref(false)
  const generatedVideoUrl = ref('')
  const processingStep = ref('')
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
    // This will be handled by the parent component
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

      processingStep.value = 'Generating animated waveform...'

      // Create the final video with both mixed audio and click track
      const outputFileName = 'output.mp4'
      const mixFileName = fileMap.get(mixFiles[0])
      const clickFileName = fileMap.get(clickTrackFile)

      // Create animated waveform video with moving cursor
      let ffmpegArgs = []

      if (mixFiles.length === 1) {
        // Single mix file - create waveform video
        ffmpegArgs.push(
          '-i', mixFileName,
          '-i', clickFileName,
          '-filter_complex', 
          `[0:a]showwaves=s=320x240:colors=0x667eea|0x764ba2:mode=line:rate=30,drawbox=x='t*320/duration':y=0:w=3:h=240:color=white:t=fill[video]`,
          '-map', '[video]',
          '-map', '0:a',
          '-map', '1:a',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '320k',
          '-ar', '48000',
          '-ac', '2',
          '-metadata:s:a:0', 'title=Mixed Audio',
          '-metadata:s:a:1', 'title=Click Track',
          '-shortest',
          outputFileName
        )
      } else {
        // Multiple mix files - create filter complex with waveform
        const inputArgs = []
        const filterInputs = []
        
        for (let i = 0; i < mixFiles.length; i++) {
          const fileName = fileMap.get(mixFiles[i])
          inputArgs.push('-i', fileName)
          filterInputs.push(`[${i + 1}:a]`)
        }
        
        inputArgs.push('-i', clickFileName)
        
        const filterComplex = `${filterInputs.join('')}amix=inputs=${mixFiles.length}[mixed];[mixed]showwaves=s=320x240:colors=0x667eea|0x764ba2:mode=line:rate=30,drawbox=x='t*320/duration':y=0:w=3:h=240:color=white:t=fill[video]`
        const clickTrackIndex = mixFiles.length + 1
        
        ffmpegArgs.push(
          ...inputArgs,
          '-filter_complex', filterComplex,
          '-map', '[video]',
          '-map', '[mixed]',
          '-map', `${clickTrackIndex}:a`,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '320k',
          '-ar', '48000',
          '-ac', '2',
          '-metadata:s:a:0', 'title=Mixed Audio',
          '-metadata:s:a:1', 'title=Click Track',
          '-shortest',
          outputFileName
        )
      }

      processingStep.value = 'Rendering waveform video with moving cursor...'

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

  return {
    // State
    selectedFiles,
    isProcessing,
    isDragOver,
    error,
    success,
    generatedVideoUrl,
    processingStep,
    
    // Computed
    sortedFiles,
    
    // Methods
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
