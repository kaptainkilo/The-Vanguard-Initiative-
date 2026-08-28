function LogActivity({ deployedCampaign, activeOp, logs, addLogs, campaigns, exercises, protocolSessions, onRecordPR, raidTemplates, raidInstances }) {
  const builtInSessions = protocolSessions.filter(s => !s.requiresSpecialization || s.requiresSpecialization === activeOp.specialization);
  const combinedSessions = builtInSessions.concat((activeOp.customProtocols||[]).map(cp => ({
    id: cp.id, protocol: 'Custom', name: cp.name, objectives: cp.objectives, briefing: null, trainingNote: null, conditioningOptions: []
  })));
  const activeRaidInstance = activeOp.squadId ? raidInstances.find(r => r.squadId === activeOp.squadId && r.status === 'active') : null;
  const activeRaidTemplate = activeRaidInstance ? raidTemplates.find(t => t.id === activeRaidInstance.raidTemplateId) : null;

  const [mode, setMode] = useState('structured');
  const [selectedProtocolFilter, setSelectedProtocolFilter] = useState(combinedSessions[0] ? combinedSessions[0].protocol : '');
  const [sessionId, setSessionId] = useState(combinedSessions[0] ? combinedSessions[0].id : '');
  const [objSets, setObjSets] = useState({});
  const [objVariant, setObjVariant] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [protocolLabel, setProtocolLabel] = useState('Protocol Alpha');
  const [pending, setPending] = useState([]);
  const [exName, setExName] = useState(exercises[0] ? exercises[0].name : '');
  const [variant, setVariant] = useState(exercises[0] ? exercises[0].name : '');
  const [sets, setSets] = useState([{reps:'', weight:''}]);
  const [duration, setDuration] = useState('');
  const [locationId, setLocationId] = useState(null);
  const [amount, setAmount] = useState('');
  const [restNote, setRestNote] = useState('');
  const [restBusy, setRestBusy] = useState(false);

  if (exercises.length === 0 || protocolSessions.length === 0) {
    return <div className="panel"><div className="empty"><div className="empty-title">Exercise or Protocol Session library not loaded.</div><div>Run exercises_and_sessions_to_db.sql in Supabase, then refresh.</div></div></div>;
  }

  const session = combinedSessions.find(s => s.id === sessionId) || combinedSessions[0];
  function suggestedTarget(obj) { return obj.repHigh >= 50 ? obj.repLow : obj.repHigh; }
  function getObjSets(idx, obj) {
    if (objSets[idx]) return objSets[idx];
    const target = suggestedTarget(obj);
    return Array.from({length: obj.sets}, () => ({reps: String(target), weight: '', checked: true}));
  }
  function updateObjSet(idx, setIdx, field, val) {
    const cur = getObjSets(idx, session.objectives[idx]).slice();
    cur[setIdx] = Object.assign({}, cur[setIdx], {[field]: val});
    setObjSets(Object.assign({}, objSets, {[idx]: cur}));
  }
  function toggleObjSetChecked(idx, setIdx, obj) {
    const cur = getObjSets(idx, obj).slice();
    cur[setIdx] = Object.assign({}, cur[setIdx], {checked: !cur[setIdx].checked});
    setObjSets(Object.assign({}, objSets, {[idx]: cur}));
  }

  async function submitStructuredSession() {
    const entries = []; const now = Date.now(); const autoNotes = []; const prNotes = []; const prWrites = [];
    session.objectives.forEach((obj, idx) => {
      const setRows = getObjSets(idx, obj);
      const totalValue = setRows.reduce((s,r)=> s + (parseFloat(r.reps)||0), 0);
      if (totalValue <= 0) return;
      const variantUsed = objVariant[idx] || obj.name;
      const priorBest = personalBest(activeOp.id, logs, variantUsed);
      if (priorBest !== null && totalValue > priorBest) {
        prNotes.push(variantUsed+' — new personal best! ('+totalValue+' vs previous '+priorBest+')');
        prWrites.push(onRecordPR(activeOp, variantUsed, totalValue, obj.unit));
      }
      const ts = now + idx*2; const logId = 'log_'+ts;
      entries.push({ id: logId, operatorId: activeOp.id, type:'protocol', date: todayStr(), timestamp: ts, protocolLabel: session.protocol, exercise: obj.name, variant: variantUsed, category: obj.muscleGroup, unit: obj.unit, sets: setRows.filter(r=>r.reps), totalValue: totalValue, detail: setRows.filter(r=>r.reps).map(r=>(r.reps||0)+(r.weight?'@'+r.weight+'lb':'')).join(', ') });
      if (deployedCampaign) {
        const loc = findLocationForCategory(deployedCampaign, obj.muscleGroup);
        if (loc) {
          const alreadyToday = logs.filter(l => l.type==='campaign' && l.campaignId===deployedCampaign.id && l.operatorId===activeOp.id && l.locationId===loc.id && l.date===todayStr()).concat(entries.filter(e2 => e2.type==='campaign' && e2.locationId===loc.id));
          const isFirst = alreadyToday.length === 0;
          entries.push({ id: logId+'_auto', operatorId: activeOp.id, type:'campaign', campaignId: deployedCampaign.id, locationId: loc.id, amount: totalValue, date: todayStr(), timestamp: ts+1, source:'protocol-auto', sourceExercise: obj.name });
          autoNotes.push(obj.name+' ('+totalValue+' '+obj.unit+') auto-credited to '+loc.name+(isFirst?'':' at half value (soft cap)'));
        }
        // Secondary muscle groups (looked up from the live exercise library by name) credit at half rate.
        const exDef = exercises.find(e => e.name === obj.name);
        (exDef && exDef.secondaryMuscleGroups || []).forEach(secGroup => {
          const secLoc = findLocationForCategory(deployedCampaign, secGroup);
          if (secLoc && secLoc.id !== (loc && loc.id)) {
            const secAmount = totalValue * 0.5;
            entries.push({ id: logId+'_sec_'+secGroup, operatorId: activeOp.id, type:'campaign', campaignId: deployedCampaign.id, locationId: secLoc.id, amount: secAmount, date: todayStr(), timestamp: ts+1, source:'protocol-auto-secondary', sourceExercise: obj.name });
            autoNotes.push(obj.name+' also credited '+secLoc.name+' at half rate ('+secAmount+' '+secLoc.unit+', secondary muscle)');
          }
        });
      }
      // Squad Raid crediting — independent of Campaign deployment.
      if (activeRaidInstance && activeRaidTemplate) {
        const raidObj = findRaidObjective(activeRaidTemplate, activeRaidInstance, obj.muscleGroup);
        if (raidObj) {
          entries.push({ id: logId+'_raid', operatorId: activeOp.id, type:'raid', raidInstanceId: activeRaidInstance.id, raidAreaId: raidObj.raidAreaId, raidObjectiveId: raidObj.id, amount: totalValue, date: todayStr(), timestamp: ts+1, source:'protocol-auto-raid', sourceExercise: obj.name });
          autoNotes.push(obj.name+' ('+totalValue+' '+obj.unit+') credited to the Raid — '+raidObj.name);
        }
      }
    });
    if (entries.length === 0) { setFeedback({cap:false,text:'Log at least one set before submitting.'}); return; }
    if (prWrites.length) await Promise.all(prWrites);
    const result = await addLogs(entries);
    if (result && result.error) { setFeedback({ win:false, text: 'Failed to save: '+result.error }); return; }
    let text = session.name+' logged, '+activeOp.callsign+'.';
    if (prNotes.length) text += ' ' + prNotes.join(' ');
    text += autoNotes.length ? ' '+autoNotes.join('. ')+'.' : (deployedCampaign ? ' No matching Location for this session\u2019s exercises.' : ' Not currently deployed \u2014 no Campaign credit applied.');
    setFeedback({ win:true, text: text });
    setObjSets({}); setObjVariant({});
  }

  const exObj = exercises.find(e => e.name === exName);
  const isTimeBased = exObj.unit === 'minutes' || exObj.unit === 'seconds';
  function updateSet(i, field, val) { const ns = sets.slice(); ns[i] = Object.assign({}, ns[i], {[field]: val}); setSets(ns); }
  function addSetRow() { setSets(sets.concat([{reps:'', weight:''}])); }
  function removeSetRow(i) { setSets(sets.filter((_,idx)=>idx!==i)); }
  function addExerciseToPending() {
    let totalValue = 0, detail = '';
    if (isTimeBased) { totalValue = parseFloat(duration) || 0; detail = totalValue + ' ' + exObj.unit; }
    else { totalValue = sets.reduce((s,st) => s + (parseFloat(st.reps)||0), 0); detail = sets.map(st => (st.reps||0)+(st.weight?'@'+st.weight+'lb':'')).join(', '); }
    if (totalValue <= 0) return;
    setPending(pending.concat([{ exercise: exName, variant: variant, muscleGroup: exObj.muscleGroup, unit: exObj.unit, isTimeBased: isTimeBased, sets: isTimeBased ? [] : sets.filter(s=>s.reps), totalValue: totalValue, detail: detail }]));
    setSets([{reps:'',weight:''}]); setDuration('');
  }
  function removePending(i) { setPending(pending.filter((_,idx)=>idx!==i)); }

  async function submitFreeformSession() {
    if (pending.length === 0) return;
    const entries = []; const now = Date.now(); const autoNotes = []; const prNotes = []; const prWrites = [];
    pending.forEach((ex, i) => {
      const priorBest = personalBest(activeOp.id, logs, ex.variant);
      if (priorBest !== null && ex.totalValue > priorBest) {
        prNotes.push(ex.variant+' — new personal best!');
        prWrites.push(onRecordPR(activeOp, ex.variant, ex.totalValue, ex.unit));
      }
      const ts = now + i*2; const logId = 'log_'+ts;
      entries.push({ id: logId, operatorId: activeOp.id, type:'protocol', date: todayStr(), timestamp: ts, protocolLabel: protocolLabel, exercise: ex.exercise, variant: ex.variant, category: ex.muscleGroup, unit: ex.unit, sets: ex.sets, totalValue: ex.totalValue, detail: ex.detail });
      if (deployedCampaign) {
        const loc = findLocationForCategory(deployedCampaign, ex.muscleGroup);
        if (loc) {
          const alreadyToday = logs.filter(l => l.type==='campaign' && l.campaignId===deployedCampaign.id && l.operatorId===activeOp.id && l.locationId===loc.id && l.date===todayStr()).concat(entries.filter(e2 => e2.type==='campaign' && e2.locationId===loc.id));
          const isFirst = alreadyToday.length === 0;
          entries.push({ id: logId+'_auto', operatorId: activeOp.id, type:'campaign', campaignId: deployedCampaign.id, locationId: loc.id, amount: ex.totalValue, date: todayStr(), timestamp: ts+1, source:'protocol-auto', sourceExercise: ex.exercise });
          autoNotes.push(ex.exercise+' ('+ex.totalValue+' '+ex.unit+') auto-credited to '+loc.name+(isFirst?'':' at half value (soft cap)'));
        }
        const exDef = exercises.find(e => e.name === ex.exercise);
        (exDef && exDef.secondaryMuscleGroups || []).forEach(secGroup => {
          const secLoc = findLocationForCategory(deployedCampaign, secGroup);
          if (secLoc && secLoc.id !== (loc && loc.id)) {
            const secAmount = ex.totalValue * 0.5;
            entries.push({ id: logId+'_sec_'+secGroup, operatorId: activeOp.id, type:'campaign', campaignId: deployedCampaign.id, locationId: secLoc.id, amount: secAmount, date: todayStr(), timestamp: ts+1, source:'protocol-auto-secondary', sourceExercise: ex.exercise });
            autoNotes.push(ex.exercise+' also credited '+secLoc.name+' at half rate ('+secAmount+' '+secLoc.unit+', secondary muscle)');
          }
        });
      }
      if (activeRaidInstance && activeRaidTemplate) {
        const raidObj = findRaidObjective(activeRaidTemplate, activeRaidInstance, ex.muscleGroup);
        if (raidObj) {
          entries.push({ id: logId+'_raid', operatorId: activeOp.id, type:'raid', raidInstanceId: activeRaidInstance.id, raidAreaId: raidObj.raidAreaId, raidObjectiveId: raidObj.id, amount: ex.totalValue, date: todayStr(), timestamp: ts+1, source:'protocol-auto-raid', sourceExercise: ex.exercise });
          autoNotes.push(ex.exercise+' ('+ex.totalValue+' '+ex.unit+') credited to the Raid — '+raidObj.name);
        }
      }
    });
    if (prWrites.length) await Promise.all(prWrites);
    const result = await addLogs(entries);
    if (result && result.error) { setFeedback({ win:false, text: 'Failed to save: '+result.error }); return; }
    let text = 'Session logged, '+activeOp.callsign+'. '+pending.length+' exercise(s) recorded.';
    if (prNotes.length) text += ' ' + prNotes.join(' ');
    text += autoNotes.length ? ' ' + autoNotes.join('. ') + '.' : (deployedCampaign ? ' No matching Location.' : ' Not currently deployed \u2014 no Campaign credit applied.');
    setFeedback({ win: true, text: text });
    setPending([]);
  }

  async function submitManualCampaign() {
    if (!deployedCampaign) { setFeedback({cap:false, text:'Deploy to a Campaign first \u2014 see the Campaigns tab.'}); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFeedback({cap:false, text:'Enter a valid amount before submitting, Operator.'}); return; }
    const locId = locationId || deployedCampaign.locations[0].id;
    const now = Date.now();
    const entry = { id:'log_'+now, operatorId: activeOp.id, type:'campaign', campaignId: deployedCampaign.id, locationId: locId, amount: amt, date: todayStr(), timestamp: now };
    const todaysAtLoc = logs.filter(l => l.type==='campaign' && l.campaignId===deployedCampaign.id && l.operatorId===activeOp.id && l.locationId===locId && l.date===todayStr());
    const result = await addLogs([entry]);
    if (result && result.error) { setFeedback({ win:false, text: 'Failed to save: '+result.error }); return; }
    if (todaysAtLoc.length >= 1) setFeedback({cap:true, text:"Contribution logged, Operator. Today's push is in \u2014 Command's got it. Anything more today still counts, just at half value. That's not a penalty. That's the mission reminding you recovery is part of it too. The Swarm doesn't stop. You're allowed to."});
    else setFeedback({cap:false, text:'Contribution logged, Operator. Command sees it.'});
    setAmount('');
  }

  async function submitRestDay() {
    const today = todayStr();
    if (logs.some(l => l.operatorId===activeOp.id && l.date===today && l.type==='rest')) {
      setFeedback({ win:false, text: 'Already logged a Rest Day for today, Operator.' }); return;
    }
    setRestBusy(true);
    const entry = { id:'log_'+Date.now(), operatorId: activeOp.id, type:'rest', date: today, timestamp: Date.now(), category:'Rest', unit:'day', totalValue:0, detail: restNote.trim() || null };
    const result = await addLogs([entry]);
    setRestBusy(false);
    if (result && result.error) { setFeedback({ win:false, text: 'Failed to save: '+result.error }); return; }
    setFeedback({ win:true, text: "Rest Day logged, "+activeOp.callsign+". Recovery is part of the mission, not a break from it. Your readiness rate still counts today." });
    setRestNote('');
  }

  const campLoc = deployedCampaign ? deployedCampaign.locations.find(l => l.id === (locationId||deployedCampaign.locations[0].id)) : null;

  return (
    <div className="panel">
      <div className="bracket-label">Log Activity — {activeOp.callsign}</div>
      <div className="field">
        <label>Activity Type</label>
        <div className="radio-group">
          <div className={"radio-opt"+(mode==='structured'?' sel':'')} onClick={()=>{setMode('structured'); setFeedback(null);}}>Structured Session</div>
          <div className={"radio-opt"+(mode==='freeform'?' sel':'')} onClick={()=>{setMode('freeform'); setFeedback(null);}}>Freeform Exercise</div>
          <div className={"radio-opt"+(mode==='campaign'?' sel':'')} onClick={()=>{setMode('campaign'); setFeedback(null);}}>Campaign Contribution (manual)</div>
          <div className={"radio-opt"+(mode==='rest'?' sel':'')} onClick={()=>{setMode('rest'); setFeedback(null);}}>Rest Day</div>
        </div>
      </div>

      {mode === 'structured' && (
        <div>
          <div className="grid2">
            <div className="field">
              <label>Protocol</label>
              <select style={{width:'100%'}} value={selectedProtocolFilter} onChange={e=>{
                const newProtocol = e.target.value;
                setSelectedProtocolFilter(newProtocol);
                const firstInProtocol = combinedSessions.find(s => s.protocol === newProtocol);
                if (firstInProtocol) { setSessionId(firstInProtocol.id); setObjSets({}); setObjVariant({}); }
              }}>
                {Array.from(new Set(combinedSessions.map(s=>s.protocol))).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Workout</label>
              <select style={{width:'100%'}} value={sessionId} onChange={e=>{setSessionId(e.target.value); setObjSets({}); setObjVariant({});}}>
                {combinedSessions.filter(s => s.protocol === selectedProtocolFilter).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {session.briefing && <div className="info-note" style={{marginBottom:14}}><strong>Mission Briefing:</strong> {session.briefing}</div>}
          {session.objectives.map((obj, idx) => {
            const isTB = obj.unit === 'seconds' || obj.unit === 'minutes';
            const rows = getObjSets(idx, obj);
            return (
              <div key={idx} style={{border:'1px solid var(--border)', borderRadius:2, padding:12, marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div><strong>{obj.name}</strong> <span className="dim" style={{fontSize:11}}>— {obj.sets}×{obj.repLow===obj.repHigh?obj.repLow:obj.repLow+'–'+obj.repHigh} {obj.unit}</span></div>
                  <select value={objVariant[idx]||obj.name} onChange={e=>setObjVariant(Object.assign({},objVariant,{[idx]:e.target.value}))} style={{fontSize:11}}>
                    <option value={obj.name}>{obj.name} (standard)</option>
                    {(obj.alternatives||[]).map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                {(() => {
                  const currentVariant = objVariant[idx]||obj.name;
                  const last = lastLoggedExercise(activeOp.id, logs, currentVariant);
                  return last ? (
                    <div className="dim mono" style={{fontSize:10,marginBottom:8}}>Last time ({last.date}): {last.detail}</div>
                  ) : null;
                })()}
                {rows.map((r,si) => (
                  <div className="set-row" key={si}>
                    <span>{si+1}</span>
                    <input type="checkbox" checked={!!r.checked} onChange={()=>toggleObjSetChecked(idx,si,obj)} style={{width:16,height:16,flex:'none'}} />
                    {r.checked ? (
                      <div style={{flex:1,fontSize:13,color:'var(--amber)',cursor:'pointer'}} onClick={()=>toggleObjSetChecked(idx,si,obj)}>✓ {r.reps} {obj.unit}{r.weight?' @ '+r.weight+'lb':''} <span className="dim" style={{fontSize:10}}>(as prescribed — tap to edit)</span></div>
                    ) : (
                      <React.Fragment>
                        <input type="number" placeholder={isTB?obj.unit:'Reps'} value={r.reps} onChange={e=>updateObjSet(idx,si,'reps',e.target.value)} />
                        {!isTB && <input type="number" placeholder="Weight (lb)" value={r.weight} onChange={e=>updateObjSet(idx,si,'weight',e.target.value)} />}
                      </React.Fragment>
                    )}
                  </div>
                ))}
                <div className="dim" style={{fontSize:10,marginTop:4}}>Checked sets log the prescribed {suggestedTarget(obj)} {obj.unit} automatically. Uncheck any set to enter what you actually did.</div>
              </div>
            );
          })}
          {session.conditioningOptions && session.conditioningOptions.length > 0 && (
            <div className="info-note" style={{marginBottom:14}}>
              <strong>Field Conditioning (choose one, log separately if performed):</strong>
              <ul style={{marginTop:6,paddingLeft:18}}>{session.conditioningOptions.map((c,i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
          {session.trainingNote && <div style={{fontSize:11,color:'var(--text-dim)',fontStyle:'italic',marginBottom:14}}>"{session.trainingNote}"</div>}
          <button className="primary" style={{width:'100%'}} onClick={submitStructuredSession}>Submit Session AAR</button>
        </div>
      )}

      {mode === 'freeform' && (
        <div>
          <div className="field">
            <label>Protocol</label>
            <select style={{width:'100%'}} value={protocolLabel} onChange={e=>setProtocolLabel(e.target.value)}>
              <option>Protocol Alpha</option><option>Protocol Bravo</option><option>Protocol Charlie</option>
            </select>
          </div>
          <div style={{border:'1px solid var(--border)', borderRadius:2, padding:14, marginBottom:14}}>
            <div className="field">
              <label>Exercise</label>
              <select style={{width:'100%'}} value={exName} onChange={e=>{setExName(e.target.value); setVariant(e.target.value);}}>
                {exercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}{ex.secondaryMuscleGroups && ex.secondaryMuscleGroups.length ? ' ('+ex.muscleGroup+' +'+ex.secondaryMuscleGroups.join('/')+')' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Variant / Substitution</label>
              <select style={{width:'100%'}} value={variant} onChange={e=>setVariant(e.target.value)}>
                <option value={exObj.name}>{exObj.name} (standard)</option>
                {exObj.alternatives.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {(() => {
              const last = lastLoggedExercise(activeOp.id, logs, variant);
              return (
                <div className="dim mono" style={{fontSize:11,marginBottom:10}}>
                  {last ? 'Last time ('+last.date+'): '+last.detail : 'No previous log for '+variant+' yet.'}
                </div>
              );
            })()}
            {isTimeBased ? (
              <div className="field"><label>Duration ({exObj.unit})</label><input type="number" value={duration} onChange={e=>setDuration(e.target.value)} /></div>
            ) : (
              <div className="field">
                <label>Sets</label>
                {sets.map((s,i) => (
                  <div className="set-row" key={i}>
                    <span>{i+1}</span>
                    <input type="number" placeholder="Reps" value={s.reps} onChange={e=>updateSet(i,'reps',e.target.value)} />
                    <input type="number" placeholder="Weight (lb)" value={s.weight} onChange={e=>updateSet(i,'weight',e.target.value)} />
                    {sets.length>1 && <button className="small ghost" onClick={()=>removeSetRow(i)}>✕</button>}
                  </div>
                ))}
                <button className="small ghost" onClick={addSetRow} style={{marginTop:6}}>+ Add Set</button>
              </div>
            )}
            <button className="primary" onClick={addExerciseToPending} style={{marginTop:6}}>Add Exercise to Session</button>
          </div>
          {pending.length > 0 && (
            <div style={{marginBottom:16}}>
              <label>Pending Session ({pending.length})</label>
              {pending.map((ex,i) => (
                <div className="exercise-pending" key={i}>
                  <div><strong>{ex.variant}</strong> — {ex.detail}</div>
                  <button className="small ghost" onClick={()=>removePending(i)}>Remove</button>
                </div>
              ))}
              <button className="primary" onClick={submitFreeformSession} style={{marginTop:8,width:'100%'}}>Submit Session AAR</button>
            </div>
          )}
        </div>
      )}

      {mode === 'campaign' && (
        <div>
          {!deployedCampaign && <div className="info-note">Not currently deployed. Visit the Campaigns tab first.</div>}
          {deployedCampaign && (
            <div>
              <div className="field">
                <label>Location — {deployedCampaign.name}</label>
                <div className="loc-pick">
                  {deployedCampaign.locations.map(l => (
                    <div key={l.id} className={"loc-opt"+((locationId||deployedCampaign.locations[0].id)===l.id?' sel':'')} onClick={()=>setLocationId(l.id)}>
                      <div className="loc-opt-name">{l.name}</div><div className="loc-opt-obj">{l.objective}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="field"><label>Amount ({campLoc?campLoc.unit:''})</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
              <button className="primary" onClick={submitManualCampaign}>Submit to Command</button>
            </div>
          )}
        </div>
      )}

      {mode === 'rest' && (
        <div>
          <div className="info-note" style={{marginBottom:12}}>Recovery is part of the training system, not a break from it. Logging a Rest Day keeps your readiness rate honest without counting as a training session {'\u2014'} it won't contribute to ORS Physical Capability, MCP, or any Campaign/Raid/Duel progress.</div>
          <div className="field"><label>Note (optional)</label><input type="text" value={restNote} onChange={e=>setRestNote(e.target.value)} placeholder="e.g. planned deload, feeling beat up, life got in the way..." /></div>
          <button className="primary" disabled={restBusy} onClick={submitRestDay}>{restBusy ? 'Logging...' : 'Log Rest Day'}</button>
        </div>
      )}

      {feedback && <div className={"feedback"+(feedback.cap?' cap':'')+(feedback.win?' win':'')+(feedback.win===false?' error':'')}>{feedback.text}</div>}
    </div>
  );
}

function MuscleFatigueGauge({ x, y, entry }) {
  const color = fatigueColor(entry.status);
  const pct = entry.daysSince===null ? 0 : Math.min(100, (7-Math.min(entry.daysSince,7))/7*100);
  const r = 13;
  const circumference = 2*Math.PI*r;
  const dashOffset = circumference * (1 - pct/100);
  return (
    <g transform={"translate("+x+","+y+")"}>
      <circle r={r} fill="var(--panel)" stroke="var(--border)" strokeWidth="2" />
      <circle r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={dashOffset} transform="rotate(-90)" />
      <text y="3" textAnchor="middle" fontSize="8" fill={color} fontFamily="'IBM Plex Mono',monospace">{entry.daysSince===null?'\u2014':entry.daysSince}</text>
      <text y="24" textAnchor="middle" fontSize="8" fill="var(--text-dim)" fontFamily="'IBM Plex Mono',monospace">{entry.muscleGroup}</text>
    </g>
  );
}
function MuscleFatigueSilhouette({ fatigue }) {
  const byGroup = {};
  fatigue.forEach(f => { byGroup[f.muscleGroup] = f; });
  // Groups with a sensible front-view anatomical spot get a gauge on the
  // silhouette. Back, Hamstrings, and Glutes don't have one from the
  // front — those render as a small supplementary strip below instead of
  // forcing them onto a body facing the wrong way.
  const frontPositions = [
    ['Cardio', 120, 38], ['Shoulders', 168, 76], ['Chest', 120, 96],
    ['Biceps', 172, 118], ['Triceps', 68, 118], ['Core', 120, 142],
    ['Grip', 176, 172], ['Quadriceps', 100, 232], ['Calves', 100, 322],
  ];
  const posteriorGroups = ['Back', 'Hamstrings', 'Glutes'];
  return (
    <div>
      <svg width="100%" viewBox="0 0 240 360" style={{maxWidth:280,display:'block',margin:'0 auto',background:'#05070d',borderRadius:4}}>
        {/* simplified body outline */}
        <circle cx="120" cy="26" r="16" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <path d="M 90 50 L 150 50 L 160 70 L 150 175 L 90 175 L 80 70 Z" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <path d="M 90 58 L 55 120 L 62 170 L 75 168 L 72 122 L 95 78 Z" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <path d="M 150 58 L 185 120 L 178 170 L 165 168 L 168 122 L 145 78 Z" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <path d="M 92 175 L 118 175 L 112 340 L 90 340 Z" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <path d="M 148 175 L 122 175 L 128 340 L 150 340 Z" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        {frontPositions.map(([name,x,y]) => byGroup[name] ? <MuscleFatigueGauge key={name} x={x} y={y} entry={byGroup[name]} /> : null)}
      </svg>
      <div className="dim mono" style={{fontSize:10,marginTop:10,marginBottom:6,letterSpacing:'0.05em',textAlign:'center'}}>POSTERIOR CHAIN (NOT SHOWN ABOVE)</div>
      <div style={{display:'flex',justifyContent:'center',gap:16}}>
        {posteriorGroups.map(name => byGroup[name] ? (
          <div key={name} style={{textAlign:'center'}}>
            <div style={{fontSize:11,color:fatigueColor(byGroup[name].status)}}>{byGroup[name].status}</div>
            <div className="dim mono" style={{fontSize:9}}>{name}{byGroup[name].daysSince!==null ? ' · '+byGroup[name].daysSince+'d' : ''}</div>
          </div>
        ) : null)}
      </div>
    </div>
  );
}
function Dossier({ op, activeOpId, operators, campaigns, logs, squads, awards, personalRecords, onUpdateOperator, onUploadAvatar, onSetBirthdate, onRedeemCode, onPurchaseCosmetic }) {
  const [pickingSpec, setPickingSpec] = useState(false);
  const [retesting, setRetesting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [birthdateDraft, setBirthdateDraft] = useState('');
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState(null);
  const [purchaseBusyKey, setPurchaseBusyKey] = useState(null);
  const [purchaseMsg, setPurchaseMsg] = useState(null);
  const [realNameDraft, setRealNameDraft] = useState(op ? (op.realName||'') : '');
  useEffect(() => { if (op) setRealNameDraft(op.realName||''); }, [op && op.id]);
  if (!op) return null;
  const isOwnProfile = activeOpId === op.id;
  const viewer = operators.find(o=>o.id===activeOpId);
  const viewerIsAdmin = viewer ? !!viewer.isAdmin : false;
  const shouldHidePersonalInfo = op.hidePersonalInfo!==false && !isOwnProfile && !viewerIsAdmin;
  const orsData = computeORS(op.id, op, logs);
  const status = computeReadinessStatus(op.id, logs);
  const deployedCampaign = op.currentDeploymentId ? campaigns.find(c => c.id === op.currentDeploymentId) : null;
  const rank = computeRank(orsData.ors, op.id, logs, campaigns, status);
  const rankTier = computeRankTier(rank, orsData.ors, op.id, logs, campaigns);
  const commandRank = computeCommandRank(op, orsData.ors, op.id, logs, campaigns, status);
  const mcp = computeMCP(op.id, campaigns, logs);
  const nri = nextRankInfo(rank, rankTier, orsData.ors, op.id, logs, campaigns, status);
  const specUnlocked = RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf('Operator');
  const daysSinceBaseline = op.baseline ? daysBetween(op.baseline.date, todayStr()) : null;
  const completedCampaigns = campaigns.filter(c => c.resolved==='success' && logs.some(l=>l.operatorId===op.id && l.type==='campaign' && l.campaignId===c.id));
  const activeHabitCount = (op.habits||[]).filter(h=>h.active).length;
  const myAwards = (awards||[]).filter(a=>a.operatorId===op.id);
  const featuredAward = op.featuredAwardId ? myAwards.find(a=>a.id===op.featuredAwardId) : null;
  const myPRs = (personalRecords||[]).filter(p=>p.operatorId===op.id);

  function chooseSpecialization(s) { if (onUpdateOperator) onUpdateOperator(Object.assign({}, op, {specialization: s})); setPickingSpec(false); }
  function submitRetest(newBaseline) { onUpdateOperator(Object.assign({}, op, { previousBaseline: op.baseline, baseline: newBaseline })); setRetesting(false); }

  return (
    <div className="panel">
      <div className="dossier-header">
        <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{position:'relative'}}>
            {op.avatarUrl ? (
              <img src={op.avatarUrl} alt={op.callsign} className="dossier-avatar" style={{objectFit:'cover',background:op.avatarColor}} />
            ) : (
              <div className="dossier-avatar" style={{background:op.avatarColor}}>{op.callsign.charAt(0)}</div>
            )}
            {isOwnProfile && (
              <label style={{position:'absolute',bottom:-4,right:-4,background:'var(--panel-alt)',border:'1px solid var(--amber-dim)',borderRadius:'50%',width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:12}}>
                📷
                <input type="file" accept="image/*" style={{display:'none'}} onChange={async(e)=>{
                  const file = e.target.files[0];
                  if (!file) return;
                  setAvatarBusy(true); setAvatarError('');
                  const result = await onUploadAvatar(op.id, file);
                  setAvatarBusy(false);
                  if (result && result.error) setAvatarError(result.error);
                  e.target.value = '';
                }} />
              </label>
            )}
          </div>
          <div><div className="disp" style={{fontSize:24}}>{op.callsign}</div><div className="dim mono" style={{fontSize:11}}>{op.idNum} · Enlisted {op.joinDate}</div>
            {isOwnProfile && avatarBusy && <div style={{fontSize:10,color:'var(--amber-dim)'}}>Uploading...</div>}
            {isOwnProfile && avatarError && <div style={{fontSize:10,color:'var(--threat)'}}>{avatarError}</div>}
          </div>
          <RankInsignia rank={commandRank ? commandRank.rank : rank} tier={commandRank ? commandRank.tier : rankTier} size={56} />
          {op.specialization && <SpecialtyBadge specialization={op.specialization} size={52} />}
          {featuredAward && (
            <div style={{display:'flex',gap:8,alignItems:'center',border:'1px solid var(--amber)',borderRadius:2,padding:'6px 12px',background:'rgba(57,255,20,0.06)'}}>
              <AwardRibbon awardType={featuredAward.awardType} size={32} />
              <div>
                <div className="dim mono" style={{fontSize:9,letterSpacing:'0.05em'}}>FEATURED</div>
                <div style={{fontSize:12,color:'var(--amber)',fontWeight:600}}>{featuredAward.title}</div>
              </div>
            </div>
          )}
        </div>
        <span className={nri && nri.eligible ? "pill eligible" : "pill not-eligible"}>{nri ? (nri.eligible ? 'Promotion Eligible' : 'Not Eligible') : 'Max Rank'}</span>
      </div>

      <div className="grid2">
        <div>
          <div style={{marginBottom:18}}>
            <div className="field-label" style={{marginBottom:4}}># ORS</div>
            <div className="disp" style={{fontSize:26}}>{orsData.ors}</div>
            <div className="bar-track" style={{marginTop:6}}><div className="bar-fill" style={{width:orsData.ors+'%'}}></div></div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="field-label" style={{marginBottom:4}}># Physical Capability</div>
            <div className="disp" style={{fontSize:20}}>{orsData.physical}</div>
            <div className="bar-track" style={{marginTop:6}}><div className="bar-fill" style={{width:orsData.physical+'%'}}></div></div>
            <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4,lineHeight:1.6}}>
              Blend of: Protocol Completion (always active)
              {orsData.overload ? `, Progressive Overload (${orsData.overload.avgChange>0?'+':''}${orsData.overload.avgChange}% avg across ${orsData.overload.exerciseCount} exercise${orsData.overload.exerciseCount===1?'':'s'})` : ', Progressive Overload (needs 60+ days of repeated exercise logs to activate)'}
              {orsData.baselineImp ? `, Baseline Improvement (${orsData.baselineImp.avgChange>0?'+':''}${orsData.baselineImp.avgChange}%)` : ', Baseline Improvement (needs a retest to activate)'}.
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="field-label" style={{marginBottom:4}}># Mission Discipline</div>
            <div className="disp" style={{fontSize:20}}>{orsData.discipline}</div>
            <div className="bar-track" style={{marginTop:6}}><div className="bar-fill" style={{width:orsData.discipline+'%'}}></div></div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="field-label" style={{marginBottom:4}}># Personal Development</div>
            <div className="disp" style={{fontSize:20}}>{orsData.personalDev === null ? '—' : orsData.personalDev}</div>
            <div className="bar-track" style={{marginTop:6}}><div className="bar-fill" style={{width:(orsData.personalDev||0)+'%'}}></div></div>
            <div style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>{activeHabitCount>0 ? `${activeHabitCount} active habit(s) tracked` : 'No active habits'}</div>
            {activeHabitCount > 0 && (
              <details style={{marginTop:6}}>
                <summary style={{cursor:'pointer',fontSize:10,color:'var(--text-dim)',fontFamily:"'IBM Plex Mono',monospace"}}>Show the breakdown</summary>
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                  {(op.habits||[]).filter(h=>h.active).map(h => {
                    const habitLogs = logs.filter(l=>l.type==='habit' && l.operatorId===op.id && l.habitId===h.id && l.date >= (new Date(Date.now()-orsData.windowDays*86400000)).toISOString().slice(0,10));
                    const rate = orsData.windowDays > 0 ? Math.round((habitLogs.length/orsData.windowDays)*100) : 0;
                    const catStyle = habitCategoryStyle(h.category);
                    return (
                      <div key={h.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}>
                        <span><span style={{color:catStyle.color,marginRight:4}}>{catStyle.icon}</span>{h.name}</span>
                        <span className="mono dim">{Math.min(100,rate)}% this window</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
          <div style={{marginBottom:18}}>
            <div className="field-label" style={{marginBottom:4}}># Squad Contribution</div>
            <div className="disp" style={{fontSize:20}}>{orsData.squad === null ? '—' : orsData.squad}</div>
            <div className="bar-track" style={{marginTop:6}}><div className="bar-fill" style={{width:(orsData.squad||0)+'%'}}></div></div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="field-label" style={{marginBottom:4}}># Mission Contribution Points</div>
            <div className="disp" style={{fontSize:20}}>{mcp}</div>
          </div>
        </div>

        <div>
          <div className="field-row"><span className="field-label">Status</span><span className={"status-pill "+status.cls}>{status.label}</span></div>
          {isOwnProfile ? (
            <div className="field-row">
              <span className="field-label">Name</span>
              <span style={{display:'flex',gap:6,alignItems:'center'}}>
                <input type="text" value={realNameDraft} onChange={e=>setRealNameDraft(e.target.value)} placeholder="Optional" style={{fontSize:12}} />
                {realNameDraft !== (op.realName||'') && <button className="ghost small" onClick={()=>onUpdateOperator(Object.assign({},op,{realName:realNameDraft}))}>Save</button>}
              </span>
            </div>
          ) : (
            <div className="field-row"><span className="field-label">Name</span><span>{shouldHidePersonalInfo ? '\u2014 Redacted \u2014' : (op.realName || '\u2014')}</span></div>
          )}
          <div className="field-row"><span className="field-label">ID</span><span className="mono">{op.idNum}</span></div>
          <div className="field-row"><span className="field-label">Join Date</span><span>{op.joinDate}</span></div>
          <div className="field-row"><span className="field-label">Age Division</span><span className="pill">{shouldHidePersonalInfo ? '\u2014 Redacted \u2014' : op.ageDivision}</span></div>
          {isOwnProfile && <div className="field-row"><span className="field-label">Requisition Credits</span><span className="stat-val mono">{op.requisitionCredits||0}</span></div>}
          {isOwnProfile && (
            <div className="field-row">
              <span className="field-label">Redeem Code</span>
              <span style={{display:'flex',gap:6,alignItems:'center'}}>
                <input type="text" value={redeemInput} onChange={e=>{setRedeemInput(e.target.value.toUpperCase()); setRedeemMsg(null);}} placeholder="VANG-XXXXXXXX" style={{fontSize:11,width:140}} />
                <button className="ghost small" disabled={redeemBusy || !redeemInput.trim()} onClick={async ()=>{
                  setRedeemBusy(true);
                  const result = await onRedeemCode(redeemInput);
                  setRedeemBusy(false);
                  setRedeemMsg(result);
                  if (result && result.success) setRedeemInput('');
                }}>{redeemBusy ? 'Checking...' : 'Redeem'}</button>
              </span>
            </div>
          )}
          {isOwnProfile && redeemMsg && (
            <div className="field-row">
              <span></span>
              <span style={{fontSize:11,color: redeemMsg.success?'var(--success)':'var(--threat)'}}>
                {redeemMsg.success ? ('+'+redeemMsg.credits+' Requisition Credits.') : (redeemMsg.message||'Redemption failed.')}
              </span>
            </div>
          )}
          {isOwnProfile && (
            <div style={{marginTop:20}}>
              <div className="bracket-label">Cosmetics Shop</div>
              <div className="dim" style={{fontSize:11,marginBottom:12}}>Customize how your chat messages appear. Spend Requisition Credits below.</div>
              {['color','border','background'].map(cat => (
                <div key={cat} style={{marginBottom:16}}>
                  <div className="dim mono" style={{fontSize:10,marginBottom:8,letterSpacing:'0.05em'}}>{cat.toUpperCase()}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {Object.entries(COSMETIC_CATALOG).filter(([k,item])=>item.category===cat).map(([key,item]) => {
                      const owned = (op.ownedCosmetics||[]).includes(key);
                      const equippedField = cat==='color'?'equippedChatColor':cat==='border'?'equippedChatBorder':'equippedChatBackground';
                      const isEquipped = op[equippedField] === key;
                      const swatchStyle = cat==='color'
                        ? {background:'var(--panel)',color:item.value,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}
                        : cat==='border'
                        ? {border:item.value,background:'var(--panel)'}
                        : {background:item.value};
                      return (
                        <div key={key} style={{border:'1px solid var(--border)',borderRadius:2,padding:8,width:140}}>
                          <div style={Object.assign({height:24,borderRadius:2,marginBottom:6},swatchStyle)}>{cat==='color' ? 'Aa' : ''}</div>
                          <div style={{fontSize:11,fontWeight:600}}>{item.label}</div>
                          <div className="dim mono" style={{fontSize:10,marginBottom:6}}>{item.price} credits</div>
                          {owned ? (
                            <button className={isEquipped?'primary small':'ghost small'} style={{width:'100%'}} onClick={()=>onUpdateOperator(Object.assign({},op,{[equippedField]: isEquipped ? null : key}))}>
                              {isEquipped ? 'Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <button className="ghost small" style={{width:'100%'}} disabled={purchaseBusyKey===key || (op.requisitionCredits||0) < item.price} onClick={async ()=>{
                              setPurchaseBusyKey(key);
                              const result = await onPurchaseCosmetic(key);
                              setPurchaseBusyKey(null);
                              setPurchaseMsg(result);
                            }}>
                              {purchaseBusyKey===key ? 'Buying...' : 'Buy'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {purchaseMsg && (
                <div style={{fontSize:11,color: purchaseMsg.success?'var(--success)':'var(--threat)',marginBottom:8}}>
                  {purchaseMsg.success ? 'Purchased.' : (purchaseMsg.message||'Purchase failed.')}
                </div>
              )}
            </div>
          )}
          {isOwnProfile && (
            <div className="field-row">
              <span className="field-label">Hide Name & Age from Others</span>
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" checked={op.hidePersonalInfo!==false} disabled={op.ageDivision==='Cadet'} onChange={e=>onUpdateOperator(Object.assign({},op,{hidePersonalInfo:e.target.checked}))} style={{width:14,height:14}} />
                {op.ageDivision==='Cadet' && <span className="dim" style={{fontSize:10}}>Locked on for Cadets</span>}
              </span>
            </div>
          )}
          {isOwnProfile && (
            op.birthdate ? (
              <div className="field-row"><span className="field-label">Birthdate</span><span className="dim mono" style={{fontSize:11}}>{op.birthdate} {'\u2014'} on file, contact Command to correct</span></div>
            ) : (
              <div className="field-row">
                <span className="field-label">Birthdate</span>
                <span style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input type="date" value={birthdateDraft} onChange={e=>setBirthdateDraft(e.target.value)} style={{fontSize:11}} />
                  <button className="ghost small" onClick={()=>{ if(birthdateDraft) onSetBirthdate(op.id, birthdateDraft); }}>Set (one-time)</button>
                </span>
              </div>
            )
          )}
          <div className="field-row"><span className="field-label">Rank</span><span className="pill rank">{commandRank ? commandRankDisplay(commandRank) : rankDisplay(rank, rankTier)}</span></div>
          <div className="field-row">
            <span className="field-label">Specialization</span>
            {!specUnlocked && <span className="pill dim">Unassigned — unlocks at Operator</span>}
            {specUnlocked && op.specialization && <span className="pill">{op.specialization}</span>}
            {specUnlocked && !op.specialization && !pickingSpec && <button className="small primary" onClick={()=>setPickingSpec(true)}>Choose Track</button>}
            {specUnlocked && !op.specialization && pickingSpec && (
              <select onChange={e=>chooseSpecialization(e.target.value)} defaultValue="">
                <option value="" disabled>Select...</option>
                {SPECIALIZATIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div className="field-row"><span className="field-label">Squad</span><span>{op.squadId ? ((squads.find(s=>s.id===op.squadId)||{}).name + (op.squadRole!=='member' ? ' ('+op.squadRole+')' : '')) : 'Unassigned (opt-in)'}</span></div>
          <div className="field-row"><span className="field-label">Privacy Level</span><span className="pill">{op.privacy}</span></div>
          <div className="field-row"><span className="field-label">Current Deployment</span><span>{deployedCampaign ? deployedCampaign.name : '\u2014'}</span></div>
          <div className="field-row"><span className="field-label">Completed Campaigns</span><span>{completedCampaigns.length ? completedCampaigns.map(c=>c.name).join(', ') : 'None yet'}</span></div>
          <div className="field-row"><span className="field-label">Reinforcement Drops</span><span>{op.reinforcementDropsAvailable} available</span></div>
          <div className="field-row"><span className="field-label">Awards</span><span>{myAwards.length ? myAwards.length+' earned' : 'None yet'}</span></div>
        </div>
      </div>

      <div className="panel" style={{marginTop:0}}>
        <div className="bracket-label">Muscle Fatigue</div>
        <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:14}}>Based on when each muscle group was last trained. Fatigued = trained yesterday or today. Neglected = 7+ days since last hit.</div>
        <MuscleFatigueSilhouette fatigue={computeMuscleFatigue(op.id, logs)} />
      </div>

      <div className="panel" style={{marginTop:0}}>
        <div className="bracket-label">Awards ({myAwards.length})</div>
        {myAwards.length === 0 ? (
          <div className="dim" style={{fontSize:12}}>No awards yet — rank-ups, Campaign victories, personal records, and activity streaks all earn recognition automatically.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {myAwards.map(a => (
              <div key={a.id} style={{display:'flex',gap:10,alignItems:'flex-start',border:'1px solid '+(op.featuredAwardId===a.id?'var(--amber)':'var(--border)'),borderRadius:2,padding:'10px 12px'}}>
                <AwardRibbon awardType={a.awardType} size={40} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div className="amber" style={{fontSize:13,fontWeight:600}}>{a.title}</div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <div className="dim mono" style={{fontSize:10}}>{a.awardedAt ? a.awardedAt.slice(0,10) : ''}</div>
                      {isOwnProfile && (
                        op.featuredAwardId===a.id
                          ? <button className="ghost small" onClick={()=>onUpdateOperator(Object.assign({},op,{featuredAwardId:null}))}>Unfeature</button>
                          : <button className="ghost small" onClick={()=>onUpdateOperator(Object.assign({},op,{featuredAwardId:a.id}))}>Feature</button>
                      )}
                    </div>
                  </div>
                  {a.description && <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{a.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{marginTop:0}}>
        <div className="bracket-label">Personal Records ({myPRs.length})</div>
        {myPRs.length === 0 ? (
          <div className="dim" style={{fontSize:12}}>No personal records logged yet — beat your own best on any exercise to start one.</div>
        ) : (
          <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Exercise</th><th>Best</th><th>Date</th></tr></thead>
            <tbody>
              {Object.values(myPRs.reduce((acc,pr) => {
                if (!acc[pr.exercise] || pr.value > acc[pr.exercise].value) acc[pr.exercise] = pr;
                return acc;
              }, {})).sort((a,b)=>b.value-a.value).map(pr => (
                <tr key={pr.exercise}><td>{pr.exercise}</td><td className="amber">{pr.value} {pr.unit}</td><td className="dim">{pr.achievedAt}</td></tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="panel" style={{marginTop:0}}>
        <div className="bracket-label">Rank Progress</div>
        {nri ? (
          <div>
            <div style={{fontSize:13,marginBottom:10}}>Next: <span className="amber">{rankDisplay(nri.next, nri.nextTier)}</span></div>
            <div className="stat-row"><span>ORS</span><span className="stat-val">{orsData.ors} / {nri.req.ors}</span></div>
            <div className="stat-row"><span>Days Active (lifetime)</span><span className="stat-val">{nri.stats.daysActive} / {nri.req.daysActive}</span></div>
            <div className="stat-row"><span>Campaigns Completed</span><span className="stat-val">{nri.stats.campaignsCompleted} / {nri.req.campaigns}</span></div>
            <div className="stat-row"><span>Readiness Status</span><span className={status.label==='Active'?'amber':'threat'}>{status.label==='Active' ? 'Meets requirement' : 'Must be Active — currently '+status.label}</span></div>
          </div>
        ) : <div className="dim" style={{fontSize:12}}>{(op.isAdmin||op.isModerator) ? 'Rank conferred by role.' : 'Maximum earnable rank achieved.'}</div>}
      </div>

      <div className="panel" style={{marginTop:0}}>
        <div className="bracket-label">Baseline Record</div>
        {op.baseline ? (
          <div>
            <div className="stat-row"><span>Last Test</span><span className="stat-val">{op.baseline.date} ({op.baseline.tier})</span></div>
            <div className="stat-row"><span>Push-Ups / Pull-Ups / Squats / Plank</span><span className="stat-val">{op.baseline.pushups} / {op.baseline.pullups} / {op.baseline.squats} / {op.baseline.plankSeconds}s</span></div>
            {op.previousBaseline && <div className="stat-row"><span>Previous Test</span><span className="stat-val">{op.previousBaseline.date}</span></div>}
            {daysSinceBaseline !== null && daysSinceBaseline >= 56 && <div className="info-note" style={{borderLeft:'2px solid var(--amber)'}}>It's been {daysSinceBaseline} days since your last baseline — 8 weeks is the recommended retest cadence.</div>}
          </div>
        ) : <div className="dim" style={{fontSize:12}}>No baseline on record.</div>}
        <button className="ghost small" onClick={()=>setRetesting(true)} style={{marginTop:12}}>Log Baseline Retest</button>
      </div>

      {retesting && <RetestModal onClose={()=>setRetesting(false)} onSubmit={submitRetest} />}
    </div>
  );
}

function RetestModal({ onClose, onSubmit }) {
  const [pushups, setPushups] = useState('');
  const [pullups, setPullups] = useState('');
  const [squats, setSquats] = useState('');
  const [plank, setPlank] = useState('');
  const [runMinutes, setRunMinutes] = useState('');
  function submit() {
    const pu = parseFloat(pushups)||0, pl = parseFloat(pullups)||0, sq = parseFloat(squats)||0, pk = parseFloat(plank)||0;
    let pts = 0;
    pts += pu>=41?4:pu>=26?3:pu>=11?2:pu>=1?1:0;
    pts += pl>=13?4:pl>=8?3:pl>=3?2:pl>=0?1:0;
    pts += pk>=180?4:pk>=120?3:pk>=60?2:pk>0?1:0;
    let tier = pts>=15?'Peak Tier':pts>=12?'Advanced Tier':pts>=8?'Development Tier':'Foundation Tier';
    onSubmit({ pushups: pu, pullups: pl, squats: sq, plankSeconds: pk, runMinutes: parseFloat(runMinutes)||0, score: pts, tier: tier, date: todayStr() });
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="disp" style={{fontSize:18,marginBottom:16}}>Baseline Retest</div>
        <div className="field"><label>Max Push-Ups</label><input type="number" value={pushups} onChange={e=>setPushups(e.target.value)} /></div>
        <div className="field"><label>Max Pull-Ups</label><input type="number" value={pullups} onChange={e=>setPullups(e.target.value)} /></div>
        <div className="field"><label>Bodyweight Squats in 2 Minutes</label><input type="number" value={squats} onChange={e=>setSquats(e.target.value)} /></div>
        <div className="field"><label>Plank Hold (seconds)</label><input type="number" value={plank} onChange={e=>setPlank(e.target.value)} /></div>
        <div className="field"><label>1.5 Mile Run Time (minutes, optional)</label><input type="number" value={runMinutes} onChange={e=>setRunMinutes(e.target.value)} /></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={submit}>Submit Retest</button>
        </div>
      </div>
    </div>
  );
}

function Roster({ operators, campaigns, logs, onView }) {
  return (
    <div className="panel">
      <div className="bracket-label">Alpha Cell — Roster</div>
      <div style={{overflowX:'auto'}}>
      <table>
        <thead><tr><th>Callsign</th><th>Rank</th><th>ORS</th><th>Status</th><th>Deployed To</th><th>Last Active</th></tr></thead>
        <tbody>
          {operators.map(op => {
            const orsData = computeORS(op.id, op, logs);
            const status = computeReadinessStatus(op.id, logs);
            const deployedCampaign = op.currentDeploymentId ? campaigns.find(c=>c.id===op.currentDeploymentId) : null;
            const rank = computeRank(orsData.ors, op.id, logs, campaigns, status);
            const rankTier = computeRankTier(rank, orsData.ors, op.id, logs, campaigns);
            const commandRank = computeCommandRank(op, orsData.ors, op.id, logs, campaigns, status);
            const opLogs = logs.filter(l => l.operatorId===op.id);
            const lastActive = opLogs.length ? opLogs.reduce((max,l)=>l.date>max?l.date:max, opLogs[0].date) : '\u2014';
            return (
              <tr key={op.id} className="clickable" onClick={()=>onView(op.id)}>
                <td className="disp" style={{fontFamily:"'Oswald',sans-serif"}}>{op.callsign}</td>
                <td>{commandRank ? commandRankDisplay(commandRank) : rankDisplay(rank, rankTier)}</td>
                <td className="amber">{orsData.ors}</td>
                <td><span className={"status-pill "+status.cls}>{status.label}</span></td>
                <td>{deployedCampaign ? deployedCampaign.name : '\u2014'}</td>
                <td>{lastActive}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function AARLog({ operators, campaigns, logs }) {
  const sorted = logs.slice().sort((a,b) => b.timestamp - a.timestamp);
  const opName = id => { const o = operators.find(o=>o.id===id); return o ? o.callsign : id; };
  const locName = (campId, locId) => { const c = campaigns.find(c=>c.id===campId); if(!c) return locId; const l = c.locations.find(l=>l.id===locId); return l ? l.name : locId; };
  const habitName = (op, habitId) => { const o = operators.find(o=>o.id===op); if(!o) return habitId; const h=(o.habits||[]).find(h=>h.id===habitId); return h?h.name:habitId; };
  if (sorted.length === 0) return <div className="panel"><div className="empty"><div className="empty-title">No AARs filed yet — your training log will show up here once you log your first session.</div></div></div>;
  return (
    <div className="panel">
      <div className="bracket-label">After Action Reports — Full Log</div>
      <div style={{overflowX:'auto'}}>
      <table>
        <thead><tr><th>Date</th><th>Operator</th><th>Type</th><th>Detail</th><th>Value</th></tr></thead>
        <tbody>
          {sorted.map(l => (
            <tr key={l.id}>
              <td>{l.date}</td>
              <td>{opName(l.operatorId)}</td>
              <td>{l.type === 'protocol' ? 'Protocol' : l.type === 'habit' ? 'Habit' : (l.source==='protocol-auto' ? 'Campaign (auto)' : 'Campaign')}</td>
              <td>{l.type === 'protocol' ? (l.variant+' — '+l.detail) : l.type === 'habit' ? habitName(l.operatorId, l.habitId) : (locName(l.campaignId, l.locationId) + (l.sourceExercise ? (' (from '+l.sourceExercise+')') : ''))}</td>
              <td>{l.type === 'protocol' ? (l.totalValue+' '+l.unit) : l.type === 'habit' ? '✓' : l.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function Comms({ chat, operators, squads, activeOp, onSend, cheers, onCheer }) {
  const mySquad = activeOp.squadId ? squads.find(s=>s.id===activeOp.squadId) : null;
  const [channel, setChannel] = useState('main');
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  const shown = chat.filter(m => {
    if (channel === 'main') return m.channel === 'main' || m.channel === 'command';
    if (channel === 'squad') return (m.channel === 'squad' && m.squadId === (mySquad&&mySquad.id)) || m.channel === 'command';
    if (channel === 'command') return m.channel === 'command';
    return false;
  });

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [shown.length]);

  const canPost = channel === 'main' || (channel === 'squad' && mySquad) || (channel === 'command' && activeOp.isAdmin);

  function send() {
    if (!text.trim() || !canPost) return;
    const msg = { id:'chat_'+Date.now(), authorId: activeOp.id, authorName: activeOp.callsign, text: text.trim(), timestamp: Date.now(), channel: channel };
    if (channel === 'command') msg.isCommand = true;
    else msg.isCommand = false;
    if (channel === 'squad') msg.squadId = mySquad.id;
    onSend(msg);
    setText('');
  }

  return (
    <div className="panel">
      <div className="bracket-label">Comms</div>
      <div className="radio-group" style={{marginBottom:16}}>
        <div className={"radio-opt"+(channel==='main'?' sel':'')} onClick={()=>setChannel('main')}>Main</div>
        <div className={"radio-opt"+(channel==='squad'?' sel':'')} onClick={()=>setChannel('squad')}>{mySquad ? mySquad.name : 'Squad (join one to unlock)'}</div>
        <div className={"radio-opt"+(channel==='command'?' sel':'')} onClick={()=>setChannel('command')}>Command</div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {shown.length === 0 && <div className="empty"><div className="empty-title">No transmissions yet — say something below to break the silence.</div></div>}
        {shown.map(m => {
          const msgCheers = (cheers||[]).filter(c=>c.messageId===m.id);
          const iCheered = msgCheers.some(c=>c.operatorId===activeOp.id);
          const sender = operators.find(o=>o.id===m.authorId);
          const cosmeticStyle = {};
          if (sender && sender.equippedChatColor && COSMETIC_CATALOG[sender.equippedChatColor]) cosmeticStyle.color = COSMETIC_CATALOG[sender.equippedChatColor].value;
          if (sender && sender.equippedChatBorder && COSMETIC_CATALOG[sender.equippedChatBorder]) cosmeticStyle.border = COSMETIC_CATALOG[sender.equippedChatBorder].value;
          if (sender && sender.equippedChatBackground && COSMETIC_CATALOG[sender.equippedChatBackground]) cosmeticStyle.background = COSMETIC_CATALOG[sender.equippedChatBackground].value;
          return (
            <div key={m.id} className={"chat-msg "+(m.isCommand?'command':(m.authorId===activeOp.id?'mine':'theirs'))} style={cosmeticStyle}>
              <div className="chat-meta">{!m.authorId ? 'VAL // AUTOMATED' : (m.isCommand ? 'COMMAND TRANSMISSION' : m.authorName)} · {new Date(m.timestamp).toLocaleString()}</div>
              <div>{m.text}</div>
              {m.isCommand && (
                <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8}}>
                  <button className={"small ghost"+(iCheered?' sel':'')} disabled={iCheered} onClick={()=>onCheer(activeOp.id, m.id)}>
                    {iCheered ? '\u2705 Cheered' : '\ud83c\udf89 Cheer'}
                  </button>
                  {msgCheers.length > 0 && <span className="dim mono" style={{fontSize:11}}>{msgCheers.length} cheer{msgCheers.length===1?'':'s'}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canPost ? (
        <div className="chat-input-row">
          <input type="text" value={text} onChange={e=>setText(e.target.value)} placeholder={channel==='command'?'Post a Command transmission...':'Message...'} onKeyDown={e=>{if(e.key==='Enter') send();}} />
          <button className="primary" onClick={send}>Send</button>
        </div>
      ) : (
        <div className="info-note">{channel==='squad' ? 'Join a Squad to post here.' : 'Only Command (admins) can post in this channel.'}</div>
      )}
      <div className="info-note">Live — new messages arrive instantly via realtime, no refresh needed. Command messages also appear in Main and every Squad channel.</div>
    </div>
  );
}
