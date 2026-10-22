"use strict";

// MG F simulator Ver.1.0 — independent calculation, ready for future dashboard integration.
const state = {
  period: 3, rule: "senior", inflation: 1.1,
  worker: 1, sales: 1, peak: 2,
  machines: [1, 1, 0], // small, attachment, large
  carry: [1, 0, 0], chips: [0, 1, 0], // education, advertising, research
  openingLong: 100, openingShort: 0, loans: [], expenses: [], nextId: 1
};
const MACHINE_NAMES = ["小型機械", "アタッチメント", "大型機械"];
const CHIP_NAMES = ["教育", "広告", "研究開発"];
const BASE = {2: 22, 3: 24, 4: 26, 5: 28};
const $ = id => document.getElementById(id);
const yen = amount => `${amount.toLocaleString("ja-JP")}円`;
// Round nonnegative money amounts using the game's ordinary half-up rule.
const round = amount => Math.floor(amount + 0.5 + 1e-9);
const cleanNumber = value => Math.max(0, Number(value) || 0);
const cleanInteger = value => Math.floor(cleanNumber(value));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function calculateFixedCost(data) {
  const junior = data.period === 2 || data.rule === "junior";
  const multiplier = junior ? 1 : data.inflation;
  const unit = round(BASE[data.period] * multiplier);
  const peakUnit = round(BASE[data.period] / 2 * multiplier);
  const wages = [round(data.worker * unit), (data.machines[0] + data.machines[2]) * unit, round(data.sales * unit), round(data.peak * peakUnit)];
  const salary = wages.reduce((a, b) => a + b, 0);
  const chipPrice = junior ? 20 : 40;
  const chipAmounts = CHIP_NAMES.map((_, i) => data.carry[i] * 20 + data.chips[i] * chipPrice);
  const chipTotal = chipAmounts.reduce((a, b) => a + b, 0);
  const depreciation = data.machines.map((count, i) => count * [100, 30, 200][i] * (junior ? .1 : .2));
  const depreciationTotal = depreciation.reduce((a, b) => a + b, 0);
  const interestFor = (amount, type) => round(cleanNumber(amount) * (type === "long" ? .1 : .2));
  const openingLongFee = interestFor(data.openingLong, "long");
  const openingShortFee = interestFor(data.openingShort, "short");
  const addedFees = data.loans.map(l => interestFor(l.amount, l.type));
  const addedInterest = addedFees.reduce((a, b) => a + b, 0);
  const interestTotal = openingLongFee + openingShortFee + addedInterest;
  const expensesBy = category => data.expenses.filter(e => e.category === category).reduce((sum, e) => sum + cleanNumber(e.amount), 0);
  const manufacturingExtra = 20 + expensesBy("manufacturing");
  const headquartersExtra = 5 + expensesBy("head");
  const expenseTotal = manufacturingExtra + headquartersExtra;
  const accounts = [
    ["労務費", wages[0]], ["製造経費", wages[1] + manufacturingExtra],
    ["減価償却費", depreciationTotal], ["本社人件費", wages[2]],
    ["本社経費", wages[3] + headquartersExtra], ["営業外費用", interestTotal],
    ["広告", chipAmounts[1]], ["研究", chipAmounts[2]], ["教育", chipAmounts[0]]
  ];
  return {junior, unit, peakUnit, wages, salary, chipPrice, chipAmounts, chipTotal,
    depreciation, depreciationTotal, openingLongFee, openingShortFee, addedFees,
    openingInterest: openingLongFee + openingShortFee, addedInterest, interestTotal,
    manufacturingExtra, headquartersExtra, expenseTotal, accounts,
    totalF: accounts.reduce((sum, item) => sum + item[1], 0)};
}

function stepper(label, key, value, step, index) {
  const keyAttr = index === undefined ? `data-key="${key}"` : `data-key="${key}" data-index="${index}"`;
  return `<div class="counter-line ${index !== undefined ? 'machine' : ''}">
    <span class="name">${esc(label)}</span>
    <div class="counter-controls"><button type="button" aria-label="${esc(label)}を減らす" data-step="-${step}" ${keyAttr} ${value <= 0 ? 'disabled' : ''}>−</button>
    <output>${value}</output><button type="button" aria-label="${esc(label)}を増やす" data-step="${step}" ${keyAttr}>＋</button></div></div>`;
}
function chipGroup(title, note, key, price, values) {
  return `<div class="chip-group"><div class="chip-head"><strong>${title}</strong><small>${price}円/枚</small></div><p class="hint">${note}</p>
    <div class="table-scroll"><table><thead><tr><th>種類</th><th class="num">枚数</th><th class="num">費用</th></tr></thead><tbody>
    ${CHIP_NAMES.map((name, i) => `<tr><td>${name}</td><td class="num"><div class="counter-controls" style="justify-content:flex-end"><button type="button" data-key="${key}" data-index="${i}" data-step="-1" ${values[i] <= 0 ? 'disabled' : ''}>−</button><output>${values[i]}</output><button type="button" data-key="${key}" data-index="${i}" data-step="1">＋</button></div></td><td class="num">${yen(values[i] * price)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}
function render() {
  const c = calculateFixedCost(state);
  $('period').value = String(state.period);
  document.querySelectorAll('[data-rule]').forEach(button => {
    button.classList.toggle('active', (c.junior ? 'junior' : 'senior') === button.dataset.rule);
    button.disabled = state.period === 2;
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  });
  document.querySelectorAll('[data-inflation]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.inflation) === (c.junior ? 1 : state.inflation));
    button.disabled = c.junior;
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  });
  $('base-unit').textContent = yen(c.unit); $('peak-unit').textContent = yen(c.peakUnit);
  $('staff-counters').innerHTML = [stepper('ワーカー', 'worker', state.worker, .5),
    ...MACHINE_NAMES.map((name, i) => stepper(name, 'machines', state.machines[i], 1, i)),
    stepper('セールスマン', 'sales', state.sales, .5), stepper('期中最大人員', 'peak', state.peak, 1)].join('');
  const salaryRows = [['ワーカー', state.worker, c.wages[0]], ['設備', state.machines[0] + state.machines[2], c.wages[1]], ['セールスマン', state.sales, c.wages[2]], ['期中最大人員', state.peak, c.wages[3]]];
  $('salary-rows').innerHTML = salaryRows.map(([label, quantity, amount]) => `<tr><td>${label}</td><td class="num">${quantity}</td><td class="num">${yen(amount)}</td></tr>`).join('');
  $('salary-summary').textContent = $('salary-total').textContent = yen(c.salary);
  $('chip-groups').innerHTML = chipGroup('前繰りチップ', '前期以前に購入し、当期使用', 'carry', 20, state.carry) + chipGroup('当期購入チップ', c.junior ? '通常購入・当期使用' : '特急購入・当期使用', 'chips', c.chipPrice, state.chips);
  $('chip-summary').textContent = $('chip-total').textContent = yen(c.chipTotal);
  $('opening-long-fee').textContent = yen(c.openingLongFee);
  $('opening-short-fee').textContent = yen(c.openingShortFee);
  $('opening-fee').textContent = yen(c.openingInterest);
  $('added-fee').textContent = yen(c.addedInterest);
  $('interest-summary').textContent = $('interest-total').textContent = yen(c.interestTotal);
  $('loan-list').innerHTML = state.loans.map((loan, index) => `<div class="entry-row" data-loan-id="${loan.id}"><select aria-label="借入区分" data-loan-field="type"><option value="long" ${loan.type === 'long' ? 'selected' : ''}>長期</option><option value="short" ${loan.type === 'short' ? 'selected' : ''}>短期</option></select><input type="number" min="0" step="1" inputmode="numeric" aria-label="借入額" data-loan-field="amount" value="${esc(loan.amount)}"><span class="computed">${yen(c.addedFees[index])}</span><button class="delete-btn" type="button" data-delete-loan="${loan.id}" aria-label="借入行を削除">×</button></div>`).join('');
  $('depreciation-rows').innerHTML = MACHINE_NAMES.map((name, i) => `<tr><td>${name}</td><td class="num">${state.machines[i]}</td><td class="num">${yen(c.depreciation[i])}</td></tr>`).join('');
  $('depreciation-summary').textContent = $('depreciation-total').textContent = yen(c.depreciationTotal);
  $('depreciation-note').textContent = `人員・設備設定の台数から自動計算。償却率：${c.junior ? '10%' : '20%'}。`;
  $('expense-list').innerHTML = state.expenses.map(e => `<div class="entry-row" data-expense-id="${e.id}"><input type="text" data-expense-field="name" aria-label="経費名" placeholder="経費名" value="${esc(e.name)}"><input type="number" min="0" step="1" inputmode="numeric" data-expense-field="amount" aria-label="金額" value="${esc(e.amount)}"><button type="button" class="delete-btn" data-delete-expense="${e.id}" aria-label="経費行を削除">×</button><select data-expense-field="category" aria-label="経費の費目"><option value="manufacturing" ${e.category === 'manufacturing' ? 'selected' : ''}>製造経費</option><option value="head" ${e.category === 'head' ? 'selected' : ''}>本社経費</option></select></div>`).join('');
  $('expense-summary').textContent = $('expense-total').textContent = yen(c.expenseTotal);
  $('account-rows').innerHTML = c.accounts.map(([name, amount]) => `<tr><td>${name}</td><td class="num">${yen(amount)}</td></tr>`).join('');
  $('grand-total').textContent = yen(c.totalF);
}

$('period').addEventListener('change', event => {
  const previous = state.period; state.period = Number(event.target.value);
  if (state.period === 2) state.rule = 'junior';
  else if (previous === 2) state.rule = 'senior';
  render();
});
document.querySelectorAll('[data-rule]').forEach(button => button.addEventListener('click', () => {state.rule = button.dataset.rule; render();}));
document.querySelectorAll('[data-inflation]').forEach(button => button.addEventListener('click', () => {state.inflation = Number(button.dataset.inflation); render();}));
document.addEventListener('click', event => {
  const stepButton = event.target.closest('button[data-step]');
  if (stepButton) {
    const {key, index, step} = stepButton.dataset;
    if (index === undefined) state[key] = Math.max(0, Math.round((state[key] + Number(step)) * 2) / 2);
    else state[key][Number(index)] = Math.max(0, state[key][Number(index)] + Number(step));
    render(); return;
  }
  const delLoan = event.target.closest('[data-delete-loan]');
  if (delLoan) {state.loans = state.loans.filter(l => l.id !== Number(delLoan.dataset.deleteLoan)); render(); return;}
  const delExpense = event.target.closest('[data-delete-expense]');
  if (delExpense) {state.expenses = state.expenses.filter(e => e.id !== Number(delExpense.dataset.deleteExpense)); render();}
});
function onEdit(event) {
  const target = event.target;
  if (target.id === 'opening-long') state.openingLong = cleanNumber(target.value);
  else if (target.id === 'opening-short') state.openingShort = cleanNumber(target.value);
  else {
    const loanRow = target.closest('[data-loan-id]');
    const expenseRow = target.closest('[data-expense-id]');
    if (loanRow && target.dataset.loanField) {
      const loan = state.loans.find(l => l.id === Number(loanRow.dataset.loanId));
      if (loan) loan[target.dataset.loanField] = target.dataset.loanField === 'amount' ? cleanNumber(target.value) : target.value;
    } else if (expenseRow && target.dataset.expenseField) {
      const expense = state.expenses.find(e => e.id === Number(expenseRow.dataset.expenseId));
      if (expense) expense[target.dataset.expenseField] = target.dataset.expenseField === 'amount' ? cleanNumber(target.value) : target.value;
    } else return;
  }
  // Preserve focus and typing position: only update computed fields during edits.
  const c = calculateFixedCost(state);
  $('opening-long-fee').textContent = yen(c.openingLongFee);
  $('opening-short-fee').textContent = yen(c.openingShortFee);
  $('opening-fee').textContent = yen(c.openingInterest);
  $('added-fee').textContent = yen(c.addedInterest);
  $('interest-summary').textContent = $('interest-total').textContent = yen(c.interestTotal);
  state.loans.forEach((loan, i) => {
    const targetRow = $('loan-list').querySelector(`[data-loan-id="${loan.id}"] .computed`);
    if (targetRow) targetRow.textContent = yen(c.addedFees[i]);
  });
  $('expense-summary').textContent = $('expense-total').textContent = yen(c.expenseTotal);
  $('account-rows').innerHTML = c.accounts.map(([name, amount]) => `<tr><td>${name}</td><td class="num">${yen(amount)}</td></tr>`).join('');
  $('grand-total').textContent = yen(c.totalF);
}
document.addEventListener('input', onEdit);
document.addEventListener('change', event => {
  if (event.target.matches('[data-loan-field="type"],[data-expense-field="category"]')) onEdit(event);
});
$('add-loan').addEventListener('click', () => {state.loans.push({id:state.nextId++,type:'long',amount:0});render();});
$('add-expense').addEventListener('click', () => {state.expenses.push({id:state.nextId++,name:'',category:'manufacturing',amount:0});render();});
$('copy-f').addEventListener('click', async () => {
  const value = String(calculateFixedCost(state).totalF);
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else {
      const temp = document.createElement('textarea'); temp.value = value;
      document.body.appendChild(temp); temp.select();
      const success = document.execCommand('copy'); temp.remove();
      if (!success) throw new Error('copy unavailable');
    }
    $('copy-message').textContent = `固定費F（${value}）をコピーしました。`;
  } catch {
    $('copy-message').textContent = `コピーできませんでした。F合計：${value}円`;
  }
});
render();
