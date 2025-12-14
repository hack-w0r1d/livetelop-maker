const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const createTelopBtn = document.getElementById('createTelopBtn');
const video = document.getElementById('pipVideo');
const pipBtn = document.getElementById('pipBtn');
const preview = document.getElementById("telopPreview");
let telopText = "テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）";
const bgColor = document.getElementById('bgColorPicker');
const textColor = document.getElementById('textColorPicker');
const updateBgColor = () => telopPreview.style.backgroundColor = bgColor.value;
const updateTextColor = () => telopPreview.style.color = textColor.value;
const isAndroid = /Android/i.test(navigator.userAgent);
const applyPresetBtn = document.getElementById("applyPresetBtn");
let isPresetApplied = false;
const deletePresetBtn = document.getElementById("deletePresetBtn");
let isDirty = false;
const savePresetBtn = document.getElementById("savePresetBtn");

function markDirty() {
    if (!isPresetApplied) return;

    isDirty = true;
    isPresetApplied = false;
    updateUI();
}

bgColor.addEventListener('input', updateBgColor);
bgColor.addEventListener('change', () => {
    updateBgColor();
    markDirty();
});

textColor.addEventListener('input', updateTextColor);
textColor.addEventListener('change', () => {
    updateTextColor();
    markDirty();
});

pipBtn.addEventListener('click', async () => {
    try {
        if (!document.pictureInPictureElement) {
            await video.requestPictureInPicture();
            pipBtn.textContent = "テロップ使用解除";
        } else {
            await document.exitPictureInPicture();
            pipBtn.textContent = "テロップ使用";
        }
    } catch (e) {
        console.error('PiP error', e);
    }
});

document.getElementById("updateTelopBtn").addEventListener('click', () => {
    const text = document.getElementById("telopInput").value.trim();
    if (!text) return;

    telopText = text;
    preview.textContent = text;

    isDirty = true;
    isPresetApplied = false;

    updateUI();
});

createTelopBtn.addEventListener('click', () => {
    const stream = canvas.captureStream(60); // 60fps
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = e => {
    const blob = new Blob(chunks, { type: 'video/webm' });

    // videoタグに読み込んで自動ループ再生
    if (video.src) URL.revokeObjectURL(video.src);
    video.src = URL.createObjectURL(blob);
    video.play();
    };

    recorder.start();

    let x = canvas.width;
    const speed = 2; // 横スクロール速度
    const text = telopText;
    ctx.font = '48px sans-serif';
    const textWidth = ctx.measureText(telopText).width;

    function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = textColor.value;
    ctx.fillText(text, x, 70);
    x -= speed;
    }

    function loop() {
    draw();
    if (x < -textWidth) {
        recorder.stop();
        return;
    }
    requestAnimationFrame(loop);
    }
    loop();
});

video.controls = isAndroid;

function hasPreset() {
    try {
        const presets = JSON.parse(localStorage.getItem("livetelop_presets"));
        return Array.isArray(presets) && presets.length > 0;
    } catch {
        return false;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    updateUI();
});

function saveCurrentPreset() {
    const text = document.getElementById("telopInput").value.trim();

    if (!text) {
        alert("テロップの文字が空のため、プリセットを保存できません。");
        return;
    }

    const preset = {
        text,
        bgColor: bgColor.value,
        textColor: textColor.value
    };

    localStorage.setItem("livetelop_presets", JSON.stringify([preset]));

    isDirty = false;

    updateUI();

    alert("現在の設定をプリセットに保存しました。");
}

// プリセット適用
function applySavedPreset() {
    const presets = JSON.parse(localStorage.getItem("livetelop_presets"));
    if (!presets || presets.length === 0) return;

    const preset = presets[0];

    // inputに反映
    document.getElementById("telopInput").value = preset.text;
    bgColor.value = preset.bgColor;
    textColor.value = preset.textColor;

    // previewに反映
    preview.textContent = preset.text;
    preview.style.backgroundColor = preset.bgColor;
    preview.style.color = preset.textColor;

    // 内部状態更新
    telopText = preset.text;

    isDirty = false;
    isPresetApplied = true;

    updateUI();
}

function deletePreset() {
    const confirmed = confirm("保存されているプリセットを削除しますか？");
    if (!confirmed) return;

    localStorage.removeItem("livetelop_presets");

    isPresetApplied = false;
    isDirty = false;

    document.getElementById("telopInput").value = "";
    preview.textContent = "テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）";

    updateUI();
    alert("プリセットを削除しました。");
}

document.getElementById("applyPresetBtn").addEventListener("click", applySavedPreset);

document.getElementById("savePresetBtn").addEventListener("click", saveCurrentPreset);

document.getElementById("deletePresetBtn").addEventListener("click", deletePreset);

// UI表示制御
function updateUI() {
    const has = hasPreset();

    // 保存ボタン
    savePresetBtn.style.display = isDirty ? "inline-block" : "none";
    savePresetBtn.disabled = !isDirty;

    // プリセット適用ボタン
    applyPresetBtn.style.display = has ? "inline-block" : "none";

    // 削除ボタン
    deletePresetBtn.style.display = has && isPresetApplied ? "inline-block" : "none";
}
