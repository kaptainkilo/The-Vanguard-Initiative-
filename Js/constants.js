const { useState, useEffect, useMemo, useRef } = React;

const AVATAR_COLORS = ['#FFB238','#E4572E','#6FCF97','#7CA9E8','#C98AD1','#F2C94C'];
const AGE_DIVISIONS = ['Cadet','Corps','Veteran'];
// Player-selectable specializations. Command and Engineer are NOT in this list —
// they're conferred titles tied to Admin/Moderator status, not chosen tracks.
const HABIT_CATEGORIES = [
  {name:'Nutrition', color:'#8FCB6B', icon:'\ud83c\udf7d\ufe0f'},
  {name:'Sleep', color:'#7CA9E8', icon:'\ud83d\ude34'},
  {name:'Mindset', color:'#B57EDC', icon:'\ud83e\udde0'},
  {name:'Recovery', color:'#4ECDC4', icon:'\ud83e\uddd8'},
  {name:'Other', color:'#8A9080', icon:'\u2726'},
];
function habitCategoryStyle(name) { return HABIT_CATEGORIES.find(c=>c.name===name) || HABIT_CATEGORIES[HABIT_CATEGORIES.length-1]; }

const SPECIALIZATIONS = [
  {name:'Heavy Assault', desc:'Strength and physical capability. Strength, power, load capacity.'},
  {name:'Recon', desc:'Endurance and adaptability. Running, mobility, conditioning.'},
  {name:'Guardian', desc:'Resilience and support. Recovery, health, helping others.'},
  {name:'Demolitions Expert', desc:'"Orbital Bombardment." Explosive power and metabolic conditioning — plyometrics, power circuits, high-intensity finishers. Short, brutal sessions.'},
  {name:'Tactical Operator', desc:'"Precision Strike Protocol." Technique, core stability, unilateral strength, controlled tempo. Quality over quantity — one shot, one kill, no wasted movement.'},
];
// Command Staff / Jr Command Staff are conferred by role (Admin/Mod), not earned —
// they override the computed rank entirely. See computeRank.
// Operator rank is now purely ORS/Days Active/Campaigns computed again — Admin/Mod
// status no longer overrides it. Instead it drives a separate, parallel rank track below.
const RANK_ORDER = ['Recruit','Operator','Senior Operator','Specialist','Vanguard'];
// Every earnable rank has 3 tiers. Each tier's requirements scale up within the
// rank; Tier 1 of a rank matches what used to be that rank's single threshold.
const RANK_TIER_REQUIREMENTS = {
  'Recruit':          [ {ors:0,  daysActive:0,   campaigns:0}, {ors:20, daysActive:5,   campaigns:0}, {ors:35, daysActive:10,  campaigns:0} ],
  'Operator':         [ {ors:50, daysActive:14,  campaigns:0}, {ors:55, daysActive:21,  campaigns:0}, {ors:60, daysActive:30,  campaigns:1} ],
  'Senior Operator':  [ {ors:65, daysActive:45,  campaigns:1}, {ors:70, daysActive:60,  campaigns:1}, {ors:73, daysActive:75,  campaigns:2} ],
  'Specialist':       [ {ors:75, daysActive:90,  campaigns:2}, {ors:78, daysActive:110, campaigns:2}, {ors:82, daysActive:135, campaigns:3} ],
  'Vanguard':         [ {ors:90, daysActive:180, campaigns:3}, {ors:93, daysActive:220, campaigns:4}, {ors:96, daysActive:270, campaigns:5} ],
};
const EARNABLE_RANK_ORDER = ['Recruit','Operator','Senior Operator','Specialist','Vanguard'];

const RANK_UP_LINES = {
  'Operator': "Recruit no more. Command has reviewed your file — consistency, not perfection, and it shows. Welcome to full operational status, Operator.",
  'Senior Operator': "Multiple Campaigns behind you now. Command doesn't hand out 'Senior' lightly. You've earned the weight of that word.",
  'Specialist': "Command has flagged your file for advanced standing. Whatever track you choose next, you've already proven you finish what you start.",
  'Vanguard': "There's a reason this rank has a name and not just a number. You are what the Initiative was built to create. Command salutes you.",
};

// Parallel Command tracks — locked names, mirroring the depth AND progression
// of the Operator track exactly (same ORS/Days Active/Campaigns thresholds via
// computeRank/computeRankTier, just relabeled — see computeCommandRank).
const JR_COMMAND_RANKS = ['Lace','Sergeant','Spear Sergeant','War Sergeant','Warden'];
const COMMAND_RANKS = ['Lieutenant','First Lieutenant','Captain','Commander','Senior Commander'];

// COMMAND_QUIPS moved to the database (command_quips table) — admin-editable in the Admin Panel.
// EXERCISES and PROTOCOL_SESSIONS moved to the database (exercises / protocol_sessions tables) — fetched at load time, admin-editable in the Admin Panel.
const CAMPAIGN_BASE_RATES = {
  Chest: 125, Back: 90, Shoulders: 100, Biceps: 90, Triceps: 100,
  Quadriceps: 100, Hamstrings: 80, Glutes: 80, Calves: 120, Core: 100,
  Grip: 25, Cardio: 50, Support: 1,
};
const LOCATION_CATEGORIES = [
  {id:'Chest', label:'Chest', unit:'reps'},
  {id:'Back', label:'Back', unit:'reps'},
  {id:'Shoulders', label:'Shoulders', unit:'reps'},
  {id:'Biceps', label:'Biceps', unit:'reps'},
  {id:'Triceps', label:'Triceps', unit:'reps'},
  {id:'Quadriceps', label:'Quadriceps', unit:'reps'},
  {id:'Hamstrings', label:'Hamstrings', unit:'reps'},
  {id:'Glutes', label:'Glutes', unit:'reps'},
  {id:'Calves', label:'Calves', unit:'reps'},
  {id:'Core', label:'Core', unit:'reps'},
  {id:'Grip', label:'Grip', unit:'reps'},
  {id:'Cardio', label:'Cardio', unit:'minutes'},
  {id:'Support', label:'Support Actions (async, engagement-type)', unit:'actions'},
];
const DEFAULT_CAMPAIGN_SEED = {
  id: 'first_light', name: 'OPERATION FIRST LIGHT', threat: 'KHARVAX SWARM', sector: 'The Hollow Reach',
  startDate: null, joinWindowDays: 5, durationDays: 28,
  locations: [
    { id: 'theta', name: 'Landing Zone Theta', objective: 'Total chest volume', category: 'Chest', unit: 'reps', manualTarget: null },
    { id: 'rust', name: 'The Rust Fields', objective: 'Total cardio minutes', category: 'Cardio', unit: 'minutes', manualTarget: null },
    { id: 'kappa', name: 'Signal Tower Kappa', objective: 'Total quadriceps volume', category: 'Quadriceps', unit: 'reps', manualTarget: null },
    { id: 'hollow', name: 'The Hollow', objective: 'Squad Support actions logged', category: 'Support', unit: 'actions', manualTarget: 8 },
  ],
  lockedAt: null, lockedTargets: null, lockedDeployedCount: 0,
  deployedOperatorIds: [], reinforcementsUsed: 0, resolved: null,
};

const DEFAULT_CODEX_ENTRIES = [
  {id:'lore_1', category:'Lore', title:'The Origin', body:"Twenty years ago, first contact wasn't a handshake. It was a warning shot across an outer colony most of Earth didn't know existed yet. The United Earth Alliance formed committees. Helix Dynamics, already deep into human performance research, had a faster answer sitting on the shelf: not weapons, not machines \u2014 people, made more capable through discipline, training, and data. The Vanguard Initiative is that answer."},
  {id:'lore_2', category:'Lore', title:'Command Structure', body:"Command runs day-to-day operations \u2014 briefings, welcomes, reactions to what the community actually does. High Command sits above, unseen: the UEA/Helix Dynamics leadership tier that sets quotas, approves budgets, and occasionally hands down a directive that makes no practical sense but has to be followed anyway."},
  {id:'planet_1', category:'Planets', title:'The Hollow Reach', body:"Dense, overrun, chaotic. Kharvax territory. Home to Kharvax Prime, site of Operation First Light."},
  {id:'planet_2', category:'Planets', title:'The Meridian Line', body:"Ordered, precise, unsettling in its cleanliness. Voss Directorate territory."},
  {id:'planet_3', category:'Planets', title:'The Bloom', body:"Overgrown, spreading, uneasy. Skarn Collective territory \u2014 named a little too prettily on purpose."},
  {id:'planet_4', category:'Planets', title:'The Open Reaches', body:"Not a Sector so much as scattered activity along the Frontier's edges. Render territory, if they can be said to hold territory at all."},
  {id:'enemy_1', category:'Enemies', title:'The Kharvax Swarm', body:"Overwhelming numbers, relentless, no negotiation. Insectoid hive-based attrition warfare. Best met with sheer sustained volume."},
  {id:'enemy_2', category:'Enemies', title:'The Voss Directorate', body:"Cold, disciplined, technologically superior \u2014 not more numerous, just more precise. A mirror of what humanity could become without Vanguard's consistency-over-perfection philosophy."},
  {id:'enemy_3', category:'Enemies', title:'The Skarn Collective', body:"Parasitic, corrupting, spreads through contested territory rather than invading outright. The fight here is containment, not a battle line."},
  {id:'enemy_4', category:'Enemies', title:'The Renders', body:"Decentralized raiders and opportunists. No central empire, no warning. They hit fast, wherever Vanguard looks weakest, then vanish."},
  {id:'phil_1', category:'Philosophy', title:'Discipline Over Motivation', body:"Motivation changes. Discipline remains. A Vanguard does not wait for the perfect conditions to begin. They begin, and they create better conditions through action."},
  {id:'phil_2', category:'Philosophy', title:'Progress Over Perfection', body:"Every Vanguard starts somewhere. Every achievement begins with a first attempt. The goal is not flawless execution. The goal is continuous improvement."},
  {id:'phil_3', category:'Philosophy', title:'The Vanguard Oath', body:"I am not here because I am already strong. I am here because I choose to become stronger. I will show up \u2014 not perfectly, but consistently. I need to be one Command can count on."},
];

// ---------- Val's scripted Q&A knowledge base ----------
// Not a real AI — pure keyword matching. First topic whose keywords match
// the highest number of times wins; no match gets a generic fallback.
const VAL_FAQ = [
  { keywords:['ors','readiness score'], answer:"ORS is your Operational Readiness Score, 0-100. It's a blend of four things: Physical Capability (30%), Mission Discipline (30%), Personal Development (20%, only counts if you have an active habit), and Squad Contribution (20%). It updates live from your last 30 days, not all-time." },
  { keywords:['rank up','ranking up','how do i rank','promotion','promote'], answer:"Ranks need three things at once: enough ORS, enough lifetime Days Active, and enough Campaigns completed \u2014 and you have to currently be Active status, not just meet the numbers. Each rank has 3 tiers before the next rank unlocks. Check your Dossier's Rank Progress panel for exactly what you're missing." },
  { keywords:['mcp','contribution points'], answer:"MCP is Mission Contribution Points \u2014 10 per day you log a Protocol session, 5 per Campaign contribution entry, plus 50 for every Campaign your squad wins. It's a running total, not a live stat like ORS." },
  { keywords:['campaign','campaigns'], answer:"Campaigns are community-wide operations. Each one has multiple Locations, each tracking a muscle group toward a target \u2014 hit 100% across enough Locations and the Campaign resolves as a win. You deploy to one at a time from the Campaigns tab." },
  { keywords:['squad','join a squad','joining'], answer:"Squads are entirely opt-in \u2014 solo operators lose nothing by skipping them. Found one or join an existing one from the Squad tab. Once in, you'll have a Leader, up to 3 Officers, and regular members." },
  { keywords:['raid','raids','boss fight'], answer:"Raids are squad-only boss battles. A Leader or Officer launches one from a template, then the whole squad works through sequential Areas \u2014 clear every objective in one Area before the next unlocks, all the way to the final Boss Fight stage." },
  { keywords:['duel','duels'], answer:"Duels are squad vs squad. Your Leader or Officer challenges another squad to a target in a chosen muscle group; both squads race independently to hit it first. Whoever's further ahead when time runs out wins if nobody hits the target outright." },
  { keywords:['daily challenge','challenge of the day'], answer:"One challenge rotates in for everyone each day \u2014 same challenge, changes at midnight. Any matching logged work today counts toward it. Complete enough over time and you'll pick up Award milestones for it." },
  { keywords:['habit','habits'], answer:"Habits are daily check-ins you set up yourself \u2014 once you have at least one active habit, it activates the Personal Development slice of your ORS. Check in once a day per habit; streaks are tracked per habit." },
  { keywords:['specialization','specialize','heavy assault','recon','guardian','demolitions','tactical operator'], answer:"Specializations unlock at Operator rank. Each one gives you an exclusive Structured Session: Heavy Assault, Recon, Guardian, Demolitions Expert, and Tactical Operator. Pick one from your Dossier once you're eligible." },
  { keywords:['command staff','jr command','junior command','warden','sergeant','lieutenant','commander'], answer:"Command Staff and Jr Command Staff are separate from your Operator rank entirely \u2014 they're conferred by Admin/Mod status, but the ranks within those tracks (Lance through Warden, Lieutenant through Senior Commander) advance using the exact same ORS/Days Active/Campaigns math as everyone else. Being staff doesn't mean free promotions." },
  { keywords:['status','decay','inactive','alert','standby','reserve'], answer:"Readiness status decays from inactivity, not just a calendar gap \u2014 it also watches your rolling 14-day logging rate. Active is the only status that lets you rank up. Your career achievements never get taken away, but new promotions pause until you're Active again." },
  { keywords:['award','awards'], answer:"Awards are earned automatically \u2014 rank-ups, Campaign wins, Raid victories, Duel wins, Personal Records, and streak/Service Strip milestones all grant them. Check your Dossier's Awards panel, and you can feature one to show it front and center." },
  { keywords:['personal record','pr','pb','personal best'], answer:"Beat your own previous best on any exercise and it's logged automatically as a Personal Record, plus a real Award. Your Dossier shows your all-time best per exercise." },
  { keywords:['service strip'], answer:"Service Strips are awarded for accumulated Days Active \u2014 the same non-consecutive lifetime count your rank uses \u2014 in full-year increments: 365, 730, 1095, and so on." },
];
function matchValFAQ(question) {
  const q = question.toLowerCase();
  let best = null, bestScore = 0;
  VAL_FAQ.forEach(topic => {
    const score = topic.keywords.filter(k => q.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = topic; }
  });
  return best ? best.answer : "Val doesn't have a scripted answer for that one. Try asking Command directly, or check the Codex.";
}
