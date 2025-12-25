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
const previewWrapper = document.getElementById("previewWrapper");
let autoSaveTimer = null;

window.addEventListener("DOMContentLoaded", () => {

    // 24時間以内の更新テロップ自動復元
    restoreCurrentTelopState();

    const checked = document.querySelector('input[name="gradientType"]:checked');
    gradientType = checked ? checked.value : "none";

    // プレミアムユーザー判定
    const isPremium = localStorage.getItem("premium");
    if (isPremium === "true") {
        showPremiumContent();
    }

    // UI反映
    updateUI();
    updatePreviewTextStyle();
    updateGradientUI();
    updateTextColorUI();

    // ヘッダーテロップ
    const headerTelop = document.querySelector(".header-telop span");
    const headerContainerWidth = headerTelop.parentElement.offsetWidth;
    let x = headerContainerWidth;
    const speed = 1;
    let loopCount = 0;
    const maxLoop = 2;

    function animateTelop() {
        headerTelop.style.transform = `translateX(${x}px)`;
        x -= speed;

        if (x < -headerTelop.offsetWidth) {
            loopCount++;
            if (loopCount < maxLoop) {
                x = headerContainerWidth;
            } else {
                const hour = new Date().getHours();
                if (hour >= 4 && hour < 11) {
                    headerTelop.textContent = "おはようございます。良い一日を。";
                } else if (hour >= 11 && hour < 16) {
                    headerTelop.textContent = "こんにちは。一日を楽しみましょう。";
                } else if (hour >= 16 && hour < 20) {
                    headerTelop.textContent = "夜に向けて、いい流れ作っていきましょう。";
                } else if (hour >= 20 && hour < 24) {
                    headerTelop.textContent = "こんばんは。今日もお疲れ様です。";
                } else {
                    headerTelop.textContent = "たまには夜更かしもいいよね。";
                }
                // headerTelop.textContent = "Merry Christmas 🎄";
                headerTelop.style.transform = "translateX(0)";
                return;
            }
        }
        requestAnimationFrame(animateTelop);
    }
    animateTelop();

    const snowCanvas = document.getElementById("snowCanvas");
    const snowCtx = snowCanvas.getContext("2d");

    function resize() {
    snowCanvas.width = window.innerWidth;
    snowCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // 雪の粒
    const snowflakes = Array.from({ length: 100 }, () => ({
    x: Math.random() * snowCanvas.width,
    y: Math.random() * snowCanvas.height,
    r: Math.random() * 3 + 1,
    speed: Math.random() * 1 + 0.5,
    }));

    function drawSnow() {
    snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
    snowCtx.fillStyle = "rgba(255, 255, 255, 0.8)";

    snowflakes.forEach(flake => {
        snowCtx.beginPath();
        snowCtx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        snowCtx.fill();

        flake.y += flake.speed;
        if (flake.y > snowCanvas.height) {
        flake.y = -5;
        flake.x = Math.random() * snowCanvas.width;
        }
    });

    requestAnimationFrame(drawSnow);
    }

    drawSnow();
});


function markDirty() {
    if (!isPresetApplied) return;

    isDirty = true;
    isPresetApplied = false;
    updateUI();
}

bgColor.addEventListener('input', () => {
    updatePreviewTextStyle();
    requestAutoSave();
});

bgColor.addEventListener('change', () => {
    updatePreviewTextStyle();
    markDirty();
});

textColor.addEventListener('input', () => {
    updatePreviewTextStyle();
    requestAutoSave();
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
            pipBtn.classList.add("active");
        } else {
            await document.exitPictureInPicture();
            pipBtn.textContent = "テロップ使用";
            pipBtn.classList.remove("active");
        }
    } catch (e) {
        console.error('PiP error', e);
    }
});

video.addEventListener('leavepictureinpicture', () => {
    pipBtn.textContent = "テロップ使用";
    pipBtn.classList.remove("active");
});

document.getElementById("updateTelopBtn").addEventListener('click', () => {
    const text = telopInput.value.trim();
    if (!text) return;

    telopText = text;
    preview.textContent = text;
    updatePreviewTextStyle();

    isDirty = true;
    isPresetApplied = false;

    saveCurrentTelopState();

    updateUI();
});

createTelopBtn.addEventListener('click', async () => {

    createTelopBtn.style.display = "none";

    const text = preview.textContent;

    ctx.font = '48px sans-serif';

    // 概算時間を計算
    const speed = 2; // px/frame
    const fps = 60;
    const distance = canvas.width + ctx.measureText(text).width;
    const durationSec = Math.ceil((distance / speed) / fps);

    const creatingNotice = document.getElementById("creatingNotice");
    const creatingText = document.getElementById("creatingText");
    const catAnim = document.getElementById("catAnim");

    creatingNotice.style.display = "flex";
    catAnim.style.display = "block";
    creatingText.textContent = `Creating ... 約${durationSec}秒`;

    // カウントダウン処理
    let remaining = durationSec;
    const countdown = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            creatingText.textContent = `Creating ... 約${remaining}秒`
        } else {
            clearInterval(countdown);
            creatingNotice.style.display = "none";
            catAnim.style.display = "none";
            createTelopBtn.style.display = "block";

            // PiP化されていない時だけテロップ使用ボタンへ自動スクロール
            if (!document.pictureInPictureElement) {
                pipBtn.scrollIntoView({ behavior: "smooth", block: "center" });
                // pipBtn.classList.add("highlight");
                // setTimeout(() => {
                //     pipBtn.classList.remove("highlight");
                // }, 1500);
            }
        }
    }, 1000);

    const stream = canvas.captureStream(fps);
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

    saveCurrentTelopState();

    recorder.start();

    let x = canvas.width;
    const textWidth = ctx.measureText(text).width;

    function draw() {
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

    const confirmed = confirm("現在の設定を保存しますか？");
    if (!confirmed) return;

    const text = telopInput.value.trim();

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
    telopInput.value = preset.text;
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

    telopInput.value = "";
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

        requestAutoSave();
    });
});

gradientColorStart.addEventListener("input", () => {
    gradientColor1 = gradientColorStart.value;
    updatePreviewTextStyle();
    markDirty();
    requestAutoSave();
});

gradientColorEnd.addEventListener("input", () => {
    gradientColor2 = gradientColorEnd.value;
    updatePreviewTextStyle();
    markDirty();
    requestAutoSave();
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

function updateClearTelopBtnVisibility() {
    clearTelopBtn.style.display = telopInput.value.trim() ? "block" : "none";
}

telopInput.addEventListener("input", () => {
    updateClearTelopBtnVisibility();
    requestAutoSave();
});

clearTelopBtn.addEventListener("click", () => {
    // 意図しない消去対策のため telopText や自動保存は更新しない
    telopInput.value = "";
    updateClearTelopBtnVisibility();
});

// 現在のテロップ設定を自動保存
function saveCurrentTelopState() {

    const state = {
        gradientType,
        text: telopText,
        bgColor: bgColor.value,
        textColor: textColor.value,
        gradientColor1,
        gradientColor2,
        updatedAt: Date.now()
    }

    localStorage.setItem("livetelop:current", JSON.stringify(state));
}

// 自動保存されたテロップ設定を復元（24時間以内のみ）
function restoreCurrentTelopState() {
    const saved = localStorage.getItem("livetelop:current");
    if (!saved) return;

    let state;

    try {
        state = JSON.parse(saved);
        if (!state || typeof state.text !== "string") return;
    } catch {
        localStorage.removeItem("livetelop:current");
        return;
    }

    // 24時間以内チェック
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (!state.updatedAt || Date.now() - state.updatedAt > ONE_DAY) {
        localStorage.removeItem("livetelop:current");
        return;
    }

    // inputに反映
    telopInput.value = state.text;
    bgColor.value = state.bgColor || defaultBgColor;
    textColor.value = state.textColor || defaultTextColor;

    updateClearTelopBtnVisibility();

    gradientType = state.gradientType || "none";
    gradientColor1 = state.gradientColor1 || "#ff00ff";
    gradientColor2 = state.gradientColor2 || "#00ffff";

    gradientColorStart.value = gradientColor1;
    gradientColorEnd.value = gradientColor2;

    // radio同期
    document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
        radio.checked = radio.value === gradientType;
    })

    // preview反映
    preview.textContent = state.text;
    previewWrapper.style.backgroundColor = bgColor.value;

    // 単色 or グラデーション 適用
    updatePreviewTextStyle();
    updateGradientUI();
    updateTextColorUI();

    // 内部状態更新
    telopText = state.text;

    updateUI();

    showRestoreNotice(state.updatedAt);
}

function requestAutoSave() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(() => {
        saveCurrentTelopState();
        autoSaveTimer = null;
    }, 300);
}

// x分前、x時間前を作る関数
function formatTimeAgo(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "現在";
    if (diffMin < 60) return `${diffMin}分前`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;

    return "前回";
}

// 自動復元通知を表示
function showRestoreNotice(updatedAt) {
    const notice = document.getElementById("restoreNotice");
    if (!notice) return;

    const timeText = formatTimeAgo(updatedAt);

    notice.textContent = `${timeText}の内容を自動復元しました`;
    notice.classList.remove("hidden", "fade-out");

    // 少し表示してからフェードアウト
    setTimeout(() => {
        notice.classList.add("fade-out");
    }, 2500);

    // 完全に消す
    setTimeout(() => {
        notice.classList.add("hidden");
    }, 3800);
}
