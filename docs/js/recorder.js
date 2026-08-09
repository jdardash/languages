// Shared record-and-compare machinery (Speechling/Mango mechanic, minus the
// fake scoring): hearing your own attempt against the native clip is the
// feedback loop. One ephemeral take; gone on reset. No ASR on purpose -
// automatic scoring runs 75-80% accuracy on learner speech and mistrains.

export function createRecorder({ recBtn, playBtn, statusEl, recordingMsg = "Recording - speak now." }) {
  let recorder = null, takeUrl = null, discarded = false;

  function reset() {
    if (recorder && recorder.state === "recording") { discarded = true; recorder.stop(); }
    if (takeUrl) { URL.revokeObjectURL(takeUrl); takeUrl = null; }
    playBtn.hidden = true;
    recBtn.textContent = "Record my attempt";
    statusEl.textContent = "";
  }

  recBtn.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") { recorder.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      statusEl.textContent = "Recording is not supported in this browser.";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", e => chunks.push(e.data));
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach(t => t.stop());
        if (discarded) return;
        if (takeUrl) URL.revokeObjectURL(takeUrl);
        takeUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        playBtn.hidden = false;
        recBtn.textContent = "Record again";
        statusEl.textContent = "Play the native clip, then yours - where do they differ?";
      });
      discarded = false;
      recorder.start();
      recBtn.textContent = "Stop recording";
      statusEl.textContent = recordingMsg;
    } catch {
      statusEl.textContent = "Microphone unavailable or permission denied.";
    }
  });

  playBtn.addEventListener("click", () => { if (takeUrl) new Audio(takeUrl).play(); });

  return { reset };
}
