/* Paneles laterales, registro de misión, leyenda y selección de sectores. */
import { TERRAIN, BUILDING_TYPES, TECHS, MAX_TURNS, TRAIN_COST } from '../config.js';
import { state, sectorLabel, neighborsOf, availableUnits, totalUnits, territoryCount } from '../state.js';
import { fmtNum, attackPowerDetail, defensePowerDetail, describeAttack, describeDefense } from '../combat.js';
import { buildBuilding, trainUnit, research, canAfford, canTrainAt, projectedIncome, popCap } from '../economy.js';
import { confirmMove } from '../game.js';
import { renderMap } from './map.js';
import { resourceIconInline } from './resource-icons.js';

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

export function resIcon(kind, px){
  return resourceIconInline(kind, px);
}

/* Muestra solo los recursos que el coste realmente consume, para que una línea de
   coste no se llene de ceros. */
export function costLabel(cost){
  return [['regolith',cost.regolith], ['helium3',cost.helium3], ['ice',cost.ice]]
    .filter(([,n]) => n > 0)
    .map(([kind,n]) => `${n} ${resIcon(kind,11)}`)
    .join(' / ');
}

/* Tamaño del icono en la barra superior: un 50% sobre los 15 px del panel lateral. */
const RESBAR_ICON = 22;

/* El tope de población puede quedar por debajo de las tropas ya reclutadas: basta
   perder un sector o un casquete de hielo para que encoja. No destruye tropas,
   pero sí bloquea el reclutamiento, así que conviene que cante a la vista.
   Solo se marca cuando lo SUPERA; igualarlo es estar al completo, no un problema. */
function contadorPoblacion(faction){
  const tropas = totalUnits(faction), tope = popCap(faction);
  const excedido = tropas > tope;
  return `<div class="res pop${excedido ? ' excedido' : ''}"
    title="${excedido ? 'Superas el tope: no puedes reclutar hasta ampliarlo o perder unidades' : 'Guarniciones / tope de población'}">👥 ${tropas}/${tope}</div>`;
}

export function renderResbar(){
  const p = state.factions[0];
  // el incremento sale del mismo cálculo que luego cobra produceResources()
  const inc = projectedIncome(p);
  // se muestra siempre, también cuando es +0: así se ve de un vistazo qué recurso
  // ha dejado de entrar (p. ej. el hielo si no controlas ningún casquete)
  const chip = (cls, kind, valor, delta) =>
    `<div class="res ${cls}">${resIcon(kind,RESBAR_ICON)} ${Math.floor(valor)}<span class="res-inc">(+${delta})</span></div>`;
  document.getElementById('resbar').innerHTML =
    chip('regolith','regolith', p.resources.regolith, inc.regolith) +
    chip('helium',  'helium3',  p.resources.helium3,  inc.helium3) +
    chip('ice',     'ice',      p.resources.ice,      inc.ice) +
    contadorPoblacion(p);
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
    <div class="stat-row"><span>Producción base</span><b>+${t.regolith} ${resIcon('regolith')} / +${t.helium3} ${resIcon('helium3')} / +${t.ice} ${resIcon('ice')}</b></div>
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
        const afford = canAfford(player, b.cost);
        out += `<div class="build-opt">
          <div class="bo-name"><span>${b.resource?resIcon(b.resource,12):b.icon} ${b.name}</span><span class="bo-cost">${costLabel(b.cost)}</span></div>
          <button class="btn" data-build="${key}" ${afford?'':'disabled'}>CONSTRUIR</button>
        </div>`;
      }
      out += `</div>`;
    } else {
      out += `<div class="empty-hint">Instalación construida: no se puede añadir otra en este sector.</div>`;
    }
    if(canTrainAt(h)){
      const topeLleno = totalUnits(player) >= popCap(player);
      const canTrain = canAfford(player, TRAIN_COST) && !topeLleno;
      out += `<div class="build-opt" style="margin-top:10px;">
        <div class="bo-name"><span>⬡ Entrenar unidad</span><span class="bo-cost">${costLabel(TRAIN_COST)}</span></div>
        <button class="btn" id="trainbtn" ${canTrain?'':'disabled'}>ENTRENAR</button>
      </div>
      ${topeLleno?`<div class="empty-hint">Tope de población alcanzado (${popCap(player)}). Se amplía conquistando sectores y aumentando tu producción de hielo por turno.</div>`:''}`;
    } else {
      out += `<div class="empty-hint" style="margin-top:10px;">Aquí no se pueden reclutar tropas: solo se entrena en la <b>Base Principal</b> y en los <b>Cuarteles Lunares</b>.</div>`;
    }
    out += `<div class="empty-hint">Pulsa un sector adyacente en el mapa para mover o atacar con estas tropas.</div>`;
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
      <div class="tech-head"><span>${t.name}</span><span>${done?'✓ COMPLETO':t.cost+' '+resIcon('helium3',12)}</span></div>
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

