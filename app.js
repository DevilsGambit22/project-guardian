const manifestPromise = fetch("guardian-manifest.json").then(r=>r.json());
const $ = s => document.querySelector(s);
const world=$("#world"), scene=$("#scene"), guardian=$("#guardian"), enemy=$("#enemy"), portrait=$("#portrait");
const dialogue=$("#dialogue"), dialogueText=$("#dialogueText"), statusText=$("#statusText");
const locationText=$("#locationText"), statusDot=$("#statusDot");
const awakenBtn=$("#awakenBtn"), recallBtn=$("#recallBtn"), soundBtn=$("#soundBtn");

let M, state="dormant", frameTimer, enemyFrameTimer, patrolTimer, clockTimer, locationTimer, dialogueTimer, combatLock=false;
let remaining=104, locationIndex=0, soundOn=true, audioCtx, masterGain, lastX=8;

const lines={
  awaken:[
    "The seal is broken. My watch begins.",
    "Steel wakes beneath a silent sky.",
    "The old halls call my name once more."
  ],
  patrol:[
    "No torch flickers without a cause.",
    "These stones remember every intruder.",
    "The western passage is quiet. Too quiet.",
    "I hear iron moving beyond the walls.",
    "The castle sleeps. I do not.",
    "Something has crossed the outer ward."
  ],
  alert:[
    "Red steel. An enemy has entered the keep.",
    "You chose the wrong gate, invader.",
    "Draw your blade. This hall belongs to the living.",
    "I know that armor. I buried its last bearer."
  ],
  duel:[
    "Come forward, Red Knight. Let the stones judge us.",
    "Your march ends beneath this roof.",
    "I have guarded this keep through darker nights than you."
  ],
  victory:[
    "The intruder is broken. The watch continues.",
    "Red steel falls. The keep still stands.",
    "Carry this warning back into the dark.",
    "One enemy less beneath the castle moon."
  ],
  return:[
    "The seal calls me home. My watch is ended.",
    "The halls are quiet again. I return to stone.",
    "Until the next awakening, the keep must dream alone."
  ]
};

function choice(a){return a[Math.floor(Math.random()*a.length)]}
function setScene(i){
  locationIndex=(i+M.locations.length)%M.locations.length;
  const loc=M.locations[locationIndex];
  scene.style.opacity="0";
  setTimeout(()=>{scene.style.backgroundImage=`url("${loc.image}")`;locationText.textContent=loc.name;scene.style.opacity="1"},350);
}
function setStatus(text,color){statusText.textContent=text;statusDot.style.background=color;statusDot.style.color=color}
function showDialogue(kind,text,ms=4200){
  portrait.src=M.portraits[kind]; portrait.alt=`Guardian: ${kind}`;
  dialogueText.textContent=text; dialogue.classList.remove("hidden");
  clearTimeout(dialogueTimer); dialogueTimer=setTimeout(()=>dialogue.classList.add("hidden"),ms);
}
function animate(name,fps=8,loop=true,onDone){
  clearInterval(frameTimer);
  const frames=M.sequences[name]; let i=0;
  guardian.src=frames[0];
  frameTimer=setInterval(()=>{
    guardian.src=frames[i++ % frames.length];
    if(!loop && i>=frames.length){clearInterval(frameTimer);onDone&&onDone()}
  },1000/fps);
}

function animateEnemy(name,fps=8,loop=true,onDone){
  clearInterval(enemyFrameTimer);
  const frames=M.enemySequences[name]; let i=0;
  enemy.src=frames[0];
  enemyFrameTimer=setInterval(()=>{
    enemy.src=frames[i++ % frames.length];
    if(!loop && i>=frames.length){clearInterval(enemyFrameTimer);onDone&&onDone()}
  },1000/fps);
}
function impact(){
  const flash=$("#impactFlash");flash.classList.remove("hit");void flash.offsetWidth;flash.classList.add("hit");
}

let enemyHealthValue=100;

function setEnemyHealth(value){
  enemyHealthValue=Math.max(0,Math.min(100,value));
  const fill=$("#enemyHealthFill");
  const panel=$("#enemyHealth");
  if(fill) fill.style.transform=`scaleX(${enemyHealthValue/100})`;
  if(panel) panel.classList.toggle("hidden", state!=="patrol" && state!=="combat");
}

function clash(){
  const fx=$("#clashSpark");
  fx.classList.remove("active");
  void fx.offsetWidth;
  fx.classList.add("active");
  impact();
}

function damageEnemy(amount){
  setEnemyHealth(enemyHealthValue-amount);
  enemy.classList.remove("enemy-hit");
  void enemy.offsetWidth;
  enemy.classList.add("enemy-hit");
  sparks(10);
}

async function duel(){
  if(combatLock || state!=="patrol") return;

  combatLock=true;
  state="combat";
  world.classList.add("combat-mode");
  clearInterval(patrolTimer);
  stopWaypointPatrol();
  setScene(1);

  enemyHealthValue=100;
  $("#enemyHealth").classList.remove("hidden");
  setEnemyHealth(100);

  setStatus("ENEMY DETECTED","#e95745");
  showDialogue("aggression",choice(lines.alert),3000);

  guardian.style.transition="left 1.5s linear, opacity .4s";
  enemy.style.transition="right 1.5s linear, opacity .4s";
  guardian.style.left="31%";
  guardian.style.transform="scaleX(1)";
  enemy.style.right="31%";
  enemy.style.transform="scaleX(-1)";
  guardian.style.opacity="1";
  enemy.style.opacity="1";
  animate("run",11,true);
  animateEnemy("run",11,true);

  await new Promise(r=>setTimeout(r,1550));

  setStatus("SWORDS CLASH","#ffb34f");
  showDialogue("aggression",choice(lines.duel),2600);

  // First clash: both knights strike, Blue Knight wins the bind.
  animate("attack",10,false);
  animateEnemy("attack",10,false);
  await new Promise(r=>setTimeout(r,520));
  clash();
  await new Promise(r=>setTimeout(r,300));
  damageEnemy(25);

  // Second clash: Red Knight attacks again, Blue Knight parries and counters.
  animateEnemy("attack",10,false);
  await new Promise(r=>setTimeout(r,360));
  animate("attack",11,false);
  await new Promise(r=>setTimeout(r,320));
  clash();
  damageEnemy(30);

  await new Promise(r=>setTimeout(r,520));

  // Finisher: Blue Knight drives through with the power attack.
  setStatus("GUARDIAN ADVANTAGE","#7ed889");
  animate("power",10,false);
  animateEnemy("attack",9,false);
  await new Promise(r=>setTimeout(r,560));
  clash();
  damageEnemy(45);

  await new Promise(r=>setTimeout(r,650));

  enemy.style.transition="right .85s ease-out, opacity .85s, transform .35s";
  enemy.style.transform="scaleX(-1) rotate(-12deg)";
  enemy.style.right="-190px";
  enemy.style.opacity="0";

  showDialogue("smile",choice(lines.victory),3800);
  setStatus("VICTORY","#75dc84");
  sparks(36);

  await new Promise(r=>setTimeout(r,2200));

  $("#enemyHealth").classList.add("hidden");
  world.classList.remove("combat-mode");
  state="patrol";
  animate("idle",6,true);
  setStatus("PATROLLING","#d7b45a");
  combatLock=false;

  if(state==="patrol"){
    waypointIndex=2;
    runWaypointPatrol();
    patrolTimer=setInterval(patrolBeat,7000);
  }
}
const patrolWaypoints = [
  { x: 10, pause: 1700, mode: "walk" },
  { x: 27, pause: 2400, mode: "walk" },
  { x: 47, pause: 1900, mode: "walk" },
  { x: 68, pause: 2200, mode: "walk" },
  { x: 84, pause: 1600, mode: "walk" }
];
let waypointIndex = 0;
let movementToken = 0;
let patrolTimeout = null;

function getGuardianXPercent(){
  const layerWidth = $("#guardianLayer").clientWidth || world.clientWidth;
  const px = parseFloat(getComputedStyle(guardian).left) || 0;
  return Math.max(0, Math.min(100, (px / Math.max(1, layerWidth)) * 100));
}

function moveTo(percent, duration, mode="walk"){
  const token = ++movementToken;
  return new Promise(resolve=>{
    const layer = $("#guardianLayer");
    const layerWidth = layer.clientWidth || world.clientWidth;
    const guardianWidth = guardian.getBoundingClientRect().width || 140;
    const maxLeft = Math.max(0, layerWidth - guardianWidth);
    const targetPx = Math.max(0, Math.min(maxLeft, layerWidth * percent / 100));
    const currentPx = parseFloat(getComputedStyle(guardian).left) || 0;
    const distance = Math.abs(targetPx - currentPx);

    if(distance < 8){
      clearInterval(frameTimer);
      animate("idle", 6, true);
      guardian.style.transition = "none";
      resolve();
      return;
    }

    guardian.style.transform = targetPx < currentPx ? "scaleX(-1)" : "scaleX(1)";
    guardian.style.transition = `left ${duration}ms linear, opacity .4s`;
    animate(mode, mode === "run" ? 11 : 8, true);

    const finish = ()=>{
      if(token !== movementToken) return;
      clearTimeout(guardian._moveFallback);
      guardian.removeEventListener("transitionend", onEnd);
      guardian.style.left = targetPx + "px";
      clearInterval(frameTimer);
      animate("idle", 6, true);
      resolve();
    };
    const onEnd = e=>{
      if(e.propertyName === "left") finish();
    };

    guardian.addEventListener("transitionend", onEnd);
    requestAnimationFrame(()=> guardian.style.left = targetPx + "px");
    guardian._moveFallback = setTimeout(finish, duration + 180);
  });
}

function stopWaypointPatrol(){
  clearTimeout(patrolTimeout);
  patrolTimeout = null;
  movementToken++;
  guardian.style.transition = "none";
  clearInterval(frameTimer);
}

async function runWaypointPatrol(){
  if(state !== "patrol" || combatLock) return;

  const waypoint = patrolWaypoints[waypointIndex];
  const current = getGuardianXPercent();
  const distance = Math.abs(waypoint.x - current);
  const duration = Math.max(850, Math.min(4200, distance * 55));

  await moveTo(waypoint.x, duration, waypoint.mode);

  if(state !== "patrol" || combatLock) return;

  setStatus("PATROLLING","#d7b45a");
  animate("idle", 6, true);

  patrolTimeout = setTimeout(()=>{
    if(state !== "patrol" || combatLock) return;

    // Move back and forth through the route instead of choosing random positions.
    if(!runWaypointPatrol.direction) runWaypointPatrol.direction = 1;
    if(waypointIndex >= patrolWaypoints.length - 1) runWaypointPatrol.direction = -1;
    if(waypointIndex <= 0) runWaypointPatrol.direction = 1;
    waypointIndex += runWaypointPatrol.direction;

    runWaypointPatrol();
  }, waypoint.pause);
}

function sparks(n=32){
  const p=$("#particles");
  for(let i=0;i<n;i++){const s=document.createElement("i");s.className="spark";
    s.style.left=(20+Math.random()*60)+"%";s.style.top=(25+Math.random()*55)+"%";
    s.style.setProperty("--dx",(Math.random()*220-110)+"px");s.style.setProperty("--dy",(Math.random()*-180-20)+"px");
    p.appendChild(s);setTimeout(()=>s.remove(),1400)}
}
let musicTracks=[];
let currentTrackIndex=-1;
let musicAudio=null;
let battleAudio=null;
let musicMode="ambient";

async function detectMusicFiles(){
  const found=[];

  // GitHub Pages: automatically list every MP3 in /music through the public
  // GitHub Contents API. No filenames need to be added to app.js.
  const host=location.hostname;
  if(host.endsWith(".github.io")){
    const owner=host.split(".")[0];
    const pathParts=location.pathname.split("/").filter(Boolean);
    const repo=pathParts[0];
    if(owner && repo){
      try{
        const response=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/music`);
        if(response.ok){
          const files=await response.json();
          for(const file of files){
            if(file.type==="file" && /\.mp3$/i.test(file.name)){
              found.push({
                name:file.name.replace(/\.mp3$/i,"").replace(/[-_]+/g," "),
                url:file.download_url
              });
            }
          }
        }
      }catch(error){
        console.warn("GitHub music detection unavailable:",error);
      }
    }
  }

  // Local/GitHub fallback: numbered filenames can be dropped directly into
  // music/ as track1.mp3 through track30.mp3.
  if(!found.length){
    const probes=[];
    for(let i=1;i<=30;i++) probes.push(`music/track${i}.mp3`);
    for(const url of probes){
      try{
        const response=await fetch(url,{method:"HEAD"});
        if(response.ok) found.push({name:url.split("/").pop().replace(".mp3",""),url});
      }catch(_){}
    }
  }

  musicTracks=found;
  updateMusicStatus();
  return found;
}

function updateMusicStatus(){
  const label=$("#musicStatus");
  if(!label)return;
  if(!musicTracks.length){
    label.textContent="SYNTH FALLBACK";
  }else if(currentTrackIndex>=0){
    label.textContent=musicTracks[currentTrackIndex].name.toUpperCase();
  }else{
    label.textContent=`${musicTracks.length} TRACK${musicTracks.length===1?"":"S"} FOUND`;
  }
}

function createMusicAudio(){
  if(musicAudio)return musicAudio;
  musicAudio=new Audio();
  musicAudio.preload="auto";
  musicAudio.volume=.52;
  musicAudio.addEventListener("ended",playNextTrack);
  musicAudio.addEventListener("error",playNextTrack);
  return musicAudio;
}

function playNextTrack(){
  if(!soundOn || !musicTracks.length)return;
  currentTrackIndex=(currentTrackIndex+1)%musicTracks.length;
  const audio=createMusicAudio();
  audio.src=musicTracks[currentTrackIndex].url;
  audio.play().catch(()=>{});
  updateMusicStatus();
}

function playMusic(){
  if(!soundOn)return;
  if(musicTracks.length){
    const audio=createMusicAudio();
    if(currentTrackIndex<0) playNextTrack();
    else audio.play().catch(()=>{});
    return;
  }
  startSynthFallback();
}

function pauseMusic(){
  if(musicAudio)musicAudio.pause();
  stopSynthFallback();
}

function startSynthFallback(){
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(masterGain)return;
  masterGain=audioCtx.createGain();
  masterGain.gain.value=.025;
  masterGain.connect(audioCtx.destination);

  const chord=[73.42,110,146.83,164.81,220];
  chord.forEach((frequency,index)=>{
    const oscillator=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    oscillator.type=index<2?"sine":"triangle";
    oscillator.frequency.value=frequency;
    gain.gain.value=index===0?.45:.10;
    oscillator.connect(gain).connect(masterGain);
    oscillator.start();
  });
}

function stopSynthFallback(){
  if(masterGain){
    masterGain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+.6);
    setTimeout(()=>{
      try{masterGain.disconnect()}catch(_){}
      masterGain=null;
    },700);
  }
}

function ambientStart(){playMusic()}
function ambientStop(){pauseMusic()}
function patrolBeat(){
  if(state!=="patrol" || combatLock)return;
  const roll=Math.random();

  // Combat now happens early and only interrupts the waypoint route.
  if(roll < .55){
    duel();
  }else if(roll < .75){
    showDialogue("calm",choice(lines.patrol),3000);
  }
}
async function awaken(){
  if(state!=="dormant")return;
  ambientStart(); state="awakening"; world.classList.remove("dormant");world.classList.add("active");
  awakenBtn.disabled=true;recallBtn.disabled=false;guardian.style.opacity="1";guardian.style.left="12%";
  setStatus("AWAKENING","#f5d36f");showDialogue("special",choice(lines.awaken),4800);sparks(48);
  animate("invocation",8,false,()=>{
    state="patrol";setStatus("PATROLLING","#d7b45a");animate("walk",8,true);moveTo(72,5000,"walk");
    patrolTimer=setInterval(patrolBeat,6500);locationTimer=setInterval(()=>setScene(locationIndex+1),22000);
    remaining=104;updateClock();clockTimer=setInterval(updateClock,1000);
  });
}
function recall(){
  if(state==="dormant"||state==="returning")return;
  state="returning";combatLock=false;stopWaypointPatrol();clearInterval(patrolTimer);clearInterval(enemyFrameTimer);clearInterval(locationTimer);clearInterval(clockTimer);enemy.style.opacity="0";enemy.style.right="-190px";$("#enemyHealth").classList.add("hidden");
  setStatus("RETURNING","#8ab4cf");showDialogue("calm",choice(lines.return),4300);setScene(0);
  moveTo(48,2400,"walk");
  setTimeout(()=>animate("kneel",6,false,()=>{
    guardian.style.opacity="0";ambientStop();state="dormant";world.classList.add("dormant");world.classList.remove("active");
    setStatus("DORMANT","#555");awakenBtn.disabled=false;recallBtn.disabled=true;remaining=104;
  }),2500);
}
soundBtn.onclick=()=>{
  soundOn=!soundOn;
  soundBtn.textContent=`AMBIENCE: ${soundOn?"ON":"OFF"}`;
  soundBtn.setAttribute("aria-pressed",soundOn);
  if(!soundOn)pauseMusic();
  else if(state!=="dormant")playMusic();
};
awakenBtn.onclick=awaken;recallBtn.onclick=recall;
manifestPromise.then(async data=>{M=data;setScene(0);guardian.src=M.sequences.idle[0];enemy.src=M.enemySequences.idle[0];portrait.src=M.portraits.calm;await detectMusicFiles();});
