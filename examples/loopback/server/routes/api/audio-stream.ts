import { spawn, type ChildProcess } from 'node:child_process'

// Audio capture settings
const CHANNELS = 2
const BIT_DEPTH = 32
const DEFAULT_DEVICE = 'gadget'

// Device-specific sample rates (some devices run at different rates)
const DEVICE_SAMPLE_RATES: Record<string, number> = {
  'loopsnoop2': 192000,  // camilladsp2 runs at 192kHz
  'gadget': 96000,       // squeezelite/LMS runs at 96kHz
}
const DEFAULT_SAMPLE_RATE = 96000

// Map bit depth to arecord format
const ARECORD_FORMAT = BIT_DEPTH === 24 ? 'S24_3LE' : BIT_DEPTH === 32 ? 'S32_LE' : 'S16_LE'

interface AudioClient {
  peer: any
  id: string
}

let arecordProcess: ChildProcess | null = null
let clients: AudioClient[] = []
let isCapturing = false
let currentDevice: string = DEFAULT_DEVICE
let currentSampleRate: number = DEFAULT_SAMPLE_RATE

function getSampleRateForDevice(device: string): number {
  return DEVICE_SAMPLE_RATES[device] || DEFAULT_SAMPLE_RATE
}

function startCapture(device: string) {
  if (isCapturing) return

  currentDevice = device
  currentSampleRate = getSampleRateForDevice(device)
  console.log(`[AudioWebSocket] Starting arecord capture from ${device} (${currentSampleRate}Hz, ${CHANNELS}ch, ${BIT_DEPTH}bit, format: ${ARECORD_FORMAT})`)

  arecordProcess = spawn('arecord', [
    '-D', device,
    '-f', ARECORD_FORMAT,
    '-c', String(CHANNELS),
    '-r', String(currentSampleRate),
    '-t', 'raw',
    '--buffer-size', '16384'
  ])

  isCapturing = true

  arecordProcess.stdout?.on('data', (data: Buffer) => {
    // Encode as base64 with prefix for identification
    const base64Data = 'PCM:' + data.toString('base64')

    // Broadcast PCM data to all connected clients
    for (const client of clients) {
      try {
        client.peer.send(base64Data)
      } catch (err) {
        console.error(`[AudioWebSocket] Error sending to client ${client.id}:`, err)
      }
    }
  })

  arecordProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[AudioWebSocket] arecord stderr: ${data.toString()}`)
  })

  arecordProcess.on('close', (code) => {
    console.log(`[AudioWebSocket] arecord exited with code ${code}`)
    isCapturing = false
    arecordProcess = null
  })

  arecordProcess.on('error', (err) => {
    console.error('[AudioWebSocket] arecord error:', err)
    isCapturing = false
    arecordProcess = null
  })
}

function stopCapture() {
  if (arecordProcess) {
    console.log('[AudioWebSocket] Stopping arecord capture')
    arecordProcess.kill('SIGTERM')
    arecordProcess = null
    isCapturing = false
  }
}

function addClient(peer: any, id: string, device: string) {
  clients.push({ peer, id })
  console.log(`[AudioWebSocket] Client ${id} connected. Total clients: ${clients.length}`)

  const sampleRate = clients.length === 1 ? getSampleRateForDevice(device) : currentSampleRate

  // Send audio config to client
  peer.send(JSON.stringify({
    type: 'config',
    sampleRate: sampleRate,
    channels: CHANNELS,
    bitDepth: BIT_DEPTH,
    device: clients.length === 1 ? device : currentDevice
  }))

  // Start capture if this is the first client
  if (clients.length === 1) {
    startCapture(device)
  } else if (device !== currentDevice) {
    // If a different device is requested, notify the client
    peer.send(JSON.stringify({
      type: 'info',
      message: `Another client is already streaming from ${currentDevice}. Using that device.`
    }))
  }
}

function removeClient(id: string) {
  clients = clients.filter(c => c.id !== id)
  console.log(`[AudioWebSocket] Client ${id} disconnected. Total clients: ${clients.length}`)

  // Stop capture if no clients remain
  if (clients.length === 0) {
    stopCapture()
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const clientId = Math.random().toString(36).substring(7)
    // Store clientId on the peer object for later reference
    ;(peer as any)._clientId = clientId

    // Extract device from URL query string
    // URL format: /api/audio-stream?device=gadget
    const url = (peer as any).request?.url || (peer as any).url || ''
    const urlParams = new URLSearchParams(url.split('?')[1] || '')
    const device = urlParams.get('device') || DEFAULT_DEVICE

    addClient(peer, clientId, device)
  },

  close(peer) {
    const clientId = (peer as any)._clientId
    if (clientId) {
      removeClient(clientId)
    }
  },

  error(peer, error) {
    const clientId = (peer as any)._clientId
    console.error(`[AudioWebSocket] Error for client ${clientId}:`, error)
    if (clientId) {
      removeClient(clientId)
    }
  }
})
