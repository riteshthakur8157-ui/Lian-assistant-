/**
 * Gemini Live API real-time bidirectional audio streaming client
 * - Captures 16kHz PCM microphone audio and streams over WebSocket
 * - Receives 24kHz native model audio PCM from Gemini Live and plays via AudioContext
 * - Supports instant barge-in interruption
 */

export class GeminiLiveAudioClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isConnected = false;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  public onAudioLevel: ((level: number) => void) | null = null;
  public onStatusChange: ((status: "connecting" | "live" | "speaking" | "interrupted" | "closed" | "error") => void) | null = null;
  public onError: ((err: string) => void) | null = null;

  public async connect(): Promise<boolean> {
    try {
      this.disconnect();
      this.onStatusChange?.("connecting");

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      this.ws = new WebSocket(wsUrl);

      this.outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      this.ws.onopen = async () => {
        this.isConnected = true;
        this.onStatusChange?.("live");
        await this.startMicrophone();
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "audio" && data.audio) {
            this.playPcmChunk(data.audio);
          } else if (data.type === "interrupted") {
            this.interrupt();
            this.onStatusChange?.("interrupted");
          } else if (data.type === "fallback_ready") {
            console.log("Live API fallback ready notice:", data.reason);
          }
        } catch (e) {
          console.error("Error handling live audio event:", e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("Live WebSocket error:", err);
        this.onError?.("Live connection issue, falling back to standard audio pipeline");
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onStatusChange?.("closed");
      };

      return true;
    } catch (e: any) {
      console.error("Failed to connect Gemini Live audio:", e);
      this.onError?.(e.message || "Failed to establish Live session");
      return false;
    }
  }

  private async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      // 2048 samples at 16kHz ≈ 128ms chunks
      this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Compute input audio level for visualizer
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += Math.abs(inputChannel[i]);
        }
        const avg = sum / inputChannel.length;
        this.onAudioLevel?.(Math.min(1.0, avg * 3.5));

        // Convert Float32 to 16-bit PCM little-endian
        const pcm16 = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          const s = Math.max(-1, Math.min(1, inputChannel[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert to base64
        const binaryString = String.fromCharCode.apply(null, Array.from(new Uint8Array(pcm16.buffer)));
        const base64Audio = btoa(binaryString);

        this.ws.send(JSON.stringify({ audio: base64Audio }));
      };

      source.connect(this.processor);
      this.processor.connect(this.inputAudioCtx.destination);
    } catch (err: any) {
      console.error("Microphone capture error:", err);
      this.onError?.("Microphone access failed: " + err.message);
    }
  }

  private playPcmChunk(base64Pcm: string): void {
    if (!this.outputAudioCtx) return;
    if (this.outputAudioCtx.state === "suspended") {
      this.outputAudioCtx.resume();
    }

    try {
      const binaryString = atob(base64Pcm);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      let sum = 0;
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
        sum += Math.abs(float32[i]);
      }

      // Drive particle orb amplitude
      const avg = sum / pcm16.length;
      this.onAudioLevel?.(Math.min(1.0, avg * 2.8));
      this.onStatusChange?.("speaking");

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      sourceNode.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.push(sourceNode);
      sourceNode.onended = () => {
        const idx = this.activeSources.indexOf(sourceNode);
        if (idx >= 0) this.activeSources.splice(idx, 1);
        if (this.activeSources.length === 0) {
          this.onAudioLevel?.(0);
          this.onStatusChange?.("live");
        }
      };
    } catch (e) {
      console.error("Error playing PCM chunk:", e);
    }
  }

  public interrupt(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
    this.onAudioLevel?.(0);
  }

  public disconnect(): void {
    this.interrupt();

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.onStatusChange?.("closed");
  }

  public getLiveStatus(): boolean {
    return this.isConnected;
  }
}
