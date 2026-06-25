// ─────────────────────────────────────────
// DOM参照
// ─────────────────────────────────────────
export const canvas         = document.getElementById('canvas');
export const ctx            = canvas.getContext('2d', { alpha: false });
export const video          = document.getElementById('pipVideo');
export const preview        = document.getElementById('telopPreview');
export const previewWrapper = document.getElementById('previewWrapper');
export const telopInput     = document.getElementById('telopInput');
export const clearTelopBtn  = document.getElementById('clearTelopBtn');
export const bgColor        = document.getElementById('bgColorPicker');
export const textColor      = document.getElementById('textColorPicker');
export const gradientColorStart = document.getElementById('gradientColorStart');
export const gradientColorEnd   = document.getElementById('gradientColorEnd');
export const createTelopBtn = document.getElementById('createTelopBtn');
export const pipBtn         = document.getElementById('pipBtn');
export const applyPresetBtn = document.getElementById('applyPresetBtn');
export const savePresetBtn  = document.getElementById('savePresetBtn');
export const deletePresetBtn= document.getElementById('deletePresetBtn');
export const fontSelect = document.getElementById('fontSelect');

// ─────────────────────────────────────────
// 定数
// ─────────────────────────────────────────
export const defaultBgColor   = '#000000';
export const defaultTextColor = '#ffffff';
export const isAndroid = /Android/i.test(navigator.userAgent);

// ─────────────────────────────────────────
// ミュータブルな状態
// importした側から state.xxx = yyy で書き換える
// ─────────────────────────────────────────
export const state = {
    telopText:       'テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）',
    gradientType:    'none',   // 'none' | 'horizontal' | 'vertical'
    gradientColor1:  '#ff00ff',
    gradientColor2:  '#00ffff',
    isPresetApplied: false,
    isDirty:         false,
    autoSaveTimer:   null,
    fontFamily: '-apple-system',
};
