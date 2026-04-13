export class FirstCrackAudio {
    constructor(config) {
        this.config = config;
        this.audioContext = null;
        this.lastPopAt = 0;
        this.activeVoices = 0;
    }

    prime() {
        if (!this.config.audio?.firstCrackPop?.enabled) return;
        if (!window.AudioContext && !window.webkitAudioContext) return;
        if (!this.audioContext) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new Ctx();
        }
        if (this.audioContext.state === "suspended") {
            this.audioContext.resume().catch(() => {});
        }
    }

    playPop(nowMs = performance.now()) {
        const cfg = this.config.audio?.firstCrackPop;
        if (!cfg?.enabled) return;
        this.prime();
        if (!this.audioContext || this.audioContext.state !== "running") return;
        if ((nowMs - this.lastPopAt) < cfg.minIntervalMs) return;
        if (this.activeVoices >= cfg.maxConcurrent) return;

        const ctx = this.audioContext;
        const start = ctx.currentTime;
        const attack = cfg.attackMs / 1000;
        const decay = cfg.decayMs / 1000;
        const end = start + attack + decay;

        const osc = ctx.createOscillator();
        const toneGain = ctx.createGain();
        const noiseGain = ctx.createGain();
        const output = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const noiseSrc = this.createNoiseBufferSource(ctx);

        const freq = cfg.minPitchHz + (Math.random() * (cfg.maxPitchHz - cfg.minPitchHz));
        const peakGain = cfg.gain * (0.8 + (Math.random() * 0.4));

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(freq * 1.8, start);
        filter.Q.setValueAtTime(4.5, start);

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 0.55), end);

        toneGain.gain.setValueAtTime(0.0001, start);
        toneGain.gain.linearRampToValueAtTime(peakGain * (1 - cfg.noiseMix), start + attack);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, end);

        noiseGain.gain.setValueAtTime(0.0001, start);
        noiseGain.gain.linearRampToValueAtTime(peakGain * cfg.noiseMix, start + attack);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, end);

        output.gain.setValueAtTime(0.95, start);

        osc.connect(toneGain).connect(output);
        noiseSrc.connect(filter).connect(noiseGain).connect(output);
        output.connect(ctx.destination);

        this.activeVoices += 1;
        const cleanup = () => {
            this.activeVoices = Math.max(0, this.activeVoices - 1);
            osc.disconnect();
            toneGain.disconnect();
            noiseGain.disconnect();
            output.disconnect();
            filter.disconnect();
            noiseSrc.disconnect();
        };

        osc.onended = cleanup;
        this.lastPopAt = nowMs;
        osc.start(start);
        noiseSrc.start(start);
        osc.stop(end);
        noiseSrc.stop(end);
    }

    createNoiseBufferSource(ctx) {
        const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.09), ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
            data[i] = (Math.random() * 2) - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        return source;
    }
}
