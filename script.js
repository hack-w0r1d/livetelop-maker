const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const createTelopBtn = document.getElementById('createTelopBtn');
const video = document.getElementById('pipVideo');
const pipBtn = document.getElementById('pipBtn');
const preview = document.getElementById("telopPreview");
let telopText = "テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）";
const telopInput = document.getElementById("telopInput");
const clearTelopBtn = document.getElementById("clearTelopBtn");
const bgColor = document.getElementById('bgColorPicker');
const textColor = document.getElementById('textColorPicker');
const defaultBgColor = "#000000";
const defaultTextColor = "#ffffff";
let gradientType = "none";  // none | horizontal | vertical
let gradientColor1 = "#ff00ff";
let gradientColor2 = "#00ffff";
const gradientColorStart = document.getElementById("gradientColorStart");
const gradientColorEnd = document.getElementById("gradientColorEnd");
const isAndroid = /Android/i.test(navigator.userAgent);
const applyPresetBtn = document.getElementById("applyPresetBtn");
let isPresetApplied = false;
const deletePresetBtn = document.getElementById("deletePresetBtn");
let isDirty = false;
const savePresetBtn = document.getElementById("savePresetBtn");
const premiumLocked = document.getElementById('premiumLocked');
const unlockBtn = document.getElementById("unlockBtn");
const premiumContent = document.getElementById('premiumContent');
const premiumToast = document.getElementById('premiumToast')
const premiumOverlay = document.getElementById('premiumOverlay')
const premiumBadge = document.querySelector(".badge");
const premiumKeyModal = document.getElementById("premiumKeyModal");
const premiumKeyInput = document.getElementById("premiumKeyInput");
const premiumKeySubmit = document.getElementById("premiumKeySubmit");
const premiumKeyCancel = document.getElementById("premiumKeyCancel");
const previewWrapper = document.getElementById("previewWrapper")

window.addEventListener("DOMContentLoaded", () => {
    const checked = document.querySelector('input[name="gradientType"]:checked');
    gradientType = checked ? checked.value : "none";

    const isPremium = localStorage.getItem("premium");

    if (isPremium === "true") {
        showPremiumContent();
    }

    updateUI();
    updatePreviewTextStyle();
    updateGradientUI();
    updateTextColorUI();
});

function markDirty() {
    if (!isPresetApplied) return;

    isDirty = true;
    isPresetApplied = false;
    updateUI();
}

bgColor.addEventListener('input', updatePreviewTextStyle);
bgColor.addEventListener('change', () => {
    updatePreviewTextStyle();
    markDirty();
});

textColor.addEventListener('input', () => {
    updatePreviewTextStyle();
});

textColor.addEventListener('change', () => {
    updatePreviewTextStyle();
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
    updatePreviewTextStyle();

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
    const textWidth = ctx.measureText(telopText).width;

    function draw() {
        ctx.font = '48px sans-serif';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgColor.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setTextStyle(ctx, {
            gradientType,
            text,
            x,
            y: 70,
            color1: gradientColor1,
            color2: gradientColor2,
            textColor: textColor.value
        });

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

function saveCurrentPreset() {
    const text = document.getElementById("telopInput").value.trim();

    if (!text) {
        alert("テロップの文字が空のため、プリセットを保存できません。");
        return;
    }

    const preset = {
        gradientType,
        text,
        bgColor: bgColor.value,
        textColor: textColor.value,
        gradientColor1,
        gradientColor2
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

    gradientType = preset.gradientType || "none";
    gradientColor1 = preset.gradientColor1 || "#ff00ff";
    gradientColor2 = preset.gradientColor2 || "#00ffff";

    gradientColorStart.value = gradientColor1;
    gradientColorEnd.value = gradientColor2;

    // radio同期
    document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
        radio.checked = radio.value === gradientType;
    })

    // preview反映
    preview.textContent = preset.text;
    previewWrapper.style.backgroundColor = preset.bgColor;

    // 単色 or グラデーション 適用
    updatePreviewTextStyle();
    updateGradientUI();
    updateTextColorUI();

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

    bgColor.value = defaultBgColor;
    textColor.value = defaultTextColor;

    previewWrapper.style.backgroundColor = defaultBgColor;
    preview.style.color = defaultTextColor;

    gradientType = "none";
    gradientColor1 = "#ff00ff";
    gradientColor2 = "#00ffff";

    document.querySelector('input[name="gradientType"][value="none"]').checked = true;
    gradientColorStart.value = gradientColor1;
    gradientColorEnd.value = gradientColor2;

    updatePreviewTextStyle();
    updateGradientUI();
    updateTextColorUI();

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

function setTextStyle(ctx, option) {
    if (!option || option.gradientType === "none") {
        ctx.fillStyle = option?.textColor || "#ffffff";
        return;
    }
    const fontSize = parseInt(ctx.font, 10) || 48;
    const textWidth = ctx.measureText(option.text).width;

    let gradient;

    if (option.gradientType === "horizontal") {
        gradient = ctx.createLinearGradient(
            option.x,
            option.y,
            option.x + textWidth,
            option.y
        );
    } else if (option.gradientType === "vertical") {
        gradient = ctx.createLinearGradient(
            option.x,
            option.y - fontSize,
            option.x,
            option.y
        );
    }

    gradient.addColorStop(0, option.color1);
    gradient.addColorStop(1, option.color2);

    ctx.fillStyle = gradient;
}

// グラデーションなしを選択したときにカラーピッカーを薄くする
function updateGradientUI() {
    const isNone = gradientType === "none";
    const colors = document.querySelector('.gradient-colors');
    if (!colors) return;
    colors.style.opacity = isNone ? 0.4 : 1;
    colors.style.pointerEvents = isNone ? "none" : "auto";
}

document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
    radio.addEventListener('change', () => {
        gradientType = radio.value;

        markDirty();
        updatePreviewTextStyle();
        updateGradientUI();
        updateTextColorUI();
    });
});

gradientColorStart.addEventListener("input", () => {
    gradientColor1 = gradientColorStart.value;
    updatePreviewTextStyle();
    markDirty();
});

gradientColorEnd.addEventListener("input", () => {
    gradientColor2 = gradientColorEnd.value;
    updatePreviewTextStyle();
    markDirty();
});

function updatePreviewTextStyle() {

    previewWrapper.style.backgroundColor = bgColor.value;

    if (gradientType === "none") {
        preview.style.color = textColor.value;
        preview.style.backgroundImage = "none";
        preview.style.removeProperty("-webkit-background-clip");
        return;
    }

    const direction = gradientType === "horizontal" ? "to right" : "to bottom";

    preview.style.backgroundImage = `linear-gradient(${direction}, ${gradientColor1}, ${gradientColor2})`;

    preview.style.backgroundClip = "text";

    preview.style.setProperty("-webkit-background-clip", "text");
    preview.style.color = "transparent";
}

function updateTextColorUI() {
    const wrapper = document.querySelector('.text-color-wrapper');
    if (!wrapper) return;

    const isGradient = gradientType !== "none";

    wrapper.style.opacity = isGradient ? 0.4 : 1;
    wrapper.style.pointerEvents = isGradient ? "none" : "auto";
}

// プレミアム機能解放モーダル表示
unlockBtn.addEventListener('click', () => {
    premiumKeyModal.classList.remove("hidden");
    premiumKeyInput.value = "";
});

// プレミアム機能解放モーダル非表示
premiumKeyCancel.addEventListener("click", () => {
    premiumKeyModal.classList.add("hidden");
})

premiumKeySubmit.addEventListener("click", submitPremiumKey);

premiumKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        submitPremiumKey();
    }
})

function submitPremiumKey() {
    const key = premiumKeyInput.value.trim();

    if (!key) {
        alert("解放キーを入力してください");
        return;
    }

    if (key === "Sweet_dreams") {
        localStorage.setItem("premium", "true");
        premiumKeyModal.classList.add("hidden");

        showPremiumContent();
        showPremiumAnimation();

        setTimeout(() => {
            glowPremiumBadge();
        }, 3600);
    } else {
        alert("解放キーが正しくありません");
    }
}

function showPremiumContent() {
    premiumLocked.classList.add("hidden");
    premiumContent.classList.remove("hidden");
}

function showPremiumAnimation() {

    premiumOverlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        premiumOverlay.classList.add("show");
    })

    setTimeout(() => {
        premiumToast.classList.remove('hidden');
        requestAnimationFrame(() => {
            premiumToast.classList.add("show");
        });
    }, 500);

    setTimeout(() => {
        premiumToast.classList.remove('show');
    }, 2600);

    setTimeout(() => {
        premiumOverlay.classList.remove('show');
    }, 3100);

    setTimeout(() => {
        premiumToast.classList.add('hidden');
        premiumOverlay.classList.add('hidden');
    }, 3600);
}

function glowPremiumBadge() {
    if (!premiumBadge) return;

    premiumBadge.classList.remove("glow");
    void premiumBadge.offsetWidth;
    premiumBadge.classList.add("glow");
}

telopInput.addEventListener("input", () => {
    clearTelopBtn.style.display = telopInput.value ? "block" : "none";
});

clearTelopBtn.addEventListener("click", () => {
    telopInput.value = "";
    clearTelopBtn.style.display = "none";
});
