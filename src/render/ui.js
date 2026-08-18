/* Paneles laterales, registro de misión, leyenda y selección de sectores. */
import { TERRAIN, BUILDING_TYPES, TECHS, MAX_TURNS, TRAIN_COST } from '../config.js';
import { state, sectorLabel, neighborsOf, availableUnits, totalUnits, territoryCount } from '../state.js';
import { fmtNum, attackPowerDetail, defensePowerDetail, describeAttack, describeDefense } from '../combat.js';
import { buildBuilding, trainUnit, research, canAfford, canTrainAt, projectedIncome, popCap,
         canBuild, edificioActivo, habilitado, puedeInvestigar, mantenimientoDe } from '../economy.js';
import { HOPPER } from '../config.js';
import { hoppersEn, puedeFabricarHopper, fabricarHopper, destinosPosibles, saltar } from '../hopper.js';
import { confirmMove } from '../game.js';
import { scoreDetail } from '../victory.js';
import { renderMap } from './map.js';
import { resourceIconInline } from './resource-icons.js';
import { unitIconInline } from './unit-icon.js';

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

/* Qué aporta una instalación ya construida: producción, defensa y si permite
   reclutar. Se arma desde los datos de BUILDING_TYPES en vez de con textos fijos,
   así que tocar un valor en config.js se refleja aquí solo. */
export function ventajaEdificio(b){
  const partes = [];
  const prod = [['regolith',b.produce.regolith], ['helium3',b.produce.helium3], ['ice',b.produce.ice]]
    .filter(([,n]) => n > 0)
    .map(([kind,n]) => `+${n} ${resIcon(kind,12)}`);
  if(prod.length) partes.push(prod.join(' ') + ' por turno');
  if(b.defense)   partes.push(`+${b.defense} a la defensa del sector`);
  if(b.trains)    partes.push('permite reclutar guarniciones');
  if(b.enables && b.enables.includes('research')) partes.push('habilita la investigación');
  if(b.enables && b.enables.includes('hoppers'))  partes.push('fabrica Transportadores');
  if(b.blocksHoppers) partes.push('niega el vuelo enemigo sobre su casilla');
  if(b.unique)    partes.push('solo uno por facción');
  if(b.upkeep){
    const up = [['regolith',b.upkeep.regolith], ['helium3',b.upkeep.helium3], ['ice',b.upkeep.ice]]
      .filter(([,n]) => n > 0).map(([k,n]) => `${n} ${resIcon(k,12)}`);
    if(up.length) partes.push(`mantenimiento ${up.join(' ')} por turno`);
  }
  return partes.length ? partes.join(' · ') : 'Sin efecto directo.';
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
  // el icono es la misma ficha que representa a las tropas en el mapa
  return `<div class="res pop${excedido ? ' excedido' : ''}"
    title="${excedido ? 'Superas el tope: no puedes reclutar hasta ampliarlo o perder unidades' : 'Guarniciones / tope de población'}">${unitIconInline(faction.id, RESBAR_ICON)} ${tropas}/${tope}</div>`;
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
  renderStats();
}

/* Grupo «Est. Juego»: ronda en curso y puntuación de cada facción, la que decide
   la victoria técnica si se agotan las rondas. El desglose va en un menú flotante
   que se abre al pasar el ratón, para no llenar la cabecera de cifras. */
export function renderStats(){
  document.getElementById('statbody').innerHTML =
    `<span class="ronda">RONDA ${state.turn} / ${MAX_TURNS}</span>` +
    state.factions.map(f => {
      const d = scoreDetail(f);
      return `<span class="fpts ${f.alive?'':'fdead'}" tabindex="0">
        <span class="fdot" style="background:${f.color}"></span>${d.total}
        <span class="pts-menu">
          <span class="pts-menu-tit" style="color:${f.color}">${f.name}</span>
          ${filaPuntos('Sectores controlados', d.conteo.sectores, d.sectores)}
          ${filaPuntos('Infraestructura activa', d.conteo.edificios, d.edificios)}
          ${filaPuntos('Bajas rivales confirmadas', d.conteo.bajas, d.bajas)}
          ${filaPuntos('Relé Orbital', d.conteo.relay ? 'sí' : 'no', d.relay)}
          <span class="pts-fila pts-total"><span>TOTAL</span><b>${d.total}</b></span>
        </span></span>`;
    }).join('');
}
function filaPuntos(etiqueta, conteo, puntos){
  return `<span class="pts-fila"><span>${etiqueta} <i>(${conteo})</i></span><b>${puntos}</b></span>`;
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
    <div class="stat-row"><span>Instalación</span><b>${h.building?BUILDING_TYPES[h.building].name:'— ninguna —'}${h.building&&h.disabled?' <span class="apagada">(DESACTIVADA)</span>':''}</b></div>
    ${h.building?`<div class="empty-hint" style="margin-top:-4px;">${ventajaEdificio(BUILDING_TYPES[h.building])}</div>`:''}
    ${h.building&&h.disabled?`<div class="empty-hint" style="color:var(--danger);margin-top:-4px;">Sin mantenimiento pagado: no produce, no defiende y no habilita nada.</div>`:''}
    ${hoppersEn(h)>0?`<div class="stat-row"><span>Transportadores</span><b>${hoppersEn(h)}</b></div>`:''}
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
    out += `<p class="panel-title subtitulo" style="margin-top:12px;">ACCIONES</p>`;
    if(!h.building){
      out += `<div class="build-list">`;
      for(const [key,b] of Object.entries(BUILDING_TYPES)){
        if(key==='base' || !canBuild(h, key, player)) continue;
        const afford = canAfford(player, b.cost);
        out += `<div class="build-opt">
          <div class="bo-name">
            <span class="bo-tit">${b.resource?resIcon(b.resource,12):b.icon} ${b.name}</span>
            <span class="bo-cost">Recursos necesarios: ${costLabel(b.cost)}</span>
            <span class="bo-vent">${ventajaEdificio(b)}</span>
          </div>
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
        <div class="bo-name">
          <span class="bo-tit">⬡ Entrenar unidad</span>
          <span class="bo-cost">Recursos necesarios: ${costLabel(TRAIN_COST)}</span>
          <span class="bo-vent">+1 guarnición en este sector</span>
        </div>
        <button class="btn" id="trainbtn" ${canTrain?'':'disabled'}>ENTRENAR</button>
      </div>
      ${topeLleno?`<div class="empty-hint">Tope de población alcanzado (${popCap(player)}). Se amplía conquistando sectores y aumentando tu producción de hielo por turno.</div>`:''}`;
    }

    // fabricar Transportadores: solo en el Laboratorio activo y con la tecnología
    if(h.building==='lab' && edificioActivo(h)){
      const listo = puedeFabricarHopper(player, h);
      const pagable = canAfford(player, HOPPER.cost);
      const motivo = !player.techs.has('hopper') ? 'Requiere investigar Tecnología Hopper'
                   : !listo ? 'Disponible a partir de la próxima ronda' : '';
      out += `<div class="build-opt" style="margin-top:10px;">
        <div class="bo-name">
          <span class="bo-tit">⬢ ${HOPPER.name}</span>
          <span class="bo-cost">Recursos necesarios: ${costLabel(HOPPER.cost)}</span>
          <span class="bo-vent">Traslada hasta ${HOPPER.capacidad} tropas a ${HOPPER.alcance} casillas. Sin fuerza de combate.</span>
          ${motivo?`<span class="bo-bloqueo">${motivo}</span>`:''}
        </div>
        <button class="btn" id="hopperbtn" ${listo&&pagable?'':'disabled'}>FABRICAR</button>
      </div>`;
    }

    // saltar con un Transportador que esté en este sector
    if(hoppersEn(h) > 0){
      const destinos = destinosPosibles(h);
      const maxTropas = Math.min(HOPPER.capacidad, availableUnits(h));
      out += `<p class="panel-title subtitulo" style="margin-top:12px;">SALTO DE TRANSPORTADOR</p>`;
      if(!destinos.length){
        out += `<div class="empty-hint">No hay destino válido a ${HOPPER.alcance} casillas: deben estar libres de guarniciones y fuera del alcance de torretas enemigas.</div>`;
      } else {
        out += `<div class="action-row">
          <select class="numinput" id="hopperdest" style="width:auto;flex:1;">
            ${destinos.map(d=>`<option value="${d.q},${d.r}">${sectorLabel(d)}</option>`).join('')}
          </select>
          <input type="number" min="0" max="${maxTropas}" value="${maxTropas}" class="numinput" id="hoppertropas">
          <button class="btn" id="hopperjump">SALTAR</button>
        </div>
        <div class="empty-hint">Llevará las tropas indicadas (máx. ${maxTropas} disponibles).</div>`;
      }
    }
  }

  el.innerHTML = out;

  el.querySelectorAll('[data-build]').forEach(btn=>{
    btn.addEventListener('click', ()=>buildBuilding(h, btn.getAttribute('data-build')));
  });
  const trainBtn = el.querySelector('#trainbtn');
  if(trainBtn) trainBtn.addEventListener('click', ()=>trainUnit(h));
  const hopperBtn = el.querySelector('#hopperbtn');
  if(hopperBtn) hopperBtn.addEventListener('click', ()=>fabricarHopper(h));
  const jumpBtn = el.querySelector('#hopperjump');
  if(jumpBtn) jumpBtn.addEventListener('click', ()=>{
    const [q,r] = el.querySelector('#hopperdest').value.split(',').map(Number);
    const tropas = parseInt(el.querySelector('#hoppertropas').value,10) || 0;
    const destino = [...state.hexes.values()].find(d=>d.q===q && d.r===r);
    if(destino) saltar(h, destino, tropas);
  });
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
  const conLab = habilitado(player, 'research');
  const lista = document.getElementById('techlist');
  // el Laboratorio es la condición primera: sin uno activo no hay investigación
  const aviso = conLab ? '' :
    `<div class="empty-hint">Necesitas un <b>Laboratorio</b> construido y con su
      mantenimiento pagado para acceder a la investigación.</div>`;
  lista.innerHTML = aviso + TECHS.map(t=>{
    const done = player.techs.has(t.id);
    const previa = t.requiere ? TECHS.find(x => x.id === t.requiere) : null;
    const faltaPrevia = !!(previa && !player.techs.has(previa.id));
    const disponible = puedeInvestigar(player, t);
    const afford = player.resources.helium3 >= t.cost && disponible;
    const motivo = faltaPrevia ? `Requiere ${previa.name}` : (!conLab ? 'Requiere Laboratorio activo' : '');
    // misma estructura que las opciones de construcción: título, coste, ventaja y
    // el botón a la derecha, para que el panel se lea igual en las dos secciones
    return `<div class="tech-item build-opt ${done?'done':''} ${!done&&!disponible?'bloqueada':''}">
      <div class="bo-name">
        <span class="bo-tit">${t.name}</span>
        <span class="bo-cost">${done?'✓ COMPLETO':`Recursos necesarios: ${t.cost} ${resIcon('helium3',11)}`}</span>
        <span class="bo-vent">${t.desc}</span>
        ${motivo&&!done?`<span class="bo-bloqueo">${motivo}</span>`:''}
      </div>
      ${done?'':`<button class="btn" data-tech="${t.id}" ${afford?'':'disabled'}>INVESTIGAR</button>`}
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

/* Producción por turno de un terreno, con los iconos de recurso. Solo lista lo que
   realmente aporta, para que un terreno estéril no se llene de ceros. */
function produccionTerreno(t){
  const partes = [['regolith',t.regolith], ['helium3',t.helium3], ['ice',t.ice]]
    .filter(([,n]) => n > 0)
    .map(([kind,n]) => `+${n} ${resIcon(kind,15)}`);
  return partes.length ? `<span class="prod">${partes.join(' ')}</span>` : '';
}

export function renderLegend(){
  const terrenos = ['mare','highlands','crater','ice'].map(k => {
    const t = TERRAIN[k];
    return `<span class="legend-item"><i style="background:${t.color}"></i>${t.name}
      ${produccionTerreno(t)}</span>`;
  }).join('');
  const facciones = state.factions.map(f =>
    `<span class="legend-item ${f.alive?'':'fdead'}"><i style="background:${f.color}"></i>${f.name}</span>`
  ).join('');
  document.getElementById('legend').innerHTML =
    `<div class="legend-group"><span class="group-label">TERRENO</span>${terrenos}</div>` +
    `<div class="legend-group"><span class="group-label">FACCIONES</span>${facciones}</div>`;
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

