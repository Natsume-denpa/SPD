let currentMode = 'versus';
const MAX_UNITS = 8;
const SPD_RANGE = { MIN: 0.9, MAX: 1.1 }; // 90% ~ 110%

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
        const currentVal = nameInput.value;
        if (currentVal === "" || /^自陣\d+$/.test(currentVal) || /^敵\d+$/.test(currentVal)) {
            nameInput.value = label + (index + 1);
        }
    });
}

function getProbSlowerThan(unitSpd, x) {
    const min = unitSpd * SPD_RANGE.MIN;
    const max = unitSpd * SPD_RANGE.MAX;
    if (x <= min) return 0;
    if (x >= max) return 1;
    return (x - min) / (max - min);
}

function calculateWinRate(targetSpd, othersSpd) {
    if (targetSpd === null || !othersSpd || othersSpd.length === 0) return 1.0;
    const a = targetSpd * SPD_RANGE.MIN;
    const b = targetSpd * SPD_RANGE.MAX;
    let totalWinProb = 0;
    const steps = 60;
    const dx = (b - a) / steps;

    for (let i = 0; i < steps; i++) {
        const x = a + dx * (i + 0.5); 
        let probAllOthersSlower = 1.0;
        for (const oSpd of othersSpd) {
            probAllOthersSlower *= getProbSlowerThan(oSpd, x);
        }
        totalWinProb += probAllOthersSlower;
    }
    return Math.min(Math.max(totalWinProb / steps, 0), 1);
}

function calculateVersusWinRate(allySpds, enemySpds) {
    const all = [...allySpds, ...enemySpds];
    const minLimit = Math.min(...all) * SPD_RANGE.MIN;
    const maxLimit = Math.max(...all) * SPD_RANGE.MAX;

    let totalAllyWinProb = 0;
    const steps = 120;
    const dx = (maxLimit - minLimit) / steps;

    for (let i = 0; i < steps; i++) {
        const x = minLimit + dx * (i + 0.5);
        const pAllyMaxBelowX = allySpds.reduce((p, s) => p * getProbSlowerThan(s, x), 1);
        const pAllyMaxBelowXPrev = allySpds.reduce((p, s) => p * getProbSlowerThan(s, x - dx), 1);
        const pAllyMaxIsX = pAllyMaxBelowX - pAllyMaxBelowXPrev;
        const pEnemyMaxBelowX = enemySpds.reduce((p, s) => p * getProbSlowerThan(s, x), 1);
        totalAllyWinProb += pAllyMaxIsX * pEnemyMaxBelowX;
    }
    return Math.min(Math.max(totalAllyWinProb, 0), 1);
}

function updateAll() {
    const allies = getTeamData('allyList');
    const enemies = (currentMode === 'versus') ? getTeamData('enemyList') : [];

    ['ally', 'enemy'].forEach(t => {
        const list = document.getElementById(t + 'List');
        if (!list) return;
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

    let displayList = [];

    if (currentMode === 'versus') {
        resultLabelEl.textContent = "自陣の先制確率";
        if (allies.length > 0 && enemies.length > 0) {
            const allySpds = allies.map(u => u.spd);
            const enemySpds = enemies.map(u => u.spd);
            const rate = calculateVersusWinRate(allySpds, enemySpds);
            
            const allSpds = [...allySpds, ...enemySpds];
            allies.forEach((u, idx) => {
                const others = [...allySpds.slice(0,idx), ...allySpds.slice(idx+1), ...enemySpds];
                u.winRate = calculateWinRate(u.spd, others);
            });
            enemies.forEach((u, idx) => {
                const others = [...allySpds, ...enemySpds.slice(0,idx), ...enemySpds.slice(idx+1)];
                u.winRate = calculateWinRate(u.spd, others);
            });

            mainValEl.textContent = (rate * 100).toFixed(1) + "%";
            mainValEl.style.color = "var(--primary)";
            
            if (rate >= 0.999) {
                badgeEl.textContent = "確定先制"; badgeEl.className = "status-badge active";
                resultBox.style.background = "var(--success-soft)";
            } else if (rate <= 0.001) {
                badgeEl.textContent = "先制不可"; badgeEl.className = "status-badge danger";
                resultBox.style.background = "var(--enemy-soft)";
            } else {
                badgeEl.textContent = "乱数勝負"; badgeEl.className = "status-badge info";
                resultBox.style.background = "var(--primary-soft)";
            }
            displayList = [...allies.map(u=>({...u, t:'ally'})), ...enemies.map(u=>({...u, t:'enemy'}))];
        } else {
            mainValEl.textContent = "--";
            badgeEl.textContent = allies.length === 0 ? "自陣を入力" : "敵陣を入力";
            badgeEl.className = "status-badge warning";
            resultBox.style.background = "#f1f5f9";
        }
    } else {
        resultLabelEl.textContent = "最速行動の期待値";
        if (allies.length >= 1) {
            const allySpds = allies.map(u => u.spd);
            allies.forEach((u, idx) => {
                const others = [...allySpds.slice(0,idx), ...allySpds.slice(idx+1)];
                u.winRate = calculateWinRate(u.spd, others);
            });
            
            const bestUnit = allies.reduce((a, b) => {
                if (a.winRate === b.winRate) return a.originalIndex < b.originalIndex ? a : b;
                return a.winRate > b.winRate ? a : b;
            });

            mainValEl.textContent = bestUnit.name;
            mainValEl.style.color = "var(--primary)";
            badgeEl.textContent = (bestUnit.winRate * 100).toFixed(1) + "% で1位";
            badgeEl.className = "status-badge info";
            resultBox.style.background = "var(--primary-soft)";
            displayList = allies.map(u => ({...u, t:'ally'}));
        } else {
            mainValEl.textContent = "--";
            badgeEl.textContent = "ユニットを入力";
            badgeEl.className = "status-badge warning";
            resultBox.style.background = "#f1f5f9";
        }
    }

    const orderListEl = document.getElementById('orderList');
    
    const sortedUnits = displayList.sort((a,b) => {
        if (Math.abs(b.winRate - a.winRate) > 0.0001) return b.winRate - a.winRate;
        if (b.spd !== a.spd) return b.spd - a.spd;
        return a.originalIndex - b.originalIndex;
    });

    orderListEl.innerHTML = sortedUnits.map((u, i) => {
        const chanceInfo = u.winRate !== undefined 
            ? `<div class="u-chance">最速確率: <span>${(u.winRate * 100).toFixed(1)}%</span></div>` 
            : '';
            
        return `
            <div class="rank-item ${u.t === 'ally' ? 'is-ally' : 'is-enemy'}">
                <div class="u-info">
                    <span class="rank-num">${i+1}</span> 
                    <span class="u-name">${u.name}</span>
                </div>
                <div class="u-details">
                    <div class="u-spd-text">SPD: <span class="u-spd-val">${u.spd}</span></div>
                    ${chanceInfo}
                </div>
            </div>
        `;
    }).join('') || '<p style="text-align:center;color:#94a3b8;font-size:0.8rem;padding:20px;">数値入力待ち</p>';
}

function getTeamData(id) {
    const list = document.getElementById(id);
    if (!list) return [];
    return Array.from(list.children).map((row, index) => {
        const val = row.querySelector('.input-spd').value;
        return { 
            name: row.querySelector('.input-name').value || "無名", 
            spd: val === "" ? null : parseInt(val),
            originalIndex: index
        };
    }).filter(u => u.spd !== null);
}

window.onload = () => { 
    addRow('ally'); 
    addRow('enemy'); 
};