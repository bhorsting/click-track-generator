# Click Track Generator

A Vue 3 + Vite web application that processes WAV files and creates MP4 videos with mixed audio tracks using FFmpeg WASM.

## Features

- 📁 **Folder Upload**: Drag and drop or click to upload folders containing WAV files
- 🎵 **Audio Processing**: Automatically sorts files by number and separates click track
- 🎬 **Video Generation**: Creates 320x240 MP4 with mixed audio and separate click track
- 📥 **Download**: Download the generated MP4 file
- 🎥 **Preview**: View the generated video directly in the browser

## File Naming Convention

The application expects WAV files with names following this pattern:
```
{anyName}{indexNumber}.wav
```

Examples:
- `Track 1.wav`, `Track 2.wav`, `Track 3.wav`
- `guitar1.wav`, `guitar2.wav`, `guitar3.wav`
- `instrument01.wav`, `instrument02.wav`, `instrument03.wav`

## How It Works

1. **File Processing**: The last WAV file (highest number) becomes the "click track"
2. **Audio Mixing**: All other WAV files are mixed into a stereo track
3. **Video Creation**: FFmpeg creates a 320x240 MP4 with:
   - Mixed audio track (all files except the last)
   - Separate click track (the last file)
4. **Output**: Download the MP4 or view it in the browser

## Setup and Installation

1. **Use the correct Node.js version**:
   ```bash
   nvm use
   ```

2. **Install dependencies with pnpm**:
   ```bash
   pnpm install
   ```

3. **Start development server**:
   ```bash
   pnpm dev
   ```

4. **Build for production**:
   ```bash
   pnpm build
   ```

## Technical Details

- **Frontend**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Node Version**: 20.10.0 (specified in .nvmrc)
- **Audio Processing**: FFmpeg WASM
- **Styling**: Custom CSS with modern design
- **Browser Support**: Modern browsers with WebAssembly support

## Requirements

- Node.js 20.10.0 (use `nvm use` to switch to the correct version)
- pnpm package manager
- Modern browser with WebAssembly support
- WAV files with numbered naming convention

## Usage

1. Open the application in your browser
2. Upload a folder containing WAV files
3. Click "Generate Video" to process the files
4. Wait for processing to complete
5. Download or preview the generated MP4

## Example

The `example-tracks` folder contains sample WAV files that demonstrate the expected naming convention:
- `Domestic Synthetic Death Horns Track 1.wav`
- `Domestic Synthetic Death Horns Track 2.wav`
- ... and so on

The last file (Track 11) will become the click track, while tracks 1-10 will be mixed together.
