import { telopInput } from './state.js?v=2.11.2';
import { showConfirm } from './confirm.js?v=2.11.2';
import {
  loadPresets,
  defaultPresetName,
  savePresetToSlot,
  applySavedPreset,
} from './storage.js?v=2.11.2';

// preset.jsのみで使用するDOM参照はここでローカルに宣言
const listModal     = document.getElementById('presetModal');
const listTitle     = document.getElementById('presetModalTitle');
const slotList      = document.getElementById('presetSlotList');
const submitBtn     = document.getElementById('presetModalSubmit');
const cancelBtn     = document.getElementById('presetModalCancel');
const nameModal     = document.getElementById('presetNameModal');
const nameNote      = document.getElementById('presetNameNote');
const nameInput     = document.getElementById('presetNameInput');
const nameCancelBtn = document.getElementById('presetNameCancel');
const nameSubmitBtn = document.getElementById('presetNameSubmit');

let mode          = null; // 'save' | 'apply'
let selectedIndex = null; // 選択中のスロット番号
let onDone        = null; // 保存・適用の完了時に呼ぶコールバック（引数: プリセット名）

// ─────────────────────────────────────────
// モーダル表示
// ─────────────────────────────────────────
export function openPresetModal(newMode, onComplete) {
  if (newMode === 'save' && !telopInput.value.trim()) {
    alert('テロップの文字が空のため、プリセットを保存できません。');
    return;
  }

  mode          = newMode;
  onDone        = onComplete;
  selectedIndex = null;

  listTitle.textContent  = mode === 'save' ? '保存先のプリセットを選択' : '適用するプリセットを選択';
  submitBtn.textContent  = mode === 'save' ? '保存する' : '適用する';
  submitBtn.disabled     = true; // スロットを選ぶまで押せない

  renderSlots();
  nameModal.classList.add('hidden');
  listModal.classList.remove('hidden');
}

function closeAll() {
  listModal.classList.add('hidden');
  nameModal.classList.add('hidden');
  mode          = null;
  selectedIndex = null;
}

// ─────────────────────────────────────────
// スロット一覧（縦並び）
// プリセット名はユーザー入力のため textContent で挿入する
// ─────────────────────────────────────────
function renderSlots() {
  const presets = loadPresets();
  slotList.textContent = '';

  presets.forEach((preset, i) => {
    const empty  = !preset;

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'preset-slot' + (i === selectedIndex ? ' is-selected' : '');
    btn.disabled  = mode === 'apply' && empty;
    btn.setAttribute('aria-pressed', String(i === selectedIndex));

    const name = document.createElement('span');
    name.className   = 'preset-slot-name';
    name.textContent = preset ? preset.name : defaultPresetName(i);

    const meta = document.createElement('span');
    meta.className = 'preset-slot-meta';
    if (empty) {
      meta.textContent = mode === 'save' ? '空き' : '未保存';
    } else {
      meta.textContent = preset.text;
    }

    btn.append(name, meta);
    btn.addEventListener('click', () => {
      if (!btn.disabled) selectSlot(i);
    });
    slotList.appendChild(btn);
  });
}

function selectSlot(index) {
  selectedIndex      = index;
  submitBtn.disabled = false;
  renderSlots();
}

// ─────────────────────────────────────────
// 適用 / 保存ボタン（スロット一覧モーダル）
// ─────────────────────────────────────────
async function onSubmit() {
  if (selectedIndex === null) return;

  const index  = selectedIndex;
  const preset = loadPresets()[index];

  if (mode === 'apply') {
    await applySelected(index, preset);
  } else if (mode === 'save') {
    openNameModal(preset);
  }
}

// 適用: 確認モーダル → 適用
async function applySelected(index, preset) {
  if (!preset) return;

  listModal.classList.add('hidden'); // 確認モーダル表示中は一覧を隠す
  const ok = await showConfirm({
    title: 'プリセットを適用',
    message: `「${preset.name}」を適用しますか？\n現在の設定は上書きされます。`,
    okLabel: '適用する',
  });
  if (!ok) {
    listModal.classList.remove('hidden'); // 一覧モーダルに戻る（選択状態は維持）
    return;
  }

  const name = preset.name;
  closeAll();
  applySavedPreset(index, () => {
    if (onDone) onDone(name);
  });
}

// ─────────────────────────────────────────
// 保存: プリセット名入力モーダル → （上書き時は確認モーダル）→ 保存
// ─────────────────────────────────────────
function openNameModal(preset) {
  nameNote.textContent = preset ? `「${preset.name}」を上書きします` : '';
  nameInput.value      = preset ? preset.name : defaultPresetName(selectedIndex);

  listModal.classList.add('hidden');
  nameModal.classList.remove('hidden');

  nameInput.focus();
  nameInput.select();
}

async function submitSave() {
  if (mode !== 'save' || selectedIndex === null) return;

  const index    = selectedIndex;
  const existing = loadPresets()[index];
  const name     = nameInput.value.trim() || defaultPresetName(index);

  if (existing) {
    nameInput.blur(); // 確認モーダル表示中にEnterで再実行されないようにする
    nameModal.classList.add('hidden'); // 確認モーダル表示中は名前入力を隠す
    const ok = await showConfirm({
      title: '上書き保存',
      message: `「${existing.name}」を上書き保存しますか？\n保存済みの内容は元に戻せません。`,
      okLabel: '上書き保存',
    });
    if (!ok) {
      nameModal.classList.remove('hidden'); // 名前入力モーダルに戻る
      return;
    }
  }

  savePresetToSlot(index, name);
  closeAll();
  if (onDone) onDone(name);
}

// 名前入力をキャンセルして保存先の選択画面に戻る（選択状態は維持）
function backToSlotList() {
  nameModal.classList.add('hidden');
  listModal.classList.remove('hidden');
}

// ─────────────────────────────────────────
// イベントリスナー
// ─────────────────────────────────────────
submitBtn.addEventListener('click', onSubmit);
cancelBtn.addEventListener('click', closeAll);
nameSubmitBtn.addEventListener('click', submitSave);
nameCancelBtn.addEventListener('click', backToSlotList);

nameInput.addEventListener('keydown', (e) => {
  // 日本語入力の変換確定のEnterでは保存しない（SafariはisComposingがfalseでkeyCode 229になる）
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) submitSave();
});
