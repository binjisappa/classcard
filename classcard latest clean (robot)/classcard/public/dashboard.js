// ============================================================
// dashboard.js — Data helpers for students & cards
// ============================================================

const Dashboard = (() => {

  // ══════════════════════════════════════════════════════════
  // STUDENTS
  // ══════════════════════════════════════════════════════════

  async function createStudent(name, teacherId) {
    const { data, error } = await sb
      .from('students')
      .insert({ name, teacher_id: teacherId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getMyStudents(teacherId) {
    const { data, error } = await sb
      .from('students')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('name');
    if (error) throw error;
    return data || [];
  }

  async function getAllStudents() {
    const { data, error } = await sb
      .from('students')
      .select('*, profiles(name, email)')
      .order('name');
    if (error) throw error;
    return data || [];
  }

  // ══════════════════════════════════════════════════════════
  // CARDS
  // ══════════════════════════════════════════════════════════

  async function saveCard(cardObj) {
    const { data, error } = await sb
      .from('cards')
      .insert(cardObj)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getMyCards(teacherId) {
    const { data, error } = await sb
      .from('cards')
      .select('*, students(name)')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getStudentCards(studentId) {
    const { data, error } = await sb
      .from('cards')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getAllCards() {
    const { data, error } = await sb
      .from('cards')
      .select('*, students(name), profiles(name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // ══════════════════════════════════════════════════════════
  // PROFILES (admin)
  // ══════════════════════════════════════════════════════════

  async function getAllProfiles() {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .order('role');
    if (error) throw error;
    return data || [];
  }

  // ══════════════════════════════════════════════════════════
  // CARD HTML RENDERER — shared across all dashboards
  // ══════════════════════════════════════════════════════════

  function renderCard(card, studentName = '') {
    const rarity = card.rarity || 'common';

    const bgMap = {
      common:    'linear-gradient(160deg,#f5e97a 0%,#e8c830 40%,#f5e097 70%,#ffe680 100%)',
      silver:    'linear-gradient(160deg,#d8e4ee 0%,#a8bfcf 40%,#e0eaf2 70%,#c0d4e4 100%)',
      'gold-rare': 'linear-gradient(160deg,#ffe090 0%,#f0b020 30%,#ffd060 60%,#e89010 80%,#ffdc80 100%)',
      prismatic: 'linear-gradient(135deg,#ffb3b3 0%,#ffd9a0 14%,#ffffa0 28%,#b3ffb3 42%,#a0e8ff 57%,#b3b3ff 71%,#e8b3ff 85%,#ffb3e8 100%)',
    };
    const borderMap = { common:'#c8a000', silver:'#7a9ab0', 'gold-rare':'#c07800', prismatic:'#c080ff' };
    const rarityLabel = { common:'◆ Common', silver:'✦ Silver', 'gold-rare':'★ Gold Rare', prismatic:'✦✦ Prismatic' };
    const shadowMap = {
      silver: 'box-shadow:0 0 0 2px #7a9ab0,0 8px 30px rgba(120,160,200,0.2);',
      'gold-rare': 'box-shadow:0 0 0 3px #d4a017,0 8px 40px rgba(212,160,23,0.35);',
      prismatic: 'box-shadow:0 0 0 3px #c080ff,0 8px 50px rgba(180,100,255,0.5),0 0 30px rgba(255,150,255,0.2);',
    };

    const extraShadow = shadowMap[rarity] || '';
    const name = studentName || card.students?.name || '';

    // Build star HTML for silver/gold/prismatic
    let starsHtml = '';
    if (rarity !== 'common') {
      const syms = rarity === 'gold-rare' ? ['★','✦','◆']
                 : rarity === 'prismatic'  ? ['★','✦','✧','◆','✶']
                 : ['✦','✧','⋆'];
      // Prismatic stars cycle through rainbow colours
      const prismCols = [
        'rgba(255,100,120,0.95)','rgba(255,180,60,0.95)','rgba(255,255,80,0.95)',
        'rgba(80,255,140,0.95)','rgba(80,200,255,0.95)','rgba(160,100,255,0.95)',
        'rgba(255,100,230,0.95)','rgba(255,255,255,0.99)',
      ];
      const cols = rarity === 'gold-rare'
        ? ['rgba(255,220,60,0.95)','rgba(255,180,0,0.9)','rgba(255,255,140,0.95)']
        : rarity === 'prismatic' ? prismCols
        : ['rgba(200,230,255,0.9)','rgba(180,210,255,0.85)','rgba(255,255,255,0.9)'];
      const starCount = rarity === 'prismatic' ? 30 : 20;
      for (let i = 0; i < starCount; i++) {
        const x = (Math.random()*86+5).toFixed(1);
        const y = (Math.random()*86+5).toFixed(1);
        const sym = syms[i % syms.length];
        const col = cols[i % cols.length];
        const sz  = (Math.random()*6+7).toFixed(0);
        const del = (Math.random()*2).toFixed(2);
        const dur = (Math.random()*1.2+0.8).toFixed(2);
        starsHtml += `<span class="holo-star" style="left:${x}%;top:${y}%;font-size:${sz}px;color:${col};text-shadow:0 0 8px ${col};animation-duration:${dur}s;--delay:${del}s">${sym}</span>`;
      }
    }

    const sheenHtml = rarity !== 'common'
      ? `<div class="holo-sheen" id="sheen-${card.id}"></div>`
      : '';

    const sparkleClass = rarity === 'common' ? 'common-sparkle'
                        : rarity === 'prismatic' ? 'prismatic-sparkle' : '';
    const shimmerBtnClass = rarity === 'prismatic' ? 'shimmer-btn prismatic-shimmer' : 'shimmer-btn';
    const shimmerLabel = rarity === 'prismatic' ? '✦✦ Shimmer ✦✦' : '✦ Shimmer ✦';

    return `
<div class="card-stage" data-id="${card.id}" style="display:flex;flex-direction:column;align-items:center;">
  <div class="poke-card ${rarity}" style="${extraShadow}"
       onmousemove="cardTilt(event,this,'${rarity}')"
       onmouseleave="cardUntilt(this,'${rarity}')">
    <div class="card-sparkle ${sparkleClass}"></div>
    <div class="holo-layer" style="${rarity === 'common' ? 'display:none' : ''}">
      ${sheenHtml}
      <div class="holo-stars">${starsHtml}</div>
    </div>
    <div class="card-content">
      <div class="card-header">
        <div class="card-name">${escHtml(card.card_name)}</div>
        <div class="card-hp">HP ${card.hp}</div>
      </div>
      <div class="card-img-box">
        <img src="${card.image_url}" alt="${escHtml(card.card_name)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="card-img-loading" style="display:none"><div style="font-size:2rem">🎭</div></div>
        <div class="card-type-badge">${escHtml(card.type)}</div>
      </div>
      <div class="card-desc">${escHtml(card.description)}</div>
      <div class="card-stats">
        <div class="stat-box"><span class="stat-label">${escHtml(card.stat1_name)}</span><span class="stat-val">${card.stat1_val}</span></div>
        <div class="stat-box"><span class="stat-label">${escHtml(card.stat2_name)}</span><span class="stat-val">${card.stat2_val}</span></div>
        <div class="stat-box"><span class="stat-label">${escHtml(card.stat3_name)}</span><span class="stat-val">${card.stat3_val}</span></div>
      </div>
      <div class="card-move"><span class="move-name">${escHtml(card.move1_name)}</span><span class="move-dmg">${card.move1_dmg}</span></div>
      <div class="card-move"><span class="move-name">${escHtml(card.move2_name)}</span><span class="move-dmg">${card.move2_dmg}</span></div>
      <div class="card-footer">
        <span class="card-rarity-tag">${rarityLabel[rarity] || ''}</span>
        <span class="card-student-name">Awarded to: ${escHtml(name)}</span>
      </div>
    </div>
  </div>
  <button class="${shimmerBtnClass}" onclick="triggerCardShimmer(this)">
    ${shimmerLabel}
  </button>
</div>`;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    createStudent, getMyStudents, getAllStudents,
    saveCard, getMyCards, getStudentCards, getAllCards,
    getAllProfiles, renderCard,
  };
})();

// ── Shared card tilt functions (called from inline handlers) ──
function cardTilt(e, card, rarity) {
  const r = card.getBoundingClientRect();
  const dx = (e.clientX - r.left - r.width/2)  / (r.width/2);
  const dy = (e.clientY - r.top  - r.height/2) / (r.height/2);
  card.style.transform = `rotateY(${dx*14}deg) rotateX(${-dy*10}deg) translateZ(10px) scale(1.04)`;
  const sheen = card.querySelector('.holo-sheen');
  if (sheen) sheen.style.transform = `rotate(${dx*30+dy*15}deg) translate(${dx*15}%,${dy*15}%)`;
  const hl = card.querySelector('.holo-layer');
  if (hl) hl.style.opacity = '1';
  if (rarity === 'gold-rare') card.style.boxShadow = `${-dx*11}px ${dy*7}px 50px rgba(212,160,23,0.6),0 0 0 3px #d4a017`;
  else if (rarity === 'silver') card.style.boxShadow = `${-dx*8}px ${dy*5}px 40px rgba(120,160,200,0.4),0 0 0 2px #7a9ab0`;
  else if (rarity === 'prismatic') card.style.boxShadow = `${-dx*12}px ${dy*8}px 60px rgba(180,100,255,0.7),0 0 0 3px #c080ff,0 0 40px rgba(255,150,255,0.3)`;
  else card.style.boxShadow = `${-dx*6}px ${dy*4}px 30px rgba(200,160,0,0.3)`;
}
function cardUntilt(card, rarity) {
  card.style.transform = '';
  const hl = card.querySelector('.holo-layer');
  if (hl) hl.style.opacity = '0';
  const sheen = card.querySelector('.holo-sheen');
  if (sheen) sheen.style.transform = '';
  const shadowMap = {
    silver: '0 0 0 2px #7a9ab0,0 8px 30px rgba(120,160,200,0.2)',
    'gold-rare': '0 0 0 3px #d4a017,0 8px 40px rgba(212,160,23,0.35)',
    prismatic: '0 0 0 3px #c080ff,0 8px 50px rgba(180,100,255,0.5),0 0 30px rgba(255,150,255,0.2)',
  };
  card.style.boxShadow = shadowMap[rarity] || '';
}

// ── Touch shimmer button — plays a tilt animation so iPad users can see the holographic effect ──
function triggerCardShimmer(btn) {
  const stage = btn.closest('[data-id]') || btn.parentElement;
  const card = stage.querySelector('.poke-card');
  if (!card) return;
  const hl = card.querySelector('.holo-layer');

  // Show holo layer during animation
  if (hl) hl.style.opacity = '1';

  // Remove then re-add class to restart animation
  card.classList.remove('shimmer-playing');
  void card.offsetWidth; // force reflow
  card.classList.add('shimmer-playing');

  // Disable button briefly
  btn.disabled = true;
  btn.style.opacity = '0.5';

  card.addEventListener('animationend', () => {
    card.classList.remove('shimmer-playing');
    if (hl) hl.style.opacity = '';
    btn.disabled = false;
    btn.style.opacity = '';
  }, { once: true });
}
