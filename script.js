
"use strict";

// ======================================
// MG Dashboard Ver.2.0
// ======================================

const STORAGE_KEY = "mg-dashboard-v2.0";

// 初期値
const initial = () => ({
  buys: [
    { id: 1, q: "2", p: "13" }
  ],
  sells: [
    { id: 2, q: "2", p: "30" }
  ],
  fixed: "150",
  goal: "50"
});

let state = initial();
let nextId = 3;

const $ = id => document.getElementById(id);

// ======================================
// 共通処理
// ======================================

const number = x =>
  x !== "" &&
  x !== null &&
  Number.isFinite(Number(x)) &&
  Number(x) >= 0
    ? Number(x)
    : null;

const signedNumber = x =>
  x !== "" &&
  x !== null &&
  Number.isFinite(Number(x))
    ? Number(x)
    : null;

const rowValid = r =>
  r != null &&
  number(r.q) !== null &&
  Number.isInteger(number(r.q)) &&
  number(r.p) !== null;

const sumQ = rows =>
  rows.reduce((n, r) => n + Number(r.q), 0);

const sumA = rows =>
  rows.reduce(
    (n, r) => n + Number(r.q) * Number(r.p),
    0
  );

const round1 = n =>
  Math.round((n + Number.EPSILON) * 10) / 10;

const round0 = n =>
  Math.round(n + Number.EPSILON);

const ceilSafe = n =>
  Math.ceil(n - 1e-9);

const fmt = n =>
  n === null
    ? "—"
    : n.toLocaleString("ja-JP", {
        maximumFractionDigits: 0
      });

const fmt1 = n =>
  n === null
    ? "—"
    : n.toLocaleString("ja-JP", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });

// ======================================
// MG中間決算 計算エンジン
// ======================================

function calculate(s) {
  const buyValid = s.buys.every(rowValid);
  const sellValid = s.sells.every(rowValid);

  const bq = buyValid ? sumQ(s.buys) : null;
  const sq = sellValid ? sumQ(s.sells) : null;

  const ba = buyValid ? sumA(s.buys) : null;
  const pq = sellValid ? sumA(s.sells) : null;

  // P：実売上合計 ÷ 販売Q
  const P = sq > 0
    ? round1(pq / sq)
    : null;

  // V：材料平均単価 ＋ 完投費用2円
  const V = bq > 0
    ? round1(ba / bq + 2)
    : null;

  // M：P − V
  const M = P !== null && V !== null
    ? round1(P - V)
    : null;

  // VQ：V × 販売Q（整数）
  const vq = V !== null && sq !== null
    ? round0(V * sq)
    : null;

  // PQは実際の販売金額合計
  const mq = pq !== null && vq !== null
    ? pq - vq
    : null;

  const F = number(s.fixed);
  const goal = signedNumber(s.goal);

  const G = mq !== null && F !== null
    ? mq - F
    : null;

  // 損益分岐点
  const q0 = M !== null && M > 0 && F !== null
    ? ceilSafe(F / M)
    : null;

  // 目標達成Q
  const qt =
    M !== null &&
    M > 0 &&
    F !== null &&
    goal !== null
      ? Math.max(0, ceilSafe((F + goal) / M))
      : null;

  const q0Left =
    q0 !== null && sq !== null
      ? Math.max(0, q0 - sq)
      : null;

  const qtLeft =
    qt !== null && sq !== null
      ? Math.max(0, qt - sq)
      : null;

  return {
    bq, sq, ba, pq,
    P, V, M,
    vq, mq, F, G,
    goal, q0, qt,
    q0Left, qtLeft
  };
}

// ======================================
// 自動保存・読込
// ======================================

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

    $("save-status").textContent =
      "この端末に自動保存済み";
  } catch (e) {
    $("save-status").textContent =
      "自動保存できません";
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const s = JSON.parse(raw);

    if (
      !s ||
      !Array.isArray(s.buys) ||
      !Array.isArray(s.sells) ||
      !s.buys.length ||
      !s.sells.length
    ) return;

    const good = rows =>
      rows.every(r =>
        r &&
        Number.isInteger(r.id) &&
        r.id > 0 &&
        typeof r.q === "string" &&
        typeof r.p === "string"
      );

    if (
      !good(s.buys) ||
      !good(s.sells) ||
      typeof s.fixed !== "string" ||
      typeof s.goal !== "string"
    ) return;

    state = s;

    nextId = Math.max(
      ...s.buys.map(r => r.id),
      ...s.sells.map(r => r.id)
    ) + 1;
  } catch (e) {
    // 読込に失敗した場合は初期値を使用
  }
}

// ======================================
// 入力コントロール作成
// ======================================

function createNumberControl(kind, row, field) {
  const wrapper = document.createElement("div");
  wrapper.className = "number-control";

  const input = document.createElement("input");

  input.type = "number";
  input.min = "0";
  input.step = field === "q" ? "1" : "any";
  input.inputMode =
    field === "q" ? "numeric" : "decimal";

  input.value = row[field];

  input.setAttribute(
    "aria-label",
    `${kind === "buys" ? "材料購入" : "販売"} ${
      field === "q" ? "数量" : "単価"
    }`
  );

  // 直接入力時
  input.addEventListener("input", () => {
    row[field] = input.value;

    const value = number(input.value);

    const invalid =
      value === null ||
      (field === "q" && !Number.isInteger(value));

    input.classList.toggle("invalid", invalid);

    refresh();
  });

  wrapper.append(input);

  // − / ＋ ボタン
  const buttons = document.createElement("div");
  buttons.className = "step-buttons";

  for (const step of [-1, 1]) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "step-button";
    button.textContent = step < 0 ? "−" : "＋";

    button.setAttribute(
      "aria-label",
      `${field === "q" ? "数量" : "単価"}を${
        step < 0 ? "減らす" : "増やす"
      }`
    );

    button.addEventListener("click", () => {
      const current = number(row[field]) ?? 0;

      // 数量は整数、単価は1円刻み
      const result = Math.max(0, current + step);

      row[field] = String(result);
      input.value = row[field];

      input.classList.remove("invalid");
      refresh();
    });

    buttons.append(button);
  }

  wrapper.append(buttons);

  return wrapper;
}

// ======================================
// 明細行の作成
// ======================================

function rowList(kind) {
  const target = $(
    kind === "buys" ? "buy-rows" : "sell-rows"
  );

  target.replaceChildren();

  state[kind].forEach(row => {
    const div = document.createElement("div");
    div.className = "entry-row";

    // 数量
    div.append(
      createNumberControl(kind, row, "q")
    );

    // 単価
    div.append(
      createNumberControl(kind, row, "p")
    );

    // 同行右側に金額表示
    const money = document.createElement("span");
    money.className = "amount";
    money.dataset.amount = String(row.id);

    money.textContent = rowValid(row)
      ? fmt(Number(row.q) * Number(row.p))
      : "—";

    div.append(money);

    // 削除ボタン
    const del = document.createElement("button");

    del.type = "button";
    del.className = "remove";
    del.textContent = "×";
    del.title = "行を削除";
    del.setAttribute("aria-label", "この行を削除");

    del.disabled = state[kind].length === 1;

    del.addEventListener("click", () => {
      state[kind] = state[kind].filter(
        x => x.id !== row.id
      );

      renderRows();
      refresh();
    });

    div.append(del);
    target.append(div);
  });
}

function renderRows() {
  rowList("buys");
  rowList("sells");
}

// ======================================
// ダッシュボード更新
// ======================================

function refresh() {
  const c = calculate(state);

  // 明細ごとの金額
  for (const kind of ["buys", "sells"]) {
    const list = $(
      kind === "buys" ? "buy-rows" : "sell-rows"
    );

    list.querySelectorAll(".amount").forEach(el => {
      const row = state[kind].find(
        r => String(r.id) === el.dataset.amount
      );

      el.textContent = rowValid(row)
        ? fmt(Number(row.q) * Number(row.p))
        : "—";
    });
  }

  // 整数の表示
  const data = {
    "buy-q": c.bq,
    "buy-a": c.ba,
    "sell-q": c.sq,
    "sell-a": c.pq,
    "q": c.sq,
    "pq": c.pq,
    "vq": c.vq,
    "mq": c.mq,
    "f": c.F,
    "g": c.G,
    "q0": c.q0,
    "qt": c.qt,
    "q0-left": c.q0Left,
    "qt-left": c.qtLeft
  };

  for (const [id, value] of Object.entries(data)) {
    $(id).textContent = fmt(value);
  }

  // PVMの表示
  for (const [id, value] of Object.entries({
    p: c.P,
    v: c.V,
    m: c.M
  })) {
    $(id).textContent = fmt1(value);
  }

  // 利益マイナス時の色
  $("m-tile").classList.toggle(
    "negative",
    c.M !== null && c.M < 0
  );

  $("g-tile").classList.toggle(
    "negative",
    c.G !== null && c.G < 0
  );

  save();
}

// ======================================
// 起動・イベント登録
// ======================================

load();

// 行追加
for (const [id, kind] of [
  ["add-buy", "buys"],
  ["add-sell", "sells"]
]) {
  $(id).addEventListener("click", () => {
    state[kind].push({
      id: nextId++,
      q: "",
      p: ""
    });

    renderRows();
    refresh();

    const inputs = $(
      kind === "buys" ? "buy-rows" : "sell-rows"
    ).querySelectorAll("input");

    inputs[inputs.length - 2]?.focus();
  });
}

// F・目標G
for (const [id, key] of [
  ["fixed", "fixed"],
  ["goal", "goal"]
]) {
  const el = $(id);
  el.value = state[key];

  el.addEventListener("input", () => {
    state[key] = el.value;

    const value = key === "fixed"
      ? number(el.value)
      : signedNumber(el.value);

    el.classList.toggle(
      "invalid",
      value === null
    );

    refresh();
  });
}

// 初期値に戻す
$("reset").addEventListener("click", () => {
  if (!confirm("入力内容を初期値に戻しますか？")) {
    return;
  }

  state = initial();
  nextId = 3;

  $("fixed").value = state.fixed;
  $("goal").value = state.goal;

  $("fixed").classList.remove("invalid");
  $("goal").classList.remove("invalid");

  renderRows();
  refresh();
});

// 初回表示
renderRows();
refresh();
