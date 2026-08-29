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
  const [challengePool, setChallengePool] = useState([]);
  const [challengeCompletions, setChallengeCompletions] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [duels, setDuels] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dismissals, setDismissals] = useState([]);
  const [cheers, setCheers] = useState([]);
  const [squadHabitChallenges, setSquadHabitChallenges] = useState([]);
  const [squadHabitOptIns, setSquadHabitOptIns] = useState([]);
  const [squadHabitCheckins, setSquadHabitCheckins] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [quadrants, setQuadrants] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [systems, setSystems] = useState([]);
  const [planets, setPlanets] = useState([]);
  const [moons, setMoons] = useState([]);
  const [asteroidBelts, setAsteroidBelts] = useState([]);
  const [deepVoidFeatures, setDeepVoidFeatures] = useState([]);
  const [tcsCards, setTcsCards] = useState([]);
  const [tcsCollections, setTcsCollections] = useState([]);
  const [tcsDecks, setTcsDecks] = useState([]);
  const [tcsMatches, setTcsMatches] = useState([]);
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
    const { ops, camps, lgs, ch, cx, squads, exercises, protocolSessions, quips, awards, personalRecords, raidTemplates, raidInstances, campaignPOIs, challengePool, challengeCompletions, seasons, duels, announcements, dismissals, cheers, squadHabitChallenges, squadHabitOptIns, squadHabitCheckins, joinRequests, quadrants, sectors, systems, planets, moons, asteroidBelts, deepVoidFeatures, tcsCards, tcsCollections, tcsDecks, tcsMatches } = await fetchAllData();
    setOperators(ops); setCampaigns(camps); setLogs(lgs); setChat(ch); setCodexEntries(cx); setSquads(squads);
    setExercises(exercises); setProtocolSessions(protocolSessions); setQuips(quips);
    setAwards(awards); setPersonalRecords(personalRecords);
    setRaidTemplates(raidTemplates); setRaidInstances(raidInstances);
    setCampaignPOIs(campaignPOIs);
    setChallengePool(challengePool); setChallengeCompletions(challengeCompletions);
    setSeasons(seasons);
    setDuels(duels);
    setAnnouncements(announcements); setDismissals(dismissals);
    setCheers(cheers);
    setJoinRequests(joinRequests);
    setSquadHabitChallenges(squadHabitChallenges); setSquadHabitOptIns(squadHabitOptIns); setSquadHabitCheckins(squadHabitCheckins);
    setQuadrants(quadrants); setSectors(sectors); setSystems(systems); setPlanets(planets);
    setMoons(moons); setAsteroidBelts(asteroidBelts); setDeepVoidFeatures(deepVoidFeatures);
    setTcsCards(tcsCards); setTcsCollections(tcsCollections); setTcsDecks(tcsDecks); setTcsMatches(tcsMatches);
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
    const { error } = await sb.from('logs').insert(entries.map(logToRow));
    await refetchAll();
    return { error: error ? error.message : null };
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
          join_window_days: nc.joinWindowDays, duration_days: nc.durationDays, planet_id: nc.planetId || null,
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
    if (msg.channel === 'main' && !msg.isCommand && /@val\b/i.test(msg.text)) {
      const question = msg.text.replace(/@val\b/i, '').trim();
      const answer = matchValFAQ(question || msg.text);
      await sb.rpc('post_command_message', { msg: answer });
    }
  }
  async function deleteChatMessage(messageId) {
    // The realtime subscription only listens for INSERT, not DELETE, so a
    // deleted message won't vanish live for other connected users the way
    // a new message appears — it'll clear on their next natural refetch.
    // Deliberately not touching that subscription to make deletes instant
    // everywhere; low risk, matches how every other non-realtime-covered
    // data type in this app already behaves.
    await sb.from('chat_messages').delete().eq('id', messageId);
    await refetchAll();
  }
  async function updateCodex(newEntries) {
    const old = codexEntries;
    const removed = old.filter(e => !newEntries.some(n=>n.id===e.id));
    for (const r of removed) await sb.from('codex_entries').delete().eq('id', r.id);
    for (const e of newEntries) {
      const oldE = old.find(x=>x.id===e.id);
      if (!oldE) await sb.from('codex_entries').insert({ category: e.category, title: e.title, body: e.body, icon_ref: e.iconRef||null, banner_ref: e.bannerRef||null });
      else if (oldE.title!==e.title || oldE.body!==e.body || oldE.iconRef!==e.iconRef || oldE.category!==e.category || oldE.bannerRef!==e.bannerRef) await sb.from('codex_entries').update({title:e.title, body:e.body, icon_ref: e.iconRef||null, category:e.category, banner_ref: e.bannerRef||null}).eq('id', e.id);
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
  async function checkChallengeCompletion(op, pool, completions, logsSnapshot, existingAwards) {
    const today = todayStr();
    if (completions.some(c => c.operatorId===op.id && c.date===today)) return; // already completed today
    const challenge = dailyChallenge(pool, hashStr(today));
    if (!challenge) return;
    const progress = computeChallengeProgress(op.id, challenge, logsSnapshot);
    if (progress.pct < 100) return;
    await sb.from('daily_challenge_completions').insert({ operator_id: op.id, date: today, pool_id: challenge.id });
    const totalCompletions = completions.filter(c=>c.operatorId===op.id).length + 1;
    const milestones = [5, 10, 25, 50, 100];
    if (milestones.includes(totalCompletions)) {
      const type = 'challenges_'+totalCompletions;
      if (!existingAwards.some(a=>a.operatorId===op.id && a.awardType===type)) {
        await sb.from('awards').insert({ operator_id: op.id, award_type: type, title: totalCompletions+' Daily Challenges', description: 'Completed '+totalCompletions+' Daily Challenges. Consistency, logged.' });
      }
    }
  }
  const SEASON_REWARD_CREDITS = 200;
  function seasonTopN(count) { return Math.max(1, Math.ceil(count * 0.1)); }
  async function grantSeasonRewards(season, ops, sqds, camps, lgs, rTemplates, rInstances) {
    const grants = []; // {operatorId, amount} — one entry per leaderboard a person/squad qualifies for; these are meant to stack, not dedupe across leaderboard types
    function creditSquad(squad) { squad.members.forEach(m => grants.push({operatorId: m.operatorId, amount: SEASON_REWARD_CREDITS})); }

    // Squad MCP
    const mcpRanked = sqds.map(s => ({ squad: s, stats: squadStats(s, ops, camps, lgs, season) })).sort((a,b)=>b.stats.totalMCP-a.stats.totalMCP);
    mcpRanked.slice(0, seasonTopN(mcpRanked.length)).forEach(w => creditSquad(w.squad));

    // Campaign Contribution
    const campRanked = sqds.map(s => ({ squad: s, stats: squadStats(s, ops, camps, lgs, season) })).sort((a,b)=>b.stats.campaignContribution-a.stats.campaignContribution);
    campRanked.slice(0, seasonTopN(campRanked.length)).forEach(w => creditSquad(w.squad));

    // Raid Fastest-Clears — per template, deduped across templates so a
    // squad topping several boards still only earns this category once
    const raidQualifyingSquadIds = new Set();
    (rTemplates||[]).forEach(t => {
      let completions = (rInstances||[]).filter(r => r.raidTemplateId === t.id && r.status === 'completed' && r.completedAt);
      completions = completions.filter(r => { const d = r.completedAt.slice(0,10); return d >= season.startDate && d <= season.endDate; });
      const bestPerSquad = {};
      completions.forEach(r => {
        const ms = new Date(r.completedAt) - new Date(r.startedAt);
        if (!bestPerSquad[r.squadId] || ms < bestPerSquad[r.squadId].ms) bestPerSquad[r.squadId] = { ms, squadId: r.squadId };
      });
      const ranked = Object.values(bestPerSquad).sort((a,b)=>a.ms-b.ms);
      ranked.slice(0, seasonTopN(ranked.length)).forEach(w => raidQualifyingSquadIds.add(w.squadId));
    });
    raidQualifyingSquadIds.forEach(squadId => { const sq = sqds.find(s=>s.id===squadId); if (sq) creditSquad(sq); });

    // Individual MCP
    const indivMCP = computeIndividualMCPRankings(ops, camps, lgs, season);
    indivMCP.slice(0, seasonTopN(indivMCP.length)).forEach(w => grants.push({operatorId: w.operator.id, amount: SEASON_REWARD_CREDITS}));

    // Individual ORS (current standing, not season-filtered — matches
    // avgORS in squadStats, which also reads current ORS rather than
    // trying to date-window a rolling metric)
    const indivORS = computeIndividualORSRankings(ops, lgs);
    indivORS.slice(0, seasonTopN(indivORS.length)).forEach(w => grants.push({operatorId: w.operator.id, amount: SEASON_REWARD_CREDITS}));

    const totalsByOperator = {};
    grants.forEach(g => { totalsByOperator[g.operatorId] = (totalsByOperator[g.operatorId]||0) + g.amount; });
    for (const operatorId of Object.keys(totalsByOperator)) {
      const target = ops.find(o=>o.id===operatorId);
      if (!target) continue;
      await sb.from('profiles').update({ requisition_credits: (target.requisitionCredits||0) + totalsByOperator[operatorId] }).eq('id', operatorId);
    }
  }
  async function checkSeasonRewards(seasonsSnapshot, ops, sqds, camps, lgs, rTemplates, rInstances) {
    const today = todayStr();
    const endedSeasons = (seasonsSnapshot||[]).filter(s => s.endDate < today);
    let paidAny = false;
    for (const season of endedSeasons) {
      // Same atomic-claim pattern as checkWeeklyDigest — the insert IS the
      // claim, guaranteed exactly-once by the unique constraint on season_id.
      const { error } = await sb.from('season_reward_payouts').insert({ season_id: season.id });
      if (error) continue;
      await grantSeasonRewards(season, ops, sqds, camps, lgs, rTemplates, rInstances);
      paidAny = true;
    }
    if (paidAny) await refetchAll();
  }
  async function checkWeeklyDigest(ops, camps, awardsSnapshot, personalRecordsSnapshot, raidInstancesSnapshot, raidTemplatesSnapshot) {
    const weekStart = weekStartDate();
    // The insert itself is the atomic "claim this week" — the unique constraint
    // on week_start means only one client (whichever gets here first) succeeds,
    // so this is duplicate-proof even with multiple people's apps open at once.
    const { error } = await sb.from('weekly_digests').insert({ week_start: weekStart });
    if (error) return; // someone already posted this week's digest
    const digestText = composeWeeklyDigest(ops, camps, awardsSnapshot, personalRecordsSnapshot, raidInstancesSnapshot, raidTemplatesSnapshot);
    await sb.rpc('post_command_message', { msg: digestText });
    await refetchAll();
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
  async function saveChallenge(challenge) {
    await sb.from('daily_challenge_pool').insert({ name: challenge.name, muscle_group: challenge.muscleGroup, unit: challenge.unit, target: challenge.target });
    await refetchAll();
  }
  async function deleteChallenge(challengeId) {
    await sb.from('daily_challenge_pool').delete().eq('id', challengeId);
    await refetchAll();
  }
  async function saveSeason(season) {
    await sb.from('seasons').insert({ name: season.name, start_date: season.startDate, end_date: season.endDate });
    await refetchAll();
  }
  async function deleteSeason(seasonId) {
    await sb.from('seasons').delete().eq('id', seasonId);
    await refetchAll();
  }
  async function createDuel(challengerSquadId, opponentSquadId, muscleGroup, target, unit, durationDays) {
    await sb.from('duels').insert({ challenger_squad_id: challengerSquadId, opponent_squad_id: opponentSquadId, muscle_group: muscleGroup, target: target, unit: unit, duration_days: durationDays });
    await refetchAll();
  }
  async function acceptDuel(duel) {
    const start = todayStr();
    const end = new Date(); end.setDate(end.getDate() + duel.durationDays);
    await sb.from('duels').update({ status:'active', start_date: start, end_date: todayStr(end) }).eq('id', duel.id);
    await refetchAll();
  }
  async function declineDuel(duelId) {
    await sb.from('duels').update({ status:'declined' }).eq('id', duelId);
    await refetchAll();
  }
  async function dismissAnnouncement(operatorId, announcementId) {
    await sb.from('announcement_dismissals').insert({ operator_id: operatorId, announcement_id: announcementId });
    await refetchAll();
  }
  async function cheerMessage(operatorId, messageId) {
    if (cheers.some(c => c.operatorId===operatorId && c.messageId===messageId)) return; // already cheered
    const { error } = await sb.from('message_cheers').insert({ operator_id: operatorId, message_id: messageId });
    if (error) { await refetchAll(); return; } // someone else's insert may have raced ahead; just resync
    const totalGiven = cheers.filter(c=>c.operatorId===operatorId).length + 1;
    const milestones = [10, 25, 50, 100];
    if (milestones.includes(totalGiven)) {
      const type = 'cheers_given_'+totalGiven;
      if (!awards.some(a=>a.operatorId===operatorId && a.awardType===type)) {
        await sb.from('awards').insert({ operator_id: operatorId, award_type: type, title: totalGiven+' Squadmates Cheered', description: 'Showed up for '+totalGiven+' squadmates\u2019 wins. That counts as much as your own.' });
      }
    }
    await refetchAll();
  }
  async function createSquadHabitChallenge(squadId, name, description, durationDays, createdBy) {
    const start = todayStr();
    const end = new Date(); end.setDate(end.getDate() + Number(durationDays) - 1);
    await sb.from('squad_habit_challenges').insert({ squad_id: squadId, name: name, description: description||null, start_date: start, end_date: todayStr(end), created_by: createdBy });
    await refetchAll();
  }
  async function joinSquadHabitChallenge(challengeId, operatorId) {
    if (squadHabitOptIns.some(o=>o.challengeId===challengeId && o.operatorId===operatorId)) return;
    await sb.from('squad_habit_opt_ins').insert({ challenge_id: challengeId, operator_id: operatorId });
    await refetchAll();
  }
  async function checkinSquadHabitChallenge(challengeId, operatorId) {
    if (squadHabitCheckins.some(c=>c.challengeId===challengeId && c.operatorId===operatorId && c.date===todayStr())) return;
    await sb.from('squad_habit_checkins').insert({ challenge_id: challengeId, operator_id: operatorId, date: todayStr() });
    await refetchAll();
  }
  // Three simple one-time "first steps" milestones. Each checks a state that's
  // already tracked elsewhere (no new columns needed) and grants once, ever.
  async function checkMilestoneAwards(op, logsSnapshot, existingAwards) {
    const grants = [];
    const loggedFirst = logsSnapshot.some(l=>l.operatorId===op.id);
    const loggedCampaign = logsSnapshot.some(l=>l.operatorId===op.id && l.type==='campaign');
    if (loggedCampaign && !existingAwards.some(a=>a.operatorId===op.id && a.awardType==='first_campaign')) {
      grants.push({ operator_id: op.id, award_type: 'first_campaign', title: 'First Deployment', description: 'Your first logged Campaign contribution. Command has your file open now.' });
    }
    if (op.squadId && !existingAwards.some(a=>a.operatorId===op.id && a.awardType==='first_squad')) {
      grants.push({ operator_id: op.id, award_type: 'first_squad', title: 'Squad Up', description: 'Joined your first Squad. You don\u2019t have to do this alone.' });
    }
    if (op.specialization && !existingAwards.some(a=>a.operatorId===op.id && a.awardType==='first_specialization')) {
      grants.push({ operator_id: op.id, award_type: 'first_specialization', title: 'Chosen Path', description: 'Selected a Specialization: '+op.specialization+'.' });
    }
    const orientationDone = loggedFirst && (op.habits||[]).length>0 && loggedCampaign && !!op.squadId && !!op.specialization;
    if (orientationDone && !existingAwards.some(a=>a.operatorId===op.id && a.awardType==='orientation_complete')) {
      grants.push({ operator_id: op.id, award_type: 'orientation_complete', title: 'Orientation Complete', description: 'Completed every step of the Orientation Checklist. You know how this works now.' });
    }
    if (grants.length) await sb.from('awards').insert(grants);
  }
  async function checkVeteranAwards(op, existingAwards) {
    const families = [
      { prefix: 'campaign_', veteranPrefix: 'campaign_veteran_', label: 'Campaigns Won', tiers: [3,5,10] },
      { prefix: 'raid_', veteranPrefix: 'raid_veteran_', label: 'Raids Cleared', tiers: [3,5,10] },
      { prefix: 'duel_', veteranPrefix: 'duel_veteran_', label: 'Duels Won', tiers: [3,5,10] },
    ];
    for (const fam of families) {
      const count = existingAwards.filter(a=>a.operatorId===op.id && a.awardType.startsWith(fam.prefix) && !a.awardType.startsWith(fam.veteranPrefix)).length;
      for (const tier of fam.tiers) {
        if (count < tier) continue;
        const type = fam.veteranPrefix+tier;
        if (!existingAwards.some(a=>a.operatorId===op.id && a.awardType===type)) {
          await sb.from('awards').insert({ operator_id: op.id, award_type: type, title: tier+' '+fam.label, description: 'Reached '+tier+' '+fam.label.toLowerCase()+'. Command has stopped being surprised.' });
        }
      }
    }
  }
  async function checkComebackAward(op, currentStatusLabel, existingAwards) {
    const badStatuses = ['Reserve','Deep Reserve'];
    if (op.lastSeenStatus && badStatuses.includes(op.lastSeenStatus) && currentStatusLabel === 'Active') {
      const existingComebacks = existingAwards.filter(a=>a.operatorId===op.id && a.awardType.startsWith('comeback_')).length;
      const type = 'comeback_'+(existingComebacks+1);
      await sb.from('awards').insert({ operator_id: op.id, award_type: type, title: 'The Comeback', description: 'Returned to Active status after '+op.lastSeenStatus+'. That takes more discipline than never falling behind at all.' });
    }
    if (op.lastSeenStatus !== currentStatusLabel) {
      await sb.from('profiles').update({ last_seen_status: currentStatusLabel }).eq('id', op.id);
    }
  }
  async function checkTookCommand(op, existingAwards) {
    if ((op.squadRole === 'leader' || op.squadRole === 'officer') && !existingAwards.some(a=>a.operatorId===op.id && a.awardType==='took_command')) {
      await sb.from('awards').insert({ operator_id: op.id, award_type: 'took_command', title: 'Took Command', description: 'Stepped into Squad leadership for the first time.' });
    }
  }
  async function checkRetestedBaseline(op, existingAwards) {
    if (op.previousBaseline && !existingAwards.some(a=>a.operatorId===op.id && a.awardType==='retested_baseline')) {
      await sb.from('awards').insert({ operator_id: op.id, award_type: 'retested_baseline', title: 'Progress, Verified', description: 'Retested your Baseline Assessment \u2014 tracking real change over time, not just guessing at it.' });
    }
  }
  async function checkAgeDivision(op) {
    if (!op.birthdate) return;
    const correctDivision = computeAgeDivision(computeAge(op.birthdate));
    if (correctDivision && correctDivision !== op.ageDivision) {
      await sb.from('profiles').update({ age_division: correctDivision }).eq('id', op.id);
    }
  }
  const CREDITS_PER_AWARD = 10;
  async function checkRequisitionCredits(op, allAwards) {
    // Counts total awards rather than hooking every individual award-
    // granting call site — robust against awards inserted via server-side
    // DB triggers (Campaign/Raid/Duel wins) that this client JS never
    // directly touches, not just the ones granted from app-core itself.
    const currentCount = allAwards.filter(a=>a.operatorId===op.id).length;
    const baseline = op.creditsAwardsBaseline || 0;
    if (currentCount > baseline) {
      const earned = (currentCount - baseline) * CREDITS_PER_AWARD;
      await sb.from('profiles').update({
        requisition_credits: (op.requisitionCredits||0) + earned,
        credits_awards_baseline: currentCount,
      }).eq('id', op.id);
    }
  }
  async function grantRequisitionCreditsAdmin(operatorId, amount) {
    const target = operators.find(o=>o.id===operatorId);
    if (!target || !amount) return { success:false, message:'Missing operator or amount.' };
    const { data, error } = await sb.from('profiles').update({ requisition_credits: (target.requisitionCredits||0) + Number(amount) }).eq('id', operatorId).select();
    if (error) return { success:false, message: error.message };
    if (!data || data.length === 0) return { success:false, message:'Update ran but affected zero rows \u2014 likely blocked by a Row Level Security policy on profiles, not a genuine error.' };
    await refetchAll();
    return { success:true, newBalance: data[0].requisition_credits };
  }
  async function generateRedemptionCode(credits) {
    // Excludes visually ambiguous characters (0/O, 1/I) since these get
    // typed by hand off a screenshot or a DM, not pasted.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i=0;i<8;i++) suffix += chars[Math.floor(Math.random()*chars.length)];
    const code = 'VANG-'+suffix;
    const { error } = await sb.from('redemption_codes').insert({ code: code, credits: Number(credits), created_by: op.id });
    if (error) return { code: null, error: error.message };
    return { code: code, error: null };
  }
  async function purchaseCardPack() {
    const { data, error } = await sb.rpc('purchase_card_pack');
    if (error) return { success: false, message: error.message };
    if (data && data.success) await refetchAll();
    return data;
  }
  async function saveTcsDeck(deckId, name, heroCardId, otherCardIds) {
    let realDeckId = deckId;
    if (!deckId) {
      const { data, error } = await sb.from('tcs_decks').insert({ operator_id: op.id, name: name, hero_card_id: heroCardId }).select().single();
      if (error) return { success: false, message: error.message };
      realDeckId = data.id;
    } else {
      const { error } = await sb.from('tcs_decks').update({ name: name, hero_card_id: heroCardId, updated_at: new Date().toISOString() }).eq('id', deckId);
      if (error) return { success: false, message: error.message };
      await sb.from('tcs_deck_cards').delete().eq('deck_id', deckId);
    }
    if (otherCardIds.length) {
      await sb.from('tcs_deck_cards').insert(otherCardIds.map(cardId => ({ deck_id: realDeckId, card_id: cardId })));
    }
    await refetchAll();
    return { success: true };
  }
  async function deleteTcsDeck(deckId) {
    await sb.from('tcs_decks').delete().eq('id', deckId);
    await refetchAll();
  }
  async function startTcsMatch(deckId, faction) {
    const deck = tcsDecks.find(d=>d.id===deckId);
    if (!deck) return { success:false, message:'Deck not found.' };
    if (!deck.heroCardId || deck.cardIds.length !== 9) return { success:false, message:'That deck isn\'t legal yet — needs a Hero and 9 other cards.' };
    const aiRoster = tcsCards.filter(c=>c.isPveOnly && c.category===faction);
    if (aiRoster.length === 0) return { success:false, message:'No cards found for that faction.' };
    const boardState = tcsInitMatch(deck, tcsCards, aiRoster);
    const { data, error } = await sb.from('tcs_matches').insert({ operator_id: op.id, deck_id: deckId, opponent_faction: faction, board_state: boardState }).select().single();
    if (error) return { success:false, message: error.message };
    await refetchAll();
    return { success:true, matchId: data.id };
  }
  async function tcsPerformMove(match, instanceId, targetCol, targetRow) {
    const result = tcsMoveUnit(match.boardState, tcsCards, instanceId, targetCol, targetRow);
    if (!result.success) return result;
    await sb.from('tcs_matches').update({ board_state: result.state, updated_at: new Date().toISOString() }).eq('id', match.id);
    await refetchAll();
    return result;
  }
  async function tcsPerformPlayCard(match, cardId, targetCol, targetRow) {
    const result = tcsPlayCard(match.boardState, tcsCards, cardId, targetCol, targetRow);
    if (!result.success) return result;
    await sb.from('tcs_matches').update({ board_state: result.state, updated_at: new Date().toISOString() }).eq('id', match.id);
    await refetchAll();
    return result;
  }
  async function tcsPerformAttack(match, attackerId, targetId) {
    const result = tcsAttack(match.boardState, tcsCards, attackerId, targetId);
    if (!result.success) return result;
    const winResult = tcsCheckWinCondition(result.state);
    const patch = { board_state: result.state, updated_at: new Date().toISOString() };
    if (winResult) patch.status = winResult;
    await sb.from('tcs_matches').update(patch).eq('id', match.id);
    await refetchAll();
    return Object.assign({}, result, { winResult: winResult });
  }
  async function tcsPerformEndTurn(match) {
    const { state, result } = tcsEndPlayerTurn(match.boardState, tcsCards);
    const patch = { board_state: state, turn_number: state.turnNumber, updated_at: new Date().toISOString() };
    if (result) patch.status = result;
    await sb.from('tcs_matches').update(patch).eq('id', match.id);
    await refetchAll();
    return { state: state, result: result };
  }
  async function redeemCode(codeText) {
    const { data, error } = await sb.rpc('redeem_code', { p_code: (codeText||'').trim() });
    if (error) return { success: false, message: error.message };
    if (data && data.success) await refetchAll();
    return data;
  }
  async function purchaseCosmetic(itemKey) {
    const { data, error } = await sb.rpc('purchase_cosmetic', { p_item_key: itemKey });
    if (error) return { success: false, message: error.message };
    if (data && data.success) await refetchAll();
    return data;
  }
  async function setBirthdateOnce(operatorId, birthdate) {
    // Set-once from the non-admin path — only writes if nothing is on file
    // yet. Once set, only the Admin Panel's roster editor can change it.
    const current = operators.find(o=>o.id===operatorId);
    if (current && current.birthdate) return;
    const division = computeAgeDivision(computeAge(birthdate));
    await sb.from('profiles').update({ birthdate: birthdate, age_division: division || 'Corps' }).eq('id', operatorId);
    await refetchAll();
  }
  async function updateBirthdateAdmin(operatorId, birthdate) {
    // Admin can always set/override, for any operator — recomputes division
    // immediately rather than waiting for that operator's own next login to
    // self-correct via checkAgeDivision.
    const division = birthdate ? computeAgeDivision(computeAge(birthdate)) : null;
    await sb.from('profiles').update({ birthdate: birthdate || null, age_division: division || 'Corps' }).eq('id', operatorId);
    await refetchAll();
  }
  async function checkRestDayMilestones(op, logsSnapshot, existingAwards) {
    const count = logsSnapshot.filter(l=>l.operatorId===op.id && l.type==='rest').length;
    const tiers = [5,10,25,50];
    for (const tier of tiers) {
      if (count < tier) continue;
      const type = 'rest_days_'+tier;
      if (!existingAwards.some(a=>a.operatorId===op.id && a.awardType===type)) {
        await sb.from('awards').insert({ operator_id: op.id, award_type: type, title: tier+' Rest Days Logged', description: 'Recovery is part of the mission. '+tier+' Rest Days logged \u2014 not skipped, not ignored. Logged.' });
      }
    }
  }
  async function grantManualAward(operatorId, title, description, awardType) {
    await sb.from('awards').insert({ operator_id: operatorId, award_type: awardType || ('manual_'+Date.now()), title: title, description: description||null });
    await refetchAll();
  }
  async function saveAnnouncement(announcement) {
    const exists = announcements.some(a=>a.id===announcement.id);
    if (exists) await sb.from('announcements').update({ title: announcement.title, body: announcement.body, active: announcement.active }).eq('id', announcement.id);
    else await sb.from('announcements').insert({ title: announcement.title, body: announcement.body, active: true });
    await refetchAll();
  }
  async function deleteAnnouncement(announcementId) {
    await sb.from('announcements').delete().eq('id', announcementId);
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
  async function addHabit(op, name, category) { await sb.from('habits').insert({operator_id: op.id, name: name, active: true, created_date: todayStr(), category: category||'Other'}); await refetchAll(); }
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
  async function requestJoinSquad(op, squad) {
    if (op.squadId) return false;
    if (squad.members.length >= 10) return false;
    if (joinRequests.some(r => r.squadId===squad.id && r.operatorId===op.id && r.status==='pending')) return false;
    await sb.from('squad_join_requests').insert({ squad_id: squad.id, operator_id: op.id });
    await refetchAll();
    return true;
  }
  async function approveJoinRequest(request) {
    const squad = squads.find(s=>s.id===request.squadId);
    const requester = operators.find(o=>o.id===request.operatorId);
    // Guard against a squad filling up or the requester joining elsewhere
    // between when they asked and when leadership got to it.
    if (!squad || squad.members.length >= 10 || (requester && requester.squadId)) {
      await sb.from('squad_join_requests').update({ status:'denied', decided_at: new Date().toISOString() }).eq('id', request.id);
      await refetchAll();
      return;
    }
    await sb.from('squad_join_requests').update({ status:'approved', decided_at: new Date().toISOString() }).eq('id', request.id);
    await sb.from('squad_members').insert({ squad_id: request.squadId, operator_id: request.operatorId, role: 'member' });
    await refetchAll();
  }
  async function denyJoinRequest(requestId) {
    await sb.from('squad_join_requests').update({ status:'denied', decided_at: new Date().toISOString() }).eq('id', requestId);
    await refetchAll();
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
  const todayLogCountTop = (loaded && opOnboarded && op) ? logs.filter(l=>l.operatorId===op.id && l.date===todayStr()).length : 0;
  useEffect(() => {
    if (!loaded || !opOnboarded || !op) return;
    checkStreakAward(op, logs, awards);
    checkServiceStripAward(op, logs, campaigns, awards);
    checkChallengeCompletion(op, challengePool, challengeCompletions, logs, awards);
    checkMilestoneAwards(op, logs, awards);
    checkVeteranAwards(op, awards);
    checkComebackAward(op, statusTop ? statusTop.label : null, awards);
    checkTookCommand(op, awards);
    checkRetestedBaseline(op, awards);
    checkRestDayMilestones(op, logs, awards);
    checkAgeDivision(op);
    checkRequisitionCredits(op, awards);
  }, [streakTop, todayLogCountTop, loaded, opOnboarded, op && op.squadId, op && op.specialization, op && op.squadRole, op && op.previousBaseline, statusTop && statusTop.label, op && op.birthdate, awards.length]);

  useEffect(() => {
    if (!loaded || !opOnboarded || !op) return;
    checkWeeklyDigest(operators, campaigns, awards, personalRecords, raidInstances, raidTemplates);
    checkSeasonRewards(seasons, operators, squads, campaigns, logs, raidTemplates, raidInstances);
  }, [loaded, opOnboarded]);

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
  const pendingAnnouncement = announcements.find(a => a.active && !dismissals.some(d => d.operatorId===op.id && d.announcementId===a.id));

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
          {NAV_STRUCTURE.filter(n => !n.adminOnly || op.isAdmin || (n.modOk && op.isModerator)).map(n => {
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
          <a href="https://ko-fi.com/leidolflokison" target="_blank" rel="noopener noreferrer" className="nav-item" style={{marginTop:20,borderTop:'1px solid var(--border)',opacity:0.75,fontSize:11,textDecoration:'none',display:'block'}}>
            {'\u2764'} Support the Initiative
          </a>
        </div>
        <div className="main">
          {tab==='command' && <CommandCenter operators={operators} campaigns={campaigns} logs={logs} activeOp={op} deployedCampaign={deployedCampaignTop} onGoCampaigns={()=>setTab('campaigns')} streak={streak} quips={quips} campaignPOIs={campaignPOIs} challengePool={challengePool} challengeCompletions={challengeCompletions} />}
          {tab==='campaigns' && <Campaigns campaigns={campaigns} activeOp={op} logs={logs} onDeploy={deployToCampaign} onUndeploy={undeploy} onClaimReinforcement={claimReinforcement} campaignPOIs={campaignPOIs} />}
          {tab==='galaxy' && <GalaxyMap entries={codexEntries} campaigns={campaigns} logs={logs} onGoCampaigns={()=>setTab('campaigns')} quadrants={quadrants} sectors={sectors} systems={systems} planets={planets} moons={moons} asteroidBelts={asteroidBelts} deepVoidFeatures={deepVoidFeatures} />}
          {tab==='log' && <LogActivity deployedCampaign={deployedCampaignTop} activeOp={op} logs={logs} addLogs={addLogs} campaigns={campaigns} exercises={exercises} protocolSessions={protocolSessions} onRecordPR={recordPersonalRecord} raidTemplates={raidTemplates} raidInstances={raidInstances} />}
          {tab==='myprotocols' && <MyProtocols op={op} onSave={saveCustomProtocol} onDelete={deleteCustomProtocol} exercises={exercises} />}
          {tab==='habits' && <Habits op={op} logs={logs} onAddHabit={addHabit} onToggleArchive={toggleHabitArchive} onCheckin={logHabitCheckin} />}
          {tab==='squad' && <SquadTab activeOp={op} operators={operators} squads={squads} logs={logs} campaigns={campaigns}
            onCreate={createSquad} onRequestJoin={requestJoinSquad} onLeave={leaveSquad} onPromote={promoteOfficer} onDemote={demoteOfficer}
            onRemoveMember={removeMember} onRename={renameSquad} onDisband={disbandSquad}
            raidTemplates={raidTemplates} raidInstances={raidInstances} onLaunchRaid={launchRaid} seasons={seasons}
            duels={duels} onCreateDuel={createDuel} onAcceptDuel={acceptDuel} onDeclineDuel={declineDuel}
            squadHabitChallenges={squadHabitChallenges} squadHabitOptIns={squadHabitOptIns} squadHabitCheckins={squadHabitCheckins}
            onCreateSquadHabitChallenge={createSquadHabitChallenge} onJoinSquadHabitChallenge={joinSquadHabitChallenge} onCheckinSquadHabitChallenge={checkinSquadHabitChallenge}
            joinRequests={joinRequests} onApproveJoinRequest={approveJoinRequest} onDenyJoinRequest={denyJoinRequest} />}
          {tab==='dossier' && <Dossier op={dossierOp} activeOpId={op.id} operators={operators} campaigns={campaigns} logs={logs} squads={squads} awards={awards} personalRecords={personalRecords} onUpdateOperator={updateOperator} onUploadAvatar={uploadAvatar} onSetBirthdate={setBirthdateOnce} onRedeemCode={redeemCode} onPurchaseCosmetic={purchaseCosmetic} />}
          {tab==='roster' && <Roster operators={operators} campaigns={campaigns} logs={logs} onView={(id)=>{setViewDossierId(id); setTab('dossier');}} />}
          {tab==='codex' && <Codex entries={codexEntries} isAdmin={op.isAdmin} onUpdate={updateCodex} />}
          {tab==='tcs' && <TacticalCommandSim activeOp={op} tcsCards={tcsCards} tcsCollections={tcsCollections} tcsDecks={tcsDecks} tcsMatches={tcsMatches} onPurchasePack={purchaseCardPack} onSaveDeck={saveTcsDeck} onDeleteDeck={deleteTcsDeck} onStartMatch={startTcsMatch} onMove={tcsPerformMove} onAttack={tcsPerformAttack} onPlayCard={tcsPerformPlayCard} onEndTurn={tcsPerformEndTurn} />}
          {tab==='comms' && <Comms chat={chat} operators={operators} squads={squads} activeOp={op} onSend={sendChat} cheers={cheers} onCheer={cheerMessage} />}
          {tab==='aar' && <AARLog operators={operators} campaigns={campaigns} logs={logs} />}
          {tab==='admin' && (op.isAdmin || op.isModerator) && <AdminPanel operators={operators} campaigns={campaigns} logs={logs} onUpdateOperators={updateOperators} onUpdateCampaigns={updateCampaigns}
            exercises={exercises} protocolSessions={protocolSessions} onSaveExercise={saveExercise} onDeleteExercise={deleteExercise}
            onSaveProtocolSession={saveProtocolSession} onDeleteProtocolSession={deleteProtocolSession}
            quips={quips} onSaveQuip={saveQuip} onDeleteQuip={deleteQuip}
            raidTemplates={raidTemplates} onSaveRaidTemplate={saveRaidTemplate} onDeleteRaidTemplate={deleteRaidTemplate}
            campaignPOIs={campaignPOIs} onSavePOI={savePOI} onDeletePOI={deletePOI}
            challengePool={challengePool} onSaveChallenge={saveChallenge} onDeleteChallenge={deleteChallenge}
            seasons={seasons} onSaveSeason={saveSeason} onDeleteSeason={deleteSeason}
            announcements={announcements} onSaveAnnouncement={saveAnnouncement} onDeleteAnnouncement={deleteAnnouncement}
            onGrantAward={grantManualAward} onUpdateBirthdateAdmin={updateBirthdateAdmin}
            quadrants={quadrants} sectors={sectors} systems={systems} planets={planets}
            viewerIsAdmin={op.isAdmin} viewerIsModerator={op.isModerator} chat={chat} onDeleteChatMessage={deleteChatMessage}
            onGrantCredits={grantRequisitionCreditsAdmin} onGenerateCode={generateRedemptionCode} />}
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

      {pendingAnnouncement && !rankUpModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e=>e.stopPropagation()} style={{borderColor:'var(--amber)'}}>
            <div className="dim mono" style={{fontSize:10,marginBottom:10,letterSpacing:'0.1em'}}>ANNOUNCEMENT</div>
            <div className="disp amber" style={{fontSize:20,marginBottom:14}}>{pendingAnnouncement.title}</div>
            <div style={{fontSize:13,lineHeight:1.7,marginBottom:20,whiteSpace:'pre-line'}}>{pendingAnnouncement.body}</div>
            <button className="primary" style={{width:'100%'}} onClick={()=>dismissAnnouncement(op.id, pendingAnnouncement.id)}>Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}

