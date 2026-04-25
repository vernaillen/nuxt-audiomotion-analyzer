/**
 * AudioWorklet processor that receives PCM audio data and outputs it
 * This runs in a separate audio thread for low-latency processing
 */
class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    // Ring buffer to store incoming PCM samples
    // Size: ~500ms of stereo audio at 48kHz
    this.bufferSize = 48000 * 2 * 0.5
    this.buffer = new Float32Array(this.bufferSize)
    this.writeIndex = 0
    this.readIndex = 0
    this.samplesAvailable = 0

    // Audio config (will be set via message)
    this.channels = 2
    this.sampleRate = 48000

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'config') {
        this.channels = event.data.channels || 2
        this.sampleRate = event.data.sampleRate || 48000
      } else if (event.data.type === 'pcm') {
        this.enqueuePCM(event.data.samples)
      }
    }
  }

  enqueuePCM(samples) {
    // samples is a Float32Array of interleaved stereo samples
    const samplesToWrite = Math.min(samples.length, this.bufferSize - this.samplesAvailable)

    for (let i = 0; i < samplesToWrite; i++) {
      this.buffer[this.writeIndex] = samples[i]
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize
    }

    this.samplesAvailable += samplesToWrite
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    if (!output || output.length === 0) return true

    const leftChannel = output[0]
    const rightChannel = output[1] || output[0]
    const frameCount = leftChannel.length

    // We need frameCount * 2 samples (stereo interleaved)
    const samplesNeeded = frameCount * 2

    if (this.samplesAvailable >= samplesNeeded) {
      for (let i = 0; i < frameCount; i++) {
        // Deinterleave stereo samples
        leftChannel[i] = this.buffer[this.readIndex]
        this.readIndex = (this.readIndex + 1) % this.bufferSize

        rightChannel[i] = this.buffer[this.readIndex]
        this.readIndex = (this.readIndex + 1) % this.bufferSize
      }
      this.samplesAvailable -= samplesNeeded
    } else {
      // Not enough samples, output silence
      leftChannel.fill(0)
      rightChannel.fill(0)
    }

    return true
  }
}

registerProcessor('pcm-worklet-processor', PCMWorkletProcessor)
