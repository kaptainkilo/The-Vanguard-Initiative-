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
    featuredAwardId: p.featured_award_id || null, lastSeenStatus: p.last_seen_status || null,
    birthdate: p.birthdate || null, hidePersonalInfo: p.hide_personal_info !== false,
  };
}
const OP_FIELD_MAP = { realName:'real_name', ageDivision:'age_division', specialization:'specialization', squad:'squad',
  privacy:'privacy', avatarColor:'avatar_color', avatarUrl:'avatar_url', weeklyTarget:'weekly_target', isAdmin:'is_admin', isModerator:'is_moderator', onboarded:'onboarded',
  baseline:'baseline', previousBaseline:'previous_baseline', currentDeploymentId:'current_deployment_id',
  reinforcementDropsAvailable:'reinforcement_drops_available', mcpAtLastReinforcement:'mcp_at_last_reinforcement',
  lastSeenRank:'last_seen_rank', customProtocols:'custom_protocols', callsign:'callsign',
  adminSince:'admin_since', moderatorSince:'moderator_since', featuredAwardId:'featured_award_id', lastSeenStatus:'last_seen_status',
  birthdate:'birthdate', hidePersonalInfo:'hide_personal_info' };
function operatorToRowPatch(patch) {
  const row = {};
  Object.keys(patch).forEach(k => { if (OP_FIELD_MAP[k]) row[OP_FIELD_MAP[k]] = patch[k]; });
  return row;
}

function rowToLocation(l) { return { id: l.id, name: l.name, objective: l.objective, category: l.category, unit: l.unit, manualTarget: l.manual_target, briefing: l.briefing || '' }; }
function rowToPOI(p) { return { id: p.id, campaignId: p.campaign_id, row: p.row, col: p.col, name: p.name, briefing: p.briefing || '' }; }
function rowToCampaign(c, locs) {
  return { id: c.id, name: c.name, threat: c.threat, sector: c.sector, startDate: c.start_date,
    joinWindowDays: c.join_window_days, durationDays: c.duration_days, lockedAt: c.locked_at,
    lockedTargets: c.locked_targets, lockedDeployedCount: c.locked_deployed_count,
    deployedOperatorIds: c.deployed_operator_ids || [], reinforcementsUsed: c.reinforcements_used,
    resolved: c.resolved, resolvedAt: c.resolved_at || null, lore: c.lore || '', lastMilestoneNotified: c.last_milestone_notified || 0,
    planetId: c.planet_id || null,
    locations: (locs||[]).map(rowToLocation) };
}
const CAMP_FIELD_MAP = { name:'name', threat:'threat', sector:'sector', joinWindowDays:'join_window_days',
  durationDays:'duration_days', lockedAt:'locked_at', lockedTargets:'locked_targets',
  lockedDeployedCount:'locked_deployed_count', deployedOperatorIds:'deployed_operator_ids',
  reinforcementsUsed:'reinforcements_used', resolved:'resolved', lore:'lore', lastMilestoneNotified:'last_milestone_notified',
  planetId:'planet_id' };
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
function rowToHabit(h) { return { id: h.id, name: h.name, active: h.active, createdDate: h.created_date, category: h.category || 'Other' }; }
function rowToCodex(c) { return { id: c.id, category: c.category, title: c.title, body: c.body, iconRef: c.icon_ref || '' }; }
function rowToQuip(q) { return { id: q.id, text: q.text }; }
function rowToChallenge(c) { return { id: c.id, name: c.name, muscleGroup: c.muscle_group, target: Number(c.target), unit: c.unit }; }
function rowToChallengeCompletion(c) { return { id: c.id, operatorId: c.operator_id, date: c.date, poolId: c.pool_id }; }
function rowToSeason(s) { return { id: s.id, name: s.name, startDate: s.start_date, endDate: s.end_date }; }
function rowToSquadHabitChallenge(c) {
  return { id: c.id, squadId: c.squad_id, name: c.name, description: c.description, startDate: c.start_date,
    endDate: c.end_date, status: c.status, success: c.success, createdBy: c.created_by };
}
function rowToSquadHabitOptIn(o) { return { id: o.id, challengeId: o.challenge_id, operatorId: o.operator_id }; }
function rowToSquadHabitCheckin(c) { return { id: c.id, challengeId: c.challenge_id, operatorId: c.operator_id, date: c.date }; }
function rowToJoinRequest(r) { return { id: r.id, squadId: r.squad_id, operatorId: r.operator_id, status: r.status, requestedAt: r.requested_at }; }
function rowToQuadrant(q) { return { id: q.id, name: q.name, gridPosition: q.grid_position }; }
function rowToSector(s) { return { id: s.id, quadrantId: s.quadrant_id, sectorNumber: s.sector_number, code: s.code, name: s.name, description: s.description, known: s.known }; }
function rowToSystem(s) { return { id: s.id, sectorId: s.sector_id, name: s.name, starName: s.star_name, starDescription: s.star_description }; }
function rowToPlanet(p) { return { id: p.id, systemId: p.system_id, name: p.name, description: p.description, orderIndex: p.order_index }; }
function rowToMoon(m) { return { id: m.id, planetId: m.planet_id, name: m.name, description: m.description }; }
function rowToAsteroidBelt(a) { return { id: a.id, systemId: a.system_id, name: a.name, description: a.description }; }
function rowToDeepVoidFeature(d) { return { id: d.id, sectorId: d.sector_id, featureType: d.feature_type, name: d.name, description: d.description }; }
function rowToDuel(d) {
  return { id: d.id, challengerSquadId: d.challenger_squad_id, opponentSquadId: d.opponent_squad_id,
    muscleGroup: d.muscle_group, target: Number(d.target), unit: d.unit, durationDays: d.duration_days,
    status: d.status, startDate: d.start_date, endDate: d.end_date, winnerSquadId: d.winner_squad_id, createdAt: d.created_at };
}
function rowToAnnouncement(a) { return { id: a.id, title: a.title, body: a.body, active: a.active, createdAt: a.created_at }; }
function rowToDismissal(d) { return { id: d.id, operatorId: d.operator_id, announcementId: d.announcement_id }; }
function rowToCheer(c) { return { id: c.id, messageId: c.message_id, operatorId: c.operator_id }; }
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
  const [birthdate, setBirthdate] = useState('');
  const [pushups, setPushups] = useState('');
  const [pullups, setPullups] = useState('');
  const [squats, setSquats] = useState('');
  const [plank, setPlank] = useState('');
  const [runMinutes, setRunMinutes] = useState('');
  const [pendingBaseline, setPendingBaseline] = useState(null);
  // Three age-scaled threshold sets — Corps values are the original,
  // unchanged adult standards; Cadet and Veteran are deliberately gentler,
  // reasonable estimates rather than clinically validated youth/senior
  // fitness benchmarks. Each array is [4pt-min, 3pt-min, 2pt-min, 1pt-min]
  // for rep-based categories (higher is better), or [4pt-max, 3pt-max,
  // 2pt-max] for run time (lower is better).
  const BASELINE_TIERS = {
    Cadet:   { pushups:[20,12,5,1], pullups:[6,3,1,0], plank:[90,60,30,1],  run:[12,14,17] },
    Corps:   { pushups:[41,26,11,1], pullups:[13,8,3,0], plank:[180,120,60,1], run:[10,12,15] },
    Veteran: { pushups:[25,15,6,1], pullups:[8,5,2,0], plank:[120,80,40,1], run:[11,13,16] },
  };
  function scoreRep(value, t) {
    if (value >= t[0]) return 4;
    if (value >= t[1]) return 3;
    if (value >= t[2]) return 2;
    if (value >= t[3]) return 1;
    return 0;
  }
  function scoreRunTime(minutes, t) {
    if (minutes <= 0) return 0; // optional field, not attempted
    if (minutes < t[0]) return 4;
    if (minutes < t[1]) return 3;
    if (minutes <= t[2]) return 2;
    return 1;
  }
  function finishAssessment() {
    const pu = parseFloat(pushups)||0, pl = parseFloat(pullups)||0, sq = parseFloat(squats)||0, pk = parseFloat(plank)||0, rn = parseFloat(runMinutes)||0;
    const division = computeAgeDivision(computeAge(birthdate)) || 'Corps';
    const tiers = BASELINE_TIERS[division] || BASELINE_TIERS.Corps;
    let pts = 0;
    pts += scoreRep(pu, tiers.pushups);
    pts += scoreRep(pl, tiers.pullups);
    pts += scoreRep(pk, tiers.plank);
    pts += scoreRunTime(rn, tiers.run);
    let tier = pts>=15?'Peak Tier':pts>=12?'Advanced Tier':pts>=8?'Development Tier':'Foundation Tier';
    setPendingBaseline({ pushups: pu, pullups: pl, squats: sq, plankSeconds: pk, runMinutes: rn, score: pts, tier: tier, date: todayStr() });
    setStep('walkthrough');
  }
  function finishOnboarding() {
    const division = computeAgeDivision(computeAge(birthdate)) || 'Corps';
    onComplete(Object.assign({}, op, { onboarded: true, baseline: pendingBaseline, birthdate: birthdate || null, ageDivision: division }));
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
            <div className="field"><label>Date of Birth (used to calibrate your Baseline Assessment fairly for your age)</label><input type="date" value={birthdate} onChange={e=>setBirthdate(e.target.value)} /></div>
            <button className="primary" style={{width:'100%'}} disabled={!birthdate} onClick={()=>setStep('assessment')}>[ I ACCEPT ]</button>
          </div>
        </div>
      </div>
    );
  }
  if (step === 'assessment') {
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
            <button className="primary" style={{width:'100%'}} onClick={finishAssessment}>Complete Assessment</button>
          </div>
        </div>
      </div>
    );
  }
  // Brief, not exhaustive — deeper detail lives in the Codex Field Guide and
  // Val's @Val FAQ, both available anytime once activated.
  return (
    <div className="login-wrap">
      <div className="login-card" style={{maxWidth:560}}>
        <div className="panel">
          <div className="bracket-label">Orientation — How This Works</div>
          <div style={{fontSize:12,lineHeight:1.9,color:'var(--text-dim)'}}>
            <strong style={{color:'var(--text)'}}>Log your training.</strong> Every workout you record is an After Action Report — Command calls it an AAR. Structured Sessions, freeform exercises, even Rest Days all count.<br/><br/>
            <strong style={{color:'var(--text)'}}>ORS drives everything.</strong> Your Operational Readiness Score blends your training, consistency, personal habits, and squad activity. ORS is what actually promotes you — not just showing up once.<br/><br/>
            <strong style={{color:'var(--text)'}}>Deploy when you're ready.</strong> Campaigns, Squads, Raids, and Duels are all there once you want them — none of them are required to make progress on your own.<br/><br/>
            <strong style={{color:'var(--text)'}}>Stuck on something?</strong> The Codex has a full Field Guide covering ranks, specializations, and awards. Or just type <span className="amber mono">@Val</span> in Main chat with a question — Command's AI will answer directly.
          </div>
          <button className="primary" style={{width:'100%',marginTop:20}} onClick={finishOnboarding}>[ ENTER THE VANGUARD INITIATIVE ]</button>
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

  const { data: poiRows } = await sb.from('campaign_pois').select('*');
  const campaignPOIs = (poiRows||[]).map(rowToPOI);

  const { data: challengePoolRows } = await sb.from('daily_challenge_pool').select('*');
  const challengePool = (challengePoolRows||[]).map(rowToChallenge);
  const { data: challengeCompletionRows } = await sb.from('daily_challenge_completions').select('*');
  const challengeCompletions = (challengeCompletionRows||[]).map(rowToChallengeCompletion);

  const { data: seasonRows } = await sb.from('seasons').select('*');
  const seasons = (seasonRows||[]).map(rowToSeason);

  const { data: duelRows } = await sb.from('duels').select('*');
  let duels = (duelRows||[]).map(rowToDuel);

  const { data: announcementRows } = await sb.from('announcements').select('*').order('created_at', {ascending:false});
  const announcements = (announcementRows||[]).map(rowToAnnouncement);
  const { data: dismissalRows } = await sb.from('announcement_dismissals').select('*');
  const dismissals = (dismissalRows||[]).map(rowToDismissal);

  const { data: cheerRows } = await sb.from('message_cheers').select('*');
  const cheers = (cheerRows||[]).map(rowToCheer);

  const { data: shcRows } = await sb.from('squad_habit_challenges').select('*');
  let squadHabitChallenges = (shcRows||[]).map(rowToSquadHabitChallenge);
  const { data: shOptInRows } = await sb.from('squad_habit_opt_ins').select('*');
  const squadHabitOptIns = (shOptInRows||[]).map(rowToSquadHabitOptIn);
  const { data: shCheckinRows } = await sb.from('squad_habit_checkins').select('*');
  const squadHabitCheckins = (shCheckinRows||[]).map(rowToSquadHabitCheckin);

  const { data: joinReqRows } = await sb.from('squad_join_requests').select('*');
  const joinRequests = (joinReqRows||[]).map(rowToJoinRequest);

  const { data: quadrantRows } = await sb.from('quadrants').select('*');
  const quadrants = (quadrantRows||[]).map(rowToQuadrant);
  const { data: sectorRows } = await sb.from('sectors').select('*');
  const sectors = (sectorRows||[]).map(rowToSector);
  const { data: systemRows } = await sb.from('systems').select('*');
  const systems = (systemRows||[]).map(rowToSystem);
  const { data: planetRows } = await sb.from('planets').select('*');
  const planets = (planetRows||[]).map(rowToPlanet);
  const { data: moonRows } = await sb.from('moons').select('*');
  const moons = (moonRows||[]).map(rowToMoon);
  const { data: beltRows } = await sb.from('asteroid_belts').select('*');
  const asteroidBelts = (beltRows||[]).map(rowToAsteroidBelt);
  const { data: voidRows } = await sb.from('deep_void_features').select('*');
  const deepVoidFeatures = (voidRows||[]).map(rowToDeepVoidFeature);

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

  // auto-resolve active Duels — either squad hitting target, or time running out
  for (let i = 0; i < duels.length; i++) {
    const d = duels[i];
    if (d.status !== 'active') continue;
    const challengerSquad = squads.find(s => s.id === d.challengerSquadId);
    const opponentSquad = squads.find(s => s.id === d.opponentSquadId);
    const challengerProgress = computeDuelProgress(challengerSquad, d, lgs);
    const opponentProgress = computeDuelProgress(opponentSquad, d, lgs);
    const challengerDone = challengerProgress >= d.target;
    const opponentDone = opponentProgress >= d.target;
    const timeUp = todayStr() > d.endDate;
    if (challengerDone || opponentDone || timeUp) {
      let winnerSquadId = null;
      if (challengerDone && opponentDone) winnerSquadId = challengerProgress >= opponentProgress ? d.challengerSquadId : d.opponentSquadId;
      else if (challengerDone) winnerSquadId = d.challengerSquadId;
      else if (opponentDone) winnerSquadId = d.opponentSquadId;
      else if (timeUp && challengerProgress !== opponentProgress) winnerSquadId = challengerProgress > opponentProgress ? d.challengerSquadId : d.opponentSquadId;
      // else: time up and exactly tied -> winnerSquadId stays null (draw)
      await sb.from('duels').update({status:'completed', winner_squad_id: winnerSquadId}).eq('id', d.id);
      duels[i] = Object.assign({}, d, {status:'completed', winnerSquadId: winnerSquadId});
    }
  }

  // auto-resolve Squad Habit Challenges past their end_date
  for (let i = 0; i < squadHabitChallenges.length; i++) {
    const c = squadHabitChallenges[i];
    if (c.status !== 'active' || todayStr() <= c.endDate) continue;
    const optedIn = squadHabitOptIns.filter(o => o.challengeId === c.id);
    const windowDays = daysBetween(c.startDate, c.endDate) + 1;
    const possible = optedIn.length * windowDays;
    const actual = squadHabitCheckins.filter(ch => ch.challengeId === c.id).length;
    const rate = possible > 0 ? actual / possible : 0;
    const success = rate >= 0.7;
    await sb.from('squad_habit_challenges').update({ status:'completed', success: success }).eq('id', c.id);
    squadHabitChallenges[i] = Object.assign({}, c, { status:'completed', success: success });
    const squad = squads.find(s => s.id === c.squadId);
    const squadName = squad ? squad.name : 'A squad';
    if (success) {
      const grants = optedIn.map(o => ({ operator_id: o.operatorId, award_type: 'squad_habit_'+c.id, title: 'Squad Habit: '+c.name, description: squadName+' completed "'+c.name+'" together \u2014 '+Math.round(rate*100)+'% collective completion.' }));
      if (grants.length) await sb.from('awards').insert(grants);
      await sb.rpc('post_command_message', { msg: '\ud83e\udd1d '+squadName+' completed the shared habit challenge "'+c.name+'" \u2014 '+Math.round(rate*100)+'% collective completion. Command noticed.' });
    } else {
      await sb.rpc('post_command_message', { msg: squadName+'\u2019s shared habit challenge "'+c.name+'" has ended \u2014 '+Math.round(rate*100)+'% collective completion. Not quite there. Worth trying again.' });
    }
  }

  return { ops, camps, lgs, ch, cx, squads, exercises, protocolSessions, quips, awards, personalRecords, raidTemplates, raidInstances, campaignPOIs, challengePool, challengeCompletions, seasons, duels, announcements, dismissals, cheers, squadHabitChallenges, squadHabitOptIns, squadHabitCheckins, joinRequests, quadrants, sectors, systems, planets, moons, asteroidBelts, deepVoidFeatures };
}

