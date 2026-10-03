const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const app=express();
const server=http.createServer(app);
const io=new Server(server);
app.use(express.static('public'));
app.get('/health',(_req,res)=>res.json({ok:true,service:'tambola'}));
const rooms=new Map();
const cats=['five','first','second','third','full'];
const rid=()=>String(Math.floor(1000+Math.random()*9000));

function shuffled(a){return [...a].sort(()=>Math.random()-0.5)}
function ticket(id){
  const grid=Array.from({length:3},()=>Array(9).fill(null));
  let rowCols;
  do {
    rowCols=[0,1,2].map(()=>shuffled([...Array(9).keys()]).slice(0,5).sort((a,b)=>a-b));
  } while(new Set(rowCols.flat()).size<9);
  for(let c=0;c<9;c++){
    const rows=rowCols.map((a,r)=>a.includes(c)?r:null).filter(r=>r!==null);
    const lo=c===0?1:c*10;
    const hi=c===0?9:(c===8?90:c*10+9);
    const nums=shuffled(Array.from({length:hi-lo+1},(_,i)=>lo+i)).slice(0,rows.length).sort((a,b)=>a-b);
    rows.forEach((r,i)=>grid[r][c]=nums[i]);
  }
  return {id,grid,marks:[]};
}

// Never send other players' ticket grids to clients.
function pub(r,viewerId){
  return {
    id:r.id,
    hostId:r.hostId,
    players:[...r.players.values()].map(p=>({
      id:p.id,
      name:p.name,
      ticketCount:p.tickets.length,
      tickets:p.id===viewerId?p.tickets:[]
    })),
    called:r.called,
    current:r.current,
    winners:r.winners,
    started:r.started,
    finished:r.finished,
    chat:r.chat.slice(-60)
  };
}
function emit(r){
  for(const p of r.players.values()) io.to(p.id).emit('room:update',pub(r,p.id));
}
function complete(t,c){
  const hit=n=>t.marks.includes(n);
  if(c==='five')return t.grid.flat().filter(Boolean).filter(hit).length>=5;
  if(c==='first')return t.grid[0].filter(Boolean).every(hit);
  if(c==='second')return t.grid[1].filter(Boolean).every(hit);
  if(c==='third')return t.grid[2].filter(Boolean).every(hit);
  return t.grid.flat().filter(Boolean).every(hit);
}
function safeName(n){return String(n||'').trim().slice(0,30)}
function freshTicketsForPlayers(r){
  r.players.forEach(p=>{
    const count=Math.max(1,p.tickets.length);
    p.tickets=Array.from({length:count},()=>ticket(`T${r.next++}`));
  });
}

io.on('connection',s=>{
  s.on('createRoom',({name},cb)=>{
    name=safeName(name); if(!name)return cb({ok:false,error:'Enter your name first.'});
    let id=rid(); while(rooms.has(id))id=rid();
    const r={id,hostId:s.id,players:new Map(),called:[],current:null,started:false,finished:false,next:1,
      winners:Object.fromEntries(cats.map(c=>[c,{playerId:null,playerName:null,ticketId:null}])),chat:[]};
    r.players.set(s.id,{id:s.id,name,tickets:[]}); rooms.set(id,r); s.join(id); cb({ok:true,roomId:id}); emit(r);
  });

  s.on('joinRoom',({roomId,name},cb)=>{
    const r=rooms.get(String(roomId||'').trim().toUpperCase()); name=safeName(name);
    if(!r)return cb({ok:false,error:'Room not found.'});
    if(!name)return cb({ok:false,error:'Enter your name first.'});
    if([...r.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return cb({ok:false,error:'That name is already in this room. Choose another name.'});
    r.players.set(s.id,{id:s.id,name,tickets:[]}); s.join(r.id); cb({ok:true,roomId:r.id}); emit(r);
  });

  s.on('host:addTickets',({roomId,playerId,count},cb)=>{
    const r=rooms.get(roomId); if(!r||r.hostId!==s.id)return cb({ok:false,error:'Host only.'});
    const p=r.players.get(playerId); if(!p)return cb({ok:false,error:'Player not found.'});
    const n=Math.max(1,Math.min(50,Number.parseInt(count,10)||1));
    for(let i=0;i<n;i++)p.tickets.push(ticket(`T${r.next++}`));
    emit(r); cb({ok:true});
  });

  s.on('host:removeTicket',({roomId,playerId},cb)=>{
    const r=rooms.get(roomId); if(!r||r.hostId!==s.id)return cb({ok:false,error:'Host only.'});
    const p=r.players.get(playerId); if(!p)return cb({ok:false,error:'Player not found.'});
    if(p.tickets.length<=1)return cb({ok:false,error:'Each player must keep at least one ticket.'});
    p.tickets.pop(); emit(r); cb({ok:true});
  });

  s.on('host:start',({roomId},cb)=>{
    const r=rooms.get(roomId);if(!r||r.hostId!==s.id)return cb({ok:false,error:'Host only.'});
    if([...r.players.values()].some(p=>p.tickets.length===0))return cb({ok:false,error:'Give every player at least one ticket first.'});
    r.started=true;r.finished=false;emit(r);cb({ok:true});
  });

  s.on('host:call',({roomId,number},cb)=>{
    const r=rooms.get(roomId);if(!r||r.hostId!==s.id)return cb({ok:false,error:'Host only.'});
    if(!r.started)return cb({ok:false,error:'Start the game first.'}); if(r.finished)return cb({ok:false,error:'Game is finished.'});
    const n=Number(number); if(!Number.isInteger(n)||n<1||n>90)return cb({ok:false,error:'Number must be 1 to 90.'});
    if(r.called.includes(n))return cb({ok:false,error:'That number was already called.'});
    r.called.push(n);r.current=n;emit(r);cb({ok:true,number:n});
  });

  // Full reset: new number sequence + fresh tickets for every player + clear marks/claims.
  s.on('host:reset',({roomId},cb)=>{
    const r=rooms.get(roomId);if(!r||r.hostId!==s.id)return cb({ok:false,error:'Host only.'});
    r.called=[];r.current=null;r.started=false;r.finished=false;
    r.winners=Object.fromEntries(cats.map(c=>[c,{playerId:null,playerName:null,ticketId:null}]));
    freshTicketsForPlayers(r);
    r.chat.push({name:'System',text:'The host started a new game. New tickets have been generated.',ts:Date.now()});
    emit(r);cb({ok:true});
  });

  s.on('mark',({roomId,ticketId,number},cb)=>{
    const r=rooms.get(roomId),p=r?.players.get(s.id),t=p?.tickets.find(x=>x.id===ticketId);
    if(!t)return cb({ok:false,error:'Ticket not found.'});
    const n=Number(number);
    if(!r.called.includes(n)||!t.grid.flat().includes(n))return cb({ok:false,error:'That number cannot be marked yet.'});
    if(!t.marks.includes(n))t.marks.push(n);else t.marks=t.marks.filter(x=>x!==n);
    emit(r);cb({ok:true});
  });

  s.on('claim',({roomId,ticketId,category},cb)=>{
    const r=rooms.get(roomId),p=r?.players.get(s.id),t=p?.tickets.find(x=>x.id===ticketId);
    if(!t||!cats.includes(category))return cb({ok:false,error:'Invalid claim.'});
    if(r.winners[category].playerId)return cb({ok:false,error:'That prize has already been claimed.'});
    if(!complete(t,category))return cb({ok:false,error:'Not eligible yet. Mark all required called numbers on your ticket first.'});
    r.winners[category]={playerId:s.id,playerName:p.name,ticketId};
    r.chat.push({name:'System',text:`${p.name} claimed ${category==='five'?'EARLY 5':category==='full'?'FULL HOUSE':category.toUpperCase()}`,ts:Date.now()});
    emit(r);cb({ok:true});
  });

  s.on('chat:send',({roomId,text},cb)=>{
    const r=rooms.get(roomId),p=r?.players.get(s.id); text=String(text||'').trim().slice(0,240);
    if(!r||!p||!text)return cb?.({ok:false,error:'Message cannot be empty.'});
    r.chat.push({name:p.name,text,ts:Date.now()}); emit(r); cb?.({ok:true});
  });

  s.on('finishGame',({roomId},cb)=>{const r=rooms.get(roomId);if(!r||r.hostId!==s.id)return cb({ok:false,error:'Host only.'});r.finished=true;emit(r);cb({ok:true})});

  s.on('disconnect',()=>{
    for(const r of rooms.values())if(r.players.delete(s.id)){
      if(r.hostId===s.id){const n=r.players.values().next().value;if(n)r.hostId=n.id;else{rooms.delete(r.id);continue}}
      emit(r);
    }
  });
});
const PORT=Number(process.env.PORT||3000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Tambola server running on port ${PORT}`));
