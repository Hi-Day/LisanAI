import { getMicrophoneErrorMessage } from "./recorder.js";

const SAMPLE_SECONDS = 4;
/** Peak amplitude (0-1) yang dianggap "suara terdengar". */
const HEARD_THRESHOLD = 0.03;

/**
 * Pengecekan mikrofon mandiri untuk modal pra-ujian: meminta izin, menampilkan
 * level suara langsung, merekam sampel pendek, lalu memutarnya kembali.
 * Sengaja dipisah dari recorder ujian agar state rekaman jawaban tidak tersentuh.
 */
export function createMicCheck({ volumeIndicator, playback }) {
  let stream = null;
  let audioContext = null;
  let analyser = null;
  let meterRaf = null;
  let peakLevel = 0;
  let playbackUrl = null;
  let running = false;

  async function run(onTick) {
    if (running) return { ok: false, message: "Tes mikrofon sedang berjalan." };
    running = true;
    reset();

    try {
      if (!window.isSecureContext) {
        return { ok: false, message: "Mikrofon hanya bisa dipakai di HTTPS atau localhost." };
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        return { ok: false, message: "Browser tidak mendukung akses mikrofon. Jawaban bisa diketik manual." };
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (error) {
        return { ok: false, message: getMicrophoneErrorMessage(error), name: error?.name || "" };
      }

      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        return { ok: false, message: "Mikrofon terdeteksi tetapi tidak ada track audio aktif." };
      }
      const label = tracks[0].label || "Mikrofon bawaan";

      startMeter();
      const chunks = await recordSample(onTick);
      stopMeter();
      releaseStream();

      if (chunks.length) setPlayback(chunks);

      return {
        ok: true,
        label,
        heard: peakLevel >= HEARD_THRESHOLD,
        peak: peakLevel,
        hasPlayback: chunks.length > 0,
        message: `Mikrofon aktif: ${label}`,
      };
    } finally {
      stopMeter();
      releaseStream();
      running = false;
    }
  }

  function recordSample(onTick) {
    return new Promise((resolve) => {
      let recorder = null;
      const chunks = [];

      const countdown = (secondsLeft) => {
        if (typeof onTick === "function") onTick(secondsLeft);
        if (secondsLeft > 0) {
          setTimeout(() => countdown(secondsLeft - 1), 1000);
          return;
        }
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        } else {
          resolve(chunks);
        }
      };

      if (typeof window.MediaRecorder !== "function") {
        countdown(SAMPLE_SECONDS);
        return;
      }

      try {
        recorder = new MediaRecorder(stream);
      } catch (error) {
        console.warn("MediaRecorder tidak tersedia untuk tes mikrofon:", error?.message);
        countdown(SAMPLE_SECONDS);
        return;
      }

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = () => resolve(chunks);
      recorder.onerror = () => resolve(chunks);
      recorder.start();
      countdown(SAMPLE_SECONDS);
    });
  }

  function setPlayback(chunks) {
    if (!playback) return;
    revokePlayback();
    playbackUrl = URL.createObjectURL(new Blob(chunks, { type: "audio/webm" }));
    playback.src = playbackUrl;
    playback.classList.remove("hidden");
  }

  function startMeter() {
    stopMeter();
    peakLevel = 0;
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const bars = volumeIndicator ? [...volumeIndicator.querySelectorAll(".volume-bar")] : [];

      const tick = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const deviation = (samples[i] - 128) / 128;
          sumSquares += deviation * deviation;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        peakLevel = Math.max(peakLevel, rms);
        const activeBars = Math.round(Math.min(1, rms * 6) * bars.length);
        bars.forEach((bar, index) => bar.classList.toggle("active", index < activeBars));
        meterRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch (error) {
      console.warn("Level meter tes mikrofon tidak tersedia:", error?.message);
    }
  }

  function stopMeter() {
    if (meterRaf) {
      cancelAnimationFrame(meterRaf);
      meterRaf = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    clearBars();
  }

  function clearBars() {
    volumeIndicator?.querySelectorAll(".volume-bar").forEach((bar) => bar.classList.remove("active"));
  }

  function releaseStream() {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function revokePlayback() {
    if (!playbackUrl) return;
    URL.revokeObjectURL(playbackUrl);
    playbackUrl = null;
  }

  /** Bersihkan hasil tes sebelumnya (dipakai saat modal dibuka/ditutup). */
  function reset() {
    stopMeter();
    releaseStream();
    if (playback) {
      playback.pause?.();
      playback.removeAttribute("src");
      playback.classList.add("hidden");
    }
    revokePlayback();
  }

  return { run, reset, isRunning: () => running, sampleSeconds: SAMPLE_SECONDS };
}
