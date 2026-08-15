const SUPABASE_URL = 'https://owdszpgcfswrcuifbpzv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZHN6cGdjZnN3cmN1aWZicHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMjE0ODQsImV4cCI6MjA5OTg5NzQ4NH0.DKnyhXm6CxLQZkKwvLZJaxaqGriNdcfCJsNZMmutlJY';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function rowToOperator(p, habits) {
  return {
    id: p.id, callsign: p.callsign, realName: p.real_name || '', idNum: p.id_num, joinDate: p.join_date,
    ageDivision: p.age_division, specialization: p.specialization, squad: p.squad, privacy: p.privacy,
    avatarColor: p.avatar_color, avatarUrl: p.avatar_url || null, weeklyTarget: p.weekly_target, isAdmin: p.is_admin, isModerator: !!p.is_moderator, onboarded: p.onboarded,
    baseline: p.baseline, previousBaseline: p.previous_baseline, currentDeploymentId: p.current_deployment_id,
    reinforcementDropsAvailable: p.reinforcement_drops_available, mcpAtLastReinforcement: p.mcp_at_last_reinforcement,
    lastSeenRank: p.last_seen_rank, customProtocols: p.custom_protocols || [], habits: habits || [],
    adminSince: p.admin_since || null, moderatorSince: p.moderator_since || null,
  };
}
const OP_FIELD_MAP = { realName:'real_name', ageDivision:'age_division', specialization:'specialization', squad:'squad',
  privacy:'privacy', avatarColor:'avatar_color', avatarUrl:'avatar_url', weeklyTarget:'weekly_target', isAdmin:'is_admin', isModerator:'is_moderator', onboarded:'onboarded',
  baseline:'baseline', previousBaseline:'previous_baseline', currentDeploymentId:'current_deployment_id',
  reinforcementDropsAvailable:'reinforcement_drops_available', mcpAtLastReinforcement:'mcp_at_last_reinforcement',
  lastSeenRank:'last_seen_rank', customProtocols:'custom_protocols', callsign:'callsign',
  adminSince:'admin_since', moderatorSince:'moderator_since' };
function operatorToRowPatch(patch) {
  const row = {};
  Object.keys(patch).forEach(k => { if (OP_FIELD_MAP[k]) row[OP_FIELD_MAP[k]] = patch[k]; });
  return row;
}

function rowToLocation(l) { return { id: l.id, name: l.name, objective: l.objective, category: l.category, unit: l.unit, manualTarget: l.manual_target, briefing: l.briefing || '' }; }
function rowToCampaign(c, locs) {
  return { id: c.id, name: c.name, threat: c.threat, sector: c.sector, startDate: c.start_date,
    joinWindowDays: c.join_window_days, durationDays: c.duration_days, lockedAt: c.locked_at,
    lockedTargets: c.locked_targets, lockedDeployedCount: c.locked_deployed_count,
    deployedOperatorIds: c.deployed_operator_ids || [], reinforcementsUsed: c.reinforcements_used,
    resolved: c.resolved, lore: c.lore || '', lastMilestoneNotified: c.last_milestone_notified || 0,
    locations: (locs||[]).map(rowToLocation) };
}
const CAMP_FIELD_MAP = { name:'name', threat:'threat', sector:'sector', joinWindowDays:'join_window_days',
  durationDays:'duration_days', lockedAt:'locked_at', lockedTargets:'locked_targets',
  lockedDeployedCount:'locked_deployed_count', deployedOperatorIds:'deployed_operator_ids',
  reinforcementsUsed:'reinforcements_used', resolved:'resolved', lore:'lore', lastMilestoneNotified:'last_milestone_notified' };
function campaignToRowPatch(patch) {
  const row = {};
  Object.keys(patch).forEach(k => { if (CAMP_FIELD_MAP[k]) row[CAMP_FIELD_MAP[k]] = patch[k]; });
  return row;
}

function rowToLog(l) {
  return { id: l.id, operatorId: l.operator_id, type: l.type, date: l.date, timestamp: Number(l.timestamp),
    protocolLabel: l.protocol_label, exercise: l.exercise, variant: l.variant, category: l.category, unit: l.unit,
    sets: l.sets, totalValue: l.total_value !== null ? Number(l.total_value) : null, detail: l.detail,
    campaignId: l.campaign_id, locationId: l.location_id, amount: l.amount !== null ? Number(l.amount) : null,
    source: l.source, sourceExercise: l.source_exercise, habitId: l.habit_id,
    raidInstanceId: l.raid_instance_id, raidAreaId: l.raid_area_id, raidObjectiveId: l.raid_objective_id };
}
function logToRow(l) {
  // Deliberately no `id` field — the app builds client-side ids like 'log_...'
  // for React keys/local dedup, but the DB column is a strict uuid type.
  // Let Postgres's gen_random_uuid() default populate it instead.
  return { operator_id: l.operatorId, type: l.type, date: l.date, timestamp: l.timestamp,
    protocol_label: l.protocolLabel || null, exercise: l.exercise || null, variant: l.variant || null,
    category: l.category || null, unit: l.unit || null, sets: l.sets || null,
    total_value: l.totalValue !== undefined ? l.totalValue : null, detail: l.detail || null,
    campaign_id: l.campaignId || null, location_id: l.locationId || null,
    amount: l.amount !== undefined ? l.amount : null, source: l.source || null,
    source_exercise: l.sourceExercise || null, habit_id: l.habitId || null,
    raid_instance_id: l.raidInstanceId || null, raid_area_id: l.raidAreaId || null, raid_objective_id: l.raidObjectiveId || null };
}
function rowToChat(m) { return { id: m.id, authorId: m.author_id, authorName: m.author_name, isCommand: m.is_command, text: m.text, timestamp: Number(m.timestamp), channel: m.channel || 'main', squadId: m.squad_id || null }; }
function chatToRow(m) {
  // Same fix as logToRow — no client-generated id, let Postgres assign a real uuid.
  return { author_id: m.authorId, author_name: m.authorName, is_command: m.isCommand, text: m.text, timestamp: m.timestamp, channel: m.channel || 'main', squad_id: m.squadId || null };
}
function rowToHabit(h) { return { id: h.id, name: h.name, active: h.active, createdDate: h.created_date }; }
function rowToCodex(c) { return { id: c.id, category: c.category, title: c.title, body: c.body }; }
function rowToQuip(q) { return { id: q.id, text: q.text }; }
function rowToAward(a) { return { id: a.id, operatorId: a.operator_id, awardType: a.award_type, title: a.title, description: a.description, awardedAt: a.awarded_at }; }
function rowToPR(p) { return { id: p.id, operatorId: p.operator_id, exercise: p.exercise, value: Number(p.value), unit: p.unit, achievedAt: p.achieved_at }; }
function rowToRaidObjective(o) { return { id: o.id, raidAreaId: o.raid_area_id, name: o.name, muscleGroup: o.muscle_group, unit: o.unit, target: Number(o.target) }; }
function rowToRaidArea(a, objectives) { return { id: a.id, raidTemplateId: a.raid_template_id, areaOrder: a.area_order, name: a.name, objectives: (objectives||[]).map(rowToRaidObjective) }; }
function rowToRaidTemplate(t, areas) {
  const sortedAreas = (areas||[]).sort((a,b)=>a.areaOrder-b.areaOrder);
  return { id: t.id, name: t.name, bossName: t.boss_name, bossFlavor: t.boss_flavor, areas: sortedAreas };
}
function rowToRaidInstance(i) { return { id: i.id, raidTemplateId: i.raid_template_id, squadId: i.squad_id, currentAreaIndex: i.current_area_index, status: i.status, startedAt: i.started_at, completedAt: i.completed_at }; }
function rowToSquad(s, members) { return { id: s.id, name: s.name, createdAt: s.created_at, members: (members||[]).map(rowToSquadMember) }; }
function rowToSquadMember(m) { return { operatorId: m.operator_id, role: m.role, joinedAt: m.joined_at }; }
function rowToExercise(e) { return { id: e.id, name: e.name, muscleGroup: e.muscle_group, unit: e.unit, alternatives: e.alternatives || [], secondaryMuscleGroups: e.secondary_muscle_groups || [] }; }
function exerciseToRow(e) { return { name: e.name, muscle_group: e.muscleGroup, unit: e.unit, alternatives: e.alternatives || [], secondary_muscle_groups: e.secondaryMuscleGroups || [] }; }
function rowToProtocolSession(s) {
  return { id: s.id, protocol: s.protocol, name: s.name, briefing: s.briefing, trainingNote: s.training_note,
    conditioningOptions: s.conditioning_options || [], requiresSpecialization: s.requires_specialization, objectives: s.objectives || [] };
}
function protocolSessionToRow(s) {
  return { id: s.id, protocol: s.protocol, name: s.name, briefing: s.briefing || null, training_note: s.trainingNote || null,
    conditioning_options: s.conditioningOptions || [], requires_specialization: s.requiresSpecialization || null, objectives: s.objectives || [] };
}

async function seedDefaultCampaign() {
  const seed = DEFAULT_CAMPAIGN_SEED;
  const { data: camp, error: e1 } = await sb.from('campaigns').insert({
    name: seed.name, threat: seed.threat, sector: seed.sector, start_date: todayStr(),
    join_window_days: seed.joinWindowDays, duration_days: seed.durationDays,
  }).select().single();
  if (e1) { console.error(e1); return null; }
  const locRows = seed.locations.map(l => ({ campaign_id: camp.id, name: l.name, objective: l.objective, category: l.category, unit: l.unit, manual_target: l.manualTarget }));
  const { data: locs } = await sb.from('locations').insert(locRows).select();
  return rowToCampaign(camp, locs);
}

// ============================================================
// AUTH-BASED LOGIN (replaces the PIN roster)
// ============================================================
function Login({ onAuthed }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [callsign, setCallsign] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(false);

  async function signIn() {
    setError(''); setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else onAuthed();
  }
  async function signUp() {
    setError(''); setBusy(true);
    if (!callsign.trim()) { setError('Callsign is required.'); setBusy(false); return; }
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { callsign: callsign.trim().toUpperCase() } } });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data.session) onAuthed();
    else setConfirmNotice(true);
  }

  if (confirmNotice) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="panel">
            <div className="disp" style={{fontSize:18,marginBottom:12}}>Check Your Email</div>
            <div style={{fontSize:13,lineHeight:1.7,color:'var(--text-dim)'}}>Command sent a confirmation link to <strong>{email}</strong>. Confirm your address, then come back and sign in.</div>
            <button className="ghost" style={{marginTop:16,width:'100%'}} onClick={()=>{setConfirmNotice(false); setMode('signin');}}>Back to Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="disp login-title">Vanguard // Personnel Terminal</div>
        <div className="login-sub">United Earth Alliance — Access Required</div>
        <div className="panel">
          <div className="radio-group" style={{marginBottom:16}}>
            <div className={"radio-opt"+(mode==='signin'?' sel':'')} onClick={()=>{setMode('signin'); setError('');}}>Sign In</div>
            <div className={"radio-opt"+(mode==='signup'?' sel':'')} onClick={()=>{setMode('signup'); setError('');}}>New Operator</div>
          </div>
          <div className="field"><label>Email</label><input type="text" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          {mode==='signup' && <div className="field"><label>Callsign</label><input type="text" value={callsign} onChange={e=>setCallsign(e.target.value)} placeholder="e.g. Iron Wolf" /></div>}
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          {error && <div className="threat" style={{fontSize:12,marginBottom:12}}>{error}</div>}
          <button className="primary" style={{width:'100%'}} disabled={busy} onClick={mode==='signin'?signIn:signUp}>
            {busy ? 'Working...' : (mode==='signin' ? 'Access Terminal' : 'Enroll')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Onboarding({ op, onComplete }) {
  const [step, setStep] = useState('oath');
  const [pushups, setPushups] = useState('');
  const [pullups, setPullups] = useState('');
  const [squats, setSquats] = useState('');
  const [plank, setPlank] = useState('');
  const [runMinutes, setRunMinutes] = useState('');
  function finishAssessment() {
    const pu = parseFloat(pushups)||0, pl = parseFloat(pullups)||0, sq = parseFloat(squats)||0, pk = parseFloat(plank)||0;
    let pts = 0;
    pts += pu>=41?4:pu>=26?3:pu>=11?2:pu>=1?1:0;
    pts += pl>=13?4:pl>=8?3:pl>=3?2:pl>=0?1:0;
    pts += pk>=180?4:pk>=120?3:pk>=60?2:pk>0?1:0;
    let tier = pts>=15?'Peak Tier':pts>=12?'Advanced Tier':pts>=8?'Development Tier':'Foundation Tier';
    onComplete(Object.assign({}, op, { onboarded: true,
      baseline: { pushups: pu, pullups: pl, squats: sq, plankSeconds: pk, runMinutes: parseFloat(runMinutes)||0, score: pts, tier: tier, date: todayStr() } }));
  }
  if (step === 'oath') {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{maxWidth:600}}>
          <div className="panel">
            <div className="bracket-label">Vanguard Codex — World Briefing</div>
            <div style={{fontSize:12,lineHeight:1.7,color:'var(--text-dim)',marginBottom:16}}>{DEFAULT_CODEX_ENTRIES[0].body}</div>
            <div style={{fontSize:11,color:'var(--text-dim)'}}>Full lore, planet, and enemy intel available anytime in the Codex tab once you're activated.</div>
          </div>
          <div className="panel">
            <div className="dim mono" style={{fontSize:11,marginBottom:10,letterSpacing:'0.08em'}}>INCOMING TRANSMISSION — SOURCE: VANGUARD COMMAND — PRIORITY ONE</div>
            <div style={{fontSize:13,lineHeight:1.8,marginBottom:20}}>
              Candidate.<br/><br/>
              Numbers tell us what you can do today. They don't tell us whether you'll be here in six months.<br/><br/>
              The Kharvax Swarm doesn't wait for motivation. Neither does the work.<br/><br/>
              So before your file moves from Candidate to Recruit, Command needs your word.
            </div>
            <div style={{borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'18px 0', fontSize:13, lineHeight:2, marginBottom:20}}>
              I am not here because I am already strong.<br/>
              I am here because I choose to become stronger.<br/>
              I will show up — not perfectly, but consistently.<br/>
              I will measure myself against who I was, not who anyone else is.<br/>
              I will log the truth, even on the days the truth is a missed one.<br/>
              I need to be one Command can count on.<br/>
              This is the Vanguard Oath. I accept it.
            </div>
            <button className="primary" style={{width:'100%'}} onClick={()=>setStep('assessment')}>[ I ACCEPT ]</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="login-wrap">
      <div className="login-card" style={{maxWidth:480}}>
        <div className="panel">
          <div className="bracket-label">Baseline Assessment</div>
          <div className="dim" style={{fontSize:12,marginBottom:16}}>Record your current starting point, {op.callsign}.</div>
          <div className="field"><label>Max Push-Ups</label><input type="number" value={pushups} onChange={e=>setPushups(e.target.value)} /></div>
          <div className="field"><label>Max Pull-Ups</label><input type="number" value={pullups} onChange={e=>setPullups(e.target.value)} /></div>
          <div className="field"><label>Bodyweight Squats in 2 Minutes</label><input type="number" value={squats} onChange={e=>setSquats(e.target.value)} /></div>
          <div className="field"><label>Plank Hold (seconds)</label><input type="number" value={plank} onChange={e=>setPlank(e.target.value)} /></div>
          <div className="field"><label>1.5 Mile Run Time (minutes, optional)</label><input type="number" value={runMinutes} onChange={e=>setRunMinutes(e.target.value)} /></div>
          <button className="primary" style={{width:'100%'}} onClick={finishAssessment}>Complete Assessment — Activate Recruit Status</button>
        </div>
      </div>
    </div>
  );
}

function MiniChat({ chat, activeOp, onGoComms }) {
  const [collapsed, setCollapsed] = useState(false);
  const recent = chat.filter(m => m.channel==='main' || m.channel==='command').slice(-4);
  return (
    <div className="mini-chat">
      <div className="mini-chat-head" onClick={()=>setCollapsed(!collapsed)}>
        <span>Main Comms</span><span>{collapsed ? '▲' : '▼'}</span>
      </div>
      {!collapsed && (
        <div>
          <div className="mini-chat-body">
            {recent.length === 0 && <div className="dim" style={{fontSize:11}}>No transmissions yet.</div>}
            {recent.map(m => (
              <div key={m.id} className="mini-chat-msg">
                <div className="who">{!m.authorId ? 'VAL' : (m.isCommand ? 'COMMAND' : m.authorName)}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'8px 12px',borderTop:'1px solid var(--border)'}}>
            <button className="ghost small" style={{width:'100%'}} onClick={onGoComms}>Open Full Comms</button>
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchAllData() {
  const { data: profileRows } = await sb.from('profiles').select('*');
  const { data: habitRows } = await sb.from('habits').select('*');
  const { data: squadRows } = await sb.from('squads').select('*');
  const { data: squadMemberRows } = await sb.from('squad_members').select('*');
  let squads = (squadRows||[]).map(s => rowToSquad(s, (squadMemberRows||[]).filter(m=>m.squad_id===s.id)));
  let ops = (profileRows||[]).map(p => {
    const memberRow = (squadMemberRows||[]).find(m => m.operator_id === p.id);
    const op = rowToOperator(p, (habitRows||[]).filter(h=>h.operator_id===p.id).map(rowToHabit));
    op.squadId = memberRow ? memberRow.squad_id : null;
    op.squadRole = memberRow ? memberRow.role : null;
    return op;
  });

  const { data: campRows } = await sb.from('campaigns').select('*');
  const { data: locRows } = await sb.from('locations').select('*');
  let camps = (campRows||[]).map(c => rowToCampaign(c, (locRows||[]).filter(l=>l.campaign_id===c.id)));
  if (camps.length === 0) {
    const seeded = await seedDefaultCampaign();
    if (seeded) camps = [seeded];
  }

  const { data: logRows } = await sb.from('logs').select('*');
  const lgs = (logRows||[]).map(rowToLog);

  const { data: chatRows } = await sb.from('chat_messages').select('*').order('timestamp', {ascending:true});
  const ch = (chatRows||[]).map(rowToChat);

  const { data: codexRows } = await sb.from('codex_entries').select('*');
  const cx = (codexRows && codexRows.length) ? codexRows.map(rowToCodex) : DEFAULT_CODEX_ENTRIES;

  const { data: exerciseRows } = await sb.from('exercises').select('*').order('name');
  const exercises = (exerciseRows||[]).map(rowToExercise);

  const { data: sessionRows } = await sb.from('protocol_sessions').select('*');
  const protocolSessions = (sessionRows||[]).map(rowToProtocolSession);

  const { data: quipRows } = await sb.from('command_quips').select('*');
  const quips = (quipRows||[]).map(rowToQuip);

  const { data: awardRows } = await sb.from('awards').select('*').order('awarded_at', {ascending:false});
  const awards = (awardRows||[]).map(rowToAward);

  const { data: prRows } = await sb.from('personal_records').select('*').order('achieved_at', {ascending:false});
  const personalRecords = (prRows||[]).map(rowToPR);

  const { data: raidTemplateRows } = await sb.from('raid_templates').select('*');
  const { data: raidAreaRows } = await sb.from('raid_areas').select('*');
  const { data: raidObjRows } = await sb.from('raid_area_objectives').select('*');
  const raidTemplates = (raidTemplateRows||[]).map(t => {
    const areasForTemplate = (raidAreaRows||[]).filter(a=>a.raid_template_id===t.id).map(a =>
      rowToRaidArea(a, (raidObjRows||[]).filter(o=>o.raid_area_id===a.id))
    );
    return rowToRaidTemplate(t, areasForTemplate);
  });
  const { data: raidInstanceRows } = await sb.from('raid_instances').select('*');
  let raidInstances = (raidInstanceRows||[]).map(rowToRaidInstance);

  // auto-lock join windows / auto-resolve campaigns / auto-detect Control % milestones, writing back any changes
  for (let i = 0; i < camps.length; i++) {
    let c = camps[i];
    if (!c.lockedAt && daysBetween(c.startDate, todayStr()) >= c.joinWindowDays) {
      const count = Math.max(1, c.deployedOperatorIds.length);
      const targets = {}; c.locations.forEach(loc => { targets[loc.id] = locationTarget(c, loc); });
      await sb.from('campaigns').update({ locked_at: todayStr(), locked_targets: targets, locked_deployed_count: count }).eq('id', c.id);
      c = Object.assign({}, c, { lockedAt: todayStr(), lockedTargets: targets, lockedDeployedCount: count });
      camps[i] = c;
    }
    if (!c.resolved && c.lockedAt) {
      const locProg = computeLocationProgress(c, lgs);
      const pct = computePlanetControl(locProg);
      if (pct >= 100) { await sb.from('campaigns').update({resolved:'success'}).eq('id', c.id); camps[i] = Object.assign({}, c, {resolved:'success'}); }
      else if (daysBetween(c.startDate, todayStr()) >= c.durationDays) { await sb.from('campaigns').update({resolved:'failed'}).eq('id', c.id); camps[i] = Object.assign({}, c, {resolved:'failed'}); }
      else {
        // Milestone check — a DB trigger posts to chat the moment last_milestone_notified actually changes.
        const crossed = pct>=75?75:pct>=50?50:pct>=25?25:0;
        if (crossed > (c.lastMilestoneNotified||0)) {
          await sb.from('campaigns').update({last_milestone_notified: crossed}).eq('id', c.id);
          camps[i] = Object.assign({}, c, {lastMilestoneNotified: crossed});
        }
      }
    }
  }

  // auto-advance raid areas / auto-complete raids, writing back any changes so the
  // DB trigger can fire reliably on the actual state transition
  for (let i = 0; i < raidInstances.length; i++) {
    let inst = raidInstances[i];
    if (inst.status !== 'active') continue;
    const template = raidTemplates.find(t => t.id === inst.raidTemplateId);
    if (!template) continue;
    const area = template.areas[inst.currentAreaIndex];
    if (!area) continue;
    const objProgress = computeRaidObjectiveProgress(inst, area, lgs);
    if (raidAreaComplete(objProgress)) {
      const isLastArea = inst.currentAreaIndex >= template.areas.length - 1;
      if (isLastArea) {
        await sb.from('raid_instances').update({status:'completed', completed_at: new Date().toISOString()}).eq('id', inst.id);
        raidInstances[i] = Object.assign({}, inst, {status:'completed', completedAt: new Date().toISOString()});
      } else {
        await sb.from('raid_instances').update({current_area_index: inst.currentAreaIndex + 1}).eq('id', inst.id);
        raidInstances[i] = Object.assign({}, inst, {currentAreaIndex: inst.currentAreaIndex + 1});
      }
    }
  }

  return { ops, camps, lgs, ch, cx, squads, exercises, protocolSessions, quips, awards, personalRecords, raidTemplates, raidInstances };
}

