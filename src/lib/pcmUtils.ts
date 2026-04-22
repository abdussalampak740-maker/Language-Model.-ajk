/**
 * Utility to play raw PCM 16-bit Mono audio at 24000Hz (standard Gemini 3 output)
 */
export async function playPcmAudio(base64Data: string, sampleRate = 24000): Promise<void> {
  try {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Gemini returns 16-bit Little Endian PCM
    const audioData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(audioData.length);

    for (let i = 0; i < audioData.length; i++) {
      floatData[i] = audioData[i] / 32768.0;
    }

    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    const audioCtx = new AudioContextClass();
    
    // Crucial for browser security: context must be resumed
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const buffer = audioCtx.createBuffer(1, floatData.length, sampleRate);
    buffer.getChannelData(0).set(floatData);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    
    return new Promise((resolve, reject) => {
      source.onended = () => {
        audioCtx.close();
        resolve();
      };
      source.onerror = (e) => {
        audioCtx.close();
        reject(e);
      };
      
      try {
        source.start();
      } catch (err) {
        audioCtx.close();
        reject(err);
      }
    });
  } catch (error) {
    console.error("PCM Utility Failure:", error);
    throw error;
  }
}
