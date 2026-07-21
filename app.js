const manifestPromise = fetch("guardian-manifest.json").then(r=>r.json());
const $ = s => document.querySelector(s);
const world=$("#world"), scene=$("#scene"), guardian=$("#guardian"), enemy=$("#enemy"), portrait=$("#portrait");
const dialogue=$("#dialogue"), dialogueText=$("#dialogueText"), statusText=$("#statusText");
const locationText=$("#locationText"), statusDot=$("#statusDot"), timerBar=$("#timerBar"), timerText=$("#timerText");
const awakenBtn=$("#awakenBtn"), recallBtn=$("#recallBtn"), soundBtn=$("#soundBtn");

let M, state="dormant", frameTimer, enemyFrameTimer, patrolTimer, clockTimer, locationTimer, dialogueTimer, combatLock=false;
let remaining=104, locationIndex=0, soundOn=true, audioCtx, masterGain, lastX=8;

const lines={
  awaken:["The watch begins. I will patrol these halls.","Guardian protocol restored. All systems are under my protection."],
  patrol:["The halls remain secure.","I sense movement beyond the next chamber.","Every player belongs. Every move matters.","I will continue watching over the network."],
  alert:["Activity detected. Advancing to intercept.","Threat pattern confirmed. Shield raised."],
  return:["My watch has ended. Returning to my post.","The halls are secure. Until I am summoned again."]
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
async function duel(){
  if(combatLock || state!=="patrol") return;
  combatLock=true; world.classList.add("combat-mode");
  clearInterval(patrolTimer);
  setScene(1);
  setStatus("ENEMY DETECTED","#e95745");
  showDialogue("aggression","Red Knight detected. Hostile presence confirmed.",2600);

  guardian.style.transition="left 1.6s linear, opacity .4s";
  enemy.style.transition="right 1.6s linear, opacity .4s";
  guardian.style.left="25%"; guardian.style.transform="scaleX(1)";
  enemy.style.right="25%"; enemy.style.transform="scaleX(-1)";
  guardian.style.opacity="1"; enemy.style.opacity="1";
  animate("run",11,true); animateEnemy("run",11,true);

  await new Promise(r=>setTimeout(r,1650));
  setStatus("DUEL IN PROGRESS","#ffb34f");
  animateEnemy("attack",10,false);
  animate("attack",10,false);
  await new Promise(r=>setTimeout(r,750));
  impact();

  animateEnemy("attack",9,false);
  await new Promise(r=>setTimeout(r,600));
  animate("power",10,false);
  impact();
  await new Promise(r=>setTimeout(r,700));

  enemy.style.transition="right .8s ease-out, opacity .8s";
  enemy.style.right="-190px"; enemy.style.opacity="0";
  showDialogue("smile","The Red Knight has been defeated. The castle is secure.",3600);
  setStatus("VICTORY","#75dc84");
  sparks(32);

  await new Promise(r=>setTimeout(r,2200));
  world.classList.remove("combat-mode");
  animate("idle",6,true);
  setStatus("PATROLLING","#d7b45a");
  combatLock=false;
  if(state==="patrol") patrolTimer=setInterval(patrolBeat,6500);
}
function moveTo(percent,duration,mode="walk"){
  const width=world.clientWidth, target=Math.max(0,Math.min(width-guardian.clientWidth,width*percent/100));
  const current=parseFloat(getComputedStyle(guardian).left)||0;
  guardian.style.transform=target<current?"scaleX(-1)":"scaleX(1)";
  guardian.style.transition=`left ${duration}ms linear, opacity .5s`;
  guardian.style.left=target+"px"; lastX=percent; animate(mode,mode==="run"?11:8,true);
}
function sparks(n=32){
  const p=$("#particles");
  for(let i=0;i<n;i++){const s=document.createElement("i");s.className="spark";
    s.style.left=(20+Math.random()*60)+"%";s.style.top=(25+Math.random()*55)+"%";
    s.style.setProperty("--dx",(Math.random()*220-110)+"px");s.style.setProperty("--dy",(Math.random()*-180-20)+"px");
    p.appendChild(s);setTimeout(()=>s.remove(),1400)}
}
function ambientStart(){
  if(!soundOn)return;
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(masterGain)return;
  masterGain=audioCtx.createGain();masterGain.gain.value=.035;masterGain.connect(audioCtx.destination);
  [110,164.81,220].forEach((f,j)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=j===0?"sine":"triangle";o.frequency.value=f;g.gain.value=j===0?.5:.13;o.connect(g).connect(masterGain);o.start()});
}
function ambientStop(){if(masterGain){masterGain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+.8);setTimeout(()=>{masterGain.disconnect();masterGain=null},900)}}
function updateClock(){
  remaining--; const m=String(Math.floor(remaining/60)).padStart(2,"0"),s=String(remaining%60).padStart(2,"0");
  timerText.textContent=`${m}:${s}`;timerBar.style.transform=`scaleX(${remaining/104})`;
  if(remaining<=0) recall();
}
function patrolBeat(){
  if(state!=="patrol")return;
  const roll=Math.random();
  if(roll<.22){duel()}
  else if(roll<.42){moveTo(8+Math.random()*78,1300+Math.random()*900,"run")}
  else if(roll<.68){moveTo(8+Math.random()*78,2600+Math.random()*1800,"walk")}
  else {setStatus("PATROLLING","#d7b45a");animate("idle",6,true);showDialogue("calm",choice(lines.patrol),3000)}
  setTimeout(()=>{if(state==="patrol")setStatus("PATROLLING","#d7b45a")},3200)
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
  state="returning";combatLock=false;clearInterval(patrolTimer);clearInterval(enemyFrameTimer);clearInterval(locationTimer);clearInterval(clockTimer);enemy.style.opacity="0";enemy.style.right="-190px";
  setStatus("RETURNING","#8ab4cf");showDialogue("calm",choice(lines.return),4300);setScene(0);
  moveTo(48,2400,"walk");
  setTimeout(()=>animate("kneel",6,false,()=>{
    guardian.style.opacity="0";ambientStop();state="dormant";world.classList.add("dormant");world.classList.remove("active");
    setStatus("DORMANT","#555");awakenBtn.disabled=false;recallBtn.disabled=true;remaining=104;timerText.textContent="01:44";timerBar.style.transform="scaleX(1)";
  }),2500);
}
soundBtn.onclick=()=>{soundOn=!soundOn;soundBtn.textContent=`AMBIENCE: ${soundOn?"ON":"OFF"}`;soundBtn.setAttribute("aria-pressed",soundOn);if(!soundOn)ambientStop();else if(state!=="dormant")ambientStart()};
awakenBtn.onclick=awaken;recallBtn.onclick=recall;
manifestPromise.then(data=>{M=data;setScene(0);guardian.src=M.sequences.idle[0];enemy.src=M.enemySequences.idle[0];portrait.src=M.portraits.calm});
