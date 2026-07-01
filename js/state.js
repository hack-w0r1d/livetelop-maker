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
export const speedSlider = document.getElementById('speedSlider');
export const speedLabel  = document.getElementById('speedLabel');
export const gradientColorStart = document.getElementById('gradientColorStart');
export const gradientColorEnd   = document.getElementById('gradientColorEnd');
export const fontSelect = document.getElementById('fontSelect');
export const createTelopBtn = document.getElementById('createTelopBtn');
export const pipBtn         = document.getElementById('pipBtn');
export const applyPresetBtn = document.getElementById('applyPresetBtn');
export const savePresetBtn  = document.getElementById('savePresetBtn');
export const deletePresetBtn= document.getElementById('deletePresetBtn');

// ─────────────────────────────────────────
// 定数
// ─────────────────────────────────────────
export const defaultBgColor   = '#000000';
export const defaultTextColor = '#ffffff';
export const isAndroid = /Android/i.test(navigator.userAgent);

// ─────────────────────────────────────────
// テロップ速度
// ─────────────────────────────────────────
// スライダー値 0/25/50/75/100 の位置に対応する実速度（px/frame）
export const SPEED_LEVELS = [1, 1.5, 2, 3, 4.5];
export const SPEED_LABELS = ['とてもゆっくり', 'ゆっくり', '普通', '速い', 'とても速い'];
export const defaultSpeedLevel = 50; // 中央値。SPEED_LEVELS[2] = 2

// スライダー値（0〜100）→ 実速度（px/frame）の区間線形補間
export function speedFromSlider(sliderValue) {
    const segments = SPEED_LEVELS.length - 1; // 4区間
    const segSize  = 100 / segments;           // 1区間 = 25
    const segIndex = Math.min(Math.floor(sliderValue / segSize), segments - 1);
    const t = (sliderValue - segIndex * segSize) / segSize;
    return SPEED_LEVELS[segIndex] + t * (SPEED_LEVELS[segIndex + 1] - SPEED_LEVELS[segIndex]);
}

// ─────────────────────────────────────────
// ミュータブルな状態
// importした側から state.xxx = yyy で書き換える
// ─────────────────────────────────────────
export const state = {
    telopText:       'テロップ作成ボタンを押すとこちらの文章がテロップとして作成されます。（サンプル）',
    speedLevel:      defaultSpeedLevel,
    gradientType:    'none',   // 'none' | 'horizontal' | 'vertical'
    gradientColor1:  '#ff00ff',
    gradientColor2:  '#00ffff',
    fontFamily:      '-apple-system',
    isPresetApplied: false,
    isDirty:         false,
    autoSaveTimer:   null,
};
