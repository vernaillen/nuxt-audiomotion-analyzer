import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

interface AudioDevice {
  id: string
  name: string
  description: string
}

async function listMacDevices(): Promise<AudioDevice[]> {
  const devices: AudioDevice[] = []
  try {
    // ffmpeg writes the device list to stderr and always exits non-zero
    const result = await execAsync(
      'ffmpeg -hide_banner -f avfoundation -list_devices true -i ""'
    ).catch((err: { stderr?: string, stdout?: string }) => err)

    const output = result.stderr || result.stdout || ''
    const lines = output.split('\n')
    let inAudioSection = false
    for (const line of lines) {
      if (line.includes('AVFoundation audio devices:')) {
        inAudioSection = true
        continue
      }
      if (line.includes('AVFoundation video devices:')) {
        inAudioSection = false
        continue
      }
      if (!inAudioSection) continue

      // Match: "[AVFoundation indev @ 0x...] [0] MacBook Pro Microphone"
      const match = line.match(/\] \[(\d+)\] (.+)$/)
      if (match && match[1] && match[2]) {
        devices.push({
          id: `:${match[1]}`,
          name: match[2].trim(),
          description: 'avfoundation audio input'
        })
      }
    }
  }
  catch (err) {
    console.error('[AudioDevices] ffmpeg device discovery failed:', err)
  }
  return devices
}

async function listLinuxDevices(): Promise<AudioDevice[]> {
  const devices: AudioDevice[] = []
  try {
    const { stdout: hwOutput } = await execAsync('arecord -l 2>/dev/null || true')

    const hwMatches = hwOutput.matchAll(
      /card (\d+): ([^[]+)\[([^\]]+)\], device (\d+): ([^[]+)\[([^\]]*)\]/g
    )
    for (const match of hwMatches) {
      const [, cardNum, cardId = '', cardName = '', deviceNum, , deviceName = ''] = match
      devices.push({
        id: `hw:${cardNum},${deviceNum}`,
        name: `hw:${cardId.trim()},${deviceNum}`,
        description: `${cardName.trim()} - ${deviceName.trim()}`
      })
    }

    const { stdout: asoundOutput } = await execAsync('cat /etc/asound.conf 2>/dev/null || true')
    const pcmMatches = asoundOutput.matchAll(/^pcm\.(\w+)\s*\{/gm)
    for (const match of pcmMatches) {
      const pcmName = match[1]
      if (!pcmName || pcmName === '!default' || pcmName === 'default' || pcmName === 'output') continue
      devices.push({
        id: pcmName,
        name: pcmName,
        description: 'ALSA plugin device'
      })
    }
  }
  catch (err) {
    console.error('[AudioDevices] arecord device discovery failed:', err)
  }
  return devices
}

export default defineEventHandler(async (): Promise<AudioDevice[]> => {
  if (process.platform === 'darwin') return listMacDevices()
  return listLinuxDevices()
})
