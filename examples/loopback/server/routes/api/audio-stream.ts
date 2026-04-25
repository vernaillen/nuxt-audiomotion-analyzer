import { spawn, type ChildProcess } from 'node:child_process'
import type { Peer } from 'crossws'

const IS_MAC = process.platform === 'darwin'

const CHANNELS = 2
const BIT_DEPTH = IS_MAC ? 16 : 32

// Linux/Pi: device-specific sample rates from prior setup
const LINUX_DEVICE_SAMPLE_RATES: Record<string, number> = {
  loopsnoop2: 192000,
  gadget: 96000
}
const DEFAULT_SAMPLE_RATE = IS_MAC ? 48000 : 96000
const DEFAULT_DEVICE = IS_MAC ? ':0' : 'gadget'

const ARECORD_FORMAT = BIT_DEPTH === 32 ? 'S32_LE' : 'S16_LE'

interface AudioClient {
  peer: Peer
  id: string
}

let captureProcess: ChildProcess | null = null
let clients: AudioClient[] = []
let isCapturing = false
let currentDevice: string = DEFAULT_DEVICE
let currentSampleRate: number = DEFAULT_SAMPLE_RATE

function getSampleRateForDevice(device: string): number {
  if (IS_MAC) return DEFAULT_SAMPLE_RATE
  return LINUX_DEVICE_SAMPLE_RATES[device] || DEFAULT_SAMPLE_RATE
}

function spawnCapture(device: string, sampleRate: number) {
  if (IS_MAC) {
    return spawn('ffmpeg', [
      '-loglevel', 'error',
      '-f', 'avfoundation',
      '-i', device,
      '-f', 's16le',
      '-ar', String(sampleRate),
      '-ac', String(CHANNELS),
      'pipe:1'
    ])
  }
  return spawn('arecord', [
    '-D', device,
    '-f', ARECORD_FORMAT,
    '-c', String(CHANNELS),
    '-r', String(sampleRate),
    '-t', 'raw',
    '--buffer-size', '16384'
  ])
}

function startCapture(device: string) {
  if (isCapturing) return

  currentDevice = device
  currentSampleRate = getSampleRateForDevice(device)
  const tool = IS_MAC ? 'ffmpeg' : 'arecord'
  console.log(`[AudioWebSocket] Starting ${tool} capture from ${device} (${currentSampleRate}Hz, ${CHANNELS}ch, ${BIT_DEPTH}bit)`)

  captureProcess = spawnCapture(device, currentSampleRate)
  isCapturing = true

  captureProcess.stdout?.on('data', (data: Buffer) => {
    const base64Data = 'PCM:' + data.toString('base64')
    for (const client of clients) {
      try {
        client.peer.send(base64Data)
      }
      catch (err) {
        console.error(`[AudioWebSocket] Error sending to client ${client.id}:`, err)
      }
    }
  })

  captureProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[AudioWebSocket] ${tool} stderr: ${data.toString()}`)
  })

  captureProcess.on('close', (code) => {
    console.log(`[AudioWebSocket] ${tool} exited with code ${code}`)
    isCapturing = false
    captureProcess = null
  })

  captureProcess.on('error', (err) => {
    console.error(`[AudioWebSocket] ${tool} error:`, err)
    isCapturing = false
    captureProcess = null
  })
}

function stopCapture() {
  if (captureProcess) {
    console.log('[AudioWebSocket] Stopping capture')
    captureProcess.kill('SIGTERM')
    captureProcess = null
    isCapturing = false
  }
}

function addClient(peer: Peer, id: string, device: string) {
  clients.push({ peer, id })
  console.log(`[AudioWebSocket] Client ${id} connected. Total clients: ${clients.length}`)

  const sampleRate = clients.length === 1 ? getSampleRateForDevice(device) : currentSampleRate

  peer.send(JSON.stringify({
    type: 'config',
    sampleRate,
    channels: CHANNELS,
    bitDepth: BIT_DEPTH,
    device: clients.length === 1 ? device : currentDevice
  }))

  if (clients.length === 1) {
    startCapture(device)
  }
  else if (device !== currentDevice) {
    peer.send(JSON.stringify({
      type: 'info',
      message: `Another client is already streaming from ${currentDevice}. Using that device.`
    }))
  }
}

function removeClient(id: string) {
  clients = clients.filter(c => c.id !== id)
  console.log(`[AudioWebSocket] Client ${id} disconnected. Total clients: ${clients.length}`)
  if (clients.length === 0) {
    stopCapture()
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const clientId = Math.random().toString(36).substring(7)
    ;(peer as unknown as { _clientId: string })._clientId = clientId

    const url = (peer as unknown as { request?: { url?: string }, url?: string }).request?.url
      || (peer as unknown as { url?: string }).url
      || ''
    const urlParams = new URLSearchParams(url.split('?')[1] || '')
    const device = urlParams.get('device') || DEFAULT_DEVICE

    addClient(peer, clientId, device)
  },

  close(peer) {
    const clientId = (peer as unknown as { _clientId?: string })._clientId
    if (clientId) removeClient(clientId)
  },

  error(peer, error) {
    const clientId = (peer as unknown as { _clientId?: string })._clientId
    console.error(`[AudioWebSocket] Error for client ${clientId}:`, error)
    if (clientId) removeClient(clientId)
  }
})
