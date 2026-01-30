let currentMode = 'versus';
const MAX_UNITS = 8;
const SPD_RANGE = { MIN: 9000, MAX: 11000 };

function setMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    document.getElementById('modeVersus').classList.toggle('active', mode === 'versus');
    document.getElementById('modeSingle').classList.toggle('active', mode === 'single');
    const enemySection = document.getElementById('enemySection');
    if (mode === 'single') {
        enemySection.classList.add('hidden');
    } else {
        enemySection.classList.remove('hidden');
    }
    
    updateAll();
}

function addRow(team) {
    const list = document.getElementById(team + 'List');
    if (list.children.length >= MAX_UNITS) return;

    const div = document.createElement('div');
    div.className = 'unit-row';
    div.innerHTML = `
        <input type="text" class="input-name" placeholder="名前">
        <input type="number" class="input-spd" placeholder="0">
        <button class="del-btn" onclick="removeRow(this, '${team}')">×</button>
    `;
    list.appendChild(div);
    div.querySelectorAll('input').forEach(input => input.addEventListener('input', updateAll));
    
    reIndexNames(team);
    updateAll();
}

function removeRow(btn, team) {
    const list = document.getElementById(team + 'List');
    if (list.children.length > 1) {
        btn.parentElement.remove();
        reIndexNames(team);
        updateAll();
    }
}

function reIndexNames(team) {
    const list = document.getElementById(team + 'List');
    const label = (team === 'ally' ? '自陣' : '敵');
    Array.from(list.children).forEach((row, index) => {
        const nameInput = row.querySelector('.input-name');
        if (nameInput.value === "" || nameInput.value.startsWith('自陣') || nameInput.value.startsWith('敵')) {
            nameInput.value = label + (index + 1);
        }
    });
}

function calculateWinRate(spd1, spd2) {
    if (spd1 === null || spd2 === null) return null;
    const a = (spd1 + 1) * SPD_RANGE.MIN;
    const b = (spd1 + 1) * SPD_RANGE.MAX;
    const c = (spd2 + 1) * SPD_RANGE.MIN;
    const d = (spd2 + 1) * SPD_RANGE.MAX;

    if (a >= d) return 1.0;
    if (b <= c) return 0.0;

    let winArea = 0;
    const totalArea = (b - a) * (d - c);
    const steps = 50; 
    const dx = (b - a) / steps;
    for (let i = 0; i < steps; i++) {
        const x = a + dx * (i + 0.5);
        const yLimit = Math.min(x, d);
        if (yLimit > c) winArea += (yLimit - c) * dx;
    }
    return Math.min(Math.max(winArea / totalArea, 0), 1);
}

function updateAll() {
    const allies = getTeamData('allyList');
    const enemies = (currentMode === 'versus') ? getTeamData('enemyList') : [];

    ['ally', 'enemy'].forEach(t => {
        const list = document.getElementById(t + 'List');
        list.querySelectorAll('.del-btn').forEach(b => b.disabled = list.children.length <= 1);
        const addBtn = document.getElementById(t === 'ally' ? 'addAllyBtn' : 'addEnemyBtn');
        if(addBtn) addBtn.disabled = list.children.length >= MAX_UNITS;
    });

    document.getElementById('allyCount').textContent = `${allies.length} / 8`;
    const enemyCountEl = document.getElementById('enemyCount');
    if (enemyCountEl) enemyCountEl.textContent = `${enemies.length} / 8`;

    const resultLabelEl = document.getElementById('resultLabel');
    const mainValEl = document.getElementById('mainValue');
    const badgeEl = document.getElementById('statusBadge');
    const resultBox = document.getElementById('resultBox');

    if (currentMode === 'versus') {
        resultLabelEl.textContent = "自陣最速の先制確率";
        if (allies.length > 0 && enemies.length > 0) {
            const maxAlly = allies.reduce((a, b) => a.spd > b.spd ? a : b);
            const maxEnemy = enemies.reduce((a, b) => a.spd > b.spd ? a : b);
            const rate = calculateWinRate(maxAlly.spd, maxEnemy.spd);
            mainValEl.textContent = (rate * 100).toFixed(1) + "%";
            mainValEl.style.color = "var(--primary)";
            
            if (rate >= 1.0) {
                badgeEl.textContent = "確定先制"; badgeEl.className = "status-badge active";
                resultBox.style.background = "var(--success-soft)";
            } else if (rate <= 0) {
                badgeEl.textContent = "先制不可"; badgeEl.className = "status-badge danger";
                resultBox.style.background = "var(--enemy-soft)";
            } else {
                badgeEl.textContent = "乱数勝負"; badgeEl.className = "status-badge info";
                resultBox.style.background = "var(--primary-soft)";
            }
        } else {
            mainValEl.textContent = "--";
            mainValEl.style.color = "var(--text-light)";
            resultBox.style.background = "#f1f5f9";
            badgeEl.textContent = allies.length === 0 ? "自陣を入力してください" : "敵陣を入力してください";
            badgeEl.className = "status-badge warning";
        }
    } else {
        resultLabelEl.textContent = "チーム内最高速度";
        if (allies.length < 2) {
            mainValEl.textContent = allies.length === 1 ? allies[0].spd : "--";
            mainValEl.style.color = "var(--text)";
            badgeEl.textContent = "2体目入力待ち";
            badgeEl.className = "status-badge warning";
            resultBox.style.background = "var(--warning-soft)";
        } else {
            const maxAlly = allies.reduce((a, b) => a.spd > b.spd ? a : b).spd;
            mainValEl.textContent = maxAlly;
            mainValEl.style.color = "var(--primary)";
            badgeEl.textContent = "解析完了";
            badgeEl.className = "status-badge info";
            resultBox.style.background = "var(--primary-soft)";
        }
    }

    const allUnits = [...allies.map(u=>({...u, t:'ally'})), ...enemies.map(u=>({...u, t:'enemy'}))].sort((a,b)=>b.spd-a.spd);
    const orderListEl = document.getElementById('orderList');
    orderListEl.innerHTML = allUnits.map((u, i) => `
        <div class="rank-item ${u.t === 'ally' ? 'is-ally' : 'is-enemy'}">
            <div class="u-info"><span>${i+1}</span> ${u.name}</div>
            <div class="u-spd-text">素早さ：<span class="u-spd-val">${u.spd}</span></div>
        </div>
    `).join('') || '<p style="text-align:center;color:#94a3b8;font-size:0.8rem;padding:20px;">数値入力待ち</p>';
}

function getTeamData(id) {
    const list = document.getElementById(id);
    if (!list) return [];
    return Array.from(list.children).map(row => {
        const val = row.querySelector('.input-spd').value;
        return { name: row.querySelector('.input-name').value || "無名", spd: val === "" ? null : parseInt(val) };
    }).filter(u => u.spd !== null);
}

window.onload = () => { addRow('ally'); addRow('enemy'); };