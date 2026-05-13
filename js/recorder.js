const SPEECH_ERROR_MESSAGES = {
  "audio-capture": "Mikrofon tidak terdeteksi. Periksa device input di browser atau sistem.",
  "not-allowed": "Izin mikrofon ditolak. Klik ikon izin di address bar lalu Allow microphone.",
  "service-not-allowed": "Layanan transkripsi browser tidak diizinkan. Rekaman audio lokal tetap bisa dipakai.",
  network: "Layanan transkripsi browser sedang tidak tersedia. Rekaman audio lokal tetap bisa dipakai.",
  "no-speech": "Belum terdengar suara. Coba bicara lebih dekat ke mikrofon.",
};

export function createRecorder({ recordButton, recordStatus, answerText }) {
  let mediaRecorder = null;
  let recognition = null;
  let mediaStream = null;
  let audioChunks = [];
  let recognizing = false;
  let transcriptDraft = "";
  let runId = 0;

  async function toggle() {
    if (isRecording()) {
      stop();
      return;
    }

    const activeRunId = runId + 1;
    runId = activeRunId;
    setPreparing(true);
    try {
      mediaStream = await requestMicrophone();
      if (activeRunId !== runId) {
        stopStream();
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        startSpeechRecognition(SpeechRecognition, activeRunId);
      } else {
        startMediaRecorder("Merekam audio lokal. Ketik transkripsi setelah selesai.", activeRunId);
      }
    } finally {
      setPreparing(false);
    }
  }

  function stop() {
    runId += 1;
    if (recognition && recognizing) recognition.stop();
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
    stopStream();
    recognizing = false;
    transcriptDraft = "";
    setRecording(false);
  }

  function isRecording() {
    return recognizing || mediaRecorder?.state === "recording";
  }

async function requestMicrophone() {
    if (!window.isSecureContext) {
      throw new Error("Mikrofon hanya bisa dipakai di HTTPS atau localhost. Buka http://127.0.0.1:4173.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser tidak mendukung akses mikrofon. Ketik jawaban manual.");
    }

    recordStatus.textContent = "Meminta izin mikrofon...";
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      throw new Error(getMicrophoneErrorMessage(error));
    }
  }

  function startSpeechRecognition(SpeechRecognition, activeRunId) {
    stopStream();
    transcriptDraft = answerText.value.trim();
    recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      if (activeRunId !== runId) return;
      recognizing = true;
      setRecording(true);
      recordStatus.textContent = "Mendengarkan jawaban dan membuat transkripsi...";
    };

    recognition.onresult = (event) => {
      if (activeRunId !== runId) return;
      const { finalText, interimText } = collectSpeechText(event);
      if (finalText) transcriptDraft = [transcriptDraft, finalText].filter(Boolean).join(" ");
      answerText.value = [transcriptDraft, interimText].filter(Boolean).join(" ");
    };

    recognition.onerror = (event) => {
      if (activeRunId !== runId) return;
      const message = SPEECH_ERROR_MESSAGES[event.error] || `Transkripsi gagal: ${event.error}`;
      recordStatus.textContent = message;
      recognizing = false;
      setRecording(false);

      if (event.error === "network" || event.error === "service-not-allowed") {
        startMediaRecorderAfterSpeechFailure(message, activeRunId);
      }
    };

    recognition.onend = () => {
      if (activeRunId !== runId) return;
      recognizing = false;
      setRecording(false);
      if (recordStatus.textContent.includes("Mendengarkan")) {
        recordStatus.textContent = answerText.value.trim()
          ? "Transkripsi dihentikan. Jawaban siap disimpan."
          : "Rekaman dihentikan. Belum ada transkripsi yang terbaca.";
      }
    };

    try {
      recognition.start();
    } catch (error) {
      recognizing = false;
      setRecording(false);
      throw new Error(`Transkripsi tidak bisa dimulai: ${error.message}`);
    }
  }

  async function startMediaRecorderAfterSpeechFailure(reason, activeRunId) {
    try {
      mediaStream = await requestMicrophone();
      if (activeRunId !== runId) {
        stopStream();
        return;
      }
      startMediaRecorder(`${reason} Merekam audio lokal...`, activeRunId);
    } catch (error) {
      if (activeRunId !== runId) return;
      recordStatus.textContent = `${reason} ${error.message}`;
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
      recordStatus.textContent = audioChunks.length
        ? "Audio berhasil direkam. Ketik atau koreksi transkripsi agar bisa dinilai."
        : "Rekaman berhenti, tetapi tidak ada audio yang tersimpan.";
    };
    mediaRecorder.start();
    setRecording(true);
    recordStatus.textContent = status;
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
  }

  function setRecording(recording) {
    recordButton.classList.toggle("recording", recording);
    recordButton.setAttribute("aria-label", recording ? "Hentikan rekam" : "Mulai rekam");
  }

  function resetStatus() {
    if (isRecording()) return;
    recordStatus.textContent = "Siap merekam";
  }

  function stopStream() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  return { resetStatus, stop, toggle };
}

function getMicrophoneErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Izin mikrofon diblokir. Klik ikon izin di address bar untuk http://127.0.0.1:4173, pilih Allow microphone, lalu reload halaman.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Mikrofon tidak ditemukan. Sambungkan mikrofon atau pilih input audio di pengaturan browser.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Mikrofon sedang dipakai aplikasi lain atau tidak bisa dibaca. Tutup aplikasi meeting/rekaman lain lalu coba lagi.";
  }
  if (name === "OverconstrainedError") {
    return "Konfigurasi mikrofon tidak cocok. Coba ganti device input audio di browser.";
  }
  return error?.message || "Mikrofon belum bisa digunakan. Ketik jawaban manual.";
}
