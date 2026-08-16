function App() {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [operators, setOperators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [chat, setChat] = useState([]);
  const [codexEntries, setCodexEntries] = useState([]);
  const [squads, setSquads] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [protocolSessions, setProtocolSessions] = useState([]);
  const [quips, setQuips] = useState([]);
  const [awards, setAwards] = useState([]);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [raidTemplates, setRaidTemplates] = useState([]);
  const [raidInstances, setRaidInstances] = useState([]);
  const [campaignPOIs, setCampaignPOIs] = useState([]);
  const [tab, setTab] = useState('command');
  const [showReset, setShowReset] = useState(false);
  const [viewDossierId, setViewDossierId] = useState(null);
  const [rankUpModal, setRankUpModal] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    sb.auth.getSession().then(({data}) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refetchAll() {
    const { ops, camps, lgs, ch, cx, squads, exercises, protocolSessions, quips, awards, personalRecords, raidTemplates, raidInstances, campaignPOIs } = await fetchAllData();
    setOperators(ops); setCampaigns(camps); setLogs(lgs); setChat(ch); setCodexEntries(cx); setSquads(squads);
    setExercises(exercises); setProtocolSessions(protocolSessions); setQuips(quips);
    setAwards(awards); setPersonalRecords(personalRecords);
    setRaidTemplates(raidTemplates); setRaidInstances(raidInstances);
    setCampaignPOIs(campaignPOIs);
  }

  useEffect(() => {
    if (!session) { setLoaded(false); return; }
    (async () => { await refetchAll(); setLoaded(true); })();
  }, [session]);

  // realtime chat subscription
  useEffect(() => {
    if (!session) return;
    const channel = sb.channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setChat(prev => prev.some(m=>m.id===payload.new.id) ? prev : prev.concat([rowToChat(payload.new)]));
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [session]);

  async function addLogs(entries) {
    await sb.from('logs').insert(entries.map(logToRow));
    await refetchAll();
  }
  async function updateOperator(updatedOp) {
    const old = operators.find(o=>o.id===updatedOp.id) || {};
    const patch = {};
    Object.keys(OP_FIELD_MAP).forEach(k => { if (JSON.stringify(updatedOp[k]) !== JSON.stringify(old[k])) patch[k] = updatedOp[k]; });
    if (Object.keys(patch).length) await sb.from('profiles').update(operatorToRowPatch(patch)).eq('id', updatedOp.id);
    await refetchAll();
  }
  async function uploadAvatar(operatorId, file) {
    if (!file) return { error: 'No file selected.' };
    if (!file.type.startsWith('image/')) return { error: 'Please choose an image file.' };
    if (file.size > 5 * 1024 * 1024) return { error: 'Image must be under 5MB.' };
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = operatorId + '/avatar.' + ext;
    const { error: uploadError } = await sb.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
    if (uploadError) return { error: uploadError.message };
    const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
    // Cache-bust so the new image shows immediately even though the path is unchanged.
    const bustedUrl = urlData.publicUrl + '?t=' + Date.now();
    await sb.from('profiles').update({ avatar_url: bustedUrl }).eq('id', operatorId);
    await refetchAll();
    return { error: null };
  }
  async function updateOperators(newOps) {
    const removed = operators.filter(o => !newOps.some(n=>n.id===o.id));
    for (const r of removed) await sb.from('profiles').delete().eq('id', r.id);
    for (const o of newOps) {
      const old = operators.find(x=>x.id===o.id);
      if (!old) continue;
      const patch = {};
      Object.keys(OP_FIELD_MAP).forEach(k => { if (JSON.stringify(o[k]) !== JSON.stringify(old[k])) patch[k]=o[k]; });
      if (Object.keys(patch).length) await sb.from('profiles').update(operatorToRowPatch(patch)).eq('id', o.id);
    }
    await refetchAll();
  }
  async function updateCampaigns(newCamps) {
    for (const nc of newCamps) {
      const old = campaigns.find(c=>c.id===nc.id);
      if (!old) {
        const { data: inserted } = await sb.from('campaigns').insert({
          name: nc.name, threat: nc.threat, sector: nc.sector, start_date: nc.startDate,
          join_window_days: nc.joinWindowDays, duration_days: nc.durationDays,
        }).select().single();
        if (inserted && nc.locations.length) {
          await sb.from('locations').insert(nc.locations.map(l => ({ campaign_id: inserted.id, name:l.name, objective:l.objective, category:l.category, unit:l.unit, manual_target:l.manualTarget, briefing:l.briefing||null })));
        }
        continue;
      }
      const patch = {};
      Object.keys(CAMP_FIELD_MAP).forEach(k => { if (JSON.stringify(nc[k]) !== JSON.stringify(old[k])) patch[k]=nc[k]; });
      if (Object.keys(patch).length) await sb.from('campaigns').update(campaignToRowPatch(patch)).eq('id', nc.id);
      const newLocIds = new Set(nc.locations.map(l=>l.id));
      const removedLocs = old.locations.filter(l=>!newLocIds.has(l.id));
      for (const rl of removedLocs) await sb.from('locations').delete().eq('id', rl.id);
      for (const nl of nc.locations) {
        const oldLoc = old.locations.find(l=>l.id===nl.id);
        if (!oldLoc) await sb.from('locations').insert({campaign_id: nc.id, name:nl.name, objective:nl.objective, category:nl.category, unit:nl.unit, manual_target:nl.manualTarget, briefing:nl.briefing||null});
        else if (JSON.stringify(oldLoc)!==JSON.stringify(nl)) await sb.from('locations').update({name:nl.name, objective:nl.objective, category:nl.category, unit:nl.unit, manual_target:nl.manualTarget, briefing:nl.briefing||null}).eq('id', nl.id);
      }
    }
    await refetchAll();
  }
  async function sendChat(msg) {
    await sb.from('chat_messages').insert(chatToRow(msg));
    // realtime subscription will pick up the insert; no need to refetch or setChat here
  }
  async function updateCodex(newEntries) {
    const old = codexEntries;
    const removed = old.filter(e => !newEntries.some(n=>n.id===e.id));
    for (const r of removed) await sb.from('codex_entries').delete().eq('id', r.id);
    for (const e of newEntries) {
      const oldE = old.find(x=>x.id===e.id);
      if (!oldE) await sb.from('codex_entries').insert({ category: e.category, title: e.title, body: e.body });
      else if (oldE.title!==e.title || oldE.body!==e.body) await sb.from('codex_entries').update({title:e.title, body:e.body}).eq('id', e.id);
    }
    await refetchAll();
  }
  async function saveExercise(exercise) {
    const exists = exercises.some(e=>e.id===exercise.id);
    if (exists) await sb.from('exercises').update(exerciseToRow(exercise)).eq('id', exercise.id);
    else await sb.from('exercises').insert(exerciseToRow(exercise));
    await refetchAll();
  }
  async function deleteExercise(exerciseId) {
    await sb.from('exercises').delete().eq('id', exerciseId);
    await refetchAll();
  }
  async function saveProtocolSession(session) {
    const exists = protocolSessions.some(s=>s.id===session.id);
    if (exists) await sb.from('protocol_sessions').update(protocolSessionToRow(session)).eq('id', session.id);
    else await sb.from('protocol_sessions').insert(protocolSessionToRow(session));
    await refetchAll();
  }
  async function deleteProtocolSession(sessionId) {
    await sb.from('protocol_sessions').delete().eq('id', sessionId);
    await refetchAll();
  }
  async function saveQuip(text) {
    if (!text.trim()) return;
    await sb.from('command_quips').insert({ text: text.trim() });
    await refetchAll();
  }
  async function deleteQuip(quipId) {
    await sb.from('command_quips').delete().eq('id', quipId);
    await refetchAll();
  }
  async function recordPersonalRecord(op, exercise, value, unit) {
    await sb.from('personal_records').insert({ operator_id: op.id, exercise: exercise, value: value, unit: unit });
    await sb.from('awards').insert({ operator_id: op.id, award_type: 'pr_'+exercise, title: 'Personal Best: '+exercise, description: 'New best of '+value+' '+unit+'.' });
    // don't refetchAll here — the caller (addLogs) already triggers one, avoids a redundant round trip
  }
  async function checkStreakAward(op, logsSnapshot, existingAwards) {
    const streak = computeStreak(op.id, logsSnapshot);
    const milestones = [7, 30, 100];
    for (const m of milestones) {
      const type = 'streak_'+m;
      if (streak >= m && !existingAwards.some(a=>a.operatorId===op.id && a.awardType===type)) {
        await sb.from('awards').insert({ operator_id: op.id, award_type: type, title: m+'-Day Streak', description: 'Logged something '+m+' days in a row. Command noticed.' });
      }
    }
  }
  async function checkServiceStripAward(op, logsSnapshot, campaignsSnapshot, existingAwards) {
    // Service Strips: one per full year of accumulated (non-consecutive) Days
    // Active — the same lifetime daysActive count the Operator rank system uses.
    const stats = operatorRankStats(op.id, logsSnapshot, campaignsSnapshot);
    const yearsServed = Math.floor(stats.daysActive / 365);
    for (let y = 1; y <= yearsServed; y++) {
      const type = 'service_strip_'+y;
      if (!existingAwards.some(a=>a.operatorId===op.id && a.awardType===type)) {
        await sb.from('awards').insert({ operator_id: op.id, award_type: type, title: y+'-Year Service Strip', description: y*365+' accumulated active days logged. Earned, not given.' });
      }
    }
  }
  async function launchRaid(squad, template) {
    const alreadyActive = raidInstances.some(r => r.squadId === squad.id && r.status === 'active');
    if (alreadyActive) return false;
    await sb.from('raid_instances').insert({ raid_template_id: template.id, squad_id: squad.id });
    await refetchAll();
    return true;
  }
  async function saveRaidTemplate(template) {
    const exists = raidTemplates.some(t=>t.id===template.id);
    let templateId = template.id;
    if (exists) {
      await sb.from('raid_templates').update({ name: template.name, boss_name: template.bossName, boss_flavor: template.bossFlavor }).eq('id', template.id);
      // simplest safe approach for nested area/objective edits: replace all areas for this template
      await sb.from('raid_areas').delete().eq('raid_template_id', template.id);
    } else {
      const { data: inserted } = await sb.from('raid_templates').insert({ name: template.name, boss_name: template.bossName, boss_flavor: template.bossFlavor }).select().single();
      templateId = inserted.id;
    }
    for (let i = 0; i < template.areas.length; i++) {
      const area = template.areas[i];
      const { data: insertedArea } = await sb.from('raid_areas').insert({ raid_template_id: templateId, area_order: i, name: area.name }).select().single();
      if (area.objectives.length) {
        await sb.from('raid_area_objectives').insert(area.objectives.map(o => ({ raid_area_id: insertedArea.id, name: o.name, muscle_group: o.muscleGroup, unit: o.unit, target: o.target })));
      }
    }
    await refetchAll();
  }
  async function deleteRaidTemplate(templateId) {
    await sb.from('raid_templates').delete().eq('id', templateId);
    await refetchAll();
  }
  async function savePOI(poi) {
    const exists = campaignPOIs.some(p=>p.id===poi.id);
    if (exists) await sb.from('campaign_pois').update({ name: poi.name, briefing: poi.briefing||null, row: poi.row, col: poi.col }).eq('id', poi.id);
    else await sb.from('campaign_pois').insert({ campaign_id: poi.campaignId, name: poi.name, briefing: poi.briefing||null, row: poi.row, col: poi.col });
    await refetchAll();
  }
  async function deletePOI(poiId) {
    await sb.from('campaign_pois').delete().eq('id', poiId);
    await refetchAll();
  }
  async function resetAll() {
    await sb.from('logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    for (const c of campaigns) await sb.from('campaigns').delete().eq('id', c.id);
    for (const o of operators) await sb.from('profiles').update({ current_deployment_id: null, reinforcement_drops_available: 0, mcp_at_last_reinforcement: 0, last_seen_rank: 'Recruit' }).eq('id', o.id);
    await refetchAll();
    setShowReset(false);
  }
  async function deployToCampaign(op, camp) {
    if (op.currentDeploymentId) return;
    const phase = campaignPhase(camp);
    if (phase === 'recruiting') {
      await sb.from('campaigns').update({ deployed_operator_ids: camp.deployedOperatorIds.concat([op.id]) }).eq('id', camp.id);
      await sb.from('profiles').update({ current_deployment_id: camp.id }).eq('id', op.id);
    } else if (phase === 'active') {
      const capMax = Math.floor(0.2 * camp.lockedDeployedCount);
      if (op.reinforcementDropsAvailable < 1 || camp.reinforcementsUsed >= capMax) return;
      await sb.from('campaigns').update({ deployed_operator_ids: camp.deployedOperatorIds.concat([op.id]), reinforcements_used: camp.reinforcementsUsed + 1 }).eq('id', camp.id);
      await sb.from('profiles').update({ current_deployment_id: camp.id, reinforcement_drops_available: op.reinforcementDropsAvailable - 1 }).eq('id', op.id);
    } else return;
    await refetchAll();
  }
  async function undeploy(op) { await sb.from('profiles').update({current_deployment_id: null}).eq('id', op.id); await refetchAll(); }
  async function claimReinforcement(op) { await sb.from('profiles').update({reinforcement_drops_available: 1, mcp_at_last_reinforcement: nonCampaignMCP(op.id, logs)}).eq('id', op.id); await refetchAll(); }
  async function addHabit(op, name) { await sb.from('habits').insert({operator_id: op.id, name: name, active: true, created_date: todayStr()}); await refetchAll(); }
  async function toggleHabitArchive(op, habitId) {
    const h = op.habits.find(h=>h.id===habitId);
    await sb.from('habits').update({active: !h.active}).eq('id', habitId);
    await refetchAll();
  }
  async function logHabitCheckin(op, habitId) {
    if (logs.some(l => l.type==='habit' && l.operatorId===op.id && l.habitId===habitId && l.date===todayStr())) return;
    await addLogs([{ id: crypto.randomUUID(), operatorId: op.id, type:'habit', habitId: habitId, date: todayStr(), timestamp: Date.now() }]);
  }
  async function saveCustomProtocol(op, protocol) {
    const cap = 5;
    if (!op.customProtocols.some(p=>p.id===protocol.id) && op.customProtocols.length>=cap) return false;
    const existingIdx = op.customProtocols.findIndex(p=>p.id===protocol.id);
    let newList;
    if (existingIdx>=0) { newList = op.customProtocols.slice(); newList[existingIdx]=protocol; }
    else newList = op.customProtocols.concat([protocol]);
    await sb.from('profiles').update({custom_protocols: newList}).eq('id', op.id);
    await refetchAll();
    return true;
  }
  async function deleteCustomProtocol(op, protocolId) {
    await sb.from('profiles').update({custom_protocols: op.customProtocols.filter(p=>p.id!==protocolId)}).eq('id', op.id);
    await refetchAll();
  }

  async function createSquad(op, name) {
    if (op.squadId) return false;
    const { data: squad, error } = await sb.from('squads').insert({ name: name }).select().single();
    if (error || !squad) return false;
    await sb.from('squad_members').insert({ squad_id: squad.id, operator_id: op.id, role: 'leader' });
    await refetchAll();
    return true;
  }
  async function joinSquad(op, squad) {
    if (op.squadId) return false;
    if (squad.members.length >= 10) return false;
    await sb.from('squad_members').insert({ squad_id: squad.id, operator_id: op.id, role: 'member' });
    await refetchAll();
    return true;
  }
  async function leaveSquad(op) {
    await sb.from('squad_members').delete().eq('operator_id', op.id);
    await refetchAll();
  }
  async function promoteOfficer(squad, operatorId) {
    const officerCount = squad.members.filter(m=>m.role==='officer').length;
    if (officerCount >= 3) return false;
    await sb.from('squad_members').update({ role: 'officer' }).eq('squad_id', squad.id).eq('operator_id', operatorId);
    await refetchAll();
    return true;
  }
  async function demoteOfficer(squad, operatorId) {
    await sb.from('squad_members').update({ role: 'member' }).eq('squad_id', squad.id).eq('operator_id', operatorId);
    await refetchAll();
  }
  async function removeMember(squad, operatorId) {
    await sb.from('squad_members').delete().eq('squad_id', squad.id).eq('operator_id', operatorId);
    await refetchAll();
  }
  async function renameSquad(squad, newName) {
    await sb.from('squads').update({ name: newName }).eq('id', squad.id);
    await refetchAll();
  }
  async function disbandSquad(squad) {
    await sb.from('squads').delete().eq('id', squad.id);
    await refetchAll();
  }

  async function signOut() { await sb.auth.signOut(); }

  const op = (session && loaded) ? operators.find(o => o.id === session.user.id) : null;
  const opOnboarded = op && op.onboarded;
  const statusTop = opOnboarded ? computeReadinessStatus(op.id, logs) : null;
  const orsDataTop = opOnboarded ? computeORS(op.id, op, logs) : null;
  const currentRankTop = opOnboarded ? computeRank(orsDataTop.ors, op.id, logs, campaigns, statusTop) : null;
  const deployedCampaignTop = (opOnboarded && op.currentDeploymentId) ? campaigns.find(c => c.id === op.currentDeploymentId) : null;

  // Hook runs unconditionally every render and guards its own logic internally —
  // never place this after an early return, or React's hook order breaks.
  useEffect(() => {
    if (!loaded || !opOnboarded || !currentRankTop || !op) return;
    if (RANK_ORDER.indexOf(currentRankTop) > RANK_ORDER.indexOf(op.lastSeenRank || 'Recruit')) {
      setRankUpModal(currentRankTop);
      updateOperator(Object.assign({}, op, {lastSeenRank: currentRankTop}));
    }
  }, [currentRankTop, loaded, opOnboarded]);

  const streakTop = (loaded && opOnboarded && op) ? computeStreak(op.id, logs) : 0;
  useEffect(() => {
    if (!loaded || !opOnboarded || !op) return;
    checkStreakAward(op, logs, awards);
    checkServiceStripAward(op, logs, campaigns, awards);
  }, [streakTop, loaded, opOnboarded]);

  useEffect(() => {
    const g = navGroupForTab(tab);
    if (g) setExpandedGroup(g);
  }, [tab]);

  if (!session) return <Login onAuthed={()=>{}} />;
  if (!loaded) return <div style={{padding:40,fontFamily:'IBM Plex Mono, monospace',color:'#8A9080'}}>ESTABLISHING UPLINK...</div>;
  if (!op) return <div style={{padding:40,fontFamily:'IBM Plex Mono, monospace',color:'#8A9080'}}>PROVISIONING PERSONNEL FILE... (refresh in a moment if this persists)</div>;
  if (!op.onboarded) return <Onboarding op={op} onComplete={(updatedOp)=>{ updateOperator(updatedOp); }} />;

  const dossierOp = viewDossierId ? operators.find(o=>o.id===viewDossierId) : op;
  const noAdminExists = !operators.some(o => o.isAdmin);
  const streak = computeStreak(op.id, logs);

  return (
    <div>
      <div className="topbar">
        <div className="brand" onClick={()=>{setTab('command'); setViewDossierId(null);}}>
          <div className="brand-dot"></div>
          <div><div className="disp brand-title">Vanguard // Personnel Terminal</div><div className="brand-sub">United Earth Alliance — Alpha Cell</div></div>
        </div>
        <div className="topbar-right">
          <div className="who"><Avatar op={op} size={28} /> {op.callsign}</div>
          <button className="ghost small" onClick={signOut}>Log Out</button>
          <button className="ghost small" onClick={() => setShowReset(true)}>Reset Test Data</button>
        </div>
      </div>

      {noAdminExists && (
        <div style={{background:'var(--panel-alt)',borderBottom:'1px solid var(--amber-dim)',padding:'10px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div style={{fontSize:12}}><span className="amber">No Command assigned.</span> <span className="dim">Claim it to manage Campaign settings, Codex, and roster.</span></div>
          <button className="primary small" onClick={()=>updateOperator(Object.assign({}, op, {isAdmin: true}))}>Claim Command ({op.callsign})</button>
        </div>
      )}

      <div className="layout">
        <div className="nav">
          {NAV_STRUCTURE.filter(n => !n.adminOnly || op.isAdmin).map(n => {
            if (n.type === 'item') {
              return (
                <div key={n.key} className={"nav-item"+(tab===n.key?" active":"")} onClick={() => {setTab(n.key); if(n.key==='dossier') setViewDossierId(op.id);}}>
                  {n.label}
                </div>
              );
            }
            const isOpen = expandedGroup === n.key;
            const groupHasActive = n.items.some(i=>i.key===tab);
            return (
              <div key={n.key}>
                <div className={"nav-item nav-group-header"+(groupHasActive?" active":"")} onClick={() => setExpandedGroup(isOpen ? null : n.key)}>
                  <span>{n.label}</span><span style={{float:'right'}}>{isOpen ? '\u2212' : '+'}</span>
                </div>
                {isOpen && n.items.map(i => (
                  <div key={i.key} className={"nav-item nav-subitem"+(tab===i.key?" active":"")} onClick={() => {setTab(i.key); if(i.key==='dossier') setViewDossierId(op.id);}}>
                    {i.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="main">
          {tab==='command' && <CommandCenter operators={operators} campaigns={campaigns} logs={logs} activeOp={op} deployedCampaign={deployedCampaignTop} onGoCampaigns={()=>setTab('campaigns')} streak={streak} quips={quips} campaignPOIs={campaignPOIs} />}
          {tab==='campaigns' && <Campaigns campaigns={campaigns} activeOp={op} logs={logs} onDeploy={deployToCampaign} onUndeploy={undeploy} onClaimReinforcement={claimReinforcement} campaignPOIs={campaignPOIs} />}
          {tab==='galaxy' && <GalaxyMap entries={codexEntries} campaigns={campaigns} logs={logs} onGoCampaigns={()=>setTab('campaigns')} />}
          {tab==='log' && <LogActivity deployedCampaign={deployedCampaignTop} activeOp={op} logs={logs} addLogs={addLogs} campaigns={campaigns} exercises={exercises} protocolSessions={protocolSessions} onRecordPR={recordPersonalRecord} raidTemplates={raidTemplates} raidInstances={raidInstances} />}
          {tab==='myprotocols' && <MyProtocols op={op} onSave={saveCustomProtocol} onDelete={deleteCustomProtocol} exercises={exercises} />}
          {tab==='habits' && <Habits op={op} logs={logs} onAddHabit={addHabit} onToggleArchive={toggleHabitArchive} onCheckin={logHabitCheckin} />}
          {tab==='squad' && <SquadTab activeOp={op} operators={operators} squads={squads} logs={logs} campaigns={campaigns}
            onCreate={createSquad} onJoin={joinSquad} onLeave={leaveSquad} onPromote={promoteOfficer} onDemote={demoteOfficer}
            onRemoveMember={removeMember} onRename={renameSquad} onDisband={disbandSquad}
            raidTemplates={raidTemplates} raidInstances={raidInstances} onLaunchRaid={launchRaid} />}
          {tab==='dossier' && <Dossier op={dossierOp} activeOpId={op.id} operators={operators} campaigns={campaigns} logs={logs} squads={squads} awards={awards} personalRecords={personalRecords} onUpdateOperator={updateOperator} onUploadAvatar={uploadAvatar} />}
          {tab==='roster' && <Roster operators={operators} campaigns={campaigns} logs={logs} onView={(id)=>{setViewDossierId(id); setTab('dossier');}} />}
          {tab==='codex' && <Codex entries={codexEntries} isAdmin={op.isAdmin} onUpdate={updateCodex} />}
          {tab==='comms' && <Comms chat={chat} operators={operators} squads={squads} activeOp={op} onSend={sendChat} />}
          {tab==='aar' && <AARLog operators={operators} campaigns={campaigns} logs={logs} />}
          {tab==='admin' && op.isAdmin && <AdminPanel operators={operators} campaigns={campaigns} logs={logs} onUpdateOperators={updateOperators} onUpdateCampaigns={updateCampaigns}
            exercises={exercises} protocolSessions={protocolSessions} onSaveExercise={saveExercise} onDeleteExercise={deleteExercise}
            onSaveProtocolSession={saveProtocolSession} onDeleteProtocolSession={deleteProtocolSession}
            quips={quips} onSaveQuip={saveQuip} onDeleteQuip={deleteQuip}
            raidTemplates={raidTemplates} onSaveRaidTemplate={saveRaidTemplate} onDeleteRaidTemplate={deleteRaidTemplate}
            campaignPOIs={campaignPOIs} onSavePOI={savePOI} onDeletePOI={deletePOI} />}
        </div>
      </div>

      {tab !== 'comms' && <MiniChat chat={chat} activeOp={op} onGoComms={()=>setTab('comms')} />}

      {showReset && (
        <div className="modal-overlay" onClick={() => setShowReset(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="disp" style={{fontSize:16,marginBottom:10}}>Reset all test data?</div>
            <div className="dim" style={{fontSize:13,marginBottom:18}}>Clears logs, chat, and Campaigns from the database. Operator accounts, habits, and custom Protocols are kept. Cannot be undone.</div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="ghost" onClick={() => setShowReset(false)}>Cancel</button>
              <button className="danger" onClick={resetAll}>Wipe & Reset</button>
            </div>
          </div>
        </div>
      )}

      {rankUpModal && (
        <div className="modal-overlay" onClick={()=>setRankUpModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{textAlign:'center',borderColor:'var(--amber)'}}>
            <div className="dim mono" style={{fontSize:10,marginBottom:10,letterSpacing:'0.1em'}}>PRIORITY TRANSMISSION — RANK ADVANCEMENT</div>
            <div className="disp amber" style={{fontSize:26,marginBottom:14}}>{rankUpModal}</div>
            <div style={{fontSize:13,lineHeight:1.7,marginBottom:20}}>{RANK_UP_LINES[rankUpModal]}</div>
            <button className="primary" style={{width:'100%'}} onClick={()=>setRankUpModal(null)}>Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}
