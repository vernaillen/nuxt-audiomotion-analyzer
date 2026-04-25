import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

interface AudioDevice {
  id: string
  name: string
  description: string
}

export default defineEventHandler(async (): Promise<AudioDevice[]> => {
  const devices: AudioDevice[] = []

  try {
    // Get hardware devices from arecord -l
    const { stdout: hwOutput } = await execAsync('arecord -l 2>/dev/null || true')

    // Parse hardware devices
    const hwMatches = hwOutput.matchAll(/card (\d+): ([^\[]+)\[([^\]]+)\], device (\d+): ([^\[]+)\[([^\]]*)\]/g)
    for (const match of hwMatches) {
      const [, cardNum, cardId, cardName, deviceNum, , deviceName] = match
      devices.push({
        id: `hw:${cardNum},${deviceNum}`,
        name: `hw:${cardId.trim()},${deviceNum}`,
        description: `${cardName.trim()} - ${deviceName.trim()}`
      })
    }

    // Get software/plugin devices from ALSA config
    const { stdout: asoundOutput } = await execAsync('cat /etc/asound.conf 2>/dev/null || true')

    // Parse pcm.* definitions (dsnoop, plug, etc.)
    const pcmMatches = asoundOutput.matchAll(/^pcm\.(\w+)\s*\{/gm)
    for (const match of pcmMatches) {
      const [, pcmName] = match
      // Skip default and output devices
      if (pcmName === '!default' || pcmName === 'default' || pcmName === 'output') continue

      devices.push({
        id: pcmName,
        name: pcmName,
        description: `ALSA plugin device`
      })
    }
  } catch (err) {
    console.error('[AudioDevices] Error listing devices:', err)
  }

  return devices
})
