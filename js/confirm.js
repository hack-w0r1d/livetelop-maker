// confirm.jsのみで使用するDOM参照はここでローカルに宣言
const modal     = document.getElementById('confirmModal');
const titleEl   = document.getElementById('confirmModalTitle');
const messageEl = document.getElementById('confirmModalMessage');
const okBtn     = document.getElementById('confirmModalOk');
const cancelBtn = document.getElementById('confirmModalCancel');

let resolver = null;

// window.confirm の代わりに使う確認モーダル
// OKなら true、キャンセルなら false で解決するPromiseを返す
export function showConfirm({ title, message, okLabel = 'OK', cancelLabel = 'キャンセル' }) {
  // 表示中に再度呼ばれた場合は、前の確認をキャンセル扱いにする
  if (resolver) close(false);

  titleEl.textContent   = title;
  messageEl.textContent = message;
  okBtn.textContent     = okLabel;
  cancelBtn.textContent = cancelLabel;
  modal.classList.remove('hidden');

  return new Promise((resolve) => {
    resolver = resolve;
  });
}

function close(result) {
  modal.classList.add('hidden');
  if (resolver) {
    const resolve = resolver;
    resolver = null;
    resolve(result);
  }
}

okBtn.addEventListener('click', () => close(true));
cancelBtn.addEventListener('click', () => close(false));
