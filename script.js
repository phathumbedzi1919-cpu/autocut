
const { createFFmpeg, fetchFile } = FFmpeg;

const videoInput = document.getElementById("videoInput");
const fileInfo = document.getElementById("fileInfo");
const preview = document.getElementById("sourcePreview");
const startBtn = document.getElementById("startBtn");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("status");
const clipsArea = document.getElementById("clips");

let selectedFile = null;
let ffmpeg = null;
let previewURL = null;

videoInput.addEventListener("change", () => {
  selectedFile = videoInput.files[0];

  if (!selectedFile) return;

  if (previewURL) URL.revokeObjectURL(previewURL);

  previewURL = URL.createObjectURL(selectedFile);
  preview.src = previewURL;
  preview.hidden = false;

  fileInfo.textContent =
    selectedFile.name + " · " +
    (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB";

  clipsArea.innerHTML = "";
  progressBar.style.width = "0%";
  statusText.textContent = "Video ready.";
});

async function loadEngine() {
  if (ffmpeg && ffmpeg.isLoaded()) return;

  statusText.textContent = "Loading video engine...";

  ffmpeg = createFFmpeg({
    log: false,
    corePath:
      "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js"
  });

  await ffmpeg.load();
}

function addClip(number, data) {
  const blob = new Blob([data], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  const card = document.createElement("div");
  card.className = "clip-card";

  const title = document.createElement("strong");
  title.textContent = "Short " + number;

  const video = document.createElement("video");
  video.src = url;
  video.controls = true;
  video.playsInline = true;

  const download = document.createElement("a");
  download.href = url;
  download.download = "AutoCut-Short-" + number + ".mp4";
  download.className = "download";
  download.textContent = "DOWNLOAD SHORT";

  card.appendChild(title);
  card.appendChild(video);
  card.appendChild(download);

  clipsArea.appendChild(card);
}

startBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    alert("Please select a video first.");
    return;
  }

  startBtn.disabled = true;
  clipsArea.innerHTML = "";
  progressBar.style.width = "0%";

  try {
    await loadEngine();

    const duration = preview.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not read the video duration.");
    }

    const clipLength = Number(
      document.getElementById("clipLength").value
    );

    const format = document.getElementById("format").value;

    const totalClips = Math.ceil(duration / clipLength);

    statusText.textContent =
      "Preparing " + totalClips + " clips...";

    const inputName = "original.mp4";

    await ffmpeg.FS(
      "writeFile",
      inputName,
      await fetchFile(selectedFile)
    );

    for (let i = 0; i < totalClips; i++) {
      const start = i * clipLength;
      const length = Math.min(clipLength, duration - start);
      const outputName = "short" + i + ".mp4";

      statusText.textContent =
        "Creating Short " + (i + 1) + " of " + totalClips;

      const command = [
        "-ss", String(start),
        "-i", inputName,
        "-t", String(length)
      ];

      if (format === "vertical") {
        command.push(
          "-vf",
          "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"
        );
      }

      command.push(
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-y", outputName
      );

      ffmpeg.setProgress(({ ratio }) => {
        const currentProgress =
          ((i + Math.max(0, Math.min(1, ratio))) / totalClips) * 100;

        progressBar.style.width =
          currentProgress + "%";
      });

      await ffmpeg.run(...command);

      const data = ffmpeg.FS("readFile", outputName);

      addClip(i + 1, data);

      ffmpeg.FS("unlink", outputName);

      progressBar.style.width =
        (((i + 1) / totalClips) * 100) + "%";
    }

    ffmpeg.FS("unlink", inputName);

    statusText.textContent =
      "Finished! Your Shorts are ready to download.";

  } catch (error) {
    console.error(error);

    statusText.textContent =
      "Processing failed: " + error.message;

    alert(
      "AutoCut could not process this video. " +
      "Try a smaller MP4 video or another browser."
    );

  } finally {
    startBtn.disabled = false;
  }
});
