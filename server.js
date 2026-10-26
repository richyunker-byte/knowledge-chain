const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const app = express();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || true } });
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const MAX = 4, MIN = 2, TURN = 75, REVIEW = 18, ROUNDS = 2;
const AVATARS = ['🦊','🐼','🐸','🦉','🐢','🐙','🦄','🐝'];
const BANK = {
 Science: {
  opening:['The class garden had been quiet all week, until a tiny green shoot appeared beside the big sunflower.','Mina and Leo opened the science club box and found a schoolyard map with one mystery spot marked in gold.'],
  tasks:[['habitat','Use “habitat” and show how an animal finds what it needs.'],['evaporate','Include how water can evaporate when warmed by the sun.'],['gravity','Show gravity helping something fall or stay on the ground.'],['observe','Have a character observe a small clue in nature.'],['energy','Include one way a character gets or uses energy.'],['pollinate','Show how a bee can help a flower pollinate.'],['solid','Include a solid object and describe one property.'],['moon','Mention that the Moon reflects light from the Sun.']]
 },
 Math: {
  opening:['The town fair was about to open, but someone had mixed up all the game tickets and prizes.','A friendly robot rolled into class carrying a puzzle: “Can you help me share these 24 shiny buttons fairly?”'],
  tasks:[['equal','Use “equal” to compare two fair shares or groups.'],['fraction','Work a simple fraction, like one half, into the story.'],['multiply','Show a character multiplying equal groups to count faster.'],['perimeter','Include finding perimeter by adding the sides of a shape.'],['pattern','Describe a pattern and say what comes next.'],['estimate','Have someone estimate an amount before checking.'],['area','Show a character counting square tiles to find area.'],['divide','Share items equally between two or more friends.']]
 },
 'Language Arts': {
  opening:['At the library, a book fluttered open by itself to a page with a message written in purple ink.','Sam found a tiny envelope in a library book—and it was addressed to the whole class.'],
  tasks:[['curious','Use “curious” for a character who wants to learn something.'],['whisper','Use “whisper” in a sentence that moves the story along.'],['brilliant','Use “brilliant” to describe an idea or a bright light.'],['compare','Compare two things using “like” or “as.”'],['because','Explain why something happened using “because.”'],['discover','Let a character discover an unexpected clue.'],['predict','Have a character predict what might happen next.'],['gently','Use “gently” to show how something is handled.']]
 },
 'Social Studies': {
  opening:['The new neighborhood park was almost ready, but the neighbors still needed to choose a name together.','A hand-drawn map appeared on the community center door: “Let’s make this town even better!”'],
  tasks:[['community','Show neighbors working together to help their community.'],['map','Use a map to help a character find a place.'],['tradition','Include a tradition people celebrate together.'],['compass','Use north, south, east, or west for directions.'],['citizen','Show a citizen helping their town.'],['landmark','Include a recognizable landmark as a meeting place.'],['resource','Include a natural resource and how people use it.'],['cooperate','Have characters cooperate to solve a problem.']]
 }
};
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(_q,r)=>r.json({ok:true,rooms:rooms.size}));
app.get('*',(_q,r)=>r.sendFile(path.join(__dirname,'public','index.html')));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clean=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,18)||'Storyteller';
function snapshot(r){return {code:r.code,phase:r.phase,subject:r.subject,hostId:r.hostId,currentTurn:r.currentTurn,turnEndsAt:r.turnEndsAt,reviewEndsAt:r.reviewEndsAt,round:r.round,totalRounds:ROUNDS,opening:r.opening,challenge:r.challenge,story:r.story,players:[...r.players.values()].map(p=>({...p})),chat:r.chat.slice(-40),contribution:r.contribution,votes:r.contribution?Object.keys(r.contribution.votes).length:0,flags:r.contribution?Object.keys(r.contribution.flags).length:0};}
function emit(r){io.to(r.code).emit('state',snapshot(r));}
function say(r,msg){r.chat.push({id:Date.now()+Math.random(),...msg,at:Date.now()});r.chat=r.chat.slice(-60);}
function next(r){r.currentTurn++;beginTurn(r);}
function beginTurn(r){
 if(r.currentTurn>=r.order.length){r.currentTurn=0;if(r.round>=ROUNDS){r.phase='results';r.turnEndsAt=r.reviewEndsAt=null;emit(r);return;}r.round++;}
 const id=r.order[r.currentTurn]; if(!r.players.get(id)?.connected)return next(r);
 r.phase='turn';r.contribution=null;r.turnEndsAt=Date.now()+TURN*1000;r.reviewEndsAt=null;
 const [word,task]=pick(BANK[r.subject].tasks);r.challenge={word,task};emit(r);
}
function finishReview(r){if(!r||r.phase!=='review'||!r.contribution)return;const c=r.contribution;if(!c.scored){const votes=Object.keys(c.votes).length,flags=Object.keys(c.flags).length,p=r.players.get(c.playerId);if(p)p.score+=Math.max(0,2+votes-(flags?1:0));c.scored=true;}next(r);}
function start(r){if([...r.players.values()].filter(p=>p.connected).length<MIN||r.phase!=='lobby')return false;r.order=[...r.players.values()].filter(p=>p.connected).map(p=>p.id);r.opening=pick(BANK[r.subject].opening);r.story=[{id:'opening',playerId:null,avatar:'📖',name:'Story starter',text:r.opening,opening:true}];r.round=1;r.currentTurn=0;say(r,{system:true,text:`The story is starting! First up: ${r.players.get(r.order[0]).name}.`});beginTurn(r);return true;}
function addPlayer(socket,r,name,avatar){let p=r.players.get(socket.id);if(!p&&r.phase!=='lobby')return socket.emit('errorMessage','This story is already underway. Join the next one!');if(!p&&r.players.size>=MAX)return socket.emit('errorMessage','This room is full (4 players max).');p=p||{id:socket.id,score:0,connected:true,ready:false};p.name=clean(name||p.name);p.avatar=AVATARS.includes(avatar)?avatar:(p.avatar||pick(AVATARS));p.connected=true;r.players.set(socket.id,p);socket.join(r.code);socket.data.room=r.code;say(r,{system:true,text:`${p.name} joined the room.`});emit(r);socket.emit('joined',{code:r.code,playerId:socket.id});}
io.on('connection',s=>{
 s.on('createRoom',({name,avatar}={})=>{let code;do{code=Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('')}while(rooms.has(code));const r={code,phase:'lobby',subject:'Science',hostId:s.id,players:new Map(),chat:[],story:[],order:[],currentTurn:0,round:1,opening:'',challenge:null,turnEndsAt:null,reviewEndsAt:null,contribution:null};rooms.set(code,r);addPlayer(s,r,name,avatar);});
 s.on('joinRoom',({code,name,avatar}={})=>{const r=rooms.get(String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,''));if(!r)return s.emit('errorMessage','We couldn’t find that room. Check the code and try again.');addPlayer(s,r,name,avatar);});
 s.on('selectSubject',sub=>{const r=rooms.get(s.data.room);if(r&&r.hostId===s.id&&r.phase==='lobby'&&BANK[sub]){r.subject=sub;emit(r);}});
 s.on('startGame',()=>{const r=rooms.get(s.data.room);if(!r||r.hostId!==s.id)return;if([...r.players.values()].filter(p=>p.connected).length<MIN)return s.emit('errorMessage','Invite at least one more player to start.');start(r);});
 s.on('chat',raw=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id),text=String(raw||'').trim().slice(0,240);if(!r||!p||!text)return;say(r,{playerId:s.id,name:p.name,avatar:p.avatar,text});emit(r);});
 s.on('contribute',raw=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!r||!p||r.phase!=='turn'||r.order[r.currentTurn]!==s.id||r.contribution)return;const text=String(raw||'').trim().slice(0,420);if(text.length<8)return s.emit('errorMessage','Add a little more to your story (at least 8 characters).');if(text.split(/[.!?]+/).filter(x=>x.trim()).length>2)return s.emit('errorMessage','Keep it to one or two sentences so everyone gets a turn.');r.story.push({id:`story-${Date.now()}-${s.id}`,playerId:s.id,avatar:p.avatar,name:p.name,text});r.contribution={playerId:s.id,name:p.name,text,votes:{},flags:{},scored:false};r.phase='review';r.turnEndsAt=null;r.reviewEndsAt=Date.now()+REVIEW*1000;say(r,{system:true,text:`${p.name} added to the story. Give it a quick review!`});emit(r);});
 s.on('review',({vote}={})=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id),c=r?.contribution;if(!r||!p||r.phase!=='review'||!c||c.playerId===s.id||!['up','flag'].includes(vote)||c.votes[s.id]||c.flags[s.id])return;if(vote==='up')c.votes[s.id]=true;else c.flags[s.id]=true;if(Object.keys(c.votes).length+Object.keys(c.flags).length>=r.players.size-1)finishReview(r);else emit(r);});
 s.on('restart',()=>{const r=rooms.get(s.data.room);if(!r||r.hostId!==s.id||r.phase!=='results')return;r.phase='lobby';r.story=[];r.order=[];r.currentTurn=0;r.round=1;r.opening='';r.challenge=null;r.contribution=null;r.turnEndsAt=r.reviewEndsAt=null;for(const p of r.players.values())p.score=0;say(r,{system:true,text:'A new story is ready. Choose a subject and invite everyone back in!'});emit(r);});
 s.on('disconnect',()=>{const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!r||!p)return;p.connected=false;if(r.hostId===s.id){const nextP=[...r.players.values()].find(x=>x.connected);if(nextP)r.hostId=nextP.id;}say(r,{system:true,text:`${p.name} lost connection.`});if(r.phase==='turn'&&r.order[r.currentTurn]===s.id){r.phase='review';r.contribution={playerId:s.id,name:p.name,text:'This storyteller lost connection. Their turn was skipped.',votes:{},flags:{},scored:true};r.story.push({id:`skip-${Date.now()}`,playerId:s.id,avatar:p.avatar,name:p.name,text:'This storyteller lost connection, so their turn was skipped.'});r.reviewEndsAt=Date.now()+3000;r.turnEndsAt=null;}emit(r);});
});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){if(r.phase==='turn'&&r.turnEndsAt<=now){const p=r.players.get(r.order[r.currentTurn]);if(p){const text='The clock ran out, so the story will keep going from here!';r.story.push({id:`timeout-${now}`,playerId:p.id,avatar:p.avatar,name:p.name,text});r.contribution={playerId:p.id,name:p.name,text,votes:{},flags:{},scored:true};r.phase='review';r.turnEndsAt=null;r.reviewEndsAt=now+3000;}emit(r);}else if(r.phase==='review'&&r.reviewEndsAt<=now)finishReview(r);}},250).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Knowledge Chain is ready on port ${PORT}`));





