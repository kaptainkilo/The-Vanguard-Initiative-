function todayStr(d) { d = d || new Date(); return d.toISOString().slice(0, 10); }
function daysAgoStr(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.floor((new Date(b) - new Date(a)) / 86400000); }
function findLocationForCategory(camp, category) {
  if (!camp) return null;
  return camp.locations.find(l => l.category === category) || null;
}
function locationTarget(camp, loc) {
  if (camp.lockedTargets && camp.lockedTargets[loc.id] !== undefined) return camp.lockedTargets[loc.id];
  if (loc.manualTarget) return loc.manualTarget;
  const rate = CAMPAIGN_BASE_RATES[loc.category] || CAMPAIGN_BASE_RATES.generic;
  const weeks = camp.durationDays / 7;
  const count = Math.max(1, camp.deployedOperatorIds.length);
  return Math.round(rate * weeks * count);
}
function campaignPhase(camp) {
  if (camp.resolved) return camp.resolved;
  if (!camp.lockedAt) return 'recruiting';
  return 'active';
}

// Narrative beats tied to Control % milestones — reused across every Campaign,
// templated with that Campaign's own threat/sector so it never reads generic.
function campaignMilestoneLine(camp, pct) {
  if (camp.resolved === 'success') return `OPERATION ${camp.name.toUpperCase()}: SUCCESS. ${camp.sector} is secured. The ${camp.threat} has been pushed off this world — this Campaign's outcome is now part of the permanent record.`;
  if (camp.resolved === 'failed') return `Time ran out. ${camp.sector} remains contested — not lost, not won. The ${camp.threat} regroups. This world will see another Campaign.`;
  if (pct >= 75) return `The ${camp.threat} is in retreat across ${camp.sector}. One good push and this world falls. Finish it, Operators.`;
  if (pct >= 50) return `${camp.sector} — halfway there. The ${camp.threat}'s positions are weakening. Command authorizes continued deployment.`;
  if (pct >= 25) return `First contact confirmed in ${camp.sector}. Initial resistance from the ${camp.threat} noted. Command is watching.`;
  return `Alpha Cell has made planetfall in ${camp.sector}. The ${camp.threat} doesn't know what's coming yet.`;
}

// ---------- War Progress — overall standing across every Campaign, ever ----------
function computeWarProgress(campaigns) {
  const resolved = campaigns.filter(c => c.resolved === 'success' || c.resolved === 'failed');
  const won = resolved.filter(c => c.resolved === 'success');
  const pct = resolved.length > 0 ? (won.length / resolved.length) * 100 : 0;
  return { won: won.length, lost: resolved.length - won.length, resolved: resolved.length, pct: pct };
}
function warProgressLine(wp) {
  if (wp.resolved === 0) return "No Campaigns concluded yet. The war hasn't been decided either way.";
  if (wp.pct >= 80) return "The Initiative is winning, and it isn't close. Every Sector Command touches, the Swarm loses.";
  if (wp.pct >= 60) return "The tide favors the Initiative. Not every world, but most of them.";
  if (wp.pct >= 40) return "Even odds out here. For every world secured, another slips.";
  if (wp.pct >= 20) return "The Initiative is losing more ground than it's taking. Command isn't hiding that from you.";
  return "This is not going well. Command isn't hiding that from you either.";
}

// ---------- Val's Weekly Digest ----------
function weekStartDate() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return todayStr(d);
}
function composeWeeklyDigest(operators, campaigns, awards, personalRecords, raidInstances, raidTemplates) {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = todayStr(weekAgo);
  const opName = id => { const o = operators.find(o=>o.id===id); return o ? o.callsign : 'an operator'; };

  const rankUps = awards.filter(a => a.awardType && a.awardType.startsWith('rank_') && a.awardedAt && a.awardedAt.slice(0,10) >= weekAgoStr);
  const prs = personalRecords.filter(p => p.achievedAt >= weekAgoStr);
  const resolvedCamps = campaigns.filter(c => c.resolved && c.resolvedAt && c.resolvedAt.slice(0,10) >= weekAgoStr);
  const completedRaids = raidInstances.filter(r => r.status==='completed' && r.completedAt && r.completedAt.slice(0,10) >= weekAgoStr);

  let lines = ['📋 WEEKLY DIGEST — the last 7 days, for the record.'];
  if (rankUps.length) lines.push('Promotions: ' + rankUps.map(a => opName(a.operatorId)+' \u2192 '+a.title.replace('Promoted to ','')).join(', ') + '.');
  if (prs.length) lines.push('Personal Records: ' + prs.map(p => opName(p.operatorId)+' ('+p.exercise+', '+p.value+' '+p.unit+')').join(', ') + '.');
  if (resolvedCamps.length) lines.push('Campaigns concluded: ' + resolvedCamps.map(c => c.name+' \u2014 '+(c.resolved==='success'?'WON':'lost')).join(', ') + '.');
  if (completedRaids.length) {
    const raidNames = completedRaids.map(r => { const t = raidTemplates.find(t=>t.id===r.raidTemplateId); return t ? t.name : 'a raid'; });
    lines.push('Raids cleared: ' + raidNames.join(', ') + '.');
  }
  if (rankUps.length===0 && prs.length===0 && resolvedCamps.length===0 && completedRaids.length===0) {
    lines.push('Quiet week. Not every week is a headline. Keep logging.');
  }
  return lines.join(' ');
}

async function loadShared(key, fallback) {
  try { const res = await window.storage.get(key, true); return res ? JSON.parse(res.value) : fallback; }
  catch (e) { return fallback; }
}
async function saveShared(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), true); }
  catch (e) { console.error('storage save failed', e); }
}

function computeLocationProgress(camp, logs) {
  return camp.locations.map(loc => {
    const target = locationTarget(camp, loc);
    const relevant = logs.filter(l => l.type === 'campaign' && l.campaignId === camp.id && l.locationId === loc.id);
    const groups = {};
    relevant.forEach(l => { const key = l.operatorId + '_' + l.date; (groups[key] = groups[key] || []).push(l); });
    let total = 0;
    Object.values(groups).forEach(entries => {
      entries.sort((a,b) => a.timestamp - b.timestamp);
      entries.forEach((e, idx) => { total += idx === 0 ? e.amount : e.amount * 0.5; });
    });
    const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;
    return Object.assign({}, loc, { total: Math.round(total * 10) / 10, target: target, pct: pct });
  });
}
function computePlanetControl(locProgress) {
  if (locProgress.length === 0) return 0;
  return locProgress.reduce((s, l) => s + l.pct, 0) / locProgress.length;
}

// ---------- Hex-grid AO visualization ----------
// Deterministically generated from a Campaign's real Locations + their live
// progress %, so it can never drift out of sync with the actual mechanic
// (computeLocationProgress). Each Location gets its own anchor point spread
// around the grid; every hex belongs to whichever anchor is nearest, forming
// an organic region rather than a straight band. Within a region, hexes
// secure from the anchor outward as that Location's progress climbs.
const HEX_GRID_COLS = 10, HEX_GRID_ROWS = 6, HEX_SIZE = 26;
function locationAnchor(idx, n, cols, rows) {
  if (n === 1) return { row: rows/2, col: cols/2 };
  const angle = (idx / n) * 2 * Math.PI - Math.PI/2;
  const centerRow = rows/2, centerCol = cols/2;
  return { row: centerRow + (rows*0.36) * Math.sin(angle), col: centerCol + (cols*0.36) * Math.cos(angle) };
}
function computeHexGrid(camp, locProgress) {
  const n = camp.locations.length;
  if (n === 0) return { cols: HEX_GRID_COLS, rows: HEX_GRID_ROWS, hexes: [] };
  const anchors = camp.locations.map((loc, i) => Object.assign({ locationId: loc.id }, locationAnchor(i, n, HEX_GRID_COLS, HEX_GRID_ROWS)));
  const hexes = [];
  for (let row = 0; row < HEX_GRID_ROWS; row++) {
    for (let col = 0; col < HEX_GRID_COLS; col++) {
      let nearest = anchors[0], nearestDistSq = Infinity;
      anchors.forEach(a => {
        const distSq = (row-a.row)*(row-a.row) + (col-a.col)*(col-a.col);
        if (distSq < nearestDistSq) { nearestDistSq = distSq; nearest = a; }
      });
      hexes.push({ row: row, col: col, locationId: nearest.locationId, distFromAnchor: Math.sqrt(nearestDistSq) });
    }
  }
  const regionHexes = {};
  hexes.forEach(h => { (regionHexes[h.locationId] = regionHexes[h.locationId] || []).push(h); });
  Object.keys(regionHexes).forEach(locId => {
    const region = regionHexes[locId];
    region.sort((a,b) => a.distFromAnchor - b.distFromAnchor); // secure from the anchor outward
    const prog = locProgress.find(l => l.id === locId);
    const pct = prog ? prog.pct : 0;
    const securedCount = Math.round(region.length * (pct / 100));
    region.forEach((h, idx) => { h.secured = idx < securedCount; });
  });
  return { cols: HEX_GRID_COLS, rows: HEX_GRID_ROWS, hexes: hexes };
}
function hexCenter(row, col) {
  const hexHorizSpacing = HEX_SIZE * 1.5;
  const hexVertSpacing = Math.sqrt(3) * HEX_SIZE;
  const x = col * hexHorizSpacing + HEX_SIZE + 4;
  const y = row * hexVertSpacing + (col % 2 === 1 ? hexVertSpacing / 2 : 0) + HEX_SIZE + 4;
  return { x, y };
}
function hexPoints(cx, cy) {
  return [0, 60, 120, 180, 240, 300].map(angle => {
    const rad = Math.PI / 180 * angle;
    return (cx + HEX_SIZE * Math.cos(rad)).toFixed(1) + ',' + (cy + HEX_SIZE * Math.sin(rad)).toFixed(1);
  }).join(' ');
}
function HexGridMap({ grid, pois, onHexClick, onSelectPOI }) {
  const width = grid.cols * (HEX_SIZE*1.5) + HEX_SIZE*2 + 8;
  const height = grid.rows * (Math.sqrt(3)*HEX_SIZE) + Math.sqrt(3)*HEX_SIZE/2 + HEX_SIZE*2 + 8;
  return (
    <svg width="100%" viewBox={"0 0 "+width+" "+height} style={{background:'#05070d', borderRadius:4}}>
      {grid.hexes.map(h => {
        const c = hexCenter(h.row, h.col);
        return <polygon key={h.row+'_'+h.col} points={hexPoints(c.x, c.y)}
          fill={h.secured ? 'rgba(57,255,20,0.25)' : 'rgba(255,255,255,0.03)'}
          stroke={h.secured ? 'var(--amber)' : 'var(--border)'} strokeWidth="1"
          onClick={onHexClick ? ()=>onHexClick(h.row, h.col) : undefined}
          style={onHexClick ? {cursor:'pointer'} : {}} />;
      })}
      {(pois||[]).map(p => {
        const c = hexCenter(p.row, p.col);
        return (
          <g key={p.id} transform={"translate("+c.x+","+c.y+")"} onClick={()=> onSelectPOI && onSelectPOI(p)} style={{cursor: onSelectPOI ? 'pointer' : 'default'}}>
            {/* flag marker: pole, pennant, base anchor — reads as a real waypoint, not a plain dot */}
            <line x1="0" y1="9" x2="0" y2="-11" stroke="var(--threat)" strokeWidth="2" />
            <polygon points="0,-11 11,-6.5 0,-2" fill="var(--threat)" stroke="#fff" strokeWidth="0.75" />
            <circle cx="0" cy="10" r="2.5" fill="var(--threat)" stroke="#fff" strokeWidth="0.75" />
            <text x="0" y="-16" fontSize="9" fill="var(--text)" textAnchor="middle" fontFamily="'IBM Plex Mono',monospace">{p.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Squad Raid progress (same soft-cap contribution logic as Campaigns) ----------
function computeRaidObjectiveProgress(instance, area, logs) {
  return area.objectives.map(obj => {
    const relevant = logs.filter(l => l.type === 'raid' && l.raidInstanceId === instance.id && l.raidObjectiveId === obj.id);
    const groups = {};
    relevant.forEach(l => { const key = l.operatorId + '_' + l.date; (groups[key] = groups[key] || []).push(l); });
    let total = 0;
    Object.values(groups).forEach(entries => {
      entries.sort((a,b) => a.timestamp - b.timestamp);
      entries.forEach((e, idx) => { total += idx === 0 ? e.amount : e.amount * 0.5; });
    });
    const pct = obj.target > 0 ? Math.min(100, (total / obj.target) * 100) : 0;
    return Object.assign({}, obj, { total: Math.round(total*10)/10, pct: pct });
  });
}
function raidAreaComplete(objProgress) {
  return objProgress.length > 0 && objProgress.every(o => o.pct >= 100);
}
function findRaidObjective(template, instance, muscleGroup) {
  if (!instance || instance.status !== 'active' || !template) return null;
  const area = template.areas[instance.currentAreaIndex];
  if (!area) return null;
  return area.objectives.find(o => o.muscleGroup === muscleGroup) || null;
}

// ---------- Squad Duels — progress computed live from existing logs, no new crediting ----------
function computeDuelProgress(squad, duel, logs) {
  if (!squad || !duel.startDate) return 0;
  const memberIds = new Set(squad.members.map(m => m.operatorId));
  const relevant = logs.filter(l =>
    l.type === 'protocol' && memberIds.has(l.operatorId) &&
    (duel.muscleGroup === 'Any' || l.category === duel.muscleGroup) &&
    l.date >= duel.startDate && l.date <= duel.endDate
  );
  return relevant.reduce((s,l) => s + (l.totalValue||0), 0);
}

function computeBaselineImprovement(operator) {
  if (!operator.baseline || !operator.previousBaseline) return null;
  const metrics = ['pushups','pullups','squats','plankSeconds'];
  const changes = [];
  metrics.forEach(m => {
    const prev = operator.previousBaseline[m], cur = operator.baseline[m];
    if (prev > 0 && cur !== undefined) changes.push(((cur - prev) / prev) * 100);
  });
  if (changes.length === 0) return null;
  const avgChange = changes.reduce((a,b)=>a+b,0) / changes.length;
  const score = Math.max(0, Math.min(100, 50 + avgChange * 5));
  return { score: Math.round(score), avgChange: Math.round(avgChange*10)/10 };
}

// Progressive Overload: compares trailing-30-day training volume against the
// prior 30 days, per exercise, using logged sets/reps/weight — fully automatic,
// no manual retest needed. Uses 30-day windows (not week-over-week) specifically
// so a single deload week doesn't tank the score.
function sessionVolume(logEntry) {
  if (logEntry.sets && logEntry.sets.some(s => parseFloat(s.weight) > 0)) {
    return logEntry.sets.reduce((s, st) => s + (parseFloat(st.reps)||0) * (parseFloat(st.weight)||0), 0);
  }
  return logEntry.totalValue || 0;
}
function computeProgressiveOverload(operatorId, logs) {
  const opLogs = logs.filter(l => l.operatorId === operatorId && l.type === 'protocol');
  if (opLogs.length === 0) return null;
  const today = todayStr();
  const recentCutoff = new Date(); recentCutoff.setDate(recentCutoff.getDate() - 29);
  const priorCutoff = new Date(); priorCutoff.setDate(priorCutoff.getDate() - 59);
  const recentStart = todayStr(recentCutoff), priorStart = todayStr(priorCutoff);

  const byExercise = {};
  opLogs.forEach(l => { (byExercise[l.exercise] = byExercise[l.exercise] || []).push(l); });

  const changes = [];
  Object.keys(byExercise).forEach(exName => {
    const entries = byExercise[exName];
    const recent = entries.filter(l => l.date >= recentStart && l.date <= today);
    const prior = entries.filter(l => l.date >= priorStart && l.date < recentStart);
    if (recent.length === 0 || prior.length === 0) return; // needs data in both windows
    const recentAvg = recent.reduce((s,l)=>s+sessionVolume(l),0) / recent.length;
    const priorAvg = prior.reduce((s,l)=>s+sessionVolume(l),0) / prior.length;
    if (priorAvg > 0) changes.push(((recentAvg - priorAvg) / priorAvg) * 100);
  });
  if (changes.length === 0) return null;
  const avgChange = changes.reduce((a,b)=>a+b,0) / changes.length;
  const score = Math.max(0, Math.min(100, 50 + avgChange * 3));
  return { score: Math.round(score), avgChange: Math.round(avgChange*10)/10, exerciseCount: changes.length };
}

function computeStreak(operatorId, logs) {
  const days = new Set(logs.filter(l=>l.operatorId===operatorId).map(l=>l.date));
  let streak = 0; let cursor = new Date();
  if (!days.has(todayStr())) cursor.setDate(cursor.getDate()-1);
  while (days.has(todayStr(cursor))) { streak++; cursor.setDate(cursor.getDate()-1); }
  return streak;
}

const MUSCLE_GROUPS_LIST = ['Chest','Back','Shoulders','Biceps','Triceps','Quadriceps','Hamstrings','Glutes','Calves','Core','Grip','Cardio'];
const NAV_STRUCTURE = [
  { type:'item', key:'command', label:'Command Center' },
  { type:'item', key:'log', label:'Log Activity' },
  { type:'item', key:'comms', label:'Comms' },
  { type:'group', key:'operations', label:'Operations', items:[
    { key:'campaigns', label:'Campaigns' },
    { key:'galaxy', label:'Galaxy Map' },
    { key:'squad', label:'Squad' },
    { key:'aar', label:'AAR Log' },
  ]},
  { type:'group', key:'personal', label:'Personal', items:[
    { key:'myprotocols', label:'My Protocols' },
    { key:'habits', label:'Habits' },
    { key:'dossier', label:'My Dossier' },
    { key:'roster', label:'Roster' },
  ]},
  { type:'item', key:'codex', label:'Codex' },
  { type:'item', key:'admin', label:'Admin Panel', adminOnly:true },
];
function navGroupForTab(tabKey) {
  const g = NAV_STRUCTURE.find(n => n.type==='group' && n.items.some(i=>i.key===tabKey));
  return g ? g.key : null;
}
function computeMuscleFatigue(operatorId, logs) {
  const opLogs = logs.filter(l => l.operatorId === operatorId && l.type === 'protocol');
  return MUSCLE_GROUPS_LIST.map(mg => {
    const relevant = opLogs.filter(l => l.category === mg);
    if (relevant.length === 0) return { muscleGroup: mg, daysSince: null, status: 'Untrained' };
    const lastDate = relevant.reduce((max,l) => l.date > max ? l.date : max, relevant[0].date);
    const daysSince = daysBetween(lastDate, todayStr());
    let status;
    if (daysSince <= 1) status = 'Fatigued';
    else if (daysSince <= 3) status = 'Recovering';
    else if (daysSince <= 6) status = 'Fresh';
    else status = 'Neglected';
    return { muscleGroup: mg, daysSince: daysSince, status: status };
  });
}
function fatigueColor(status) {
  if (status==='Fatigued') return 'var(--threat)';
  if (status==='Recovering') return 'var(--amber)';
  if (status==='Fresh') return 'var(--success)';
  return 'var(--text-dim)';
}

function computeORS(operatorId, operator, logs) {
  const opLogs = logs.filter(l => l.operatorId === operatorId);
  const firstLogDate = opLogs.length ? opLogs.reduce((min,l) => l.date < min ? l.date : min, opLogs[0].date) : todayStr();
  const windowDays = Math.min(30, Math.max(1, daysBetween(firstLogDate, todayStr()) + 1));
  const uniqueDaysWithLog = new Set(opLogs.map(l => l.date)).size;
  const protocolSessionDays = new Set(opLogs.filter(l => l.type === 'protocol').map(l => l.date)).size;
  const scheduledSessions = (operator.weeklyTarget / 7) * windowDays;
  const protocolCompletionRate = scheduledSessions > 0 ? Math.min(100, (protocolSessionDays / scheduledSessions) * 100) : 0;
  const aarSubmissionRate = Math.min(100, (uniqueDaysWithLog / windowDays) * 100);
  const baselineImp = computeBaselineImprovement(operator);
  const overload = computeProgressiveOverload(operatorId, logs);

  // Physical Capability is itself a weighted blend of available sub-components:
  // consistency (always available), progressive overload (auto, once there's
  // enough logged history), and periodic baseline retest (manual, optional).
  const physComponents = [
    { weight: 0.50, value: protocolCompletionRate, available: true },
    { weight: 0.30, value: overload ? overload.score : null, available: !!overload },
    { weight: 0.20, value: baselineImp ? baselineImp.score : null, available: !!baselineImp },
  ];
  const physWeightSum = physComponents.filter(c=>c.available).reduce((s,c)=>s+c.weight,0);
  let physicalVal = 0;
  physComponents.forEach(c => { if (c.available) physicalVal += (c.weight/physWeightSum) * c.value; });

  const activeHabits = (operator.habits || []).filter(h => h.active);
  let personalDevVal = null;
  if (activeHabits.length > 0) {
    const habitLogs = opLogs.filter(l => l.type === 'habit');
    const possibleCheckins = activeHabits.length * windowDays;
    personalDevVal = possibleCheckins > 0 ? Math.min(100, (habitLogs.length / possibleCheckins) * 100) : 0;
  }
  // Squad Contribution used to just be a mislabeled copy of your own Campaign
  // logging rate — nothing about it was actually squad-related, and a
  // completely solo operator scored the same as an engaged squad member.
  // Now it's gated on actually being in a squad (mirrors how Personal
  // Development is gated on having an active habit — solo operators simply
  // don't have this slice, and ORS weight redistributes across the rest, so
  // opting out of squads is never penalized), and measures real shared-
  // objective participation: days you contributed to a Campaign or an active
  // Raid. Duels are deliberately left out here — their progress is computed
  // live from ordinary protocol logs with no dedicated log type, so there's
  // no clean way to attribute a specific day to Duel participation without a
  // much bigger change to what computeORS has access to.
  const inSquad = !!operator.squadId;
  let squadVal = null;
  if (inSquad) {
    const squadLogs = opLogs.filter(l => l.type === 'campaign' || l.type === 'raid');
    const uniqueSquadDays = new Set(squadLogs.map(l => l.date)).size;
    squadVal = Math.min(100, (uniqueSquadDays / windowDays) * 100);
  }
  const components = [
    { key:'physical', weight:0.30, value: physicalVal, available: true },
    { key:'discipline', weight:0.30, value: aarSubmissionRate, available: true },
    { key:'personalDev', weight:0.20, value: personalDevVal, available: personalDevVal !== null },
    { key:'squad', weight:0.20, value: squadVal, available: squadVal !== null },
  ];
  const availWeightSum = components.filter(c=>c.available).reduce((s,c)=>s+c.weight,0);
  let ors = 0;
  components.forEach(c => { if (c.available) ors += (c.weight/availWeightSum) * c.value; });
  ors = Math.round(ors);
  return { ors: ors, physical: Math.round(physicalVal), discipline: Math.round(aarSubmissionRate),
    squad: squadVal!==null?Math.round(squadVal):null, personalDev: personalDevVal!==null?Math.round(personalDevVal):null,
    windowDays: windowDays, baselineImp: baselineImp, overload: overload };
}

function nonCampaignMCP(operatorId, logs) {
  const opLogs = logs.filter(l => l.operatorId === operatorId && l.type === 'protocol');
  return new Set(opLogs.map(l => l.date)).size * 10;
}
function computeMCP(operatorId, campaigns, logs) {
  const opLogs = logs.filter(l => l.operatorId === operatorId);
  const protocolDays = new Set(opLogs.filter(l=>l.type==='protocol').map(l=>l.date)).size;
  const campaignEntries = opLogs.filter(l=>l.type==='campaign').length;
  let mcp = protocolDays*10 + campaignEntries*5;
  campaigns.forEach(camp => { if (camp.resolved === 'success' && opLogs.some(l => l.type==='campaign' && l.campaignId===camp.id)) mcp += 50; });
  return mcp;
}

// ---------- Leaderboard Seasons ----------
function computeCurrentSeason(seasons) {
  const today = todayStr();
  return (seasons||[]).find(s => today >= s.startDate && today <= s.endDate) || null;
}

// Readiness status now weighs BOTH the gap since your last log AND your rolling logging
// frequency — sparse-but-technically-recent logging will decay status, not just full inactivity.
const STATUS_TIERS = [
  {label:'Active', cls:'status-active'}, {label:'Alert', cls:'status-alert'},
  {label:'Standby', cls:'status-standby'}, {label:'Reserve', cls:'status-reserve'}, {label:'Deep Reserve', cls:'status-deep'},
];
function computeReadinessStatus(operatorId, logs) {
  const opLogs = logs.filter(l => l.operatorId === operatorId);
  if (opLogs.length === 0) return Object.assign({days:0}, STATUS_TIERS[0]);
  const lastDate = opLogs.reduce((max,l) => l.date > max ? l.date : max, opLogs[0].date);
  const gapDays = daysBetween(lastDate, todayStr());
  const gapTierIdx = gapDays<=7?0:gapDays<=14?1:gapDays<=30?2:gapDays<=60?3:4;

  const firstLogDate = opLogs.reduce((min,l) => l.date < min ? l.date : min, opLogs[0].date);
  const historyDays = daysBetween(firstLogDate, todayStr()) + 1;
  let rateTierIdx = 0;
  if (historyDays >= 7) {
    const rateWindow = Math.min(14, historyDays);
    const cutoffStr = daysAgoStr(rateWindow - 1);
    const uniqueDays = new Set(opLogs.filter(l => l.date >= cutoffStr).map(l => l.date)).size;
    const rate = uniqueDays / rateWindow;
    rateTierIdx = rate>=0.5?0:rate>=0.3?1:rate>=0.15?2:rate>0?3:4;
  }
  const finalIdx = Math.max(gapTierIdx, rateTierIdx);
  return Object.assign({days: gapDays}, STATUS_TIERS[finalIdx]);
}

// Rank now requires ORS + lifetime Days Active + Campaigns Completed, checked top-down.
function operatorRankStats(operatorId, logs, campaigns) {
  const opLogs = logs.filter(l => l.operatorId === operatorId);
  const daysActive = new Set(opLogs.map(l => l.date)).size;
  const campaignsCompleted = campaigns.filter(c => c.resolved === 'success' && opLogs.some(l => l.type === 'campaign' && l.campaignId === c.id)).length;
  return { daysActive, campaignsCompleted };
}
function computeRank(ors, operatorId, logs, campaigns, status) {
  const stats = operatorRankStats(operatorId, logs, campaigns);
  for (let i = EARNABLE_RANK_ORDER.length - 1; i >= 0; i--) {
    const rank = EARNABLE_RANK_ORDER[i];
    const tiers = RANK_TIER_REQUIREMENTS[rank];
    for (let t = 2; t >= 0; t--) {
      const req = tiers[t];
      if (status.label === 'Active' && ors >= req.ors && stats.daysActive >= req.daysActive && stats.campaignsCompleted >= req.campaigns) return rank;
    }
  }
  return 'Recruit';
}
// Which of the 3 tiers within the current rank an operator has actually reached.
function computeRankTier(rank, ors, operatorId, logs, campaigns) {
  const tiers = RANK_TIER_REQUIREMENTS[rank];
  if (!tiers) return 1;
  const stats = operatorRankStats(operatorId, logs, campaigns);
  for (let t = 2; t >= 0; t--) {
    const req = tiers[t];
    if (ors >= req.ors && stats.daysActive >= req.daysActive && stats.campaignsCompleted >= req.campaigns) return t + 1;
  }
  return 1;
}
function nextRankInfo(currentRank, currentTier, ors, operatorId, logs, campaigns, status) {
  let nextRank, nextTier;
  if (currentTier < 3) { nextRank = currentRank; nextTier = currentTier + 1; }
  else {
    const idx = EARNABLE_RANK_ORDER.indexOf(currentRank);
    if (idx === -1 || idx === EARNABLE_RANK_ORDER.length - 1) return null; // Vanguard Tier 3 is the top of the earnable track
    nextRank = EARNABLE_RANK_ORDER[idx+1]; nextTier = 1;
  }
  const req = RANK_TIER_REQUIREMENTS[nextRank][nextTier-1];
  const stats = operatorRankStats(operatorId, logs, campaigns);
  const eligible = status.label === 'Active' && ors >= req.ors && stats.daysActive >= req.daysActive && stats.campaignsCompleted >= req.campaigns;
  return { next: nextRank, nextTier: nextTier, req: req, stats: stats, eligible: eligible };
}
// Parallel Command track — completely independent of the Operator rank above.
// Driven by continuous tenure-in-role (days since admin_since/moderator_since),
// not ORS. Admin takes precedence over Moderator if an operator somehow has both.
function computeCommandRank(operator, ors, operatorId, logs, campaigns, status) {
  if (!operator.isAdmin && !operator.isModerator) return null;
  const track = operator.isAdmin ? 'Command Staff' : 'Jr Command Staff';
  const ranks = operator.isAdmin ? COMMAND_RANKS : JR_COMMAND_RANKS;
  // Deliberately reuses computeRank/computeRankTier directly — same ORS/Days
  // Active/Campaigns thresholds, same Active-status gate, same everything.
  // The Command rank is just the Operator rank's tier index relabeled with
  // NCO/Officer names, so the two tracks can never drift out of sync.
  const operatorRank = computeRank(ors, operatorId, logs, campaigns, status);
  const operatorTier = computeRankTier(operatorRank, ors, operatorId, logs, campaigns);
  const idx = EARNABLE_RANK_ORDER.indexOf(operatorRank);
  return { track: track, rank: ranks[idx], tier: operatorTier };
}
function dailyQuip(seed, quips) { if (!quips || quips.length===0) return ''; return quips[Math.abs(seed) % quips.length].text; }

// ---------- Daily Challenge — same deterministic per-day selection as quips ----------
function dailyChallenge(pool, dateSeed) {
  if (!pool || pool.length===0) return null;
  return pool[Math.abs(dateSeed) % pool.length];
}
function computeChallengeProgress(operatorId, challenge, logs) {
  if (!challenge) return { total: 0, target: 0, pct: 0 };
  const today = todayStr();
  const total = logs.filter(l => l.operatorId===operatorId && l.type==='protocol' && l.category===challenge.muscleGroup && l.date===today)
    .reduce((s,l) => s + (l.totalValue||0), 0);
  const pct = challenge.target > 0 ? Math.min(100, (total/challenge.target)*100) : 0;
  return { total: Math.round(total*10)/10, target: challenge.target, pct: pct };
}
function hashStr(s) { let h=0; for (let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i))|0; } return h; }
const TIER_ROMAN = ['I','II','III'];
function rankDisplay(rank, tier) {
  if (rank === 'Command Staff' || rank === 'Jr Command Staff') return rank;
  return rank + ' ' + (TIER_ROMAN[tier-1] || 'I');
}
function commandRankDisplay(cmdInfo) {
  if (!cmdInfo) return null;
  return cmdInfo.rank + ' ' + (TIER_ROMAN[cmdInfo.tier-1] || 'I');
}

// Automated warnings/nudges — computed fresh each render from live data, not stored content.
// Each entry: {id, severity: 'info'|'warning'|'urgent', text}
function computeNotifications(op, orsData, status, deployedCampaign, campaigns, logs) {
  const notes = [];

  // Inactivity — tone escalates with how far status has decayed.
  if (status.label === 'Alert') {
    notes.push({ id:'inactive', severity:'warning', text: `Command hasn't seen you in ${status.days} days. Log something today to get back to Active.` });
  } else if (status.label === 'Standby' || status.label === 'Reserve' || status.label === 'Deep Reserve') {
    notes.push({ id:'inactive', severity:'urgent', text: `${status.days} days since your last log, Operator. You're at ${status.label} — rank-ups are on hold until you're Active again. Career progress is safe, but Command needs to see you.` });
  } else {
    // Active, but about to tip into Alert tomorrow if nothing gets logged today.
    const opLogs = logs.filter(l => l.operatorId === op.id);
    if (opLogs.length > 0) {
      const lastDate = opLogs.reduce((max,l) => l.date > max ? l.date : max, opLogs[0].date);
      const gap = daysBetween(lastDate, todayStr());
      if (gap === 7) notes.push({ id:'streak-risk', severity:'info', text: `One more day and your status tips to Alert. Log something today to stay Active.` });
    }
  }

  // Near rank-up — nudges only when genuinely close on every axis, not just ORS.
  const rank = computeRank(orsData.ors, op.id, logs, campaigns, status);
  const rankTier = computeRankTier(rank, orsData.ors, op.id, logs, campaigns);
  const nri = nextRankInfo(rank, rankTier, orsData.ors, op.id, logs, campaigns, status);
  if (nri && !nri.eligible) {
    const orsGap = nri.req.ors - orsData.ors;
    const daysRatio = nri.req.daysActive > 0 ? nri.stats.daysActive / nri.req.daysActive : 1;
    const campaignsOk = nri.stats.campaignsCompleted >= nri.req.campaigns;
    if (orsGap <= 10 && orsGap > 0 && daysRatio >= 0.7 && campaignsOk && status.label === 'Active') {
      notes.push({ id:'near-rank', severity:'info', text: `${orsGap} ORS from ${nri.next}. You're close, Operator.` });
    }
  }

  // Campaign deadline — only fires if genuinely deployed and time is short.
  if (deployedCampaign && campaignPhase(deployedCampaign) === 'active') {
    const daysLeft = deployedCampaign.durationDays - daysBetween(deployedCampaign.startDate, todayStr());
    const pct = computePlanetControl(computeLocationProgress(deployedCampaign, logs));
    if (daysLeft <= 5 && daysLeft >= 0 && pct < 100) {
      notes.push({ id:'campaign-deadline', severity: daysLeft<=2?'urgent':'warning', text: `${daysLeft} day${daysLeft===1?'':'s'} left on ${deployedCampaign.name}. Control at ${Math.round(pct)}%.` });
    }
  }

  return notes;
}

function Gauge(props) {
  const pct = props.pct;
  const deg = Math.round((pct/100)*360);
  return React.createElement('div', {className:'gauge', style:{background:'conic-gradient(var(--amber) '+deg+'deg, var(--panel-alt) '+deg+'deg)'}},
    React.createElement('div', {className:'gauge-inner'},
      React.createElement('div', {className:'gauge-pct'}, Math.round(pct)+'%'),
      React.createElement('div', {className:'gauge-label'}, 'Control')
    )
  );
}
function SubBar(props) {
  return (
    <div className="sub-bar-row">
      <div className="sub-bar-label">{props.label}</div>
      <div className="sub-bar-track"><div className="sub-bar-fill" style={{width: (props.val||0)+'%'}}></div></div>
      <div className="sub-bar-val">{props.val===null?'—':props.val}</div>
    </div>
  );
}
function Avatar(props) {
  const op = props.op; const s = props.size || 52;
  if (op.avatarUrl) {
    return <img src={op.avatarUrl} alt={op.callsign} className="avatar" style={{width:s,height:s,objectFit:'cover',background:op.avatarColor}} />;
  }
  return <div className="avatar" style={{width:s,height:s,fontSize:s*0.38,background:op.avatarColor}}>{op.callsign.charAt(0)}</div>;
}

// ---------- Rank Insignia (chevron progression, matching the reference art) ----------
// NCO (Warden Corps / Jr Command Staff) and Officer (Command Corps / Command
// Staff) tracks get their own dedicated insignia, approximating the reference
// art's escalating motifs — skull count + chevron stripes for NCO, bars then
// an eagle for Officer — until real uploaded artwork replaces these.
const NCO_RANK_ICONS = {
  'Lance': {skulls:1, chevrons:1}, 'Sergeant': {skulls:1, chevrons:2},
  'Spear Sergeant': {skulls:2, chevrons:2}, 'War Sergeant': {skulls:2, chevrons:3},
  'Warden': {skulls:3, chevrons:3},
};
const OFFICER_RANK_ICONS = {
  'Lieutenant': {bars:1, eagle:null}, 'First Lieutenant': {bars:2, eagle:null},
  'Captain': {bars:0, eagle:'small'}, 'Commander': {bars:0, eagle:'bold'},
  'Senior Commander': {bars:0, eagle:'radiant'},
};
function RankInsignia({ rank, tier, size }) {
  const s = size || 64;
  const dots = tier || 1;

  if (NCO_RANK_ICONS[rank]) {
    const { skulls, chevrons } = NCO_RANK_ICONS[rank];
    const color = '#7CA9E8';
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <svg width={s} height={s} viewBox="0 0 64 64">
          <polygon points="32,58 6,50 6,20 32,6 58,20 58,50" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
          {Array.from({length: skulls}).map((_, i) => {
            const x = 32 - ((skulls-1)*11)/2 + i*11;
            return (
              <g key={i} transform={"translate("+x+",18)"}>
                <circle r="4.5" fill={color} />
                <circle cx="-1.6" cy="-0.5" r="0.9" fill="#05070d" />
                <circle cx="1.6" cy="-0.5" r="0.9" fill="#05070d" />
              </g>
            );
          })}
          {Array.from({length: chevrons}).map((_, i) => (
            <path key={i} d={"M18 "+(40-i*7)+" L32 "+(32-i*7)+" L46 "+(40-i*7)} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
          ))}
          <g stroke={color} strokeWidth="2" fill="none">
            <path d="M8 34 L2 40 L8 46" />
            <path d="M56 34 L62 40 L56 46" />
          </g>
        </svg>
        <div style={{display:'flex',gap:3}}>
          {[1,2,3].map(d => <div key={d} style={{width:5,height:5,borderRadius:'50%',background: d<=dots ? color : 'var(--border)'}}></div>)}
        </div>
      </div>
    );
  }

  if (OFFICER_RANK_ICONS[rank]) {
    const { bars, eagle } = OFFICER_RANK_ICONS[rank];
    const color = '#F2C94C';
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <svg width={s} height={s} viewBox="0 0 64 64">
          <polygon points="32,58 6,50 6,20 32,6 58,20 58,50" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
          {bars > 0 && Array.from({length: bars}).map((_,i) => <rect key={i} x="22" y={13+i*7} width="20" height="3.5" rx="1" fill={color} />)}
          {eagle && (
            <g opacity={eagle==='small' ? 0.75 : 1}>
              <path d="M10,17 L20,11 L32,19 L44,11 L54,17 L44,22 L32,16 L20,22 Z" fill={color} />
              {eagle==='radiant' && (
                <g stroke={color} strokeWidth="1" opacity="0.45">
                  {[20,70,110,160].map(a => <line key={a} x1="32" y1="16" x2={32+22*Math.cos(a*Math.PI/180)} y2={16+22*Math.sin(a*Math.PI/180)} />)}
                </g>
              )}
            </g>
          )}
          <path d="M18 40 L32 32 L46 40 L40 40 L32 35 L24 40 Z" fill={color} opacity="0.85" />
          <g stroke={color} strokeWidth="2" fill="none">
            <path d="M8 34 L2 40 L8 46" />
            <path d="M56 34 L62 40 L56 46" />
          </g>
        </svg>
        <div style={{display:'flex',gap:3}}>
          {[1,2,3].map(d => (
            <svg key={d} width="9" height="9" viewBox="0 0 24 24">
              <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill={d<=dots ? color : 'var(--border)'} />
            </svg>
          ))}
        </div>
      </div>
    );
  }

  // Operator track — unchanged
  const color = rank === 'Vanguard' ? '#F2C94C' : rank === 'Specialist' ? '#E8E6DD'
    : rank === 'Senior Operator' ? '#C9CDD6' : rank === 'Operator' ? '#A9AEB8' : '#8A93A6';
  const hasBrackets = ['Operator','Senior Operator','Specialist','Vanguard'].includes(rank);
  const hasCircle = ['Senior Operator','Specialist','Vanguard'].includes(rank);
  const hasDiamond = ['Specialist','Vanguard'].includes(rank);

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={s} height={s} viewBox="0 0 64 64">
        <path d="M14 40 L32 24 L50 40 L44 40 L32 32 L20 40 Z" fill={color} stroke={color} strokeWidth="1.5" />
        {hasBrackets && (
          <g stroke={color} strokeWidth="2" fill="none">
            <path d="M10 34 L4 40 L10 46" />
            <path d="M54 34 L60 40 L54 46" />
          </g>
        )}
        {hasCircle && !hasDiamond && (
          <circle cx="32" cy="18" r="4" fill="none" stroke={color} strokeWidth="2" />
        )}
        {hasDiamond && (
          <rect x="28" y="12" width="8" height="8" fill={color} transform="rotate(45 32 16)" />
        )}
      </svg>
      <div style={{display:'flex',gap:3}}>
        {[1,2,3].map(d => <div key={d} style={{width:5,height:5,borderRadius:'50%',background: d<=dots ? color : 'var(--border)'}}></div>)}
      </div>
    </div>
  );
}

// ---------- Specialist Armband icons ----------
const SPECIALTY_ICONS = {
  'Heavy Assault': (color) => <path d="M32 10 L38 20 L38 46 L26 46 L26 20 Z" fill={color} />,
  'Recon': (color) => (
    <g stroke={color} strokeWidth="2" fill="none">
      <circle cx="32" cy="32" r="14" />
      <line x1="32" y1="12" x2="32" y2="20" />
      <line x1="32" y1="44" x2="32" y2="52" />
      <line x1="12" y1="32" x2="20" y2="32" />
      <line x1="44" y1="32" x2="52" y2="32" />
      <circle cx="32" cy="32" r="3" fill={color} />
    </g>
  ),
  'Guardian': (color) => <path d="M32 10 L48 16 L48 30 Q48 44 32 52 Q16 44 16 30 L16 16 Z" fill="none" stroke={color} strokeWidth="2.5" />,
  'Demolitions Expert': (color) => <polygon points="32,8 37,24 52,20 40,32 52,44 37,40 32,56 27,40 12,44 24,32 12,20 27,24" fill={color} />,
  'Tactical Operator': (color) => (
    <g fill={color}>
      <polygon points="32,8 36,34 28,34" />
      <rect x="22" y="34" width="20" height="3" />
      <rect x="30" y="37" width="4" height="14" />
      <circle cx="32" cy="53" r="3" />
    </g>
  ),
};
// ---------- Award Ribbons (start of the ribbon/medal system) ----------
// Placeholder visuals for every Award family — real military ribbon-bar
// styling (base color + accent stripes), with tier magnitude shown as a
// small numeral badge so open-ended families (Service Strips) scale
// cleanly without needing a distinct icon per possible tier.
function parseAwardFamily(awardType) {
  if (!awardType) return { family: 'unknown', tier: null };
  if (awardType.startsWith('rank_')) return { family: 'rank', tier: null };
  if (awardType.startsWith('campaign_')) return { family: 'campaign', tier: null };
  if (awardType.startsWith('raid_')) return { family: 'raid', tier: null };
  if (awardType.startsWith('duel_')) return { family: 'duel', tier: null };
  if (awardType.startsWith('pr_')) return { family: 'pr', tier: null };
  if (awardType.startsWith('streak_')) return { family: 'streak', tier: Number(awardType.split('_')[1]) };
  if (awardType.startsWith('service_strip_')) return { family: 'service_strip', tier: Number(awardType.split('_')[2]) };
  if (awardType.startsWith('challenges_')) return { family: 'challenges', tier: Number(awardType.split('_')[1]) };
  if (awardType.startsWith('cheers_given_')) return { family: 'cheers', tier: Number(awardType.split('_')[2]) };
  if (awardType === 'first_campaign' || awardType === 'first_squad' || awardType === 'first_specialization') return { family: 'milestone', tier: null };
  return { family: 'unknown', tier: null };
}
const AWARD_FAMILY_STYLES = {
  rank:             { color:'#F2C94C', secondary:'#8a6d1f' },
  campaign:         { color:'#39FF14', secondary:'#1a7a0a' },
  raid:             { color:'#E8453C', secondary:'#7a1f1a' },
  duel:             { color:'#5DA9E8', secondary:'#1f4a7a' },
  pr:               { color:'#F2994A', secondary:'#7a4a1f' },
  streak:           { color:'#B57EDC', secondary:'#5a3a7a' },
  service_strip:    { color:'#C9CDD6', secondary:'#5a5f6a' },
  challenges:       { color:'#4ECDC4', secondary:'#1f6a63' },
  cheers:           { color:'#FF6B9D', secondary:'#7a1f47' },
  milestone:        { color:'#E8E6DD', secondary:'#6a6f68' },
  unknown:          { color:'#8A9080', secondary:'#3a3f38' },
};
function AwardRibbon({ awardType, size }) {
  const s = size || 44;
  const h = s * 0.55;
  const { family, tier } = parseAwardFamily(awardType);
  const style = AWARD_FAMILY_STYLES[family] || AWARD_FAMILY_STYLES.unknown;
  return (
    <div style={{position:'relative', width:s, height:h, flexShrink:0}}>
      <svg width={s} height={h} viewBox="0 0 100 55" style={{display:'block'}}>
        <rect x="0" y="0" width="100" height="55" fill={style.color} />
        <rect x="0" y="0" width="100" height="9" fill={style.secondary} />
        <rect x="0" y="46" width="100" height="9" fill={style.secondary} />
        <rect x="46" y="0" width="8" height="55" fill={style.secondary} opacity="0.6" />
      </svg>
      {tier ? (
        <div style={{position:'absolute',bottom:-3,right:-3,background:'#05070d',color:style.color,fontSize:9,lineHeight:1,fontFamily:"'IBM Plex Mono',monospace",padding:'1px 4px',borderRadius:2,border:'1px solid '+style.color}}>{tier}</div>
      ) : null}
    </div>
  );
}

// ---------- Codex icon references ----------
// A Codex entry can reference one or more real badge components via a simple
// spec string, e.g. "rank:Operator:2,rank:Vanguard:3" or "specialty:Recon" or
// "award:rank_Vanguard,award:streak_30". These are the SAME components used
// live elsewhere in the app (Dossier, Command Center) — genuine reference
// images that can never drift out of sync with what people actually see,
// rather than separate static art that needs to be kept in sync by hand.
function CodexIconRow({ iconRef, size }) {
  if (!iconRef) return null;
  const specs = iconRef.split(',').map(s=>s.trim()).filter(Boolean);
  if (specs.length === 0) return null;
  const s = size || 44;
  return (
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:10}}>
      {specs.map((spec, i) => {
        const parts = spec.split(':');
        const type = parts[0];
        if (type === 'rank') return <RankInsignia key={i} rank={parts[1]} tier={Number(parts[2])||1} size={s} />;
        if (type === 'specialty') return <SpecialtyBadge key={i} specialization={parts[1]} size={s} />;
        if (type === 'award') return <AwardRibbon key={i} awardType={parts[1]} size={s} />;
        return null;
      })}
    </div>
  );
}

function SpecialtyBadge({ specialization, size }) {
  const s = size || 56;
  if (!specialization || !SPECIALTY_ICONS[specialization]) return null;
  return (
    <div style={{width:s,height:s,borderRadius:'50%',background:'var(--panel-alt)',border:'2px solid var(--amber-dim)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <svg width={s*0.6} height={s*0.6} viewBox="0 0 64 64">{SPECIALTY_ICONS[specialization]('#2E9E1E')}</svg>
    </div>
  );
}

// ============================================================
// SUPABASE CLIENT + DATA MAPPING LAYER
// Converts between Postgres snake_case rows and the app's existing
// camelCase JS shapes, so every UI component below is unchanged.
// ============================================================
