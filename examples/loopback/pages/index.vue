<template>
  <div class="loopback-page">
    <div class="controls">
      <div v-if="connectionError" class="error">
        {{ connectionError }}
      </div>

      <div class="status-bar">
        <span :class="['status-indicator', connectionStatus]" />
        <span class="status-text">{{ statusText }}</span>
      </div>

      <div class="device-select">
        <label for="device">Audio Device:</label>
        <select
          id="device"
          v-model="selectedDevice"
          :disabled="isConnected || isConnecting || devices.length === 0"
        >
          <option v-if="devices.length === 0" value="">Loading devices...</option>
          <option v-for="device in devices" :key="device.id" :value="device.id">
            {{ device.name }} - {{ device.description }}
          </option>
        </select>
      </div>

      <div class="actions">
        <button
          v-if="!isConnected"
          class="btn btn-primary"
          :disabled="isConnecting || !selectedDevice"
          @click="connect"
        >
          {{ isConnecting ? 'Connecting...' : 'Connect to Audio Stream' }}
        </button>
        <button
          v-else
          class="btn btn-danger"
          @click="disconnect"
        >
          Disconnect
        </button>
      </div>

      <div class="info">
        <p>
          Audio is captured server-side from the ALSA loopback device
          and streamed to your browser via WebSocket.
        </p>
      </div>
    </div>

    <div class="visualizer-container">
      <NuxtAudioMotionAnalyzer
        v-if="audioSource"
        :source="audioSource"
        :options="options"
        :full-screen="isFullscreen"
      />
      <div v-else class="placeholder">
        Click "Connect to Audio Stream" to begin visualization
      </div>
    </div>

    <div class="footer-controls">
      <button class="btn" @click="isFullscreen = !isFullscreen">
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
      <button class="btn" :class="{ 'btn-active': !isMuted }" @click="toggleMute">
        {{ isMuted ? 'Unmute' : 'Mute' }}
      </button>
      <label class="checkbox-label">
        <input v-model="options.radial" type="checkbox">
        Radial Mode
      </label>
      <label class="checkbox-label">
        <input v-model="options.showPeaks" type="checkbox">
        Show Peaks
      </label>
      <label class="checkbox-label">
        <input v-model="options.ledBars" type="checkbox">
        LED Bars
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Options } from 'audiomotion-analyzer'

interface AudioDevice {
  id: string
  name: string
  description: string
}

const devices = ref<AudioDevice[]>([])
const selectedDevice = ref('')

const options = ref<Options>({
  mode: 5,
  barSpace: 0.25,
  gradient: 'rainbow',
  ledBars: false,
  lumiBars: false,
  radial: false,
  reflexAlpha: 0.25,
  reflexBright: 1,
  reflexFit: true,
  reflexRatio: 0.3,
  showBgColor: false,
  showPeaks: true,
  overlay: false,
  connectSpeakers: false // Don't output to speakers - we control that separately
})

const audioSource = ref<HTMLMediaElement | AudioNode>()
const isConnected = ref(false)
const isConnecting = ref(false)
const isFullscreen = ref(false)
const connectionError = ref('')
const connectionStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')

let audioContext: AudioContext | null = null
let scriptNode: ScriptProcessorNode | null = null
let gainNode: GainNode | null = null
let websocket: WebSocket | null = null

const isMuted = ref(true) // Start muted by default

// Audio config from server (reactive for UI display)
const serverConfig = ref({
  sampleRate: 48000,
  channels: 2,
  bitDepth: 16
})

const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'disconnected': return 'Disconnected'
    case 'connecting': return 'Connecting...'
    case 'connected': return `Connected - Streaming ${serverConfig.value.sampleRate}Hz ${serverConfig.value.channels}ch ${serverConfig.value.bitDepth}bit audio`
  }
})

async function connect() {
  if (isConnected.value || isConnecting.value) return

  isConnecting.value = true
  connectionStatus.value = 'connecting'
  connectionError.value = ''

  // Ring buffer variables (will be initialized after config)
  let ringBuffer: Float32Array
  let ringBufferSize: number
  let writeIndex = 0
  let readIndex = 0
  let samplesAvailable = 0
  let audioInitialized = false

  // Function to enqueue PCM samples
  let enqueueCount = 0
  const enqueueSamples = (samples: Float32Array) => {
    if (!audioInitialized) return

    const samplesToWrite = Math.min(samples.length, ringBufferSize - samplesAvailable)
    for (let i = 0; i < samplesToWrite; i++) {
      ringBuffer[writeIndex] = samples[i]
      writeIndex = (writeIndex + 1) % ringBufferSize
    }
    samplesAvailable += samplesToWrite

    enqueueCount++
    if (enqueueCount <= 3) {
      console.log(`[AudioStream] Enqueued ${samplesToWrite} samples, total available: ${samplesAvailable}`)
    }
  }

  // Function to initialize audio after receiving config
  const initializeAudio = (sampleRate: number) => {
    if (audioInitialized) return

    console.log(`[AudioStream] Initializing audio at ${sampleRate}Hz`)

    // Create AudioContext with the server's sample rate
    audioContext = new AudioContext({ sampleRate })

    // Create a ScriptProcessorNode for audio output
    const bufferSize = 1024
    scriptNode = audioContext.createScriptProcessor(bufferSize, 0, 2)

    // Ring buffer for incoming PCM samples (~1 second)
    ringBufferSize = sampleRate * 2
    ringBuffer = new Float32Array(ringBufferSize)

    // Audio processing callback
    let processCount = 0
    scriptNode.onaudioprocess = (event) => {
      const leftChannel = event.outputBuffer.getChannelData(0)
      const rightChannel = event.outputBuffer.getChannelData(1)
      const frameCount = leftChannel.length

      const samplesNeeded = frameCount * 2

      if (samplesAvailable >= samplesNeeded) {
        for (let i = 0; i < frameCount; i++) {
          leftChannel[i] = ringBuffer[readIndex]
          readIndex = (readIndex + 1) % ringBufferSize
          rightChannel[i] = ringBuffer[readIndex]
          readIndex = (readIndex + 1) % ringBufferSize
        }
        samplesAvailable -= samplesNeeded

        processCount++
        if (processCount <= 3) {
          const maxSample = Math.max(...leftChannel.map(Math.abs))
          console.log(`[AudioStream] Audio process ${processCount}: ${frameCount} frames, max amplitude: ${maxSample.toFixed(4)}`)
        }
      } else {
        leftChannel.fill(0)
        rightChannel.fill(0)
      }
    }

    // Create gain node for mute control
    gainNode = audioContext.createGain()
    gainNode.gain.value = 0 // Start muted

    // Connect audio graph
    scriptNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Pass to visualizer
    audioSource.value = scriptNode

    audioInitialized = true
    console.log('[AudioStream] Audio initialized, starting muted (gain=0)')
  }

  try {
    // Connect to WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${window.location.host}/api/audio-stream?device=${encodeURIComponent(selectedDevice.value)}`

    websocket = new WebSocket(wsUrl)
    websocket.binaryType = 'blob'

    websocket.onopen = () => {
      console.log('[AudioStream] WebSocket connected')
      isConnected.value = true
      isConnecting.value = false
      connectionStatus.value = 'connected'
    }

    let messageCount = 0
    websocket.onmessage = async (event) => {
      let data = event.data
      messageCount++

      if (messageCount <= 3) {
        console.log(`[AudioStream] Message ${messageCount}:`, {
          type: typeof data,
          isBlob: data instanceof Blob,
          isArrayBuffer: data instanceof ArrayBuffer,
          constructor: data?.constructor?.name,
          length: data?.length || data?.size || data?.byteLength
        })
      }

      // Handle string messages
      if (typeof data === 'string') {
        // Config message (JSON)
        if (data.startsWith('{')) {
          try {
            const msg = JSON.parse(data)
            if (msg.type === 'config') {
              serverConfig.value.sampleRate = msg.sampleRate
              serverConfig.value.channels = msg.channels
              serverConfig.value.bitDepth = msg.bitDepth
              console.log(`[AudioStream] Config: ${msg.sampleRate}Hz, ${msg.channels}ch, ${msg.bitDepth}bit`)

              // Initialize audio with the correct sample rate
              initializeAudio(msg.sampleRate)
            }
          } catch (e) {
            console.warn('[AudioStream] Failed to parse config:', e)
          }
          return
        }

        // PCM audio data (base64 encoded)
        if (data.startsWith('PCM:')) {
          const base64 = data.slice(4)
          const binaryString = atob(base64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          data = bytes.buffer

          // Debug: log first PCM decode
          if (messageCount <= 3) {
            console.log(`[AudioStream] Decoded PCM: ${bytes.length} bytes, first 10 bytes:`, Array.from(bytes.slice(0, 10)))
          }
        } else {
          // Unknown string format
          console.warn('[AudioStream] Unknown string format:', data.slice(0, 20))
          return
        }
      }

      // Handle Blob data (convert to ArrayBuffer)
      if (data instanceof Blob) {
        data = await data.arrayBuffer()
      }

      // Binary message (PCM audio data)
      if (!(data instanceof ArrayBuffer)) {
        console.warn('[AudioStream] Unexpected data type:', typeof data, data?.constructor?.name)
        return
      }

      const buffer = data
      let floatData: Float32Array

      if (serverConfig.value.bitDepth === 24) {
        // S24_3LE: 24-bit packed little-endian (3 bytes per sample)
        const bytes = new Uint8Array(buffer)
        const numSamples = Math.floor(bytes.length / 3)
        floatData = new Float32Array(numSamples)

        for (let i = 0; i < numSamples; i++) {
          const offset = i * 3
          // Read 3 bytes as little-endian 24-bit signed integer
          let sample = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
          // Sign extend from 24-bit to 32-bit
          if (sample & 0x800000) {
            sample |= 0xFF000000
          }
          // Convert to float (-1.0 to 1.0)
          floatData[i] = sample / 8388608.0 // 2^23
        }
      } else if (serverConfig.value.bitDepth === 32) {
        // S32_LE: 32-bit little-endian
        const pcmData = new Int32Array(buffer)
        floatData = new Float32Array(pcmData.length)
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 2147483648.0 // 2^31
        }
      } else {
        // S16_LE: 16-bit little-endian (default)
        const pcmData = new Int16Array(buffer)
        floatData = new Float32Array(pcmData.length)
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0 // 2^15
        }
      }

      // Debug: log first conversions
      if (messageCount <= 3) {
        const maxVal = Math.max(...Array.from(floatData).map(Math.abs))
        console.log(`[AudioStream] Float data: ${floatData.length} samples, max value: ${maxVal.toFixed(6)}`)
      }

      // Enqueue samples for playback
      enqueueSamples(floatData)
    }

    websocket.onerror = (event) => {
      console.error('[AudioStream] WebSocket error:', event)
      connectionError.value = 'WebSocket connection error'
      disconnect()
    }

    websocket.onclose = () => {
      console.log('[AudioStream] WebSocket closed')
      if (isConnected.value) {
        disconnect()
      }
    }
  } catch (err) {
    console.error('[AudioStream] Connection error:', err)
    connectionError.value = `Failed to connect: ${err instanceof Error ? err.message : String(err)}`
    disconnect()
  }
}

function disconnect() {
  isConnecting.value = false
  isConnected.value = false
  connectionStatus.value = 'disconnected'

  if (websocket) {
    websocket.close()
    websocket = null
  }

  if (gainNode) {
    gainNode.disconnect()
    gainNode = null
  }

  if (scriptNode) {
    scriptNode.disconnect()
    scriptNode = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  audioSource.value = undefined
}

function toggleMute() {
  if (!gainNode) return

  isMuted.value = !isMuted.value
  gainNode.gain.value = isMuted.value ? 0 : 1
  console.log('[AudioStream] Mute toggled:', isMuted.value, 'gain:', gainNode.gain.value)
}

onMounted(async () => {
  try {
    const response = await fetch('/api/audio-devices')
    devices.value = await response.json()
    // Select first device by default
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0].id
    }
  } catch (err) {
    console.error('[AudioStream] Failed to fetch devices:', err)
  }
})

onUnmounted(() => {
  disconnect()
})
</script>

<style scoped>
.loopback-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: calc(100vh - 100px);
}

.controls {
  background: #16213e;
  padding: 1rem;
  border-radius: 8px;
}

.error {
  background: #e74c3c;
  color: white;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #666;
}

.status-indicator.disconnected {
  background: #666;
}

.status-indicator.connecting {
  background: #f39c12;
  animation: pulse 1s infinite;
}

.status-indicator.connected {
  background: #2ecc71;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-weight: 500;
}

.device-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.device-select label {
  font-weight: 500;
}

.device-select select {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #fff;
  cursor: pointer;
}

.device-select select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actions {
  margin-bottom: 1rem;
}

.info {
  background: #0f3460;
  padding: 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.info p {
  margin: 0;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-active {
  background: #2ecc71;
  color: white;
}

.btn-active:hover {
  background: #27ae60;
}

.visualizer-container {
  flex: 1;
  min-height: 300px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  color: #666;
  text-align: center;
  padding: 2rem;
}

.footer-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  cursor: pointer;
}
</style>
