/* Paneles laterales, registro de misión, leyenda y selección de sectores. */
import { TERRAIN, BUILDING_TYPES, TECHS, MAX_TURNS } from '../config.js';
import { state, sectorLabel, neighborsOf, availableUnits, popCap, totalUnits, territoryCount } from '../state.js';
import { fmtNum, attackPowerDetail, defensePowerDetail, describeAttack, describeDefense } from '../combat.js';
import { buildBuilding, trainUnit, research } from '../economy.js';
import { confirmMove } from '../game.js';
import { renderMap } from './map.js';

export function onHexClick(hex){
  if(state.gameOver) return;
  const player = state.factions[0];

  if(state.selected){
    const sel = state.selected;
    if(sel.q===hex.q && sel.r===hex.r){
      state.selected=null; state.pending=null; renderAll(); return;
    }
    const adjacent = neighborsOf(sel).some(n=>n.q===hex.q && n.r===hex.r);
    if(sel.owner===0 && adjacent && availableUnits(sel)>0){
      state.pending = { source:sel, target:hex, amount:Math.max(1, availableUnits(sel)-1) };
      renderAll();
      return;
    }
  }
  state.selected = hex;
  state.pending = null;
  renderAll();
}

export function resIcon(kind){
  return kind==='regolith'?'⛰':kind==='helium3'?'☢':'❄';
}

export function renderResbar(){
  const p = state.factions[0];
  document.getElementById('resbar').innerHTML = `
    <div class="res regolith"><span class="ic">⛰</span> ${Math.floor(p.resources.regolith)}</div>
    <div class="res helium"><span class="ic">☢</span> ${Math.floor(p.resources.helium3)}</div>
    <div class="res water"><span class="ic">❄</span> ${Math.floor(p.resources.water)}</div>
    <div class="res" style="color:var(--text-dim)">👥 ${totalUnits(p)}/${popCap(p)}</div>
  `;
  document.getElementById('turnbadge').textContent = `RONDA ${state.turn} / ${MAX_TURNS}`;
  document.getElementById('factionsstrip').innerHTML = state.factions.map(f=>{
    const t = territoryCount(f);
    return `<span class="${f.alive?'':'fdead'}" style="font-size:10px;display:flex;align-items:center;gap:4px;">
      <span class="fdot" style="background:${f.color}"></span>${t}</span>`;
  }).join('');
}

export function renderHexPanel(){
  const el = document.getElementById('hexpanel');
  const h = state.selected;
  if(!h){
    el.innerHTML = `<p class="panel-title">SECTOR SELECCIONADO</p>
      <div class="empty-hint">Selecciona un sector del mapa para ver detalles y acciones disponibles.</div>`;
    return;
  }
  const t = TERRAIN[h.terrain];
  const faction = h.owner!=null ? state.factions[h.owner] : null;
  const player = state.factions[0];
  const isMine = h.owner===0;

  const defDetailStatic = defensePowerDetail(faction, h);
  const avail = availableUnits(h), spent = (h.movedUnits||0);
  let out = `<p class="panel-title">SECTOR SELECCIONADO</p>
    <div class="hexinfo-name" style="color:${faction?faction.color:'var(--text-main)'}">${sectorLabel(h)}</div>
    <div class="hexinfo-terrain">${t.name}${faction?(' · Control: '+faction.name):' · Sin reclamar'}</div>
    <div class="stat-row"><span>Producción base</span><b>+${t.regolith} ⛰ / +${t.helium3} ☢ / +${t.water} ❄</b></div>
    <div class="stat-row"><span>Guarnición</span><b>${h.units} unidades</b></div>
    ${isMine ? `<div class="stat-row"><span>Disponibles este turno</span><b style="color:${avail>0?'var(--ok)':'var(--danger)'}">${avail}${spent>0?` (${spent} ya movidas)`:''}</b></div>` : ''}
    <div class="stat-row"><span>Instalación</span><b>${h.building?BUILDING_TYPES[h.building].name:'— ninguna —'}</b></div>
    <div class="stat-row"><span>Fuerza de defensa base</span><b>${fmtNum(defDetailStatic.total)}</b></div>
    <div class="empty-hint" style="margin-top:-4px;">${describeDefense(defDetailStatic, h)}</div>`;

  if(state.pending && state.pending.source.q===h.q && state.pending.source.r===h.r){
    const p = state.pending;
    const isAttack = p.target.owner!==0;
    const maxSend = availableUnits(p.source);
    out += `<p class="panel-title" style="margin-top:12px;">${isAttack?'ORDEN DE ATAQUE':'ORDEN DE MOVIMIENTO'} → ${sectorLabel(p.target)}</p>
      <div class="action-row">
        <input type="number" min="1" max="${maxSend}" value="${Math.min(p.amount,maxSend)}" class="numinput" id="moveamount">
        <button class="btn" id="confirmmove" ${maxSend>0?'':'disabled'}>${isAttack?'ATACAR':'MOVER'}</button>
        <button class="btn" id="cancelmove">CANCELAR</button>
      </div>
      <div id="combatpreview" style="margin-top:8px;font-size:11px;"></div>`;
  } else if(isMine){
    out += `<p class="panel-title" style="margin-top:12px;">ACCIONES</p>`;
    if(!h.building){
      out += `<div class="build-list">`;
      for(const [key,b] of Object.entries(BUILDING_TYPES)){
        if(key==='base' || !b.allowed.includes(h.terrain)) continue;
        const afford = player.resources.regolith>=b.cost.regolith && player.resources.helium3>=b.cost.helium3;
        out += `<div class="build-opt">
          <div class="bo-name"><span>${b.icon} ${b.name}</span><span class="bo-cost">${b.cost.regolith}⛰ ${b.cost.helium3?('/ '+b.cost.helium3+'☢'):''}</span></div>
          <button class="btn" data-build="${key}" ${afford?'':'disabled'}>CONSTRUIR</button>
        </div>`;
      }
      out += `</div>`;
    } else {
      out += `<div class="empty-hint">Instalación construida: no se puede añadir otra en este sector.</div>`;
    }
    const trainCost = {regolith:12,helium3:4};
    const canTrain = player.resources.regolith>=trainCost.regolith && player.resources.helium3>=trainCost.helium3
      && totalUnits(player) < popCap(player);
    out += `<div class="build-opt" style="margin-top:10px;">
      <div class="bo-name"><span>⬡ Entrenar unidad</span><span class="bo-cost">${trainCost.regolith}⛰ / ${trainCost.helium3}☢</span></div>
      <button class="btn" id="trainbtn" ${canTrain?'':'disabled'}>ENTRENAR</button>
    </div>
    <div class="empty-hint">Pulsa un sector adyacente en el mapa para mover o atacar con estas tropas.</div>`;
  }

  el.innerHTML = out;

  el.querySelectorAll('[data-build]').forEach(btn=>{
    btn.addEventListener('click', ()=>buildBuilding(h, btn.getAttribute('data-build')));
  });
  const trainBtn = el.querySelector('#trainbtn');
  if(trainBtn) trainBtn.addEventListener('click', ()=>trainUnit(h));
  const confirmBtn = el.querySelector('#confirmmove');
  if(confirmBtn) confirmBtn.addEventListener('click', ()=>{
    const amt = parseInt(document.getElementById('moveamount').value,10) || 1;
    confirmMove(state.pending.source, state.pending.target, amt);
  });
  const cancelBtn = el.querySelector('#cancelmove');
  if(cancelBtn) cancelBtn.addEventListener('click', ()=>{ state.pending=null; renderAll(); });

  const previewEl = el.querySelector('#combatpreview');
  if(previewEl && state.pending){
    const p = state.pending;
    const isAttack = p.target.owner!==0;
    const amountInput = el.querySelector('#moveamount');
    const updatePreview = ()=>{
      const maxSend = availableUnits(p.source);
      const amt = Math.max(1, Math.min(parseInt(amountInput.value,10)||1, maxSend));
      if(!isAttack){
        previewEl.innerHTML = `<span style="color:var(--text-dim)">Movimiento sin combate: se trasladan ${amt} unidades a un sector propio. No podrán volver a moverse este turno.</span>`;
        return;
      }
      const defFaction = p.target.owner!=null ? state.factions[p.target.owner] : null;
      const atkD = attackPowerDetail(player, amt, p.source, p.target);
      const defD = defensePowerDetail(defFaction, p.target, p.source);
      const willWin = atkD.total > defD.total;
      previewEl.innerHTML = `
        <div class="stat-row"><span>Tu ataque</span><b style="color:var(--f0)">${fmtNum(atkD.total)}</b></div>
        <div class="empty-hint" style="margin:-2px 0 6px;">${describeAttack(atkD)}</div>
        <div class="stat-row"><span>Defensa del sector</span><b style="color:${defFaction?defFaction.color:'var(--text-dim)'}">${fmtNum(defD.total)}</b></div>
        <div class="empty-hint" style="margin:-2px 0 6px;">${describeDefense(defD, p.target)}</div>
        <div style="font-size:12px;font-weight:700;color:${willWin?'var(--ok)':'var(--danger)'}">
          ${willWin ? '✓ Resultado probable: CONQUISTA' : '✕ Resultado probable: DERROTA'}
        </div>`;
    };
    amountInput.addEventListener('input', updatePreview);
    updatePreview();
  }
}

export function renderTechs(){
  const player = state.factions[0];
  document.getElementById('techlist').innerHTML = TECHS.map(t=>{
    const done = player.techs.has(t.id);
    const afford = player.resources.helium3 >= t.cost;
    return `<div class="tech-item ${done?'done':''}">
      <div class="tech-head"><span>${t.name}</span><span>${done?'✓ COMPLETO':t.cost+' ☢'}</span></div>
      <div class="tech-desc">${t.desc}</div>
      ${done?'':`<button class="btn" data-tech="${t.id}" ${afford?'':'disabled'} style="width:100%;">INVESTIGAR</button>`}
    </div>`;
  }).join('');
  document.querySelectorAll('[data-tech]').forEach(btn=>{
    btn.addEventListener('click', ()=>research(btn.getAttribute('data-tech')));
  });
}

export function renderLog(){
  document.getElementById('logpanel').innerHTML =
    state.log.slice().reverse().map(e=>`<div>[R${e.turn}] ${e.msg}</div>`).join('');
}

export function renderLegend(){
  document.getElementById('legend').innerHTML = `
    <span><i style="background:${TERRAIN.mare.color}"></i>Mare</span>
    <span><i style="background:${TERRAIN.highlands.color}"></i>Tierras Altas</span>
    <span><i style="background:${TERRAIN.crater.color}"></i>Cráter</span>
    <span><i style="background:${TERRAIN.ice.color}"></i>Hielo</span>
    ${state.factions.map(f=>`<span><i style="background:${f.color}"></i>${f.name}</span>`).join('')}
  `;
}

export function renderAll(){
  renderMap();
  renderResbar();
  renderHexPanel();
  renderTechs();
  renderLog();
  renderLegend();
  document.getElementById('endturnbtn').disabled = state.gameOver;
}

