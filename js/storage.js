import {
    state,
    telopInput, bgColor, textColor,
    gradientColorStart, gradientColorEnd,
    preview, previewWrapper,
    defaultBgColor, defaultTextColor,
} from './state.js';

// ─────────────────────────────────────────
// LocalStorageキー
// ─────────────────────────────────────────
const KEY_CURRENT = 'livetelop:current';
const KEY_PRESETS = 'livetelop_presets';
const ONE_DAY = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────
// 自動保存
// ─────────────────────────────────────────
export function saveCurrentTelopState() {
    const data = {
        text:          state.telopText,
        bgColor:       bgColor.value,
        textColor:     textColor.value,
        gradientType:  state.gradientType,
        gradientColor1: state.gradientColor1,
        gradientColor2: state.gradientColor2,
        updatedAt:     Date.now(),
    };
    localStorage.setItem(KEY_CURRENT, JSON.stringify(data));
}

export function requestAutoSave() {
    if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
        saveCurrentTelopState();
        state.autoSaveTimer = null;
    }, 300);
}

// ─────────────────────────────────────────
// 復元（24時間以内のみ）
// UI更新はmain.jsのonRestoredコールバックで行う
// ─────────────────────────────────────────
export function restoreCurrentTelopState(onRestored) {
    const saved = localStorage.getItem(KEY_CURRENT);
    if (!saved) return;

    let data;
    try {
        data = JSON.parse(saved);
        if (!data || typeof data.text !== 'string') return;
    } catch {
        localStorage.removeItem(KEY_CURRENT);
        return;
    }

    if (!data.updatedAt || Date.now() - data.updatedAt > ONE_DAY) {
        localStorage.removeItem(KEY_CURRENT);
        return;
    }

    // DOM値を復元
    telopInput.value          = data.text;
    bgColor.value             = data.bgColor       || defaultBgColor;
    textColor.value           = data.textColor     || defaultTextColor;
    gradientColorStart.value  = data.gradientColor1 || '#ff00ff';
    gradientColorEnd.value    = data.gradientColor2 || '#00ffff';

    // ラジオボタン同期
    document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
        radio.checked = radio.value === (data.gradientType || 'none');
    });

    // プレビュー反映
    preview.textContent               = data.text;
    previewWrapper.style.backgroundColor = bgColor.value;

    // state更新
    state.telopText      = data.text;
    state.gradientType   = data.gradientType   || 'none';
    state.gradientColor1 = data.gradientColor1 || '#ff00ff';
    state.gradientColor2 = data.gradientColor2 || '#00ffff';

    showRestoreNotice(data.updatedAt);

    if (onRestored) onRestored();
}

// ─────────────────────────────────────────
// 復元通知
// ─────────────────────────────────────────
function formatTimeAgo(timestamp) {
    const diffMin = Math.floor((Date.now() - timestamp) / 60000);
    if (diffMin < 1)  return '現在';
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    return '前回';
}

function showRestoreNotice(updatedAt) {
    const notice = document.getElementById('restoreNotice');
    if (!notice) return;

    notice.textContent = `${formatTimeAgo(updatedAt)}の内容を自動復元しました`;
    notice.classList.remove('hidden', 'fade-out');
    setTimeout(() => notice.classList.add('fade-out'), 2500);
    setTimeout(() => notice.classList.add('hidden'), 3800);
}

// ─────────────────────────────────────────
// プリセット
// UI更新はmain.jsのコールバックで行う
// ─────────────────────────────────────────
export function hasPreset() {
    try {
        const presets = JSON.parse(localStorage.getItem(KEY_PRESETS));
        return Array.isArray(presets) && presets.length > 0;
    } catch {
        return false;
    }
}

export function saveCurrentPreset() {
    const confirmed = confirm('現在の設定を保存しますか？');
    if (!confirmed) return;

    const text = telopInput.value.trim();
    if (!text) {
        alert('テロップの文字が空のため、プリセットを保存できません。');
        return;
    }

    const preset = {
        text,
        bgColor:        bgColor.value,
        textColor:      textColor.value,
        gradientType:   state.gradientType,
        gradientColor1: state.gradientColor1,
        gradientColor2: state.gradientColor2,
    };

    localStorage.setItem(KEY_PRESETS, JSON.stringify([preset]));
    state.isDirty = false;

    alert('現在の設定をプリセットに保存しました。');
}

export function applySavedPreset(onComplete) {
    const presets = JSON.parse(localStorage.getItem(KEY_PRESETS));
    if (!presets || presets.length === 0) return;

    const preset = presets[0];

    // DOM値を復元
    telopInput.value          = preset.text;
    bgColor.value             = preset.bgColor;
    textColor.value           = preset.textColor;
    gradientColorStart.value  = preset.gradientColor1 || '#ff00ff';
    gradientColorEnd.value    = preset.gradientColor2 || '#00ffff';

    // ラジオボタン同期
    document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
        radio.checked = radio.value === (preset.gradientType || 'none');
    });

    // プレビュー反映
    preview.textContent               = preset.text;
    previewWrapper.style.backgroundColor = preset.bgColor;

    // state更新
    state.telopText      = preset.text;
    state.gradientType   = preset.gradientType   || 'none';
    state.gradientColor1 = preset.gradientColor1 || '#ff00ff';
    state.gradientColor2 = preset.gradientColor2 || '#00ffff';
    state.isDirty        = false;
    state.isPresetApplied = true;

    if (onComplete) onComplete();
}

export function deletePreset(onComplete) {
    const confirmed = confirm('保存されているプリセットを削除しますか？');
    if (!confirmed) return;

    localStorage.removeItem(KEY_PRESETS);

    // stateをデフォルトに戻す
    state.isPresetApplied = false;
    state.isDirty         = false;
    state.gradientType    = 'none';
    state.gradientColor1  = '#ff00ff';
    state.gradientColor2  = '#00ffff';

    // DOM値をデフォルトに戻す
    bgColor.value            = defaultBgColor;
    textColor.value          = defaultTextColor;
    gradientColorStart.value = state.gradientColor1;
    gradientColorEnd.value   = state.gradientColor2;

    document.querySelector('input[name="gradientType"][value="none"]').checked = true;

    previewWrapper.style.backgroundColor = defaultBgColor;
    preview.style.color  = defaultTextColor;
    preview.textContent  = 'テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）';
    telopInput.value     = '';

    alert('プリセットを削除しました。');

    if (onComplete) onComplete();
}
