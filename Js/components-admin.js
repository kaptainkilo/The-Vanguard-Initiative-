function RaidObjectiveAdder({ onAdd }) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS_LIST[0]);
  const [unit, setUnit] = useState('reps');
  const [target, setTarget] = useState('');
  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8,alignItems:'center'}}>
      <input type="text" placeholder="Objective name" value={name} onChange={e=>setName(e.target.value)} style={{flex:'1 1 140px'}} />
      <select value={muscleGroup} onChange={e=>setMuscleGroup(e.target.value)}>{MUSCLE_GROUPS_LIST.map(m => <option key={m} value={m}>{m}</option>)}</select>
      <select value={unit} onChange={e=>setUnit(e.target.value)}><option value="reps">reps</option><option value="seconds">seconds</option><option value="minutes">minutes</option></select>
      <input type="number" placeholder="Target" value={target} onChange={e=>setTarget(e.target.value)} style={{width:80}} />
      <button className="small ghost" onClick={()=>{
        if (!name.trim() || !target) return;
        onAdd({ name: name.trim(), muscleGroup: muscleGroup, unit: unit, target: Number(target) });
        setName(''); setTarget('');
      }}>+ Add Objective</button>
    </div>
  );
}

function AdminPanel({ operators, campaigns, logs, onUpdateOperators, onUpdateCampaigns, exercises, protocolSessions, onSaveExercise, onDeleteExercise, onSaveProtocolSession, onDeleteProtocolSession, quips, onSaveQuip, onDeleteQuip, raidTemplates, onSaveRaidTemplate, onDeleteRaidTemplate, campaignPOIs, onSavePOI, onDeletePOI, challengePool, onSaveChallenge, onDeleteChallenge, seasons, onSaveSeason, onDeleteSeason, announcements, onSaveAnnouncement, onDeleteAnnouncement, onGrantAward, onUpdateBirthdateAdmin, quadrants, sectors, systems, planets }) {
  const [editingId, setEditingId] = useState(campaigns[0] ? campaigns[0].id : null);
  const [savedMsg, setSavedMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draft, setDraft] = useState(null);
  useEffect(() => { const c = campaigns.find(c=>c.id===editingId); setDraft(c ? JSON.parse(JSON.stringify(c)) : null); }, [editingId]);
  const [campaignQuadrantId, setCampaignQuadrantId] = useState('');
  const [campaignSectorId, setCampaignSectorId] = useState('');
  const [campaignSystemId, setCampaignSystemId] = useState('');
  useEffect(() => {
    const c = campaigns.find(c=>c.id===editingId);
    if (c && c.planetId) {
      const p = planets.find(x=>x.id===c.planetId);
      const sy = p ? systems.find(x=>x.id===p.systemId) : null;
      const se = sy ? sectors.find(x=>x.id===sy.sectorId) : null;
      setCampaignSystemId(sy ? sy.id : '');
      setCampaignSectorId(se ? se.id : '');
      setCampaignQuadrantId(se ? se.quadrantId : '');
    } else {
      setCampaignQuadrantId(''); setCampaignSectorId(''); setCampaignSystemId('');
    }
  }, [editingId]);

  const [exEditing, setExEditing] = useState(null);
  const [exDraft, setExDraft] = useState(null);
  const [exConfirmDelete, setExConfirmDelete] = useState(null);

  const [sessEditing, setSessEditing] = useState(null);
  const [sessDraft, setSessDraft] = useState(null);
  const [sessConfirmDelete, setSessConfirmDelete] = useState(null);
  const [newQuipText, setNewQuipText] = useState('');
  const [challengeDraft, setChallengeDraft] = useState({name:'', muscleGroup:MUSCLE_GROUPS_LIST[0], target:'', unit:'reps'});
  const [seasonDraft, setSeasonDraft] = useState({name:'', startDate:'', endDate:''});
  const [announcementDraft, setAnnouncementDraft] = useState(null);
  const [announcementConfirmDelete, setAnnouncementConfirmDelete] = useState(null);
  const [raidEditing, setRaidEditing] = useState(null);
  const [raidDraft, setRaidDraft] = useState(null);
  const [raidConfirmDelete, setRaidConfirmDelete] = useState(null);
  const [raidSaving, setRaidSaving] = useState(false);
  const [poiDraft, setPoiDraft] = useState(null);
  const [poiConfirmDelete, setPoiConfirmDelete] = useState(null);
  const [subTab, setSubTab] = useState('campaigns');
  const [grantAwardFor, setGrantAwardFor] = useState(null);
  const [grantAwardDraft, setGrantAwardDraft] = useState({title:'', description:''});

  function updateLocField(idx, field, val) {
    const locs = draft.locations.slice();
    locs[idx] = Object.assign({}, locs[idx], { [field]: field==='manualTarget' ? (val?Number(val):null) : val });
    setDraft(Object.assign({}, draft, {locations: locs}));
  }
  function addLocation() { setDraft(Object.assign({}, draft, {locations: draft.locations.concat([{ id: 'loc_'+Date.now(), name: 'New Location', objective: 'Total reps', category: 'Chest', unit: 'reps', manualTarget: null, briefing: '' }])})); }
  function removeLocation(idx) { setDraft(Object.assign({}, draft, {locations: draft.locations.filter((_,i)=>i!==idx)})); }
  async function saveCampaign() {
    const exists = campaigns.some(c=>c.id===draft.id);
    const newCamps = exists ? campaigns.map(c => c.id === draft.id ? draft : c) : campaigns.concat([draft]);
    await onUpdateCampaigns(newCamps);
    setEditingId(draft.id);
    setSavedMsg('Saved.'); setTimeout(()=>setSavedMsg(''), 2000);
  }
  async function forceLockWindow() {
    const count = Math.max(1, draft.deployedOperatorIds.length);
    const targets = {}; draft.locations.forEach(loc => { targets[loc.id] = locationTarget(draft, loc); });
    const updated = Object.assign({}, draft, {lockedAt: todayStr(), lockedTargets: targets, lockedDeployedCount: count});
    setDraft(updated);
    await onUpdateCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
  }
  async function forceResolve(result) {
    const updated = Object.assign({}, draft, {resolved: result});
    setDraft(updated);
    const clearedOps = operators.map(o => o.currentDeploymentId === updated.id ? Object.assign({}, o, {currentDeploymentId:null}) : o);
    await onUpdateOperators(clearedOps);
    await onUpdateCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
  }
  function updateOpField(id, field, val) {
    const parsedVal = field==='weeklyTarget' ? Number(val) : val;
    const patch = { [field]: parsedVal };
    // Admin/Moderator status drives a separate, parallel Command rank track
    // (see computeCommandRank) — it no longer touches the Operator rank or
    // specialization at all. Tenure timestamps mark continuous time-in-role:
    // set the moment a role is granted, cleared if it's removed (tenure
    // restarts if someone loses and later regains a role).
    if (field === 'isAdmin') patch.adminSince = parsedVal ? new Date().toISOString() : null;
    if (field === 'isModerator') patch.moderatorSince = parsedVal ? new Date().toISOString() : null;
    onUpdateOperators(operators.map(o => o.id === id ? Object.assign({}, o, patch) : o));
  }
  function deleteOperator(id) { onUpdateOperators(operators.filter(o => o.id !== id)); setConfirmDelete(null); }

  return (
    <div>
      <div className="radio-group" style={{marginBottom:16}}>
        <div className={"radio-opt"+(subTab==='campaigns'?' sel':'')} onClick={()=>setSubTab('campaigns')}>Campaigns</div>
        <div className={"radio-opt"+(subTab==='library'?' sel':'')} onClick={()=>setSubTab('library')}>Content Library</div>
        <div className={"radio-opt"+(subTab==='competitive'?' sel':'')} onClick={()=>setSubTab('competitive')}>Competitive & Events</div>
        <div className={"radio-opt"+(subTab==='roster'?' sel':'')} onClick={()=>setSubTab('roster')}>Roster</div>
      </div>
      {subTab==='campaigns' && (<>
      <div className="panel">
        <div className="bracket-label">Admin — Campaigns</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
          {campaigns.map(c => <button key={c.id} className={editingId===c.id?'primary small':'ghost small'} onClick={()=>setEditingId(c.id)}>{c.name}</button>)}
          <button className="ghost small" onClick={()=>{const id='camp_'+Date.now(); setEditingId(null); setDraft({id:id, name:'New Campaign', threat:'Unknown', sector:'Unassigned Sector', startDate: todayStr(), joinWindowDays:5, durationDays:28, locations:[], lockedAt:null, lockedTargets:null, lockedDeployedCount:0, deployedOperatorIds:[], reinforcementsUsed:0, resolved:null, lore:''});}}>+ New Campaign</button>
        </div>
        {draft && (
          <div>
            <div className="field"><label>Campaign Name</label><input type="text" value={draft.name} onChange={e=>setDraft(Object.assign({},draft,{name:e.target.value}))} /></div>
            <div className="grid2">
              <div className="field"><label>Threat / Faction</label><input type="text" value={draft.threat} onChange={e=>setDraft(Object.assign({},draft,{threat:e.target.value}))} /></div>
              <div className="field"><label>Sector (legacy label, still shown on Campaign cards)</label><input type="text" value={draft.sector} onChange={e=>setDraft(Object.assign({},draft,{sector:e.target.value}))} /></div>
              <div className="field"><label>Target Planet</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <select value={campaignQuadrantId} onChange={e=>{setCampaignQuadrantId(e.target.value); setCampaignSectorId(''); setCampaignSystemId(''); setDraft(Object.assign({},draft,{planetId:null}));}}>
                    <option value="">Quadrant...</option>
                    {quadrants.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                  </select>
                  <select value={campaignSectorId} onChange={e=>{setCampaignSectorId(e.target.value); setCampaignSystemId(''); setDraft(Object.assign({},draft,{planetId:null}));}} disabled={!campaignQuadrantId}>
                    <option value="">Sector...</option>
                    {sectors.filter(s=>s.quadrantId===campaignQuadrantId && s.known).map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                  <select value={campaignSystemId} onChange={e=>{setCampaignSystemId(e.target.value); setDraft(Object.assign({},draft,{planetId:null}));}} disabled={!campaignSectorId}>
                    <option value="">System...</option>
                    {systems.filter(sy=>sy.sectorId===campaignSectorId).map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                  <select value={draft.planetId||''} onChange={e=>setDraft(Object.assign({},draft,{planetId:e.target.value||null}))} disabled={!campaignSystemId}>
                    <option value="">Planet...</option>
                    {planets.filter(p=>p.systemId===campaignSystemId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="dim mono" style={{fontSize:10,marginTop:4}}>Optional {'\u2014'} links this Campaign to the Galaxy Map and shows real-time Control % there. Campaigns without a linked planet still work exactly as before.</div>
              </div>
            </div>
            <div className="grid2">
              <div className="field"><label>Join Window (days)</label><input type="number" value={draft.joinWindowDays} onChange={e=>setDraft(Object.assign({},draft,{joinWindowDays:Number(e.target.value)}))} /></div>
              <div className="field"><label>Duration (days)</label><input type="number" value={draft.durationDays} onChange={e=>setDraft(Object.assign({},draft,{durationDays:Number(e.target.value)}))} /></div>
            </div>
            <div className="field"><label>Full Lore Briefing (optional — shown as an expandable "Full Briefing" to deployed operators)</label>
              <textarea value={draft.lore||''} onChange={e=>setDraft(Object.assign({},draft,{lore:e.target.value}))} rows="8" style={{width:'100%'}} placeholder="Write the deeper story behind this Campaign — why this world matters, what's at stake, who's already been lost..." />
            </div>
            <label style={{marginTop:8}}>Locations</label>
            {draft.locations.map((loc, idx) => (
              <div key={loc.id} style={{border:'1px solid var(--border)',borderRadius:2,padding:12,marginBottom:10}}>
                <div className="grid2">
                  <div className="field"><label>Location Name</label><input type="text" value={loc.name} onChange={e=>updateLocField(idx,'name',e.target.value)} /></div>
                  <div className="field"><label>Objective Description</label><input type="text" value={loc.objective} onChange={e=>updateLocField(idx,'objective',e.target.value)} /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>Category</label>
                    <select style={{width:'100%'}} value={loc.category} onChange={e=>updateLocField(idx,'category',e.target.value)}>{LOCATION_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
                  </div>
                  <div className="field"><label>Unit</label><input type="text" value={loc.unit} onChange={e=>updateLocField(idx,'unit',e.target.value)} /></div>
                </div>
                <div className="field"><label>Manual Target Override (blank = auto-calculated)</label><input type="number" value={loc.manualTarget||''} onChange={e=>updateLocField(idx,'manualTarget',e.target.value)} /></div>
                <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:8}}>Current computed target: {locationTarget(draft, loc)} {loc.unit}</div>
                <div className="field"><label>Full Briefing (optional — shown as expandable detail to deployed operators)</label>
                  <textarea value={loc.briefing||''} onChange={e=>updateLocField(idx,'briefing',e.target.value)} rows="3" style={{width:'100%'}} placeholder="What's actually happening at this Location — why it matters, what's been seen there..." />
                </div>
                <button className="small danger" onClick={()=>removeLocation(idx)}>Remove Location</button>
              </div>
            ))}
            <button className="ghost small" onClick={addLocation} style={{marginBottom:14}}>+ Add Location</button>

            <label>AO Hex Map — Points of Interest</label>
            <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:10}}>Click a hex to place the POI you're editing (or a new one) there. The grid preview shows the AO's current live territory state.</div>
            <div style={{marginBottom:10}}>
              <HexGridMap
                grid={computeHexGrid(draft, computeLocationProgress(draft, logs))}
                pois={(campaignPOIs||[]).filter(p=>p.campaignId===draft.id)}
                onHexClick={(row,col)=>setPoiDraft(Object.assign({}, poiDraft || {id:undefined, campaignId:draft.id, name:'New POI', briefing:''}, {row,col}))}
                onSelectPOI={(p)=>setPoiDraft(Object.assign({}, p))}
              />
            </div>
            {poiDraft ? (
              <div style={{border:'1px solid var(--border)',borderRadius:2,padding:12,marginBottom:14}}>
                <div className="dim mono" style={{fontSize:10,marginBottom:8}}>Position: row {poiDraft.row}, col {poiDraft.col} — click a different hex above to move it</div>
                <div className="field"><label>POI Name</label><input type="text" value={poiDraft.name} onChange={e=>setPoiDraft(Object.assign({},poiDraft,{name:e.target.value}))} /></div>
                <div className="field"><label>Briefing (lore text shown when clicked)</label>
                  <textarea value={poiDraft.briefing||''} onChange={e=>setPoiDraft(Object.assign({},poiDraft,{briefing:e.target.value}))} rows="3" style={{width:'100%'}} />
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="primary small" onClick={async()=>{ await onSavePOI(poiDraft); setPoiDraft(null); }}>Save POI</button>
                  <button className="ghost small" onClick={()=>setPoiDraft(null)}>Cancel</button>
                  {poiDraft.id && (poiConfirmDelete===poiDraft.id ? (
                    <span style={{display:'flex',gap:6}}><button className="small danger" onClick={async()=>{ await onDeletePOI(poiDraft.id); setPoiDraft(null); setPoiConfirmDelete(null); }}>Confirm Delete</button><button className="small ghost" onClick={()=>setPoiConfirmDelete(null)}>Cancel</button></span>
                  ) : <button className="small ghost" onClick={()=>setPoiConfirmDelete(poiDraft.id)}>Delete POI</button>)}
                </div>
              </div>
            ) : (
              <button className="ghost small" style={{marginBottom:14}} onClick={()=>setPoiDraft({id:undefined, campaignId:draft.id, name:'New POI', briefing:'', row:0, col:0})}>+ New POI (then click a hex above)</button>
            )}

            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <button className="primary" onClick={saveCampaign}>Save Campaign</button>
              {!draft.lockedAt && <button className="ghost" onClick={forceLockWindow}>Force Lock Join Window Now</button>}
              {draft.lockedAt && !draft.resolved && <button className="ghost" onClick={()=>forceResolve('success')}>Force Resolve: Success</button>}
              {draft.lockedAt && !draft.resolved && <button className="danger" onClick={()=>forceResolve('failed')}>Force Resolve: Failed</button>}
              {savedMsg && <span style={{color:'var(--success)',fontSize:12}}>{savedMsg}</span>}
            </div>
          </div>
        )}
      </div>
      </>)}
      {subTab==='library' && (<>

      <div className="panel">
        <div className="bracket-label">Admin — Exercise Library ({exercises.length})</div>
        <div style={{maxHeight:300,overflowY:'auto',marginBottom:14}}>
          {exercises.map(ex => (
            <div key={ex.id} className="field-row">
              <span>{ex.name} <span className="dim mono" style={{fontSize:10}}>({ex.muscleGroup}{ex.secondaryMuscleGroups && ex.secondaryMuscleGroups.length ? ' + '+ex.secondaryMuscleGroups.join('/') : ''} · {ex.unit})</span></span>
              <span style={{display:'flex',gap:6}}>
                <button className="small ghost" onClick={()=>{setExEditing(ex.id); setExDraft(Object.assign({},ex,{altText:(ex.alternatives||[]).join(', '), secText:(ex.secondaryMuscleGroups||[]).join(', ')}));}}>Edit</button>
                {exConfirmDelete===ex.id ? (
                  <span style={{display:'flex',gap:4}}><button className="small danger" onClick={()=>{onDeleteExercise(ex.id); setExConfirmDelete(null);}}>Confirm</button><button className="small ghost" onClick={()=>setExConfirmDelete(null)}>Cancel</button></span>
                ) : <button className="small ghost" onClick={()=>setExConfirmDelete(ex.id)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
        {exDraft ? (
          <div style={{border:'1px solid var(--border)',borderRadius:2,padding:12}}>
            <div className="field"><label>Name</label><input type="text" value={exDraft.name} onChange={e=>setExDraft(Object.assign({},exDraft,{name:e.target.value}))} /></div>
            <div className="grid2">
              <div className="field"><label>Primary Muscle Group</label>
                <select style={{width:'100%'}} value={exDraft.muscleGroup} onChange={e=>setExDraft(Object.assign({},exDraft,{muscleGroup:e.target.value}))}>
                  {MUSCLE_GROUPS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field"><label>Unit</label>
                <select style={{width:'100%'}} value={exDraft.unit} onChange={e=>setExDraft(Object.assign({},exDraft,{unit:e.target.value}))}>
                  <option value="reps">reps</option><option value="seconds">seconds</option><option value="minutes">minutes</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Alternatives (comma-separated)</label><input type="text" value={exDraft.altText||''} onChange={e=>setExDraft(Object.assign({},exDraft,{altText:e.target.value}))} /></div>
            <div className="field"><label>Secondary Muscle Groups (comma-separated — informational, plus half Campaign credit)</label>
              <input type="text" value={exDraft.secText||''} onChange={e=>setExDraft(Object.assign({},exDraft,{secText:e.target.value}))} placeholder="e.g. Triceps, Shoulders" />
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="primary small" onClick={()=>{
                const toSave = { id: exDraft.id, name: exDraft.name, muscleGroup: exDraft.muscleGroup, unit: exDraft.unit, alternatives: exDraft.altText.split(',').map(s=>s.trim()).filter(Boolean), secondaryMuscleGroups: (exDraft.secText||'').split(',').map(s=>s.trim()).filter(Boolean) };
                onSaveExercise(toSave); setExDraft(null); setExEditing(null);
              }}>Save</button>
              <button className="ghost small" onClick={()=>{setExDraft(null); setExEditing(null);}}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="ghost small" onClick={()=>setExDraft({id:undefined, name:'', muscleGroup:'Chest', unit:'reps', altText:'', secText:''})}>+ Add Exercise</button>
        )}
      </div>

      <div className="panel">
        <div className="bracket-label">Admin — Protocol Session Library ({protocolSessions.length})</div>
        <div style={{maxHeight:300,overflowY:'auto',marginBottom:14}}>
          {protocolSessions.map(s => (
            <div key={s.id} className="field-row">
              <span>{s.protocol} — {s.name} <span className="dim mono" style={{fontSize:10}}>({s.objectives.length} exercises{s.requiresSpecialization?', '+s.requiresSpecialization:''})</span></span>
              <span style={{display:'flex',gap:6}}>
                <button className="small ghost" onClick={()=>{setSessEditing(s.id); setSessDraft(JSON.parse(JSON.stringify(s)));}}>Edit</button>
                {sessConfirmDelete===s.id ? (
                  <span style={{display:'flex',gap:4}}><button className="small danger" onClick={()=>{onDeleteProtocolSession(s.id); setSessConfirmDelete(null);}}>Confirm</button><button className="small ghost" onClick={()=>setSessConfirmDelete(null)}>Cancel</button></span>
                ) : <button className="small ghost" onClick={()=>setSessConfirmDelete(s.id)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
        {sessDraft ? (
          <div style={{border:'1px solid var(--border)',borderRadius:2,padding:12}}>
            <div className="grid2">
              <div className="field"><label>Protocol Label</label><input type="text" value={sessDraft.protocol} onChange={e=>setSessDraft(Object.assign({},sessDraft,{protocol:e.target.value}))} /></div>
              <div className="field"><label>Session Name</label><input type="text" value={sessDraft.name} onChange={e=>setSessDraft(Object.assign({},sessDraft,{name:e.target.value}))} /></div>
            </div>
            <div className="field"><label>Briefing</label><textarea value={sessDraft.briefing||''} onChange={e=>setSessDraft(Object.assign({},sessDraft,{briefing:e.target.value}))} rows="2" style={{width:'100%'}} /></div>
            <div className="field"><label>Training Note</label><textarea value={sessDraft.trainingNote||''} onChange={e=>setSessDraft(Object.assign({},sessDraft,{trainingNote:e.target.value}))} rows="2" style={{width:'100%'}} /></div>
            <div className="field"><label>Requires Specialization (blank = available to everyone)</label>
              <input type="text" value={sessDraft.requiresSpecialization||''} onChange={e=>setSessDraft(Object.assign({},sessDraft,{requiresSpecialization:e.target.value||null}))} placeholder="e.g. Heavy Assault" />
            </div>
            <label>Objectives ({sessDraft.objectives.length})</label>
            {sessDraft.objectives.map((o,i) => (
              <div key={i} className="exercise-pending">
                <div>{o.name} — {o.sets}×{o.repLow}-{o.repHigh} {o.unit} ({o.muscleGroup})</div>
                <button className="small ghost" onClick={()=>setSessDraft(Object.assign({},sessDraft,{objectives:sessDraft.objectives.filter((_,idx)=>idx!==i)}))}>Remove</button>
              </div>
            ))}
            {exercises.length > 0 && (
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <select id="sessAddEx" style={{flex:1}} defaultValue={exercises[0].name}>
                  {exercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}{ex.secondaryMuscleGroups && ex.secondaryMuscleGroups.length ? ' ('+ex.muscleGroup+' +'+ex.secondaryMuscleGroups.join('/')+')' : ''}</option>)}
                </select>
                <button className="ghost small" onClick={()=>{
                  const sel = document.getElementById('sessAddEx').value;
                  const ex = exercises.find(e=>e.name===sel);
                  setSessDraft(Object.assign({},sessDraft,{objectives: sessDraft.objectives.concat([{name:ex.name, muscleGroup:ex.muscleGroup, unit:ex.unit, sets:3, repLow:10, repHigh:12, alternatives:ex.alternatives}])}));
                }}>+ Add Exercise</button>
              </div>
            )}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button className="primary small" onClick={()=>{
                const toSave = Object.assign({}, sessDraft, {id: sessDraft.id || ('custom_session_'+Date.now())});
                onSaveProtocolSession(toSave); setSessDraft(null); setSessEditing(null);
              }}>Save Session</button>
              <button className="ghost small" onClick={()=>{setSessDraft(null); setSessEditing(null);}}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="ghost small" onClick={()=>setSessDraft({id:undefined, protocol:'Protocol Alpha', name:'New Session', briefing:'', trainingNote:'', conditioningOptions:[], requiresSpecialization:null, objectives:[]})}>+ Add Protocol Session</button>
        )}
      </div>

      <div className="panel">
        <div className="bracket-label">Admin — Command Quips ({quips.length})</div>
        <div className="info-note" style={{marginBottom:12}}>One quip shows per day in the Sitrep panel, picked deterministically so it's the same for everyone all day. Add as many as you like.</div>
        <div style={{maxHeight:240,overflowY:'auto',marginBottom:14}}>
          {quips.map(q => (
            <div key={q.id} className="field-row">
              <span style={{fontSize:12}}>{q.text}</span>
              <button className="small ghost" onClick={()=>onDeleteQuip(q.id)}>Delete</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <input type="text" value={newQuipText} onChange={e=>setNewQuipText(e.target.value)} placeholder="New Command quip..." style={{flex:1}} />
          <button className="primary small" onClick={()=>{onSaveQuip(newQuipText); setNewQuipText('');}}>Add</button>
        </div>
      </div>

      <div className="panel">
        <div className="bracket-label">Admin — Daily Challenge Pool ({challengePool.length})</div>
        <div className="info-note" style={{marginBottom:12}}>One challenge is picked per day, same for every operator, deterministically — same pattern as Command Quips. Completing it (any matching logged work today, cumulative) earns recognition toward milestone Awards.</div>
        <div style={{maxHeight:240,overflowY:'auto',marginBottom:14}}>
          {challengePool.map(c => (
            <div key={c.id} className="field-row">
              <span style={{fontSize:12}}>{c.name} — {c.target} {c.muscleGroup} {c.unit}</span>
              <button className="small ghost" onClick={()=>onDeleteChallenge(c.id)}>Delete</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <input type="text" placeholder="Challenge name" value={challengeDraft.name} onChange={e=>setChallengeDraft(Object.assign({},challengeDraft,{name:e.target.value}))} style={{flex:'1 1 140px'}} />
          <select value={challengeDraft.muscleGroup} onChange={e=>setChallengeDraft(Object.assign({},challengeDraft,{muscleGroup:e.target.value}))}>{MUSCLE_GROUPS_LIST.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <select value={challengeDraft.unit} onChange={e=>setChallengeDraft(Object.assign({},challengeDraft,{unit:e.target.value}))}><option value="reps">reps</option><option value="minutes">minutes</option></select>
          <input type="number" placeholder="Target" value={challengeDraft.target} onChange={e=>setChallengeDraft(Object.assign({},challengeDraft,{target:e.target.value}))} style={{width:80}} />
          <button className="small ghost" onClick={()=>{
            if (!challengeDraft.name.trim() || !challengeDraft.target) return;
            onSaveChallenge({ name: challengeDraft.name.trim(), muscleGroup: challengeDraft.muscleGroup, unit: challengeDraft.unit, target: Number(challengeDraft.target) });
            setChallengeDraft({name:'', muscleGroup:MUSCLE_GROUPS_LIST[0], target:'', unit:'reps'});
          }}>+ Add</button>
        </div>
      </div>
      </>)}
      {subTab==='competitive' && (<>

      <div className="panel">
        <div className="bracket-label">Admin — Leaderboard Seasons ({seasons.length})</div>
        <div className="info-note" style={{marginBottom:12}}>When today falls within a season's date range, Squad MCP, Campaign Contribution, and Raid Fastest-Clear leaderboards reset to only count that window — keeps things winnable instead of one permanent all-time board. No active season falls back to all-time automatically.</div>
        <div style={{maxHeight:200,overflowY:'auto',marginBottom:14}}>
          {seasons.map(s => (
            <div key={s.id} className="field-row">
              <span style={{fontSize:12}}>{s.name} — {s.startDate} to {s.endDate}{computeCurrentSeason(seasons) && computeCurrentSeason(seasons).id===s.id ? ' (current)' : ''}</span>
              <button className="small ghost" onClick={()=>onDeleteSeason(s.id)}>Delete</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <input type="text" placeholder="Season name" value={seasonDraft.name} onChange={e=>setSeasonDraft(Object.assign({},seasonDraft,{name:e.target.value}))} style={{flex:'1 1 140px'}} />
          <input type="date" value={seasonDraft.startDate} onChange={e=>setSeasonDraft(Object.assign({},seasonDraft,{startDate:e.target.value}))} />
          <input type="date" value={seasonDraft.endDate} onChange={e=>setSeasonDraft(Object.assign({},seasonDraft,{endDate:e.target.value}))} />
          <button className="small ghost" onClick={()=>{
            if (!seasonDraft.name.trim() || !seasonDraft.startDate || !seasonDraft.endDate) return;
            onSaveSeason(seasonDraft);
            setSeasonDraft({name:'', startDate:'', endDate:''});
          }}>+ Add Season</button>
        </div>
      </div>

      <div className="panel">
        <div className="bracket-label">Admin — Announcements ({announcements.length})</div>
        <div className="info-note" style={{marginBottom:12}}>Every operator sees the most recent active announcement they haven't dismissed yet, as a pop-up on load. Dismissing is permanent per operator — set "Active" off to retire an announcement without deleting its history.</div>
        <div style={{maxHeight:220,overflowY:'auto',marginBottom:14}}>
          {announcements.map(a => (
            <div key={a.id} className="field-row">
              <span style={{fontSize:12}}>{a.title} {!a.active && <span className="dim">(inactive)</span>}</span>
              <span style={{display:'flex',gap:6}}>
                <button className="small ghost" onClick={()=>setAnnouncementDraft(Object.assign({},a))}>Edit</button>
                {announcementConfirmDelete===a.id ? (
                  <span style={{display:'flex',gap:4}}><button className="small danger" onClick={()=>{onDeleteAnnouncement(a.id); setAnnouncementConfirmDelete(null);}}>Confirm</button><button className="small ghost" onClick={()=>setAnnouncementConfirmDelete(null)}>Cancel</button></span>
                ) : <button className="small ghost" onClick={()=>setAnnouncementConfirmDelete(a.id)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
        {announcementDraft ? (
          <div style={{border:'1px solid var(--border)',borderRadius:2,padding:12}}>
            <div className="field"><label>Title</label><input type="text" value={announcementDraft.title||''} onChange={e=>setAnnouncementDraft(Object.assign({},announcementDraft,{title:e.target.value}))} /></div>
            <div className="field"><label>Body</label><textarea value={announcementDraft.body||''} onChange={e=>setAnnouncementDraft(Object.assign({},announcementDraft,{body:e.target.value}))} rows="4" style={{width:'100%'}} /></div>
            {announcementDraft.id && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <input type="checkbox" checked={announcementDraft.active!==false} onChange={e=>setAnnouncementDraft(Object.assign({},announcementDraft,{active:e.target.checked}))} style={{width:14,height:14}} />
                <label style={{marginBottom:0,textTransform:'none',fontSize:12}}>Active</label>
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <button className="primary small" onClick={()=>{
                if (!announcementDraft.title || !announcementDraft.title.trim() || !announcementDraft.body || !announcementDraft.body.trim()) return;
                onSaveAnnouncement(announcementDraft);
                setAnnouncementDraft(null);
              }}>Save</button>
              <button className="ghost small" onClick={()=>setAnnouncementDraft(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="ghost small" onClick={()=>setAnnouncementDraft({id:undefined, title:'', body:''})}>+ New Announcement</button>
        )}
      </div>

      <div className="panel">
        <div className="bracket-label">Admin — Squad Raids ({raidTemplates.length})</div>
        <div className="info-note" style={{marginBottom:12}}>Each Area's objectives use flat, hand-set targets (not scaled by squad size) so clear-time leaderboards stay fair across squads of different sizes.</div>
        <div style={{maxHeight:240,overflowY:'auto',marginBottom:14}}>
          {raidTemplates.map(t => (
            <div key={t.id} className="field-row">
              <span>{t.name} <span className="dim mono" style={{fontSize:10}}>(Boss: {t.bossName} · {t.areas.length} area{t.areas.length===1?'':'s'})</span></span>
              <span style={{display:'flex',gap:6}}>
                <button className="small ghost" onClick={()=>{setRaidEditing(t.id); setRaidDraft(JSON.parse(JSON.stringify(t)));}}>Edit</button>
                {raidConfirmDelete===t.id ? (
                  <span style={{display:'flex',gap:4}}><button className="small danger" onClick={()=>{onDeleteRaidTemplate(t.id); setRaidConfirmDelete(null);}}>Confirm</button><button className="small ghost" onClick={()=>setRaidConfirmDelete(null)}>Cancel</button></span>
                ) : <button className="small ghost" onClick={()=>setRaidConfirmDelete(t.id)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
        {raidDraft ? (
          <div style={{border:'1px solid var(--border)',borderRadius:2,padding:12}}>
            <div className="grid2">
              <div className="field"><label>Raid Name</label><input type="text" value={raidDraft.name} onChange={e=>setRaidDraft(Object.assign({},raidDraft,{name:e.target.value}))} /></div>
              <div className="field"><label>Boss Name</label><input type="text" value={raidDraft.bossName} onChange={e=>setRaidDraft(Object.assign({},raidDraft,{bossName:e.target.value}))} /></div>
            </div>
            <div className="field"><label>Boss Flavor Text (shown on the final Area)</label>
              <textarea value={raidDraft.bossFlavor||''} onChange={e=>setRaidDraft(Object.assign({},raidDraft,{bossFlavor:e.target.value}))} rows="2" style={{width:'100%'}} />
            </div>

            <label>Areas ({raidDraft.areas.length}) — the last one is the Boss Fight</label>
            {raidDraft.areas.map((area, ai) => (
              <div key={ai} style={{border:'1px solid var(--border)',borderRadius:2,padding:10,marginTop:8}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                  <input type="text" value={area.name} onChange={e=>{
                    const areas = raidDraft.areas.slice(); areas[ai] = Object.assign({},area,{name:e.target.value});
                    setRaidDraft(Object.assign({},raidDraft,{areas}));
                  }} style={{flex:1}} placeholder={"Area "+(ai+1)+" name"} />
                  <button className="small ghost" onClick={()=>setRaidDraft(Object.assign({},raidDraft,{areas:raidDraft.areas.filter((_,idx)=>idx!==ai)}))}>Remove Area</button>
                </div>
                {area.objectives.map((o, oi) => (
                  <div key={oi} className="field-row">
                    <span style={{fontSize:11}}>{o.name} — {o.target} {o.unit} ({o.muscleGroup})</span>
                    <button className="small ghost" onClick={()=>{
                      const areas = raidDraft.areas.slice();
                      areas[ai] = Object.assign({},area,{objectives:area.objectives.filter((_,idx)=>idx!==oi)});
                      setRaidDraft(Object.assign({},raidDraft,{areas}));
                    }}>Remove</button>
                  </div>
                ))}
                <RaidObjectiveAdder onAdd={(obj)=>{
                  const areas = raidDraft.areas.slice();
                  areas[ai] = Object.assign({},area,{objectives:area.objectives.concat([obj])});
                  setRaidDraft(Object.assign({},raidDraft,{areas}));
                }} />
              </div>
            ))}
            <button className="ghost small" style={{marginTop:8}} onClick={()=>setRaidDraft(Object.assign({},raidDraft,{areas:raidDraft.areas.concat([{name:'New Area', objectives:[]}])}))}>+ Add Area</button>

            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button className="primary small" disabled={raidSaving} onClick={async()=>{
                setRaidSaving(true); await onSaveRaidTemplate(raidDraft); setRaidSaving(false); setRaidDraft(null); setRaidEditing(null);
              }}>{raidSaving ? 'Saving...' : 'Save Raid'}</button>
              <button className="ghost small" onClick={()=>{setRaidDraft(null); setRaidEditing(null);}}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="ghost small" onClick={()=>setRaidDraft({id:undefined, name:'New Raid', bossName:'Unnamed Threat', bossFlavor:'', areas:[]})}>+ New Raid</button>
        )}
      </div>
      </>)}
      {subTab==='roster' && (<>

      <div className="panel">
        <div className="bracket-label">Admin — Roster Management</div>
        <div className="info-note" style={{marginBottom:12}}>Toggling Admin or Mod automatically sets the operator's rank to Command Staff or Jr Command Staff — these are conferred by role, not chosen. Admin takes precedence if both are checked.</div>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Callsign</th><th>Weekly Target</th><th>Age Division</th><th>Birthdate</th><th>Admin</th><th>Mod</th><th>Command Rank</th><th></th><th></th></tr></thead>
          <tbody>
            {operators.map(o => (
              <tr key={o.id}>
                <td className="disp" style={{fontFamily:"'Oswald',sans-serif"}}>{o.callsign}</td>
                <td><input type="number" value={o.weeklyTarget} onChange={e=>updateOpField(o.id,'weeklyTarget',e.target.value)} style={{width:60}} /></td>
                <td><select value={o.ageDivision} onChange={e=>updateOpField(o.id,'ageDivision',e.target.value)}>{AGE_DIVISIONS.map(a => <option key={a} value={a}>{a}</option>)}</select></td>
                <td><input type="date" value={o.birthdate||''} onChange={e=>onUpdateBirthdateAdmin(o.id, e.target.value)} style={{fontSize:11}} /></td>
                <td><input type="checkbox" checked={!!o.isAdmin} onChange={e=>updateOpField(o.id,'isAdmin',e.target.checked)} /></td>
                <td><input type="checkbox" checked={!!o.isModerator} onChange={e=>updateOpField(o.id,'isModerator',e.target.checked)} /></td>
                <td className="dim" style={{fontSize:11}}>{(() => { const oOrs = computeORS(o.id, o, logs); const oStatus = computeReadinessStatus(o.id, logs); return commandRankDisplay(computeCommandRank(o, oOrs.ors, o.id, logs, campaigns, oStatus)) || '—'; })()}</td>
                <td><button className="small ghost" onClick={()=>{setGrantAwardFor(o.id); setGrantAwardDraft({title:'', description:''});}}>Grant Award</button></td>
                <td>
                  {confirmDelete===o.id ? (
                    <span style={{display:'flex',gap:6}}><button className="small danger" onClick={()=>deleteOperator(o.id)}>Confirm</button><button className="small ghost" onClick={()=>setConfirmDelete(null)}>Cancel</button></span>
                  ) : <button className="small ghost" onClick={()=>setConfirmDelete(o.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {grantAwardFor && (
          <div style={{border:'1px solid var(--amber)',borderRadius:2,padding:12,marginTop:14}}>
            <div style={{fontSize:12,marginBottom:8}}>Granting an award to <strong>{(operators.find(o=>o.id===grantAwardFor)||{}).callsign}</strong></div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button className="ghost small" onClick={()=>setGrantAwardDraft({title:'Founding Operator', description:'Here from the beginning \u2014 before there was a wide audience, before there was a track record. Just training, and trust that it would matter.'})}>Use "Founding Operator" preset</button>
            </div>
            <div className="field"><label>Title</label><input type="text" value={grantAwardDraft.title} onChange={e=>setGrantAwardDraft(Object.assign({},grantAwardDraft,{title:e.target.value}))} /></div>
            <div className="field"><label>Description</label><textarea value={grantAwardDraft.description} onChange={e=>setGrantAwardDraft(Object.assign({},grantAwardDraft,{description:e.target.value}))} rows="3" style={{width:'100%'}} /></div>
            <div style={{display:'flex',gap:8}}>
              <button className="primary small" onClick={()=>{
                if (!grantAwardDraft.title.trim()) return;
                const isFounding = grantAwardDraft.title.trim() === 'Founding Operator';
                onGrantAward(grantAwardFor, grantAwardDraft.title.trim(), grantAwardDraft.description.trim(), isFounding ? 'founding_operator' : null);
                setGrantAwardFor(null);
              }}>Grant</button>
              <button className="ghost small" onClick={()=>setGrantAwardFor(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
        </>)}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
