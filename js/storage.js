import {
  state,
  telopInput,
  preview, previewWrapper,
  defaultBgColor, defaultTextColor,
  bgColor, textColor,
  speedSlider, defaultSpeedLevel,
  gradientColorStart, gradientColorEnd,
  fontSelect,
  textEffectSelect, bgEffectSelect,
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
    text:           state.telopText,
    bgColor:        bgColor.value,
    textColor:      textColor.value,
    speedLevel:     state.speedLevel,
    gradientType:   state.gradientType,
    gradientColor1: state.gradientColor1,
    gradientColor2: state.gradientColor2,
    fontFamily:     state.fontFamily,
    textEffect:     state.textEffect,
    bgEffect:       state.bgEffect,
    updatedAt:      Date.now(),
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
  bgColor.value             = data.bgColor || defaultBgColor;
  textColor.value           = data.textColor || defaultTextColor;
  state.speedLevel          = data.speedLevel ?? defaultSpeedLevel; // 既存のlocalStorageデータ（speedLevelが存在しないもの）を読み込んだ場合でもデフォルト値にフォールバックさせる
  speedSlider.value         = state.speedLevel;
  gradientColorStart.value  = data.gradientColor1 || '#ff00ff';
  gradientColorEnd.value    = data.gradientColor2 || '#00ffff';
  state.fontFamily          = data.fontFamily || '-apple-system';
  document.getElementById('fontSelect').value = state.fontFamily;
  state.textEffect          = data.textEffect || 'none';
  state.bgEffect            = data.bgEffect   || 'none';
  textEffectSelect.value    = state.textEffect;
  bgEffectSelect.value      = state.bgEffect;

  // ラジオボタン同期
  document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
    radio.checked = radio.value === (data.gradientType || 'none');
  });

  // プレビュー反映
  preview.textContent                  = data.text;
  preview.style.fontFamily             = state.fontFamily;
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
// 汎用通知関数
// ─────────────────────────────────────────
export function showNotice(message, options = {}) {
  const notice = document.getElementById('showNotice');
  if (!notice) return;

  const {
    duration = 2500,
    fadeOutDuration = 1300,
    type = null
  } = options;

  notice.textContent = message;
  notice.classList.remove('hidden', 'fade-out');

  // type があれば class に追加
  if (type) {
    notice.classList.add(type);
  }

  setTimeout(() => notice.classList.add('fade-out'), duration);
  setTimeout(() => {
    notice.classList.add('hidden');
    // 次の通知に影響しないように type を削除
    if (type) {
      notice.classList.remove(type);
    }
  }, duration + fadeOutDuration);
}

function formatTimeAgo(timestamp) {
  const diffMin = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMin < 1)  return '現在';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  return '前回';
}

// 復元通知（showNotice() のラッパー）
function showRestoreNotice(updatedAt) {
  const message = `${formatTimeAgo(updatedAt)}の内容を自動復元しました`;
  showNotice(message);
}

// ─────────────────────────────────────────
// プリセット（最大3スロット。プレミアム会員のみ2・3を使用可）
// UI更新はmain.jsのコールバックで行う
// ─────────────────────────────────────────
export const PRESET_SLOT_COUNT = 3;
const FREE_SLOT_COUNT = 1;
let appliedPresetIndex = null; // 適用中のスロット番号（未適用ならnull）

export function isPremiumUser() {
  return localStorage.getItem('premium') === 'true';
}

// プレミアム会員でない場合はプリセット1のみ利用可
export function isSlotAvailable(index) {
  return index < FREE_SLOT_COUNT || isPremiumUser();
}

export function defaultPresetName(index) {
  return `プリセット${index + 1}`;
}

// 常に3要素の配列を返す（空きスロットはnull）
// 旧形式（要素1つ・name無し）のデータもそのまま読み込める
export function loadPresets() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY_PRESETS));
  } catch {
    saved = null;
  }
  const list = Array.isArray(saved) ? saved : [];

  return Array.from({ length: PRESET_SLOT_COUNT }, (_, i) => {
    const p = list[i];
    if (!p || typeof p.text !== 'string') return null;
    return { ...p, name: p.name || defaultPresetName(i) };
  });
}

function writePresets(presets) {
  if (presets.some(Boolean)) {
    localStorage.setItem(KEY_PRESETS, JSON.stringify(presets));
  } else {
    localStorage.removeItem(KEY_PRESETS);
  }
}

export function hasPreset() {
  return loadPresets().some(Boolean);
}

// 確認モーダルは呼び出し側（preset.js）で表示する
export function savePresetToSlot(index, name) {
  if (!isSlotAvailable(index)) return;

  const presets = loadPresets();
  presets[index] = {
    name,
    text:           telopInput.value.trim(),
    bgColor:        bgColor.value,
    textColor:      textColor.value,
    speedLevel:     state.speedLevel,
    gradientType:   state.gradientType,
    gradientColor1: state.gradientColor1,
    gradientColor2: state.gradientColor2,
    fontFamily:     state.fontFamily,
    textEffect:     state.textEffect,
    bgEffect:       state.bgEffect,
  };

  writePresets(presets);
  state.isDirty = false;
}

export function applySavedPreset(index, onComplete) {
  const preset = loadPresets()[index];
  if (!preset || !isSlotAvailable(index)) return;

  // DOM値を復元
  telopInput.value          = preset.text;
  bgColor.value             = preset.bgColor;
  textColor.value           = preset.textColor;
  state.speedLevel          = preset.speedLevel ?? defaultSpeedLevel;
  speedSlider.value         = state.speedLevel;
  gradientColorStart.value  = preset.gradientColor1 || '#ff00ff';
  gradientColorEnd.value    = preset.gradientColor2 || '#00ffff';
  state.fontFamily          = preset.fontFamily || '-apple-system';
  document.getElementById('fontSelect').value = state.fontFamily;
  state.textEffect          = preset.textEffect || 'none';
  state.bgEffect            = preset.bgEffect   || 'none';
  textEffectSelect.value    = state.textEffect;
  bgEffectSelect.value      = state.bgEffect;

  // ラジオボタン同期
  document.querySelectorAll('input[name="gradientType"]').forEach(radio => {
    radio.checked = radio.value === (preset.gradientType || 'none');
  });

  // プレビュー反映
  preview.textContent                  = preset.text;
  preview.style.fontFamily             = preset.fontFamily;
  previewWrapper.style.backgroundColor = preset.bgColor;

  // state更新
  state.telopText       = preset.text;
  state.gradientType    = preset.gradientType   || 'none';
  state.gradientColor1  = preset.gradientColor1 || '#ff00ff';
  state.gradientColor2  = preset.gradientColor2 || '#00ffff';
  state.isDirty         = false;
  state.isPresetApplied = true;
  appliedPresetIndex    = index;

  if (onComplete) onComplete();
}

// 適用中のプリセットのみ削除する
export function deletePreset(onComplete) {
  const index  = appliedPresetIndex;
  const preset = index === null ? null : loadPresets()[index];
  if (!preset) return;

  const confirmed = confirm(`プリセット「${preset.name}」を削除しますか？`);
  if (!confirmed) return;

  const presets = loadPresets();
  presets[index] = null;
  writePresets(presets);
  appliedPresetIndex = null;

  // stateをデフォルトに戻す
  state.isPresetApplied = false;
  state.isDirty         = false;
  state.gradientType    = 'none';
  state.gradientColor1  = '#ff00ff';
  state.gradientColor2  = '#00ffff';
  state.fontFamily      = '-apple-system';
  state.textEffect      = 'none';
  state.bgEffect        = 'none';

  // DOM値をデフォルトに戻す
  bgColor.value            = defaultBgColor;
  textColor.value          = defaultTextColor;
  state.speedLevel         = defaultSpeedLevel;
  speedSlider.value        = defaultSpeedLevel;
  gradientColorStart.value = state.gradientColor1;
  gradientColorEnd.value   = state.gradientColor2;
  fontSelect.value         = state.fontFamily;
  textEffectSelect.value   = state.textEffect;
  bgEffectSelect.value     = state.bgEffect;

  // プレビューをデフォルトに戻す
  preview.style.fontFamily = state.fontFamily;

  document.querySelector('input[name="gradientType"][value="none"]').checked = true;

  previewWrapper.style.backgroundColor = defaultBgColor;
  preview.style.color  = defaultTextColor;
  preview.textContent  = 'テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）';
  telopInput.value     = '';

  alert('プリセットを削除しました。');

  if (onComplete) onComplete();
}
