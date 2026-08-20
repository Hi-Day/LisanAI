const SPEECH_ERROR_MESSAGES = {
  "audio-capture": "Mikrofon tidak terdeteksi. Periksa device input di browser atau sistem.",
  "not-allowed": "Izin mikrofon ditolak. Klik ikon izin di address bar lalu Allow microphone.",
  "service-not-allowed": "Layanan transkripsi browser tidak diizinkan. Rekaman audio lokal tetap bisa dipakai.",
  network: "Layanan transkripsi browser sedang tidak tersedia. Rekaman audio lokal tetap bisa dipakai.",
  "no-speech": "Belum terdengar suara. Coba bicara lebih dekat ke mikrofon.",
};

export function createRecorder({ recordButton, recordStatus, answerText, recordTimer, volumeIndicator }) {
  let mediaRecorder = null;
  let recognition = null;
  let mediaStream = null;
  let audioChunks = [];
  let recognizing = false;
  let transcriptDraft = "";
  let runId = 0;
  let enabled = true;
  let timerInterval = null;
  let recordingStartedAt = 0;
  let audioContext = null;
  let analyser = null;
  let volumeRaf = null;

  async function start() {
    if (!enabled) return;
    if (isRecording()) return;

    const activeRunId = runId + 1;
    runId = activeRunId;
    setPreparing(true);
    try {
      mediaStream = await requestMicrophone();
      if (activeRunId !== runId) {
        stopStream();
        return;
      }

      // Start MediaRecorder for actual audio storage
      startMediaRecorder("Merekam audio...", activeRunId);

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        startSpeechRecognition(SpeechRecognition, activeRunId);
      }
    } catch (err) {
      recordStatus.textContent = err.message;
      setRecording(false);
      throw err;
    } finally {
      setPreparing(false);
    }
  }

  async function toggle() {
    if (isRecording()) {
      stop();
    } else {
      await start();
    }
  }

  function stop() {
    runId += 1;
    if (recognition && recognizing) recognition.stop();
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    // Do NOT stop stream here, wait for mediaRecorder to finish saving chunks.
    // Stream will be stopped in onstop event of mediaRecorder.
    recognizing = false;
    transcriptDraft = "";
    setRecording(false);
  }

  function isRecording() {
    return recognizing || mediaRecorder?.state === "recording";
  }

  async function requestMicrophone() {
    if (!window.isSecureContext) {
      throw new Error("Mikrofon hanya bisa dipakai di HTTPS atau localhost.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser tidak mendukung akses mikrofon. Ketik jawaban manual.");
    }

    recordStatus.textContent = "Meminta izin mikrofon...";
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      throw new Error(getMicrophoneErrorMessage(error));
    }
  }

  function startSpeechRecognition(SpeechRecognition, activeRunId) {
    transcriptDraft = answerText.value.trim();
    recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      if (activeRunId !== runId) return;
      recognizing = true;
      recordStatus.textContent = "Merekam suara dan membuat transkripsi...";
    };

    recognition.onresult = (event) => {
      if (activeRunId !== runId) return;
      const { finalText, interimText } = collectSpeechText(event);
      if (finalText) transcriptDraft = [transcriptDraft, finalText].filter(Boolean).join(" ");
      answerText.value = [transcriptDraft, interimText].filter(Boolean).join(" ");
    };

    recognition.onerror = (event) => {
      if (activeRunId !== runId) return;
      console.warn("Speech recognition error:", event.error);
      recognizing = false;
    };

    recognition.onend = () => {
      if (activeRunId !== runId) return;
      recognizing = false;
    };

    try {
      recognition.start();
    } catch (error) {
      recognizing = false;
      console.warn("Transkripsi tidak bisa dimulai:", error.message);
    }
  }

  function startMediaRecorder(status, activeRunId) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => {
      if (activeRunId !== runId) return;
      if (event.data.size) audioChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      if (activeRunId !== runId) return;
      stopStream();
      stopTimer();
      stopVolumeMeter();
      recordStatus.textContent = audioChunks.length
        ? (answerText.readOnly
            ? "Audio berhasil direkam. Jawaban hanya menggunakan transkripsi otomatis."
            : "Audio berhasil direkam. Ketik atau koreksi transkripsi agar bisa dinilai.")
        : "Rekaman berhenti, tetapi tidak ada audio yang tersimpan.";
    };
    mediaRecorder.start();
    setRecording(true);
    recordStatus.textContent = status;
    startTimer();
    startVolumeMeter();
  }

  function collectSpeechText(event) {
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) {
        finalText = [finalText, transcript].filter(Boolean).join(" ");
      } else {
        interimText = [interimText, transcript].filter(Boolean).join(" ");
      }
    }
    return { finalText, interimText };
  }

  function setPreparing(preparing) {
    recordButton.disabled = preparing;
    recordButton.setAttribute("aria-label", preparing ? "Menyiapkan mikrofon..." : "Mulai rekam");
  }

  function setRecording(recording) {
    recordButton.classList.toggle("recording", recording);
    recordButton.setAttribute("aria-label", recording ? "Berhenti rekam" : "Mulai rekam");
    const label = recordButton.querySelector(".record-label");
    if (label) label.textContent = recording ? "Berhenti" : "Mulai rekam";
  }

  function resetStatus() {
    if (isRecording()) return;
    recordStatus.textContent = "Siap merekam";
    resetTimer();
    resetVolumeMeter();
  }

  function startTimer() {
    stopTimer();
    recordingStartedAt = Date.now();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (!recordTimer) return;
    const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const s = (elapsed % 60).toString().padStart(2, "0");
    recordTimer.textContent = `${m}:${s}`;
  }

  function resetTimer() {
    stopTimer();
    if (recordTimer) recordTimer.textContent = "00:00";
  }

  function startVolumeMeter() {
    stopVolumeMeter();
    if (!volumeIndicator) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const bars = volumeIndicator.querySelectorAll(".volume-bar");

      const tick = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const level = Math.min(1, avg / 128);
        const activeBars = Math.round(level * bars.length);
        bars.forEach((bar, index) => {
          bar.classList.toggle("active", index < activeBars);
        });
        volumeRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch (error) {
      console.warn("Volume meter tidak tersedia:", error.message);
    }
  }

  function stopVolumeMeter() {
    if (volumeRaf) {
      cancelAnimationFrame(volumeRaf);
      volumeRaf = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
      analyser = null;
    }
    resetVolumeMeter();
  }

  function resetVolumeMeter() {
    if (!volumeIndicator) return;
    volumeIndicator.querySelectorAll(".volume-bar").forEach((bar) => bar.classList.remove("active"));
  }

  function stopStream() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function getAudioBase64() {
    if (audioChunks.length === 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function clearAudio() {
    audioChunks = [];
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    if (!enabled) {
      stop();
      clearAudio();
    }
  }

  async function testMicrophone() {
    if (isRecording()) {
      return { ok: false, message: "Rekaman sedang berjalan. Hentikan dulu sebelum tes mikrofon." };
    }
    if (!window.isSecureContext) {
      return { ok: false, message: "Mikrofon hanya bisa dipakai di HTTPS atau localhost." };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, message: "Browser tidak mendukung akses mikrofon. Ketik jawaban manual." };
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        return { ok: false, message: "Mikrofon terdeteksi tetapi tidak ada track audio aktif." };
      }
      const label = tracks[0].label || "Mikrofon bawaan";
      const enabled = tracks[0].enabled;
      return { ok: true, message: `Mikrofon siap: ${label}`, label, enabled };
    } catch (error) {
      return { ok: false, message: getMicrophoneErrorMessage(error), name: error?.name || "" };
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    }
  }

  return { resetStatus, stop, start, toggle, getAudioBase64, clearAudio, setEnabled, testMicrophone };
}

function getMicrophoneErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin mikrofon diblokir. Klik ikon izin di address bar, pilih Allow microphone, lalu reload halaman.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Mikrofon tidak ditemukan. Sambungkan mikrofon atau pilih input audio di pengaturan browser.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Mikrofon sedang dipakai aplikasi lain atau tidak bisa dibaca.";
  }
  if (name === "OverconstrainedError") {
    return "Konfigurasi mikrofon tidak cocok.";
  }
  return error?.message || "Mikrofon belum bisa digunakan.";
}
