const socket=io();
const app=document.getElementById('app');
let state=null,roomId='',isHost=false,myName='',screen='home',soundOn=true,hostChatOpen=false,previousOpen=false;
const labels={five:'EARLY 5',first:'FIRST LINE',second:'SECOND LINE',third:'THIRD LINE',full:'FULL HOUSE'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const go=fn=>{screen=fn;previousOpen=false;window.scrollTo(0,0);renderScreen()};

socket.on('connect',()=>{const el=document.getElementById('conn');if(el)el.textContent='ONLINE'});
socket.on('disconnect',()=>{const el=document.getElementById('conn');if(el)el.textContent='OFFLINE'});
socket.on('room:update',r=>{
  state=r;isHost=r.hostId===socket.id;
  if(isHost&&['hostManage','hostPlay'].includes(screen))renderScreen();
  else if(!isHost&&screen==='player')renderScreen();
});

function renderScreen(){
  if(screen==='home')return home();
  if(screen==='create')return createPage();
  if(screen==='join')return joinPage();
  if(screen==='hostManage')return hostManage();
  if(screen==='hostPlay')return hostPlay();
  if(screen==='player')return playerPage();
}
function shell(content,conn=true){app.innerHTML=`<div class="screen">${conn?`<div class="topbar"><b>🎟️ SURENDRA CREATED WORLD</b><span id="conn">${socket.connected?'ONLINE':'OFFLINE'}</span></div>`:''}${content}</div>`}
function home(){shell(`<main class="home"><div class="ornament">✦ ✧ ✦</div><h1>WELCOME TO<br><strong>SURENDRA</strong><br><span>CREATED WORLD</span></h1><div class="home-cards"><button class="home-card green" onclick="showCreate()"><span>🏠➕</span><b>CREATE<br>ROOM</b></button><button class="home-card blue" onclick="showJoin()"><span>👥</span><b>JOIN<br>ROOM</b></button></div><footer>© 2020–2037 Surendra</footer></main>`);}
function createPage(){shell(`<main class="form-screen"><button class="back" onclick="showHome()">← BACK</button><section class="form-panel"><div class="panel-icon">🏠➕</div><h2>CREATE ROOM</h2><p>Enter your name</p><input id="createName" maxlength="30" placeholder="Your name" autofocus><button class="gold-btn" onclick="createRoom()">CREATE ROOM</button></section></main>`);setTimeout(()=>document.getElementById('createName')?.focus(),50)}
function joinPage(){shell(`<main class="form-screen"><button class="back" onclick="showHome()">← BACK</button><section class="form-panel"><div class="panel-icon">👥</div><h2>JOIN ROOM</h2><p>Enter your name and room ID</p><input id="joinName" maxlength="30" placeholder="Your name"><input id="roomInput" maxlength="20" placeholder="Room ID" autocapitalize="characters"><button class="gold-btn" onclick="joinRoom()">JOIN ROOM</button></section></main>`);setTimeout(()=>document.getElementById('joinName')?.focus(),50)}

function hostManage(){
  if(!state)return;
  const players=state.players.map(p=>`<div class="player-row"><div><b>${esc(p.name)}${p.id===socket.id?' (HOST)':''}</b><small>${p.ticketCount??p.tickets.length} ticket(s)</small></div><div class="ticket-actions"><button onclick="changeTickets('${p.id}',-1)">−</button><strong>${p.ticketCount??p.tickets.length}</strong><button onclick="changeTickets('${p.id}',1)">+</button></div></div>`).join('');
  shell(`<main class="game-screen"><div class="room-title"><div><small>ROOM #${esc(roomId)}</small><h1>MANAGEMENT MODE</h1></div><button class="outline" onclick="exitRoom()">EXIT</button></div><div class="mode-cards"><button class="mode-card manager" onclick="showHostManage()"><span>🎫</span><b>PLAYERS &amp;<br>TICKETS</b><small>Manage tickets</small></button><button class="mode-card playing" onclick="showHostPlay()"><span>☝️▶</span><b>HOST PLAYING<br>MODE</b><small>Call numbers</small></button></div><section class="glass"><h3>PLAYER MANAGEMENT</h3>${players||'<p class="muted">Waiting for players…</p>'}</section><section class="glass"><h3>WINNING PATTERNS</h3>${winnerList()}</section><div class="copy-row">Room ID: <b>${esc(roomId)}</b><button onclick="copyRoom()">COPY</button></div></main>`);
}

function hostPlay(){
  if(!state)return;
  const me=state.players.find(p=>p.id===socket.id);
  const myTickets=me?.tickets||[];
  shell(`<main class="play-screen"><div class="play-head"><div><small>ROOM #${esc(roomId)}</small><h1>HOST PLAYING MODE</h1></div><div class="head-actions"><button class="sound-toggle" onclick="toggleSound()">${soundOn?'🔊 SOUND ON':'🔇 SOUND OFF'}</button><button class="chat-toggle" onclick="toggleHostChat()">💬 MESSAGE</button><button class="outline" onclick="showHostManage()">GO TO MANAGEMENT MODE</button></div></div><div class="play-layout"><section class="number-panel"><div class="panel-head"><h3>GENERATED NUMBERS</h3><button class="icon-btn" title="Toggle number sound" onclick="toggleSound()">${soundOn?'🔊':'🔇'}</button></div><div class="recent">${state.called.slice(-5).map(n=>`<span>${n}</span>`).join('')||'<span>—</span>'}</div><div class="call-controls"><button class="generate" onclick="generateNumber()" ${!state.started||state.finished?'disabled':''}><strong>${state.current??'+'}</strong><span>GENERATE<br>NUMBER</span></button><div><button class="reset" onclick="resetGame()">↻ RESET<br>GAME</button><button class="previous" onclick="showPrevious()">↶ PREVIOUS<br>NUMBERS</button></div></div><div class="players-mini">${state.players.map(p=>esc(p.name)).join(' • ')}</div></section><section class="tickets-panel"><div class="startline"><button class="gold-btn small" onclick="startGame()" ${state.started||state.finished?'disabled':''}>${state.started?'GAME STARTED':'START GAME'}</button><div class="current">CURRENT <b>${state.current??'—'}</b></div></div><h3>MY TICKETS</h3>${myTickets.length?myTickets.map(t=>`<article class="ticket-card host-own-ticket"><div class="ticket-label">TICKET ${esc(t.id)} — HOST</div>${ticketGrid(t,true)}</article>`).join(''):'<p class="muted">No host ticket yet. Add one in Management Mode.</p>'}</section><section class="claims-panel"><h3>CLAIMS</h3>${claimPanel(true)}</section></div>${hostChat()}${previousModal()}</main>`);
}

function playerPage(){
  if(!state)return;
  shell(`<main class="player-screen"><div class="play-head"><div><small>ROOM #${esc(roomId)}</small><h1>JOIN ROOM</h1></div><div class="head-actions"><button class="sound-toggle" onclick="toggleSound()">${soundOn?'🔊 SOUND ON':'🔇 SOUND OFF'}</button><span class="you">${esc(myName)}</span></div></div><div class="player-layout"><section class="chat-panel"><h3>LIVE CHAT</h3><div id="chatMessages" class="chat-messages">${chatHtml()}</div><div class="chat-input"><input id="chatText" placeholder="Type a message…" maxlength="240" onkeydown="if(event.key==='Enter')sendChat()"><button onclick="sendChat()">SEND</button></div></section><section class="player-ticket-panel"><div class="called-strip">${state.called.slice(-5).map(n=>`<b>${n}</b>`).join(' ')||'Waiting for numbers…'}</div><h3>MY TICKETS</h3>${myTickets()}</section><section class="claims-panel"><h3>CLAIM PANEL</h3>${claimPanel(false)}</section></div></main>`);
}

function chatHtml(){return (state.chat||[]).map(c=>`<div><b>[${esc(c.name)}]</b> ${esc(c.text)}</div>`).join('')||'<div class="muted">No messages yet.</div>'}
function hostChat(){return `<aside class="host-chat ${hostChatOpen?'open':''}"><div class="host-chat-head"><b>LIVE CHAT</b><button onclick="toggleHostChat()">✕</button></div><div id="hostChatMessages" class="chat-messages">${chatHtml()}</div><div class="chat-input"><input id="hostChatText" placeholder="Message players…" maxlength="240" onkeydown="if(event.key==='Enter')sendHostChat()"><button onclick="sendHostChat()">SEND</button></div></aside>`}

function ticketGrid(t,interactive){
  return `<div class="ticket-grid">${t.grid.flat().map(n=>n?`<button class="cell ${t.marks.includes(n)?'marked':''} ${state.called.includes(n)?'called':''}" ${interactive?`onclick="markNumber('${t.id}',${n})"`:''}>${n}</button>`:'<span class="cell blank"></span>').join('')}</div>`;
}
function myTickets(){
  const me=state.players.find(p=>p.id===socket.id);if(!me?.tickets.length)return '<p class="muted">Waiting for the host to give you tickets…</p>';
  return me.tickets.map(t=>`<article class="ticket-card"><div class="ticket-label">TICKET ${esc(t.id)}</div>${ticketGrid(t,true)}</article>`).join('');
}

function ticketEligible(t,k){
  if(!t)return false;
  const marked=n=>t.marks.includes(n);
  if(k==='five')return t.grid.flat().filter(Boolean).filter(marked).length>=5;
  if(k==='first')return t.grid[0].filter(Boolean).every(marked);
  if(k==='second')return t.grid[1].filter(Boolean).every(marked);
  if(k==='third')return t.grid[2].filter(Boolean).every(marked);
  return t.grid.flat().filter(Boolean).every(marked);
}
function myEligibleTicket(k){
  const me=state?.players.find(p=>p.id===socket.id);return me?.tickets.find(t=>ticketEligible(t,k));
}
function claimPanel(){
  return Object.entries(labels).map(([k,label])=>{
    const w=state.winners[k];
    const eligible=myEligibleTicket(k);
    const disabled=!!w.playerId||!eligible||!state.started||state.finished;
    return `<button class="claim-side ${w.playerId?'claimed':''} ${eligible&&!w.playerId?'ready':''}" ${disabled?'disabled':''} onclick="claimEligible('${k}')"><span>${label}</span><small>${w.playerId?`CLAIMED BY ${esc(w.playerName)}`:eligible?'CLAIM NOW':'PENDING'}</small></button>`;
  }).join('');
}
function winnerList(){return Object.entries(labels).map(([k,v])=>{const w=state.winners[k];return `<div class="winner-line"><b>${v}</b><span>${w.playerId?esc(w.playerName):'Pending'}</span></div>`}).join('')}

function previousModal(){
  if(!previousOpen)return '';
  const called=new Set(state.called);
  const order=state.called.length?state.called.map((n,i)=>`${i+1}. ${n}`).join('  →  '):'No numbers have been called yet.';
  return `<div class="modal-backdrop" onclick="closePrevious(event)"><section class="previous-modal" onclick="event.stopPropagation()"><div class="modal-head"><h2>PREVIOUS NUMBERS</h2><button onclick="closePrevious()">✕</button></div><div class="number-grid-90">${Array.from({length:90},(_,i)=>i+1).map(n=>`<span class="number-item ${called.has(n)?'called-number':''}">${n}</span>`).join('')}</div><h3>CALLED NUMBERS — ORDER</h3><div class="called-order">${esc(order)}</div></section></div>`;
}
function showPrevious(){previousOpen=true;renderScreen()}
function closePrevious(){previousOpen=false;renderScreen()}
function toggleHostChat(){hostChatOpen=!hostChatOpen;renderScreen();setTimeout(()=>document.getElementById('hostChatMessages')?.scrollTo(0,999999),30)}
function toggleSound(){soundOn=!soundOn;renderScreen()}
function showHome(){go('home')}
function showCreate(){go('create')}
function showJoin(){go('join')}
function showHostManage(){go('hostManage')}
function showHostPlay(){go('hostPlay')}
function enterHost(){go('hostManage')}
function enterPlayer(){go('player')}

function createRoom(){const name=document.getElementById('createName')?.value.trim();if(!name)return alert('Please enter your name.');myName=name;socket.emit('createRoom',{name},r=>{if(!r.ok)return alert(r.error);roomId=r.roomId;isHost=true;enterHost()})}
function joinRoom(){const name=document.getElementById('joinName')?.value.trim(),id=document.getElementById('roomInput')?.value.trim().toUpperCase();if(!name||!id)return alert('Enter your name and room ID.');myName=name;socket.emit('joinRoom',{roomId:id,name},r=>{if(!r.ok)return alert(r.error);roomId=r.roomId;isHost=false;enterPlayer()})}
function startGame(){socket.emit('host:start',{roomId},r=>{if(r&&!r.ok)alert(r.error)})}
function generateNumber(){if(!state.started||state.finished)return;const available=Array.from({length:90},(_,i)=>i+1).filter(n=>!state.called.includes(n));if(!available.length)return alert('All 90 numbers have been called.');const n=available[Math.floor(Math.random()*available.length)];socket.emit('host:call',{roomId,number:n},r=>{if(!r.ok)alert(r.error);else speak(`Number ${r.number}`)})}
function resetGame(){if(confirm('RESET GAME? This will generate NEW tickets for every player and clear all numbers and claims.'))socket.emit('host:reset',{roomId},r=>{if(r&&!r.ok)alert(r.error)})}
function changeTickets(id,delta){if(delta>0){socket.emit('host:addTickets',{roomId,playerId:id,count:1},r=>{if(r&&!r.ok)alert(r.error)})}else{socket.emit('host:removeTicket',{roomId,playerId:id},r=>{if(r&&!r.ok)alert(r.error)})}}
function markNumber(t,n){socket.emit('mark',{roomId,ticketId:t,number:n},r=>{if(!r.ok)alert(r.error)})}
function claimEligible(category){const t=myEligibleTicket(category);if(!t)return alert('This claim is not ready yet.');socket.emit('claim',{roomId,ticketId:t.id,category},r=>{if(!r.ok)alert(r.error);else speak(labels[category])})}
function sendChat(){const input=document.getElementById('chatText');const text=input?.value.trim();if(!text)return;socket.emit('chat:send',{roomId,text},r=>{if(!r.ok)alert(r.error);else{input.value='';setTimeout(()=>document.getElementById('chatMessages')?.scrollTo(0,999999),30)}})}
function sendHostChat(){const input=document.getElementById('hostChatText');const text=input?.value.trim();if(!text)return;socket.emit('chat:send',{roomId,text},r=>{if(!r.ok)alert(r.error);else{input.value='';setTimeout(()=>document.getElementById('hostChatMessages')?.scrollTo(0,999999),30)}})}
function copyRoom(){navigator.clipboard?.writeText(roomId).then(()=>alert('Room ID copied!'),()=>alert(`Room ID: ${roomId}`))}
function exitRoom(){if(confirm('Leave this room?')){socket.disconnect();location.href=location.pathname}}
function speak(text){if(soundOn&&'speechSynthesis'in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(text))}}
document.addEventListener('keydown',e=>{if(e.key==='Enter'){if(screen==='create')createRoom();else if(screen==='join')joinRoom()}});
renderScreen();
