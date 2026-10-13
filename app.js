import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
const $=id=>document.getElementById(id), STORE='chessmemo_v1', AUTH='chessmemo_auth', TZ='Europe/Rome', START_DATE='2026-10-13', START_MS=Date.parse('2026-10-12T22:00:00Z');
let solverColor='w'; let db=load(), token=sessionStorage.getItem(AUTH)||'', account='', session=[], current=null, chess=null, selected=null, step=0, hadError=false, finished=false, unveiled=false;
function load(){try{return JSON.parse(localStorage.getItem(STORE))||{items:{},attempts:[],lastSync:0}}catch{return {items:{},attempts:[],lastSync:0}}}
function save(){localStorage.setItem(STORE,JSON.stringify(db));refresh()}
function dateISO(t=Date.now()){return new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(t)}
function weekday(){return new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:TZ}).format(new Date())}
function plusDays(n){return dateISO(Date.now()+n*86400000)}
function all(){return Object.values(db.items)}
function dueItems(){return all().filter(x=>!x.next||x.next<=dateISO()).sort((a,b)=>(a.next||'').localeCompare(b.next||'')||b.level-a.level||b.rating-a.rating)}
function notice(msg,bad=false){$('notice').textContent=msg;$('notice').className='info '+(bad?'err':'ok')}
function refresh(){const arr=all(),due=dueItems();$('count').textContent=arr.length;$('due').textContent=due.length;$('accuracy').textContent=db.attempts.length?Math.round(db.attempts.filter(a=>a.correct).length/db.attempts.length*100)+'%':'—';$('dayBadge').textContent=weekday()==='Sat'?'Sabato: ripasso':'Ripasso il sabato';$('start').disabled=weekday()!=='Sat'||due.length===0;$('preview').disabled=due.length===0;$('weeklyDescription').textContent=`${Math.min(30,due.length)} problemi pronti per il ripasso (massimo 30).`;
 $('list').replaceChildren();if(!arr.length){$('list').textContent='Nessun problema salvato.';return}arr.sort((a,b)=>b.added-a.added).slice(0,100).forEach(item=>{const row=document.createElement('div');row.className='item';const info=document.createElement('div');const link=document.createElement('a');link.href='https://lichess.org/training/'+encodeURIComponent(item.id);link.target='_blank';link.rel='noopener';link.textContent='#'+item.id;const sub=document.createElement('div');sub.className='sub';sub.textContent=`Lichess ${item.rating||'?'} · indice ${item.level}/5 · prossimo ${item.next||'oggi'}`;info.append(link,sub);const btn=document.createElement('button');btn.className='btn secondary';btn.textContent='Ripassa';btn.onclick=()=>begin([item]);row.append(info,btn);$('list').append(row)});if(arr.length>100){const t=document.createElement('p');t.className='note';t.textContent='Mostrati i 100 più recenti; tutti gli altri rimangono salvati.';$('list').append(t)}}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')}
async function login(){if(location.protocol==='file:'){notice('Pubblica ChessMemo su un indirizzo HTTPS prima di collegare Lichess.',true);return}const verifier=b64url(crypto.getRandomValues(new Uint8Array(32)));const state=b64url(crypto.getRandomValues(new Uint8Array(16)));const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));sessionStorage.setItem('cm_pkce',JSON.stringify({verifier,state}));const q=new URLSearchParams({response_type:'code',client_id:'chessmemo-ipad',redirect_uri:location.origin+location.pathname,scope:'puzzle:read',code_challenge:b64url(new Uint8Array(digest)),code_challenge_method:'S256',state});location.href='https://lichess.org/oauth?'+q}
async function callback(){const params=new URLSearchParams(location.search),code=params.get('code'),error=params.get('error');if(error){notice('Accesso Lichess annullato: '+error,true);history.replaceState(null,'',location.pathname);return}if(!code)return;history.replaceState(null,'',location.pathname);const v=JSON.parse(sessionStorage.getItem('cm_pkce')||'null');sessionStorage.removeItem('cm_pkce');if(!v||params.get('state')!==v.state){notice('Verifica di sicurezza non riuscita. Riprova il collegamento.',true);return}try{const res=await fetch('https://lichess.org/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:v.verifier,client_id:'chessmemo-ipad',redirect_uri:location.origin+location.pathname})});if(!res.ok)throw Error('Autorizzazione: '+res.status);const json=await res.json();token=json.access_token;sessionStorage.setItem(AUTH,token);await identify();await sync()}catch(e){notice('Collegamento non riuscito: '+e.message,true)}}
async function identify(){if(!token)return;try{const r=await fetch('https://lichess.org/api/account',{headers:{Authorization:'Bearer '+token}});if(r.status===401)throw Error('Autorizzazione scaduta');if(!r.ok)throw Error('Errore '+r.status);const data=await r.json();account=data.username||data.id||'';$('connection').textContent='Lichess collegato';$('username').textContent=account;$('login').classList.add('hidden');$('sync').classList.remove('hidden');$('logout').classList.remove('hidden')}catch(e){notice(e.message,true)}}
function ingest(obj){if(!obj||!Number.isFinite(Number(obj.date))||Number(obj.date)<START_MS||obj.win!==false||!obj.puzzle||!obj.puzzle.id)return false;const p=obj.puzzle,id=p.id;const prev=db.items[id];const item=prev||{id,added:obj.date||Date.now(),level:3,reps:0,failures:0,next:dateISO()};item.rating=p.rating||item.rating||0;item.fen=p.fen||item.fen;item.solution=p.solution||item.solution;item.themes=p.themes||item.themes||[];item.lastFailed=Math.max(obj.date||0,item.lastFailed||0);if(!prev)item.level=Math.max(2,Math.min(5,Math.ceil((item.rating-900)/350)));db.items[id]=item;return !prev}
async function sync(){if(!token)return; $('sync').disabled=true;notice('Importazione della cronologia Lichess in corso…');try{let before=Date.now()+60000, imported=0,scanned=0,stop=false;const since=Math.max(START_MS,db.lastSync?db.lastSync-86400000:START_MS);for(let page=0;page<30&&!stop;page++){const q=new URLSearchParams({max:'250',before:String(before)});q.set('since',String(since));const r=await fetch('https://lichess.org/api/puzzle/activity?'+q,{headers:{Authorization:'Bearer '+token,Accept:'application/x-ndjson'}});if(!r.ok)throw Error('Lichess ha risposto '+r.status);const lines=(await r.text()).trim().split('\n').filter(Boolean);if(!lines.length)break;let earliest=before;for(const line of lines){const a=JSON.parse(line);scanned++;if(ingest(a))imported++;if(a.date)earliest=Math.min(earliest,a.date)}if(lines.length<250||earliest>=before)stop=true;else before=earliest-1;}db.lastSync=Date.now();save();notice(`Sincronizzati ${scanned} tentativi; ${imported} nuovi problemi sbagliati salvati.`)}catch(e){save();notice('Sincronizzazione interrotta: '+e.message+'; puoi riprovare.',true)}finally{$('sync').disabled=false}}
async function addManual(){const v=$('manualUrl').value.trim(),m=v.match(/(?:lichess\.org\/training\/)?([A-Za-z0-9]{4,12})(?:[/?#].*)?$/);if(!m){notice('Inserisci un link valido a un problema Lichess.',true);return}const id=m[1];try{const r=await fetch('https://lichess.org/api/puzzle/'+encodeURIComponent(id));if(!r.ok)throw Error('Problema non trovato');const data=await r.json(),p=data.puzzle;if(!p?.fen||!p?.solution)throw Error('Dati del problema incompleti');if(!db.items[id]){db.items[id]={id,added:Date.now(),level:3,reps:0,failures:0,next:dateISO(),rating:p.rating,fen:p.fen,solution:p.solution,themes:p.themes||[]};save()}$('manualUrl').value='';notice('Problema #'+id+' aggiunto.')}catch(e){notice('Impossibile aggiungere: '+e.message,true)}}
function begin(items){session=items?items.slice():dueItems().slice(0,30);if(!session.length){notice('Non ci sono problemi da ripassare.');return}$('review').classList.remove('hidden');openPuzzle();$('review').scrollIntoView({behavior:'smooth'})}
function openPuzzle(){if(!session.length){$('review').classList.add('hidden');notice('Sessione completata!');refresh();return}current=session[0];step=0;selected=null;hadError=false;finished=false;unveiled=false;try{chess=new Chess(current.fen);solverColor=getColor()}catch{notice('Posizione non valida per #'+current.id,true);session.shift();openPuzzle();return}$('progress').textContent=`Problema ${Math.min(30,1+(Number($('progress').dataset.done)||0))} · #${current.id}`;$('rating').textContent='Lichess '+(current.rating||'?');$('personal').textContent='Indice '+current.level+'/5';$('feedback').textContent='Trova la continuazione migliore. Tocca un pezzo e poi la casella di arrivo.';$('feedback').className='info';$('retry').classList.add('hidden');$('next').classList.add('hidden');$('solution').classList.remove('hidden');$('lichessLink').href='https://lichess.org/training/'+encodeURIComponent(current.id);draw()}
const PIECE_URLS={
  wk:'https://lichess1.org/assets/piece/cburnett/wK.svg',
  wq:'https://lichess1.org/assets/piece/cburnett/wQ.svg',
  wr:'https://lichess1.org/assets/piece/cburnett/wR.svg',
  wb:'https://lichess1.org/assets/piece/cburnett/wB.svg',
  wn:'https://lichess1.org/assets/piece/cburnett/wN.svg',
  wp:'https://lichess1.org/assets/piece/cburnett/wP.svg',
  bk:'https://lichess1.org/assets/piece/cburnett/bK.svg',
  bq:'https://lichess1.org/assets/piece/cburnett/bQ.svg',
  br:'https://lichess1.org/assets/piece/cburnett/bR.svg',
  bb:'https://lichess1.org/assets/piece/cburnett/bB.svg',
  bn:'https://lichess1.org/assets/piece/cburnett/bN.svg',
  bp:'https://lichess1.org/assets/piece/cburnett/bP.svg'
};
const FALLBACK_SYMBOLS={w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
function pieceImgSrc(piece){return PIECE_URLS[piece.color+piece.type]||''}
function makePieceNode(piece){
  const img=document.createElement('img');
  img.className='piece-img';
  img.src=pieceImgSrc(piece);
  img.alt='';
  img.draggable=false;
  img.loading='eager';
  img.onerror=()=>{
    const span=document.createElement('span');
    span.className='piece '+(piece.color==='w'?'whitepiece':'blackpiece');
    span.textContent=FALLBACK_SYMBOLS[piece.color][piece.type];
    img.replaceWith(span);
  };
  return img;
}

// Simple synthesized sounds inspired by chess interfaces; no external audio files.
const SOUND_PREF='chessmemo_sound_enabled';
let soundEnabled=localStorage.getItem(SOUND_PREF)!=='false';
let audioContext=null;
function playSound(kind='move'){
  if(!soundEnabled)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    if(!audioContext)audioContext=new AC();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const now=audioContext.currentTime;
    const cues={
      move:[[660,0,.065],[460,.07,.065]],
      capture:[[350,0,.095],[245,.065,.11]],
      wrong:[[190,0,.10],[150,.10,.12]],
      correct:[[520,0,.065],[780,.085,.11]]
    };
    for(const [hz,offset,duration] of cues[kind]||cues.move){
      const osc=audioContext.createOscillator();
      const gain=audioContext.createGain();
      osc.type='triangle';
      osc.frequency.setValueAtTime(hz,now+offset);
      gain.gain.setValueAtTime(0.0001,now+offset);
      gain.gain.exponentialRampToValueAtTime(0.085,now+offset+.008);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+duration);
      osc.connect(gain);gain.connect(audioContext.destination);
      osc.start(now+offset);osc.stop(now+offset+duration+.01);
    }
  }catch(e){/* Sound should never interfere with chess moves. */}
}
function updateSoundButton(){
  const button=$('soundToggle');
  if(button){
    button.textContent=soundEnabled?'🔊 Suoni attivi':'🔇 Suoni disattivati';
    button.setAttribute('aria-pressed',String(soundEnabled));
  }
}
function draw(){const el=$('board');el.replaceChildren();const userColor=solverColor;const ranks=userColor==='w'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];const files=userColor==='w'?'abcdefgh':'hgfedcba';for(const rank of ranks)for(const file of files){const sq=file+rank,p=chess.get(sq),button=document.createElement('button');button.className='sq '+(((files.indexOf(file)+ranks.indexOf(rank))%2===0)?'light':'dark')+(sq===selected?' sel':'');button.setAttribute('aria-label',sq+(p?' '+p.type:''));if(p){button.append(makePieceNode(p))}if(selected&&chess.moves({square:selected,verbose:true}).some(m=>m.to===sq))button.classList.add('hint');button.onclick=()=>tap(sq);el.append(button)}$('turn').textContent=userColor==='w'?'Giochi con i bianchi':'Giochi con i neri'}
function getColor(){const f=current.solution?.[0]?.slice(0,2);const p=f?chess.get(f):null;return p?.color||(current.fen.split(' ')[1]||'w')}
function tap(sq){if(finished||unveiled||!chess||step>=current.solution.length)return;const piece=chess.get(sq);if(!selected){if(piece&&piece.color===chess.turn()){selected=sq;draw()}return}if(piece&&piece.color===chess.turn()&&sq!==selected){selected=sq;draw();return}const from=selected;selected=null;const wanted=current.solution[step];let move;try{move=chess.move({from,to:sq,promotion:wanted.length>4?wanted[4]:'q'})}catch{move=null}if(!move){draw();return}const uci=move.from+move.to+(move.promotion||'');if(uci!==wanted){hadError=true;chess.undo();playSound('wrong');$('feedback').textContent='Mossa non corretta. Puoi riprovare oppure vedere la soluzione.';$('feedback').className='info err';$('retry').classList.remove('hidden');draw();return}step++;playSound(move.captured?'capture':'move');$('feedback').textContent='Mossa corretta!';$('feedback').className='info ok';draw();if(step>=current.solution.length){playSound('correct');finish(!hadError);return}setTimeoutSafe(()=>{if(finished||unveiled)return;const reply=current.solution[step];try{const replyMove=chess.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]||'q'});step++;playSound(replyMove.captured?'capture':'move');draw();if(step>=current.solution.length){playSound('correct');finish(!hadError)}}catch{notice('Impossibile riprodurre una mossa del problema.',true)}},450)}
function setTimeoutSafe(fn,ms){setTimeout(fn,ms)}
function finish(correct){if(finished)return;finished=true;const p=current;p.reps=(p.reps||0)+1;if(!correct)p.failures=(p.failures||0)+1;p.level=Math.max(1,Math.min(5,p.level+(correct?-1:1)));const intervals=[1,2,5,14,30];const days=correct?intervals[Math.max(0,4-p.level)]:1;p.next=plusDays(days);db.attempts.push({id:p.id,date:Date.now(),correct});save();$('feedback').textContent=correct?'Risolto al primo tentativo. Ottimo!':'Registrato come problema difficile. Sarà riproposto presto.';$('feedback').className='info '+(correct?'ok':'err');$('next').classList.remove('hidden');$('solution').classList.add('hidden');$('retry').classList.add('hidden')}
function showSolution(){if(!current||finished)return;hadError=true;unveiled=true;try{chess=new Chess(current.fen);for(const u of current.solution){chess.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||'q'})}draw()}catch{}finish(false);$('feedback').textContent='Soluzione: '+current.solution.map(m=>m.slice(0,2)+'–'+m.slice(2,4)).join(' · ')+'. Registrato come errore.';$('feedback').className='info err'}
$('soundToggle').onclick=()=>{soundEnabled=!soundEnabled;localStorage.setItem(SOUND_PREF,String(soundEnabled));updateSoundButton();if(soundEnabled)playSound('move')};updateSoundButton();
$('login').onclick=login;$('sync').onclick=sync;$('logout').onclick=()=>{sessionStorage.removeItem(AUTH);token='';account='';$('connection').textContent='Lichess non collegato';$('username').textContent='Dati già salvati sul dispositivo';$('login').classList.remove('hidden');$('sync').classList.add('hidden');$('logout').classList.add('hidden');notice('Account scollegato. Archivio locale conservato.')};$('manualAdd').onclick=addManual;$('start').onclick=()=>{ $('progress').dataset.done='0';begin()};$('preview').onclick=()=>{$('progress').dataset.done='0';begin()};$('retry').onclick=()=>{$('feedback').textContent='Riprova dalla posizione iniziale. Il primo errore rimane registrato.';chess=new Chess(current.fen);step=0;selected=null;$('retry').classList.add('hidden');draw()};$('solution').onclick=showSolution;$('next').onclick=()=>{session.shift();$('progress').dataset.done=String((Number($('progress').dataset.done)||0)+1);openPuzzle()};$('stop').onclick=()=>{$('review').classList.add('hidden');session=[];refresh()};$('export').onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ChessMemo-'+dateISO()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!obj.items||typeof obj.items!=='object'||!Array.isArray(obj.attempts))throw Error('Formato non valido');db={items:{...db.items,...obj.items},attempts:[...db.attempts,...obj.attempts],lastSync:Math.max(db.lastSync||0,obj.lastSync||0)};save();notice('Archivio importato correttamente.')}catch(err){notice('Importazione fallita: '+err.message,true)}e.target.value=''};
refresh();const wasCallback=new URLSearchParams(location.search).has('code');await callback();if(token&&!wasCallback){await identify();await sync()}
