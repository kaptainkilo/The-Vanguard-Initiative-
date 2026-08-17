function CommandCenter({ operators, campaigns, logs, activeOp, deployedCampaign, onGoCampaigns, streak, quips, campaignPOIs, challengePool, challengeCompletions }) {
  const [selectedPOI, setSelectedPOI] = useState(null);
  const orsData = computeORS(activeOp.id, activeOp, logs);
  const status = computeReadinessStatus(activeOp.id, logs);
  const rank = computeRank(orsData.ors, activeOp.id, logs, campaigns, status);
  const rankTier = computeRankTier(rank, orsData.ors, activeOp.id, logs, campaigns);
  const commandRank = computeCommandRank(activeOp, orsData.ors, activeOp.id, logs, campaigns, status);
  const locProgress = deployedCampaign ? computeLocationProgress(deployedCampaign, logs) : [];
  const planetPct = deployedCampaign ? computePlanetControl(locProgress) : 0;
  const hexGrid = deployedCampaign ? computeHexGrid(deployedCampaign, locProgress) : null;
  const myPOIs = deployedCampaign ? (campaignPOIs||[]).filter(p=>p.campaignId===deployedCampaign.id) : [];
  const daysLeft = deployedCampaign ? Math.max(0, deployedCampaign.durationDays - daysBetween(deployedCampaign.startDate, todayStr())) : 0;
  const quip = dailyQuip(hashStr(todayStr()), quips);
  const loggedToday = logs.some(l => l.operatorId===activeOp.id && l.date===todayStr());
  const notifications = computeNotifications(activeOp, orsData, status, deployedCampaign, campaigns, logs);
  const warProgress = computeWarProgress(campaigns);
  const todayChallenge = dailyChallenge(challengePool, hashStr(todayStr()));
  const challengeProgress = computeChallengeProgress(activeOp.id, todayChallenge, logs);
  const challengeDone = (challengeCompletions||[]).some(c=>c.operatorId===activeOp.id && c.date===todayStr());

  return (
    <div>
      {notifications.map(n => (
        <div key={n.id} className="panel" style={{borderColor: n.severity==='urgent'?'var(--threat)':n.severity==='warning'?'var(--amber)':'var(--border)', padding:'12px 16px', marginBottom:12}}>
          <div style={{fontSize:12, color: n.severity==='urgent'?'var(--threat)':'var(--amber)'}}>{n.text}</div>
        </div>
      ))}
      <div className="panel">
        <div className="bracket-label">Sitrep — {todayStr()}</div>
        <div style={{fontSize:14,marginBottom:8}}>
          {loggedToday ? `Good work today, ${activeOp.callsign}.` : `Command hasn't seen you log anything today yet, ${activeOp.callsign}.`}
          {streak > 0 && <span> Current streak: <span className="amber mono">{streak} day{streak===1?'':'s'}</span>.</span>}
        </div>
        {quip && <div style={{fontSize:12,color:'var(--text-dim)',fontStyle:'italic'}}>"{quip}"</div>}
      </div>

      <div className="panel">
        <div className="bracket-label">War Progress — All Campaigns, All Time</div>
        <div className="bar-track" style={{height:10}}><div className="bar-fill" style={{width:warProgress.pct+'%', background: warProgress.pct>=50?'var(--success)':'var(--threat)'}}></div></div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginTop:6}}>
          <span className="dim">{warProgress.won} Won · {warProgress.lost} Lost · {warProgress.resolved} Concluded</span>
          <span className="mono">{Math.round(warProgress.pct)}%</span>
        </div>
        <div style={{fontSize:12,color:'var(--text-dim)',fontStyle:'italic',marginTop:8}}>{warProgressLine(warProgress)}</div>
      </div>

      {todayChallenge && (
        <div className="panel" style={{borderColor: challengeDone ? 'var(--success)' : 'var(--border)'}}>
          <div className="bracket-label">Daily Challenge{challengeDone ? ' — Complete' : ''}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div className="disp" style={{fontSize:16}}>{todayChallenge.name}</div>
            {challengeDone && <span style={{fontSize:18}}>✅</span>}
          </div>
          <div className="dim mono" style={{fontSize:11,marginBottom:8}}>{todayChallenge.muscleGroup} · {challengeProgress.total} / {challengeProgress.target} {todayChallenge.unit}</div>
          <div className="bar-track"><div className="bar-fill" style={{width:challengeProgress.pct+'%', background: challengeDone?'var(--success)':'var(--amber)'}}></div></div>
          {!challengeDone && <div style={{fontSize:11,color:'var(--text-dim)',marginTop:8}}>Resets at midnight. Log any {todayChallenge.muscleGroup} work today to fill this in.</div>}
        </div>
      )}

      {deployedCampaign ? (
        <div className="panel">
          <div className="bracket-label">Your Deployment</div>
          <div className="disp panel-title">{deployedCampaign.name}</div>
          <div className="dim mono" style={{fontSize:12}}>Threat: {deployedCampaign.threat} · {deployedCampaign.sector} · {daysLeft} days remaining · Control: <span className="amber">{Math.round(planetPct)}%</span></div>
          <div style={{fontSize:12,fontStyle:'italic',color:'var(--amber-dim)',marginTop:10}}>"{campaignMilestoneLine(deployedCampaign, planetPct)}"</div>
          <div style={{marginTop:16}}>
            <HexGridMap grid={hexGrid} pois={myPOIs} onSelectPOI={setSelectedPOI} />
          </div>
          {selectedPOI && (
            <div style={{marginTop:10,padding:'10px 12px',border:'1px solid var(--threat)',borderRadius:2}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <strong style={{fontSize:12}}>{selectedPOI.name}</strong>
                <span className="dim" style={{cursor:'pointer',fontSize:11}} onClick={()=>setSelectedPOI(null)}>✕</span>
              </div>
              {selectedPOI.briefing && <div style={{fontSize:11,color:'var(--text-dim)',marginTop:6,whiteSpace:'pre-line'}}>{selectedPOI.briefing}</div>}
            </div>
          )}
          <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:10}}>
            {locProgress.map(loc => (
              <div key={loc.id} className="loc-row">
                <div className="loc-head"><span className="loc-name">{loc.name}</span><span className="loc-pct mono">{Math.round(loc.pct)}% · {loc.total} / {loc.target} {loc.category} {loc.unit}</span></div>
                {loc.objective && <div className="dim" style={{fontSize:11,marginTop:2}}>{loc.objective}</div>}
                {loc.briefing && (
                  <details style={{marginTop:4}}>
                    <summary style={{cursor:'pointer',fontSize:10,color:'var(--text-dim)',fontFamily:"'IBM Plex Mono',monospace"}}>Briefing</summary>
                    <div style={{fontSize:11,lineHeight:1.6,color:'var(--text-dim)',marginTop:6,whiteSpace:'pre-line'}}>{loc.briefing}</div>
                  </details>
                )}
              </div>
            ))}
          </div>
          {deployedCampaign.lore && (
            <details style={{marginTop:16}}>
              <summary style={{cursor:'pointer',fontSize:11,color:'var(--text-dim)',fontFamily:"'IBM Plex Mono',monospace",letterSpacing:'0.05em'}}>FULL BRIEFING</summary>
              <div style={{fontSize:12,lineHeight:1.8,color:'var(--text-dim)',marginTop:10,whiteSpace:'pre-line'}}>{deployedCampaign.lore}</div>
            </details>
          )}
        </div>
      ) : (
        <div className="panel">
          <div className="bracket-label">Your Deployment</div>
          <div className="dim" style={{fontSize:13,marginBottom:12}}>Not currently deployed to any Campaign.</div>
          <button className="primary" onClick={onGoCampaigns}>View Campaigns</button>
        </div>
      )}

      <div className="grid2">
        <div className="panel">
          <div className="bracket-label">Operator Status — {activeOp.callsign}</div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
            <RankInsignia rank={commandRank ? commandRank.rank : rank} tier={commandRank ? commandRank.tier : rankTier} size={44} />
            {activeOp.specialization && <SpecialtyBadge specialization={activeOp.specialization} size={40} />}
          </div>
          <div className="stat-row"><span>Rank</span><span className="pill rank">{commandRank ? commandRankDisplay(commandRank) : rankDisplay(rank, rankTier)}</span></div>
          <div className="stat-row"><span>Readiness (ORS)</span><span className="stat-val">{orsData.ors} / 100</span></div>
          <div className="stat-row"><span>Status</span><span className={"status-pill "+status.cls}>{status.label}</span></div>
          <div className="sub-bars">
            <SubBar label="Physical Capability" val={orsData.physical} />
            <SubBar label="Mission Discipline" val={orsData.discipline} />
            <SubBar label="Personal Development" val={orsData.personalDev} />
            <SubBar label="Squad Contribution" val={orsData.squad} />
          </div>
        </div>
        <div className="panel">
          <div className="bracket-label">Quick Reference</div>
          <div className="dim" style={{fontSize:12,lineHeight:1.8}}>
            One Campaign deployment at a time. First log per Location per day counts 1:1; additional logs same day count at 50%.<br/><br/>
            Status now reflects your logging frequency over time, not just whether you logged something recently.
          </div>
        </div>
      </div>
    </div>
  );
}

function Campaigns({ campaigns, activeOp, logs, onDeploy, onUndeploy, onClaimReinforcement, campaignPOIs }) {
  const deployedId = activeOp.currentDeploymentId;
  const nonCampMCP = nonCampaignMCP(activeOp.id, logs);
  const mcpToNextDrop = Math.max(0, 200 - (nonCampMCP - activeOp.mcpAtLastReinforcement));
  const eligibleForDrop = activeOp.reinforcementDropsAvailable < 1 && mcpToNextDrop <= 0;
  return (
    <div>
      {activeOp.reinforcementDropsAvailable > 0 && (
        <div className="panel" style={{borderColor:'var(--amber)'}}>
          <div className="bracket-label">Reinforcement Drop Available</div>
          <div style={{fontSize:12,color:'var(--text-dim)'}}>You've earned a late-entry pass into any Campaign whose Join Window has already closed.</div>
        </div>
      )}
      {activeOp.reinforcementDropsAvailable === 0 && (
        <div className="panel">
          <div className="bracket-label">Reinforcement Drop Progress</div>
          <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:8}}>{mcpToNextDrop > 0 ? mcpToNextDrop+' MCP to go.' : 'Ready to claim!'}</div>
          {eligibleForDrop && <button className="primary small" onClick={()=>onClaimReinforcement(activeOp)}>Claim Reinforcement Drop</button>}
        </div>
      )}
      {campaigns.map(camp => {
        const phase = campaignPhase(camp);
        const locProg = computeLocationProgress(camp, logs);
        const planetPct = computePlanetControl(locProg);
        const isDeployed = deployedId === camp.id;
        const daysLeft = Math.max(0, camp.durationDays - daysBetween(camp.startDate, todayStr()));
        const joinWindowDaysLeft = Math.max(0, camp.joinWindowDays - daysBetween(camp.startDate, todayStr()));
        const capMax = Math.floor(0.2 * camp.lockedDeployedCount);
        const canDeployReinforcement = phase==='active' && activeOp.reinforcementDropsAvailable>0 && camp.reinforcementsUsed < capMax;
        return (
          <div key={camp.id} className={"campaign-card"+(isDeployed?' deployed':'')}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
              <div><div className="disp" style={{fontSize:18}}>{camp.name}</div><div className="dim mono" style={{fontSize:11}}>{camp.threat} · {camp.sector}</div></div>
              <span className={"status-tag "+(phase==='recruiting'?'recruiting':phase==='active'?'active':phase)}>
                {phase==='recruiting' && `Recruiting (${joinWindowDaysLeft}d left)`}
                {phase==='active' && `Active (${daysLeft}d left)`}
                {phase==='success' && 'Victory'}{phase==='failed' && 'Contested'}
              </span>
            </div>
            <div style={{marginTop:12,fontSize:12}}>Control: <span className="amber mono">{Math.round(planetPct)}%</span> · Deployed: {camp.deployedOperatorIds.length}{camp.lockedAt ? ` (locked at ${camp.lockedDeployedCount})` : ''}</div>
            <div style={{fontSize:11,fontStyle:'italic',color:'var(--amber-dim)',marginTop:6}}>"{campaignMilestoneLine(camp, planetPct)}"</div>
            <details style={{marginTop:8}}>
              <summary style={{cursor:'pointer',fontSize:10,color:'var(--text-dim)',fontFamily:"'IBM Plex Mono',monospace",letterSpacing:'0.05em'}}>AO MAP</summary>
              <div style={{marginTop:8,maxWidth:360}}>
                <HexGridMap grid={computeHexGrid(camp, locProg)} pois={(campaignPOIs||[]).filter(p=>p.campaignId===camp.id)} />
              </div>
            </details>
            {camp.lore && (
              <details style={{marginTop:8}}>
                <summary style={{cursor:'pointer',fontSize:10,color:'var(--text-dim)',fontFamily:"'IBM Plex Mono',monospace",letterSpacing:'0.05em'}}>FULL BRIEFING</summary>
                <div style={{fontSize:11,lineHeight:1.7,color:'var(--text-dim)',marginTop:8,whiteSpace:'pre-line'}}>{camp.lore}</div>
              </details>
            )}
            <div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}>
              {isDeployed && <button className="ghost small" onClick={()=>onUndeploy(activeOp)}>Undeploy</button>}
              {!isDeployed && !deployedId && phase==='recruiting' && <button className="primary small" onClick={()=>onDeploy(activeOp, camp)}>Deploy</button>}
              {!isDeployed && !deployedId && phase==='active' && canDeployReinforcement && <button className="primary small" onClick={()=>onDeploy(activeOp, camp)}>Deploy (Reinforcement Drop)</button>}
              {!isDeployed && deployedId && deployedId !== camp.id && <span className="dim" style={{fontSize:11}}>Already deployed elsewhere</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Habits({ op, logs, onAddHabit, onToggleArchive, onCheckin }) {
  const [newHabit, setNewHabit] = useState('');
  const habits = op.habits || [];
  const active = habits.filter(h=>h.active);
  const archived = habits.filter(h=>!h.active);
  function habitStreak(habitId) {
    const days = new Set(logs.filter(l=>l.type==='habit' && l.operatorId===op.id && l.habitId===habitId).map(l=>l.date));
    let streak = 0; let cursor = new Date();
    if (!days.has(todayStr())) cursor.setDate(cursor.getDate()-1);
    while (days.has(todayStr(cursor))) { streak++; cursor.setDate(cursor.getDate()-1); }
    return streak;
  }
  const last7 = Array.from({length:7}, (_,i) => { const d = new Date(); d.setDate(d.getDate()-(6-i)); return d; });
  const dayLetters = ['S','M','T','W','T','F','S'];
  return (
    <div>
      <div className="panel">
        <div className="bracket-label">Daily Habits</div>
        <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:16}}>Habits feed the Personal Development slice of your ORS.</div>
        {active.length === 0 && <div className="empty"><div className="empty-title">No active habits yet.</div></div>}
        {active.map(h => {
          const checkedToday = logs.some(l=>l.type==='habit' && l.operatorId===op.id && l.habitId===h.id && l.date===todayStr());
          return (
            <div key={h.id} className="field-row">
              <span>{h.name} <span className="dim mono" style={{fontSize:10}}>({habitStreak(h.id)} day streak)</span></span>
              <span style={{display:'flex',gap:8}}>
                <button className={checkedToday?'primary small':'ghost small'} onClick={()=>onCheckin(op, h.id)} disabled={checkedToday}>{checkedToday?'Done Today':'Check In'}</button>
                <button className="ghost small" onClick={()=>onToggleArchive(op, h.id)}>Archive</button>
              </span>
            </div>
          );
        })}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <input type="text" value={newHabit} onChange={e=>setNewHabit(e.target.value)} placeholder="e.g. Drink 64oz water" style={{flex:1}} />
          <button className="primary" onClick={()=>{ if(newHabit.trim()){ onAddHabit(op, newHabit.trim()); setNewHabit(''); } }}>Add Habit</button>
        </div>
      </div>

      {active.length > 0 && (
        <div className="panel">
          <div className="bracket-label">This Week</div>
          <table>
            <thead>
              <tr>
                <th>Habit</th>
                {last7.map((d,i) => <th key={i} style={{textAlign:'center'}}>{dayLetters[d.getDay()]}</th>)}
              </tr>
            </thead>
            <tbody>
              {active.map(h => (
                <tr key={h.id}>
                  <td style={{fontSize:11}}>{h.name}</td>
                  {last7.map((d,i) => {
                    const dateStr = todayStr(d);
                    const done = logs.some(l=>l.type==='habit' && l.operatorId===op.id && l.habitId===h.id && l.date===dateStr);
                    const isFuture = dateStr > todayStr();
                    return (
                      <td key={i} style={{textAlign:'center'}}>
                        <div style={{width:16,height:16,borderRadius:3,margin:'0 auto',background: done?'var(--amber)':(isFuture?'transparent':'var(--panel-alt)'),border:'1px solid '+(done?'var(--amber)':'var(--border)')}}></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {archived.length > 0 && (
        <div className="panel">
          <div className="bracket-label">Archived Habits</div>
          {archived.map(h => <div key={h.id} className="field-row"><span className="dim">{h.name}</span><button className="ghost small" onClick={()=>onToggleArchive(op, h.id)}>Reactivate</button></div>)}
        </div>
      )}
    </div>
  );
}

function squadStats(squad, operators, campaigns, logs, season) {
  const memberOps = squad.members.map(m => operators.find(o=>o.id===m.operatorId)).filter(Boolean);
  const seasonLogs = season ? logs.filter(l => l.date >= season.startDate && l.date <= season.endDate) : logs;
  const totalMCP = memberOps.reduce((s,o)=>s+computeMCP(o.id,campaigns,seasonLogs),0);
  const avgORS = memberOps.length ? Math.round(memberOps.reduce((s,o)=>s+computeORS(o.id,o,logs).ors,0)/memberOps.length) : 0;
  const campaignContribution = seasonLogs.filter(l=>l.type==='campaign' && memberOps.some(o=>o.id===l.operatorId)).reduce((s,l)=>s+(l.amount||0),0);
  return { memberCount: memberOps.length, totalMCP, avgORS, campaignContribution };
}

function SquadTab({ activeOp, operators, squads, logs, campaigns, onCreate, onJoin, onLeave, onPromote, onDemote, onRemoveMember, onRename, onDisband, raidTemplates, raidInstances, onLaunchRaid, seasons, duels, onCreateDuel, onAcceptDuel, onDeclineDuel }) {
  const [newSquadName, setNewSquadName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [launchingTemplateId, setLaunchingTemplateId] = useState(null);
  const [duelDraft, setDuelDraft] = useState({opponentSquadId:'', muscleGroup:'Any', target:'', unit:'reps', durationDays:'7'});
  const currentSeason = computeCurrentSeason(seasons);

  const mySquad = activeOp.squadId ? squads.find(s=>s.id===activeOp.squadId) : null;

  if (!mySquad) {
    return (
      <div>
        <div className="panel">
          <div className="bracket-label">Squads — Opt-In</div>
          <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:16}}>Squads are entirely optional. Solo operators are never penalized for not joining one — ORS works the same either way.</div>
          <div className="field"><label>Found a New Squad</label>
            <div style={{display:'flex',gap:8}}>
              <input type="text" value={newSquadName} onChange={e=>setNewSquadName(e.target.value)} placeholder="Squad name" style={{flex:1}} />
              <button className="primary" onClick={()=>{ if(newSquadName.trim()){ onCreate(activeOp, newSquadName.trim()); setNewSquadName(''); } }}>Found Squad</button>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="bracket-label">Browse Squads</div>
          {squads.length === 0 && <div className="empty"><div className="empty-title">No squads exist yet.</div></div>}
          {squads.map(s => {
            const stats = squadStats(s, operators, campaigns, logs, currentSeason);
            const full = stats.memberCount >= 10;
            return (
              <div key={s.id} className="protocol-card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div><strong>{s.name}</strong> <span className="dim" style={{fontSize:11}}>— {stats.memberCount}/10 members · Avg ORS {stats.avgORS}</span></div>
                  <button className="primary small" disabled={full} onClick={()=>onJoin(activeOp, s)}>{full?'Full':'Join'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const isLeader = activeOp.squadRole === 'leader';
  const isLeadership = activeOp.squadRole === 'leader' || activeOp.squadRole === 'officer';
  const officerCount = mySquad.members.filter(m=>m.role==='officer').length;
  const memberOps = mySquad.members.map(m => {
    const o = operators.find(o=>o.id===m.operatorId);
    return o ? Object.assign({}, o, {role: m.role}) : null;
  }).filter(Boolean);

  const allStats = squads.map(s => ({ squad: s, stats: squadStats(s, operators, campaigns, logs, currentSeason) }));
  const rankBy = (key) => allStats.slice().sort((a,b)=>b.stats[key]-a.stats[key]);

  return (
    <div>
      <div className="panel">
        <div className="dossier-header">
          <div>
            {renaming ? (
              <div style={{display:'flex',gap:8}}>
                <input type="text" value={renameVal} onChange={e=>setRenameVal(e.target.value)} />
                <button className="primary small" onClick={()=>{onRename(mySquad, renameVal); setRenaming(false);}}>Save</button>
                <button className="ghost small" onClick={()=>setRenaming(false)}>Cancel</button>
              </div>
            ) : (
              <div className="disp" style={{fontSize:24}}>{mySquad.name}</div>
            )}
            <div className="dim mono" style={{fontSize:11}}>{memberOps.length}/10 members</div>
          </div>
          <span className="pill rank">{activeOp.squadRole}</span>
        </div>

        <table style={{marginBottom:16}}>
          <thead><tr><th>Callsign</th><th>Role</th><th>ORS</th><th>MCP</th>{isLeadership && <th></th>}</tr></thead>
          <tbody>
            {memberOps.map(m => {
              const ors = computeORS(m.id, m, logs).ors;
              const mcp = computeMCP(m.id, campaigns, logs);
              return (
                <tr key={m.id}>
                  <td className="disp" style={{fontFamily:"'Oswald',sans-serif"}}>{m.callsign}</td>
                  <td>{m.role}</td>
                  <td className="amber">{ors}</td>
                  <td>{mcp}</td>
                  {isLeadership && m.id !== activeOp.id && (
                    <td style={{display:'flex',gap:6}}>
                      {isLeader && m.role==='member' && officerCount<3 && <button className="small ghost" onClick={()=>onPromote(mySquad, m.id)}>Promote</button>}
                      {isLeader && m.role==='officer' && <button className="small ghost" onClick={()=>onDemote(mySquad, m.id)}>Demote</button>}
                      <button className="small ghost" onClick={()=>onRemoveMember(mySquad, m.id)}>Remove</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {isLeader && !renaming && <button className="ghost small" onClick={()=>{setRenaming(true); setRenameVal(mySquad.name);}}>Rename Squad</button>}
          {isLeader && (confirmDisband ? (
            <span style={{display:'flex',gap:6}}>
              <button className="danger small" onClick={()=>onDisband(mySquad)}>Confirm Disband</button>
              <button className="ghost small" onClick={()=>setConfirmDisband(false)}>Cancel</button>
            </span>
          ) : <button className="danger small" onClick={()=>setConfirmDisband(true)}>Disband Squad</button>)}
          {!isLeader && (confirmLeave ? (
            <span style={{display:'flex',gap:6}}>
              <button className="danger small" onClick={()=>onLeave(activeOp)}>Confirm Leave</button>
              <button className="ghost small" onClick={()=>setConfirmLeave(false)}>Cancel</button>
            </span>
          ) : <button className="ghost small" onClick={()=>setConfirmLeave(true)}>Leave Squad</button>)}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="bracket-label">Leaderboard — MCP{currentSeason ? ' ('+currentSeason.name+')' : ' (All-Time)'}</div>
          {rankBy('totalMCP').slice(0,5).map((r,i) => (
            <div key={r.squad.id} className="stat-row"><span>{i+1}. {r.squad.name}</span><span className="stat-val">{r.stats.totalMCP}</span></div>
          ))}
        </div>
        <div className="panel">
          <div className="bracket-label">Leaderboard — Average ORS (Current)</div>
          {rankBy('avgORS').slice(0,5).map((r,i) => (
            <div key={r.squad.id} className="stat-row"><span>{i+1}. {r.squad.name}</span><span className="stat-val">{r.stats.avgORS}</span></div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="bracket-label">Leaderboard — Campaign Contribution{currentSeason ? ' ('+currentSeason.name+')' : ' (All-Time)'}</div>
        {rankBy('campaignContribution').slice(0,5).map((r,i) => (
          <div key={r.squad.id} className="stat-row"><span>{i+1}. {r.squad.name}</span><span className="stat-val">{Math.round(r.stats.campaignContribution)}</span></div>
        ))}
      </div>

      {(() => {
        const myActiveRaid = raidInstances.find(r => r.squadId === mySquad.id && r.status === 'active');
        const myTemplate = myActiveRaid ? raidTemplates.find(t => t.id === myActiveRaid.raidTemplateId) : null;
        const availableTemplates = raidTemplates.filter(t => t.areas.length > 0);

        return (
          <div>
            {myActiveRaid && myTemplate ? (() => {
              const area = myTemplate.areas[myActiveRaid.currentAreaIndex];
              const isBossArea = myActiveRaid.currentAreaIndex >= myTemplate.areas.length - 1;
              const objProgress = area ? computeRaidObjectiveProgress(myActiveRaid, area, logs) : [];
              return (
                <div className="panel" style={{borderColor: isBossArea ? 'var(--threat)' : 'var(--border)'}}>
                  <div className="bracket-label">{isBossArea ? '⚔️ BOSS FIGHT' : 'Active Raid'} — {myTemplate.name}</div>
                  <div className="dim mono" style={{fontSize:11,marginBottom:10}}>Area {myActiveRaid.currentAreaIndex+1} of {myTemplate.areas.length}: {area ? area.name : '\u2014'}</div>
                  {isBossArea && myTemplate.bossFlavor && <div style={{fontSize:12,fontStyle:'italic',color:'var(--threat)',marginBottom:12}}>"{myTemplate.bossFlavor}"</div>}
                  {objProgress.map(o => (
                    <div key={o.id} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                        <span>{o.name} ({o.muscleGroup})</span><span className="mono">{o.total} / {o.target} {o.unit}</span>
                      </div>
                      <div className="bar-track"><div className="bar-fill" style={{width:o.pct+'%'}}></div></div>
                    </div>
                  ))}
                  <div className="dim mono" style={{fontSize:10,marginTop:6}}>Started {new Date(myActiveRaid.startedAt).toLocaleDateString()}</div>
                </div>
              );
            })() : (
              <div className="panel">
                <div className="bracket-label">Available Raids</div>
                {availableTemplates.length === 0 && <div className="dim" style={{fontSize:12}}>No raids have been created yet.</div>}
                {availableTemplates.map(t => (
                  <div key={t.id} className="protocol-card">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><strong>{t.name}</strong> <span className="dim" style={{fontSize:11}}>— Boss: {t.bossName} · {t.areas.length} area{t.areas.length===1?'':'s'}</span></div>
                      {isLeadership && (
                        <button className="primary small" onClick={async()=>{setLaunchingTemplateId(t.id); const ok = await onLaunchRaid(mySquad, t); setLaunchingTemplateId(null); if(!ok) alert('Squad already has an active raid.');}} disabled={launchingTemplateId===t.id}>
                          {launchingTemplateId===t.id ? 'Launching...' : 'Launch'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!isLeadership && availableTemplates.length > 0 && <div className="info-note" style={{marginTop:10}}>Only your Squad's Leader or Officers can launch a raid.</div>}
              </div>
            )}

            {raidTemplates.length > 0 && (
              <div className="panel">
                <div className="bracket-label">Fastest Clears{currentSeason ? ' ('+currentSeason.name+')' : ' (All-Time)'}</div>
                {raidTemplates.map(t => {
                  let completions = raidInstances.filter(r => r.raidTemplateId === t.id && r.status === 'completed' && r.completedAt);
                  if (currentSeason) completions = completions.filter(r => { const d = r.completedAt.slice(0,10); return d >= currentSeason.startDate && d <= currentSeason.endDate; });
                  const bestPerSquad = {};
                  completions.forEach(r => {
                    const ms = new Date(r.completedAt) - new Date(r.startedAt);
                    if (!bestPerSquad[r.squadId] || ms < bestPerSquad[r.squadId].ms) bestPerSquad[r.squadId] = { ms, squadId: r.squadId };
                  });
                  const ranked = Object.values(bestPerSquad).sort((a,b)=>a.ms-b.ms);
                  if (ranked.length === 0) return null;
                  return (
                    <div key={t.id} style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>{t.name}</div>
                      {ranked.slice(0,5).map((r,i) => {
                        const sq = squads.find(s=>s.id===r.squadId);
                        return <div key={r.squadId} className="stat-row"><span>{i+1}. {sq?sq.name:'Unknown Squad'}</span><span className="stat-val">{formatDuration(r.ms)}</span></div>;
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {(() => {
        const incoming = duels.filter(d => d.status==='pending' && d.opponentSquadId===mySquad.id);
        const outgoing = duels.filter(d => d.status==='pending' && d.challengerSquadId===mySquad.id);
        const active = duels.filter(d => d.status==='active' && (d.challengerSquadId===mySquad.id || d.opponentSquadId===mySquad.id));
        const squadName = id => { const s = squads.find(s=>s.id===id); return s ? s.name : 'Unknown Squad'; };
        const otherSquads = squads.filter(s => s.id !== mySquad.id);

        return (
          <div>
            {incoming.length > 0 && (
              <div className="panel" style={{borderColor:'var(--amber)'}}>
                <div className="bracket-label">Incoming Duel Challenges</div>
                {incoming.map(d => (
                  <div key={d.id} className="protocol-card">
                    <div>{squadName(d.challengerSquadId)} challenges you: <strong>{d.target} {d.muscleGroup} {d.unit}</strong> over {d.durationDays} days.</div>
                    {isLeadership && (
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <button className="primary small" onClick={()=>onAcceptDuel(d)}>Accept</button>
                        <button className="ghost small" onClick={()=>onDeclineDuel(d.id)}>Decline</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {outgoing.length > 0 && (
              <div className="panel">
                <div className="bracket-label">Outgoing Challenges</div>
                {outgoing.map(d => (
                  <div key={d.id} className="dim" style={{fontSize:12,marginBottom:6}}>Waiting on {squadName(d.opponentSquadId)}: {d.target} {d.muscleGroup} {d.unit} over {d.durationDays} days.</div>
                ))}
              </div>
            )}

            {active.length > 0 && (
              <div className="panel">
                <div className="bracket-label">Active Duels</div>
                {active.map(d => {
                  const challengerSquad = squads.find(s=>s.id===d.challengerSquadId);
                  const opponentSquad = squads.find(s=>s.id===d.opponentSquadId);
                  const challengerProgress = computeDuelProgress(challengerSquad, d, logs);
                  const opponentProgress = computeDuelProgress(opponentSquad, d, logs);
                  const daysLeft = Math.max(0, daysBetween(todayStr(), d.endDate));
                  return (
                    <div key={d.id} style={{marginBottom:16}}>
                      <div style={{fontSize:12,marginBottom:6}}>{squadName(d.challengerSquadId)} vs {squadName(d.opponentSquadId)} — {d.target} {d.muscleGroup} {d.unit} · {daysLeft}d left</div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}><span>{squadName(d.challengerSquadId)}</span><span className="mono">{challengerProgress} / {d.target}</span></div>
                      <div className="bar-track"><div className="bar-fill" style={{width:Math.min(100,(challengerProgress/d.target)*100)+'%'}}></div></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginTop:8,marginBottom:2}}><span>{squadName(d.opponentSquadId)}</span><span className="mono">{opponentProgress} / {d.target}</span></div>
                      <div className="bar-track"><div className="bar-fill" style={{width:Math.min(100,(opponentProgress/d.target)*100)+'%', background:'var(--threat)'}}></div></div>
                    </div>
                  );
                })}
              </div>
            )}

            {isLeadership && (
              <div className="panel">
                <div className="bracket-label">Challenge a Squad</div>
                <div className="grid2">
                  <div className="field"><label>Opponent Squad</label>
                    <select value={duelDraft.opponentSquadId} onChange={e=>setDuelDraft(Object.assign({},duelDraft,{opponentSquadId:e.target.value}))}>
                      <option value="">Select a squad...</option>
                      {otherSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Muscle Group</label>
                    <select value={duelDraft.muscleGroup} onChange={e=>setDuelDraft(Object.assign({},duelDraft,{muscleGroup:e.target.value}))}>
                      <option value="Any">Any (total volume)</option>
                      {MUSCLE_GROUPS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field"><label>Target</label><input type="number" value={duelDraft.target} onChange={e=>setDuelDraft(Object.assign({},duelDraft,{target:e.target.value}))} /></div>
                  <div className="field"><label>Duration (days)</label><input type="number" value={duelDraft.durationDays} onChange={e=>setDuelDraft(Object.assign({},duelDraft,{durationDays:e.target.value}))} /></div>
                </div>
                <button className="primary small" onClick={()=>{
                  if (!duelDraft.opponentSquadId || !duelDraft.target || !duelDraft.durationDays) return;
                  onCreateDuel(mySquad.id, duelDraft.opponentSquadId, duelDraft.muscleGroup, Number(duelDraft.target), duelDraft.muscleGroup==='Cardio'?'minutes':'reps', Number(duelDraft.durationDays));
                  setDuelDraft({opponentSquadId:'', muscleGroup:'Any', target:'', unit:'reps', durationDays:'7'});
                }}>Issue Challenge</button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return days+'d '+hours+'h';
  if (hours > 0) return hours+'h '+minutes+'m';
  return minutes+'m';
}

function planetFactionClass(planet) {
  const text = (planet.title + ' ' + planet.body).toLowerCase();
  if (text.includes('kharvax')) return 'faction-kharvax';
  if (text.includes('voss')) return 'faction-voss';
  if (text.includes('skarn')) return 'faction-skarn';
  return 'faction-unknown';
}
function planetPosition(idx, total) {
  const angle = (idx / Math.max(1,total)) * 2 * Math.PI - Math.PI/2;
  const radiusX = 36, radiusY = 34;
  const left = 50 + radiusX * Math.cos(angle);
  const top = 50 + radiusY * Math.sin(angle);
  return { left: left+'%', top: top+'%' };
}
function planetStatus(planet, campaigns, logs) {
  const matches = campaigns.filter(c => c.sector === planet.title);
  if (matches.length === 0) return { label: 'Uncharted', detail: null, campaign: null };
  const active = matches.find(c => campaignPhase(c) === 'active' || campaignPhase(c) === 'recruiting');
  if (active) {
    const pct = Math.round(computePlanetControl(computeLocationProgress(active, logs)));
    return { label: `Contested — ${pct}% Control`, detail: campaignPhase(active), campaign: active };
  }
  const success = matches.find(c => c.resolved === 'success');
  if (success) return { label: 'Secured', detail: 'success', campaign: success };
  const failed = matches.filter(c => c.resolved === 'failed');
  if (failed.length) return { label: 'Contested (past Campaign failed)', detail: 'failed', campaign: failed[failed.length-1] };
  return { label: 'Uncharted', detail: null, campaign: null };
}

function GalaxyMap({ entries, campaigns, logs, onGoCampaigns }) {
  const [selected, setSelected] = useState(null);
  const planets = entries.filter(e => e.category === 'Planets');
  const selectedPlanet = selected ? planets.find(p=>p.id===selected) : null;
  const selectedStatus = selectedPlanet ? planetStatus(selectedPlanet, campaigns, logs) : null;

  return (
    <div>
      <div className="panel">
        <div className="bracket-label">Galactic Map</div>
        <div className="galaxy-wrap">
          <div className="galaxy-core">
            <div className="galaxy-core-dot"></div>
            <div className="galaxy-core-label">UEA CORE — SECURED</div>
          </div>
          {planets.map((p, idx) => {
            const pos = planetPosition(idx, planets.length);
            const status = planetStatus(p, campaigns, logs);
            const factionClass = planetFactionClass(p);
            return (
              <div key={p.id} className={"planet-node "+factionClass} style={{left:pos.left, top:pos.top}} onClick={()=>setSelected(p.id)}>
                <div className="planet-dot"></div>
                <div className="planet-label" style={{color: selected===p.id?'var(--amber)':'var(--text-dim)'}}>{p.title}</div>
              </div>
            );
          })}
        </div>
        <div className="galaxy-legend">
          <div className="galaxy-legend-item"><div className="galaxy-legend-dot" style={{background:'#E4572E'}}></div>Kharvax Swarm</div>
          <div className="galaxy-legend-item"><div className="galaxy-legend-dot" style={{background:'#7CA9E8'}}></div>Voss Directorate</div>
          <div className="galaxy-legend-item"><div className="galaxy-legend-dot" style={{background:'#6FCF97'}}></div>Skarn Collective</div>
          <div className="galaxy-legend-item"><div className="galaxy-legend-dot" style={{background:'#8A93A6'}}></div>Unclaimed / Renders</div>
        </div>
      </div>

      {selectedPlanet ? (
        <div className="panel">
          <div className="bracket-label">{selectedPlanet.title}</div>
          <div style={{fontSize:13,lineHeight:1.8,color:'var(--text-dim)',marginBottom:14}}>{selectedPlanet.body}</div>
          <div className="stat-row"><span>Status</span><span className="amber">{selectedStatus.label}</span></div>
          {selectedStatus.campaign && (selectedStatus.detail==='active'||selectedStatus.detail==='recruiting') && (
            <button className="primary small" style={{marginTop:10}} onClick={onGoCampaigns}>View Campaign</button>
          )}
        </div>
      ) : (
        <div className="panel"><div className="dim" style={{fontSize:12}}>Click a world to view its Codex entry and current Campaign status.</div></div>
      )}
    </div>
  );
}

function Codex({ entries, isAdmin, onUpdate }) {
  const categories = ['Lore','Planets','Enemies','Characters','Field Guide','Philosophy'];
  const [activeCat, setActiveCat] = useState('Lore');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({title:'',body:'',iconRef:''});
  const [adding, setAdding] = useState(false);

  function startEdit(entry) { setEditingId(entry.id); setDraft({title:entry.title, body:entry.body, iconRef:entry.iconRef||''}); }
  function saveEdit() {
    onUpdate(entries.map(e => e.id===editingId ? Object.assign({}, e, draft) : e));
    setEditingId(null);
  }
  function saveNew() {
    if (!draft.title.trim()) return;
    onUpdate(entries.concat([{id:'codex_'+Date.now(), category:activeCat, title:draft.title, body:draft.body, iconRef:draft.iconRef}]));
    setDraft({title:'',body:'',iconRef:''}); setAdding(false);
  }
  function deleteEntry(id) { onUpdate(entries.filter(e=>e.id!==id)); }

  const shown = entries.filter(e=>e.category===activeCat);

  return (
    <div className="panel">
      <div className="bracket-label">Vanguard Codex</div>
      <div className="codex-cat-tabs">
        {categories.map(c => <button key={c} className={activeCat===c?'primary small':'ghost small'} onClick={()=>{setActiveCat(c); setEditingId(null); setAdding(false);}}>{c}</button>)}
      </div>
      {shown.length === 0 && <div className="empty"><div className="empty-title">No entries in {activeCat} yet.</div></div>}
      {shown.map(entry => (
        <div key={entry.id} className="codex-entry">
          {editingId === entry.id ? (
            <div>
              <input type="text" value={draft.title} onChange={e=>setDraft(Object.assign({},draft,{title:e.target.value}))} style={{marginBottom:8}} />
              <textarea value={draft.body} onChange={e=>setDraft(Object.assign({},draft,{body:e.target.value}))} rows="4" style={{width:'100%',marginBottom:8}} />
              <input type="text" value={draft.iconRef} onChange={e=>setDraft(Object.assign({},draft,{iconRef:e.target.value}))} placeholder="Icon refs, e.g. rank:Operator:2,specialty:Recon,award:streak_30" style={{marginBottom:8}} />
              <div style={{display:'flex',gap:8}}>
                <button className="primary small" onClick={saveEdit}>Save</button>
                <button className="ghost small" onClick={()=>setEditingId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="codex-entry-head">
                <div className="disp amber" style={{fontSize:15}}>{entry.title}</div>
                {isAdmin && <span style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="ghost small" onClick={()=>startEdit(entry)}>Edit</button>
                  <button className="ghost small" onClick={()=>deleteEntry(entry.id)}>Delete</button>
                </span>}
              </div>
              <CodexIconRow iconRef={entry.iconRef} />
              <div style={{fontSize:12,lineHeight:1.7,color:'var(--text-dim)',marginTop:6}}>{entry.body}</div>
            </div>
          )}
        </div>
      ))}
      {isAdmin && !adding && <button className="ghost small" onClick={()=>{setAdding(true); setDraft({title:'',body:'',iconRef:''});}}>+ Add {activeCat} Entry</button>}
      {isAdmin && adding && (
        <div className="codex-entry">
          <input type="text" value={draft.title} onChange={e=>setDraft(Object.assign({},draft,{title:e.target.value}))} placeholder="Title" style={{marginBottom:8}} />
          <textarea value={draft.body} onChange={e=>setDraft(Object.assign({},draft,{body:e.target.value}))} placeholder="Body text" rows="4" style={{width:'100%',marginBottom:8}} />
          <input type="text" value={draft.iconRef} onChange={e=>setDraft(Object.assign({},draft,{iconRef:e.target.value}))} placeholder="Icon refs, e.g. rank:Operator:2,specialty:Recon,award:streak_30" style={{marginBottom:8}} />
          <div style={{display:'flex',gap:8}}>
            <button className="primary small" onClick={saveNew}>Add Entry</button>
            <button className="ghost small" onClick={()=>setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyProtocols({ op, onSave, onDelete, exercises }) {
  const [building, setBuilding] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [name, setName] = useState('');
  const [objectives, setObjectives] = useState([]);
  const [exName, setExName] = useState(exercises[0] ? exercises[0].name : '');
  const custom = op.customProtocols || [];
  const cap = 5;

  if (exercises.length === 0) {
    return <div className="panel"><div className="empty"><div className="empty-title">Exercise library not loaded.</div><div>Run exercises_and_sessions_to_db.sql in Supabase, then refresh.</div></div></div>;
  }

  function startNew() { setBuilding(true); setEditTarget(null); setName(''); setObjectives([]); }
  function startEdit(p) { setBuilding(true); setEditTarget(p.id); setName(p.name); setObjectives(p.objectives); }
  function addObjective() {
    const ex = exercises.find(e=>e.name===exName);
    setObjectives(objectives.concat([{name: ex.name, muscleGroup: ex.muscleGroup, unit: ex.unit, sets: 3, repLow: 10, repHigh: 12, alternatives: ex.alternatives}]));
  }
  function removeObjective(i) { setObjectives(objectives.filter((_,idx)=>idx!==i)); }
  async function save() {
    if (!name.trim() || objectives.length===0) return;
    const ok = await onSave(op, {id: editTarget || 'custom_'+Date.now(), name: name.trim(), objectives: objectives});
    if (ok === false) { alert('Custom Protocol limit reached ('+cap+' max). Delete one first.'); return; }
    setBuilding(false);
  }

  return (
    <div>
      <div className="panel">
        <div className="bracket-label">My Protocols — Custom Sessions ({custom.length}/{cap})</div>
        <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:16}}>Build your own session templates using any exercise in the library. Log against them the same way as built-in Protocol sessions.</div>
        {custom.length === 0 && <div className="empty"><div className="empty-title">No custom Protocols yet.</div></div>}
        {custom.map(p => (
          <div key={p.id} className="protocol-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><strong>{p.name}</strong> <span className="dim" style={{fontSize:11}}>— {p.objectives.length} exercise(s)</span></div>
              <span style={{display:'flex',gap:6}}>
                <button className="ghost small" onClick={()=>startEdit(p)}>Edit</button>
                <button className="ghost small" onClick={()=>onDelete(op, p.id)}>Delete</button>
              </span>
            </div>
          </div>
        ))}
        {custom.length < cap && !building && <button className="primary" onClick={startNew} style={{marginTop:8}}>+ New Custom Protocol</button>}
        {custom.length >= cap && !building && <div className="info-note">Limit reached — delete an existing custom Protocol to add a new one.</div>}
      </div>

      {building && (
        <div className="panel">
          <div className="bracket-label">{editTarget ? 'Edit' : 'Build'} Custom Protocol</div>
          <div className="field"><label>Protocol Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My Saturday Circuit" /></div>
          <div className="field">
            <label>Add Exercise</label>
            <div style={{display:'flex',gap:8}}>
              <select style={{flex:1}} value={exName} onChange={e=>setExName(e.target.value)}>{exercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}{ex.secondaryMuscleGroups && ex.secondaryMuscleGroups.length ? ' ('+ex.muscleGroup+' +'+ex.secondaryMuscleGroups.join('/')+')' : ''}</option>)}</select>
              <button className="ghost" onClick={addObjective}>Add</button>
            </div>
          </div>
          {objectives.map((o,i) => (
            <div key={i} className="exercise-pending">
              <div>{o.name} — {o.sets}×{o.repLow}-{o.repHigh} {o.unit}</div>
              <button className="small ghost" onClick={()=>removeObjective(i)}>Remove</button>
            </div>
          ))}
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button className="primary" onClick={save}>Save Protocol</button>
            <button className="ghost" onClick={()=>setBuilding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function personalBest(operatorId, logs, exerciseName) {
  const prior = logs.filter(l => l.type==='protocol' && l.operatorId===operatorId && l.exercise===exerciseName);
  if (prior.length === 0) return null;
  return Math.max.apply(null, prior.map(l=>l.totalValue));
}

