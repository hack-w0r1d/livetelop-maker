import {
    state,
    telopInput, clearTelopBtn,
    defaultBgColor, defaultTextColor,
    bgColor, textColor,
    speedSlider, speedLabel, SPEED_LABELS,
    gradientColorStart, gradientColorEnd,
    fontSelect,
    preview, previewWrapper,
    applyPresetBtn, savePresetBtn, deletePresetBtn,
} from './state.js';
import { initPremium }    from './premium.js';
import { initTelop }      from './telop.js';
import {
    requestAutoSave,
    saveCurrentTelopState,
    restoreCurrentTelopState,
    showNotice,
    hasPreset,
    saveCurrentPreset,
    applySavedPreset,
    deletePreset,
} from './storage.js';

// ─────────────────────────────────────────
// UI更新
// ─────────────────────────────────────────
export function updateUI() {
    const has = hasPreset();

    savePresetBtn.style.display   = state.isDirty ? 'inline-block' : 'none';
    savePresetBtn.disabled        = !state.isDirty;
    applyPresetBtn.style.display  = has ? 'inline-block' : 'none';
    deletePresetBtn.style.display = has && state.isPresetApplied ? 'inline-block' : 'none';
}

export function updatePreviewTextStyle() {
    previewWrapper.style.backgroundColor = bgColor.value;

    if (state.gradientType === 'none') {
        preview.style.color           = textColor.value;
        preview.style.backgroundImage = 'none';
        preview.style.removeProperty('-webkit-background-clip');
        return;
    }

    const direction = state.gradientType === 'horizontal' ? 'to right' : 'to bottom';
    preview.style.backgroundImage = `linear-gradient(${direction}, ${state.gradientColor1}, ${state.gradientColor2})`;
    preview.style.backgroundClip  = 'text';
    preview.style.setProperty('-webkit-background-clip', 'text');
    preview.style.color = 'transparent';
}

export function updateGradientUI() {
    const isNone      = state.gradientType === 'none';
    const colors      = document.querySelector('.gradient-colors');
    const swapBtn     = document.getElementById('swapGradientBtn');
    const swapColorBtn = document.getElementById('swapColorBtn');
    if (!colors) return;
    colors.style.opacity       = isNone ? 0.4 : 1;
    colors.style.pointerEvents = isNone ? 'none' : 'auto';
    if (swapBtn) swapBtn.style.display = isNone ? 'none' : 'inline-block';
    if (swapColorBtn) swapColorBtn.style.display = isNone ? 'inline-block' : 'none';
}

export function updateTextColorUI() {
    const wrapper = document.querySelector('.text-color-wrapper');
    if (!wrapper) return;
    const isGradient = state.gradientType !== 'none';
    wrapper.style.opacity       = isGradient ? 0.4 : 1;
    wrapper.style.pointerEvents = isGradient ? 'none' : 'auto';
}

function updateSpeedLabel() {
    const index = Math.min(Math.round(speedSlider.value / 25), 4);
    speedLabel.textContent = SPEED_LABELS[index];
}

function updateClearTelopBtnVisibility() {
    clearTelopBtn.style.display = telopInput.value.trim() ? 'block' : 'none';
}

// ─────────────────────────────────────────
// isDirtyフラグ管理
// ─────────────────────────────────────────
function markDirty() {
    state.isDirty        = true;
    state.isPresetApplied = false;
    updateUI();
}

// ─────────────────────────────────────────
// イベントリスナー
// ─────────────────────────────────────────

// 背景色
bgColor.addEventListener('input', () => {
    updatePreviewTextStyle();
    requestAutoSave();
});
bgColor.addEventListener('change', () => {
    updatePreviewTextStyle();
    markDirty();
});

// 文字色
textColor.addEventListener('input', () => {
    updatePreviewTextStyle();
    requestAutoSave();
});
textColor.addEventListener('change', () => {
    updatePreviewTextStyle();
    markDirty();
});

const SNAP_CENTER  = 50;
const SNAP_ZONE    = 3;   // ±3の範囲でスナップ（47〜53）

// テロップ速度
speedSlider.addEventListener('input', () => {
    let value = Number(speedSlider.value);

    const nearCenter = Math.abs(value - SNAP_CENTER) <= SNAP_ZONE;
    if (nearCenter) {
        value = SNAP_CENTER;
        speedSlider.value = SNAP_CENTER;
    }

    state.speedLevel = value;
    updateSpeedLabel();
    requestAutoSave();
});
speedSlider.addEventListener('change', () => {
    markDirty();
});

// グラデーション方向
document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
    radio.addEventListener('change', () => {
        state.gradientType = radio.value;
        markDirty();
        updatePreviewTextStyle();
        updateGradientUI();
        updateTextColorUI();
        requestAutoSave();
    });
});

// グラデーション色
gradientColorStart.addEventListener('input', () => {
    state.gradientColor1 = gradientColorStart.value;
    updatePreviewTextStyle();
    markDirty();
    requestAutoSave();
});
gradientColorEnd.addEventListener('input', () => {
    state.gradientColor2 = gradientColorEnd.value;
    updatePreviewTextStyle();
    markDirty();
    requestAutoSave();
});

// テロップ更新ボタン
document.getElementById('updateTelopBtn').addEventListener('click', () => {
    const text = telopInput.value.trim();
    if (!text) return;

    state.telopText       = text;
    preview.textContent   = text;
    state.isDirty         = true;
    state.isPresetApplied = false;

    updatePreviewTextStyle();
    saveCurrentTelopState();
    updateUI();
});

// テロップ入力
telopInput.addEventListener('input', () => {
    updateClearTelopBtnVisibility();
    requestAutoSave();
});

// クリアボタン（意図しない消去対策のため telopText や自動保存は更新しない）
clearTelopBtn.addEventListener('click', () => {
    telopInput.value = '';
    updateClearTelopBtnVisibility();
});

// プリセット操作
applyPresetBtn.addEventListener('click', () => {
    applySavedPreset(() => {
        updatePreviewTextStyle();
        updateTextColorUI();
        updateGradientUI();
        updateSpeedLabel();
        updateUI();
        showNotice('プリセットを適用しました');
    });
    applyPresetBtn.style.display = 'none';
});

savePresetBtn.addEventListener('click', () => {
    saveCurrentPreset(() => {
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showNotice('現在の設定をプリセットに保存しました', { type: 'green' });
    });
});

deletePresetBtn.addEventListener('click', () => {
    deletePreset(() => {
        updatePreviewTextStyle();
        updateTextColorUI();
        updateGradientUI();
        updateSpeedLabel();
        updateUI();
        showNotice('プリセットを削除しました', { type: 'red' });
    });
});

// ─────────────────────────────────────────
// ヘッダーテロップアニメーション
// ─────────────────────────────────────────
function initHeaderTelop() {
    const headerTelop = document.querySelector('.header-telop span');
    const containerWidth = headerTelop.parentElement.offsetWidth;
    let x         = containerWidth;
    let loopCount = 0;
    const speed   = 1;
    const maxLoop = 2;

    function animateTelop() {
        headerTelop.style.transform = `translateX(${x}px)`;
        x -= speed;

        if (x < -headerTelop.offsetWidth) {
            loopCount++;
            if (loopCount < maxLoop) {
                x = containerWidth;
            } else {
                const hour = new Date().getHours();
                if      (hour >= 4  && hour < 11) headerTelop.textContent = 'おはようございます。良い一日を。';
                else if (hour >= 11 && hour < 16) headerTelop.textContent = 'こんにちは。一日を楽しみましょう。';
                else if (hour >= 16 && hour < 20) headerTelop.textContent = '夜に向けて、いい流れ作っていきましょう。';
                else if (hour >= 20 && hour < 24) headerTelop.textContent = 'こんばんは。今日もお疲れ様です。';
                else                              headerTelop.textContent = 'たまには夜更かしもいいよね。';
                headerTelop.style.transform = 'translateX(0)';
                return;
            }
        }
        requestAnimationFrame(animateTelop);
    }
    animateTelop();
}

// ─────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {

    restoreCurrentTelopState(() => {
        updatePreviewTextStyle();
        updateGradientUI();
        updateTextColorUI();
        updateUI();
    });

    const checked = document.querySelector('input[name="gradientType"]:checked');
    state.gradientType = checked ? checked.value : 'none';

    initPremium();
    initTelop();

    updateUI();
    updatePreviewTextStyle();
    updateGradientUI();
    updateTextColorUI();

    // 背景色と文字色の反転
    document.getElementById('swapColorBtn').addEventListener('click', () => {
        const tmp       = bgColor.value;
        bgColor.value   = textColor.value;
        textColor.value = tmp;
        updatePreviewTextStyle();
        markDirty();
        requestAutoSave();
    });

    // フォント選択
    fontSelect.addEventListener('change', () => {
        state.fontFamily = fontSelect.value;
        preview.style.fontFamily = fontSelect.value;
        markDirty();
        requestAutoSave();
    });

    // グラデーション色反転
    document.getElementById('swapGradientBtn').addEventListener('click', () => {
        [state.gradientColor1, state.gradientColor2] = [state.gradientColor2, state.gradientColor1];
        gradientColorStart.value = state.gradientColor1;
        gradientColorEnd.value   = state.gradientColor2;
        updatePreviewTextStyle();
        markDirty();
        requestAutoSave();
    });

    updateSpeedLabel();

    initHeaderTelop();
});
