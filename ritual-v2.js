/* Ritual v3 stability layer — local profile, share cards, notification controls.
   Zero backend, zero paid services. Designed to be safe on Android, PWA, and offline web.
   Important: enhancement rendering is idempotent so its MutationObserver can never self-trigger forever. */
(function () {
  'use strict';

  var PROFILE_KEY = 'ritual.profile.v2';
  var REMINDER_KEY = 'ritual.reminders.v2';
  var lastReminderMinute = '';

  function safeCryptoId(prefix) {
    try {
      if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
      }
    } catch (e) {}
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function getState() {
    try { return JSON.parse(localStorage.getItem('ritual.v1') || 'null') || {}; }
    catch (e) { return {}; }
  }

  function saveStatePatch(patch) {
    var s = getState();
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    localStorage.setItem('ritual.v1', JSON.stringify(s));
  }

  function getProfile() {
    try {
      var p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      if (p) return p;
    } catch (e) {}
    return { id: safeCryptoId('p'), name: '', bio: '', avatar: '', createdAt: new Date().toISOString() };
  }

  function setProfile(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    saveStatePatch({ profile: p });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
    });
  }

  function dateKey(d) {
    var x = d || new Date();
    var y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, '0'), day = String(x.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function shiftDate(key, delta) {
    var p = key.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + delta);
    return dateKey(d);
  }

  function stats() {
    var s = getState(), logs = s.log || {}, habits = Array.isArray(s.habits) ? s.habits : [];
    var total = 0, days = {};
    Object.keys(logs).forEach(function (day) {
      var row = logs[day] || {};
      Object.keys(row).forEach(function (id) {
        if (row[id]) { total++; days[day] = true; }
      });
    });

    var today = dateKey(), cur = 0, k = today;
    while (days[k]) { cur++; k = shiftDate(k, -1); }

    var best = 0, run = 0, last = null;
    Object.keys(days).sort().forEach(function (d) {
      if (last && shiftDate(last, 1) === d) run++; else run = 1;
      if (run > best) best = run;
      last = d;
    });

    var scheduled = 0, completed30 = 0;
    var active = habits.filter(function (h) { return h && !h.archived; });
    for (var i = 0; i < 30; i++) {
      var dk = shiftDate(today, -i), row30 = logs[dk] || {};
      active.forEach(function (h) {
        var dow = new Date(dk + 'T12:00:00').getDay();
        var daysArr = Array.isArray(h.days) ? h.days : [0,1,2,3,4,5,6];
        if (daysArr.indexOf(dow) >= 0) {
          scheduled++;
          if (row30[h.id]) completed30++;
        }
      });
    }
    return {
      total: total,
      current: cur,
      best: best,
      consistency: scheduled ? Math.round(completed30 / scheduled * 100) : 0,
      habits: active.length
    };
  }

  function avatarMarkup(p, size) {
    var label = (p.name || 'R').trim().slice(0, 1).toUpperCase();
    var cls = size === 'large' ? 'ritual-avatar large' : 'ritual-avatar';
    return p.avatar
      ? '<img class="' + cls + '" src="' + escapeHtml(p.avatar) + '" alt="">'
      : '<div class="' + cls + '" aria-hidden="true">' + escapeHtml(label) + '</div>';
  }

  function injectStyles() {
    if (document.getElementById('ritual-v2-style')) return;
    var st = document.createElement('style');
    st.id = 'ritual-v2-style';
    st.textContent = `
      .ritual-v2-profile{background:linear-gradient(145deg,var(--surface),var(--surface2));border:1px solid var(--line);border-radius:22px;padding:18px;margin-bottom:16px}
      .ritual-v2-head{display:flex;align-items:center;gap:13px}
      .ritual-avatar{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink);font:700 19px var(--font-d);object-fit:cover;box-shadow:0 8px 20px rgba(0,0,0,.16)}
      .ritual-avatar.large{width:76px;height:76px;border-radius:22px;font-size:28px}
      .ritual-v2-name{font:700 21px/1.1 var(--font-d)}
      .ritual-v2-bio{color:var(--muted);font-size:12.5px;margin-top:4px}
      .ritual-v2-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
      .ritual-v2-actions button{min-height:44px}
      .ritual-v2-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}
      .ritual-v2-stat{background:var(--bg);border-radius:13px;padding:10px 6px;text-align:center}
      .ritual-v2-stat b{display:block;font:700 19px var(--font-d)}
      .ritual-v2-stat span{font-size:9.5px;color:var(--muted)}
      .ritual-v2-perm{margin-top:12px;padding:12px;border-radius:14px;background:var(--bg);border:1px solid var(--line);font-size:12px}
      .ritual-challenge{position:relative;overflow:hidden;margin:0 0 16px;padding:18px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,var(--surface),var(--surface2));box-shadow:0 16px 42px rgba(0,0,0,.16)}
      .ritual-challenge:before{content:"";position:absolute;width:190px;height:190px;right:-82px;top:-76px;border-radius:50%;border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);box-shadow:0 0 0 22px color-mix(in srgb,var(--accent) 5%,transparent),0 0 0 48px color-mix(in srgb,var(--accent) 3%,transparent)}
      .ritual-challenge-top{position:relative;z-index:2;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .ritual-challenge-kicker{font:700 10px/1 var(--font-m);letter-spacing:.15em;color:var(--accent);text-transform:uppercase}
      .ritual-challenge-title{font:800 25px/.98 var(--font-d);letter-spacing:-.035em;margin-top:7px}
      .ritual-challenge-sub{font-size:12px;color:var(--muted);line-height:1.4;margin-top:7px;max-width:270px}
      .ritual-challenge-badge{padding:7px 9px;border-radius:10px;background:var(--accent);color:var(--accent-ink);font:800 9px var(--font-m);white-space:nowrap}
      .ritual-challenge-grid{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:15px}
      .ritual-challenge-stat{background:color-mix(in srgb,var(--bg) 68%,transparent);border:1px solid color-mix(in srgb,var(--line) 80%,transparent);border-radius:13px;padding:10px 7px}
      .ritual-challenge-stat b{display:block;font:800 19px var(--font-d)}
      .ritual-challenge-stat span{display:block;margin-top:3px;color:var(--muted);font-size:9.5px}
      .ritual-challenge-track{position:relative;z-index:2;height:8px;border-radius:99px;background:color-mix(in srgb,var(--fg) 9%,transparent);overflow:hidden;margin-top:13px}
      .ritual-challenge-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),#E9FFB6)}
      .ritual-challenge-foot{position:relative;z-index:2;display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:9px}
      .ritual-challenge-foot span{font:700 10px var(--font-m);color:var(--muted)}
      .ritual-challenge-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;position:relative;z-index:2}
      .ritual-challenge-actions button{min-height:42px}
      .ritual-recap{position:relative;overflow:hidden;margin-top:14px;padding:18px;border-radius:22px;background:#101612;color:#F4F5F1;border:1px solid #2A352E}
      .ritual-recap:after{content:"";position:absolute;width:170px;height:170px;right:-70px;top:-85px;border-radius:50%;border:1px solid rgba(183,243,107,.18);box-shadow:0 0 0 24px rgba(183,243,107,.04),0 0 0 48px rgba(183,243,107,.025)}
      .ritual-recap-title{font:800 23px/1 var(--font-d);letter-spacing:-.03em;position:relative;z-index:2}
      .ritual-recap-sub{font-size:12px;color:#9BA69F;line-height:1.45;margin-top:6px;position:relative;z-index:2}
      .ritual-recap-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px;position:relative;z-index:2}
      .ritual-recap-stat{padding:11px;border-radius:14px;background:#18211C}
      .ritual-recap-stat b{display:block;font:800 21px var(--font-d)}
      .ritual-recap-stat span{font-size:9.5px;color:#8D9991}
      .ritual-recap-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;position:relative;z-index:2}
      .ritual-recap-actions button{min-height:42px}
      @media(max-width:420px){.ritual-challenge-grid{grid-template-columns:repeat(3,1fr)}.ritual-challenge-stat b{font-size:17px}}
      .ritual-hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:8px;align-items:stretch;overflow:hidden;margin-bottom:16px;padding:20px;border:1px solid var(--line);border-radius:24px;background:radial-gradient(circle at 82% 24%,rgba(183,243,107,.16),transparent 32%),linear-gradient(145deg,#111713,#0D120F 68%,#182319);box-shadow:0 14px 38px rgba(0,0,0,.18)}
      .ritual-hero:after{content:"";position:absolute;inset:auto -35px -55px auto;width:170px;height:170px;border-radius:50%;border:1px solid rgba(183,243,107,.16);box-shadow:0 0 0 24px rgba(183,243,107,.035),0 0 0 48px rgba(183,243,107,.02);pointer-events:none}
      .ritual-hero-copy{position:relative;z-index:2;min-width:0;display:flex;flex-direction:column;justify-content:center}
      .ritual-hero-kicker{font:700 10px/1 var(--font-m);letter-spacing:.16em;color:var(--accent);text-transform:uppercase;margin-bottom:8px}
      .ritual-hero-title{font:800 clamp(24px,7vw,34px)/.98 var(--font-d);letter-spacing:-.035em}
      .ritual-hero-sub{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.45;max-width:260px}
      .ritual-hero-progress{height:7px;margin-top:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
      .ritual-hero-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),#E7FFB5);transition:width .35s ease}
      .ritual-hero-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .ritual-hero-chip{padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07);font:700 10px var(--font-m);color:var(--fg)}
      .ritual-hero-character{position:relative;z-index:2;display:grid;place-items:center;min-width:0}
      .ritual-hero-character svg{width:128px;height:170px;display:block;filter:drop-shadow(0 18px 20px rgba(0,0,0,.3))}
      .ritual-hero-level{position:absolute;right:5px;top:3px;padding:6px 8px;border-radius:9px;background:var(--accent);color:var(--accent-ink);font:800 9px var(--font-m);letter-spacing:.06em}
      .ritual-v2-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:18px}
      .ritual-v2-modal[hidden]{display:none}
      .ritual-v2-dialog{width:min(100%,390px);max-height:90dvh;overflow:auto;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:24px;padding:20px}
      .ritual-v2-dialog h2{font:700 24px var(--font-d);margin:0 0 16px}
      .ritual-v2-field{display:grid;gap:7px;margin-bottom:12px}
      .ritual-v2-field label{font-size:12px;color:var(--muted);font-weight:600}
      .ritual-v2-field input,.ritual-v2-field textarea,.ritual-v2-field select{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--fg);border-radius:12px;padding:11px}
      .ritual-v2-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
      .ritual-v2-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1200;background:var(--fg);color:var(--bg);padding:10px 14px;border-radius:12px;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
      @media(max-width:480px){.ritual-v2-modal{padding:12px}.ritual-v2-dialog{border-radius:20px}}
    `;
    document.head.appendChild(st);
  }

  function toast(msg) {
    var old = document.querySelector('.ritual-v2-toast'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'ritual-v2-toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function(){el.remove();}, 2200);
  }

  function openModal(html) {
    var old = document.getElementById('ritual-v2-modal'); if (old) old.remove();
    var wrap = document.createElement('div'); wrap.id='ritual-v2-modal'; wrap.className='ritual-v2-modal';
    wrap.innerHTML='<div class="ritual-v2-dialog" role="dialog" aria-modal="true">'+html+'</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click',function(e){if(e.target===wrap)wrap.remove();});
    return wrap;
  }

  function refreshEnhancementCard() {
    var view = document.getElementById('view');
    var existing = view && view.querySelector('.ritual-v2-profile');
    if (existing) existing.remove();
    renderEnhancement();
  }

  function editProfile() {
    var p=getProfile();
    var modal=openModal(
      '<h2>Your profile</h2>'+
      '<div style="display:flex;justify-content:center;margin-bottom:16px">'+avatarMarkup(p,'large')+'</div>'+
      '<div class="ritual-v2-field"><label for="rv-name">Display name</label><input id="rv-name" maxlength="40" value="'+escapeHtml(p.name)+'" placeholder="Your name"></div>'+
      '<div class="ritual-v2-field"><label for="rv-bio">Tagline (optional)</label><input id="rv-bio" maxlength="80" value="'+escapeHtml(p.bio)+'" placeholder="Small habits. Kept daily."></div>'+
      '<div class="ritual-v2-field"><label for="rv-avatar">Avatar image URL (optional)</label><input id="rv-avatar" value="'+escapeHtml(p.avatar)+'" placeholder="https://..."></div>'+
      '<p class="small muted">Your profile is stored on this device. No account or server is required.</p>'+
      '<div class="ritual-v2-dialog-actions"><button class="btn ghost" data-rv-close>Cancel</button><button class="btn" data-rv-save>Save profile</button></div>'
    );
    modal.querySelector('[data-rv-close]').onclick=function(){modal.remove();};
    modal.querySelector('[data-rv-save]').onclick=function(){
      p.name=modal.querySelector('#rv-name').value.trim();
      p.bio=modal.querySelector('#rv-bio').value.trim();
      p.avatar=modal.querySelector('#rv-avatar').value.trim();
      if(!p.name){toast('Add a display name');return;}
      p.updatedAt=new Date().toISOString();
      setProfile(p);
      modal.remove();
      refreshEnhancementCard();
      toast('Profile saved');
    };
  }

  function requestNotifications() {
    if (!('Notification' in window)) { toast('Notifications are not supported in this browser'); return; }
    Notification.requestPermission().then(function(permission){
      if(permission==='granted'){
        try { new Notification('Ritual reminders enabled', {body:'Ritual can now remind you while the app is open.'}); } catch(e){}
        toast('Notifications enabled');
      } else toast('Notification permission was not granted');
      refreshEnhancementCard();
    }).catch(function(){ toast('Notification permission request failed'); });
  }

  function reminderSettings() {
    var r={enabled:false,time:'20:00'};
    try{r=Object.assign(r,JSON.parse(localStorage.getItem(REMINDER_KEY)||'{}'));}catch(e){}
    var perm=('Notification' in window)?Notification.permission:'unsupported';
    var modal=openModal(
      '<h2>Reminders</h2>'+
      '<p class="small muted" style="margin-bottom:14px">Ritual uses the platform notification system. No account, server, or paid notification service is required.</p>'+
      '<div class="ritual-v2-field"><label for="rv-time">Daily reminder time</label><input id="rv-time" type="time" value="'+escapeHtml(r.time)+'"></div>'+
      '<label style="display:flex;gap:9px;align-items:center;margin:10px 0;font-size:13px"><input id="rv-enabled" type="checkbox" '+(r.enabled?'checked':'')+'> Enable daily reminder</label>'+
      '<div class="ritual-v2-perm"><b>Permission:</b> '+escapeHtml(perm)+
      (perm!=='granted'?'<br><button class="btn subtle" data-rv-perm style="margin-top:9px">Allow notifications</button>':'')+
      '</div>'+
      '<p class="small muted" style="margin-top:12px">Background delivery depends on the platform. While Ritual is open, the local reminder check is reliable.</p>'+
      '<div class="ritual-v2-dialog-actions"><button class="btn ghost" data-rv-close>Cancel</button><button class="btn" data-rv-save>Save</button></div>'
    );
    var permBtn=modal.querySelector('[data-rv-perm]'); if(permBtn) permBtn.onclick=requestNotifications;
    modal.querySelector('[data-rv-close]').onclick=function(){modal.remove();};
    modal.querySelector('[data-rv-save]').onclick=function(){
      r.time=modal.querySelector('#rv-time').value||'20:00'; r.enabled=modal.querySelector('#rv-enabled').checked;
      localStorage.setItem(REMINDER_KEY,JSON.stringify(r)); modal.remove(); toast('Reminder settings saved');
    };
  }

  function currentAchievement(st) {
    if(st.current>=365)return '365 Day Streak';
    if(st.current>=100)return '100 Day Streak';
    if(st.current>=30)return '30 Day Streak';
    if(st.current>=14)return '14 Day Streak';
    if(st.current>=7)return '7 Day Streak';
    if(st.total>=100)return '100 Check-ins';
    if(st.total>=50)return '50 Check-ins';
    if(st.total>=1)return 'First Check-in';
    return 'Day One';
  }

  function shareAchievement() {
    var p=getProfile(), st=stats(), title=currentAchievement(st);
    var canvas=document.createElement('canvas'), W=1080,H=1350; canvas.width=W;canvas.height=H;
    var c=canvas.getContext('2d');
    if (!c) { toast('Achievement card is not supported on this device'); return; }
    c.fillStyle='#0B0E13';c.fillRect(0,0,W,H);
    c.fillStyle='#3DDC97';c.fillRect(72,86,90,8);
    c.fillStyle='#EEF2F7';c.font='600 42px Arial';c.fillText('RITUAL',72,160);
    c.fillStyle='#8C99AA';c.font='500 26px Arial';c.fillText('ACHIEVEMENT UNLOCKED',72,235);
    c.fillStyle='#EEF2F7';c.font='700 82px Arial';wrapCanvas(c,title,72,355,900,96);
    c.fillStyle='#3DDC97';c.font='700 58px Arial';c.fillText(String(st.current)+' DAY STREAK',72,625);
    c.fillStyle='#EEF2F7';c.font='600 34px Arial';c.fillText(String(st.total)+' total check-ins',72,700);
    c.fillStyle='#EEF2F7';c.font='600 34px Arial';c.fillText(String(st.consistency)+'% 30-day consistency',72,755);
    c.fillStyle='#8C99AA';c.font='500 30px Arial';c.fillText(p.name||'Ritual user',72,1170);
    c.fillText(dateKey(new Date()),72,1220);
    c.fillStyle='#3DDC97';c.font='500 26px Arial';c.fillText('Small habits. Kept daily.',72,1275);
    canvas.toBlob(function(blob){
      if (!blob) { toast('Could not create achievement card'); return; }
      var file=new File([blob],'ritual-achievement-'+dateKey(new Date())+'.png',{type:'image/png'});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        navigator.share({title:'Ritual achievement',text:title,files:[file]}).catch(function(){});
      } else {
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(url);},1500);toast('Achievement card downloaded');
      }
    },'image/png');
  }

  function wrapCanvas(c,text,x,y,maxWidth,lineHeight){
    var words=text.split(' '),line='';
    for(var n=0;n<words.length;n++){var test=line?line+' '+words[n]:words[n];if(c.measureText(test).width>maxWidth&&line){c.fillText(line,x,y);line=words[n];y+=lineHeight;}else line=test;}
    c.fillText(line,x,y);
  }

  function checkReminder(){
    var r;try{r=JSON.parse(localStorage.getItem(REMINDER_KEY)||'null');}catch(e){return;}
    if(!r||!r.enabled||!('Notification' in window)||Notification.permission!=='granted')return;
    var now=new Date(), key=dateKey(now)+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    if(key===lastReminderMinute)return;lastReminderMinute=key;
    if(key.endsWith(r.time)){
      try{new Notification('Ritual reminder',{body:'Time to keep your ritual. Open Ritual to check in.',icon:'icon-192.png'});}catch(e){}
    }
  }

  var CHALLENGE_KEY = 'ritual.challenge.v1';

  function getChallenge(){
    var d={mode:'66',startedAt:null,completed:false,maintenance:false};
    try{d=Object.assign(d,JSON.parse(localStorage.getItem(CHALLENGE_KEY)||'{}'));}catch(e){}
    if(!d.startedAt) d.startedAt=(getState().start||dateKey(new Date()));
    return d;
  }

  function setChallenge(d){localStorage.setItem(CHALLENGE_KEY,JSON.stringify(d));}

  function challengeDays(mode){return mode==='30'?30:mode==='90'?90:66;}

  function challengeData(){
    var d=getChallenge(), target=challengeDays(d.mode), st=stats(), s=getState(), logs=s.log||{}, habits=Array.isArray(s.habits)?s.habits.filter(function(h){return h&&!h.archived;}):[];
    var start=d.startedAt||s.start||dateKey(new Date()), today=dateKey(new Date());
    var elapsed=Math.max(1,Math.min(target,daysBetween(start,today)+1)), kept=0, activeDays=0;
    for(var i=0;i<elapsed;i++){
      var dk=shiftDate(start,i), row=logs[dk]||{}, scheduled=habits.filter(function(h){
        var ds=Array.isArray(h.days)?h.days:[0,1,2,3,4,5,6];
        return ds.indexOf(new Date(dk+'T12:00:00').getDay())>=0;
      });
      if(!scheduled.length) continue;
      activeDays++;
      var done=scheduled.filter(function(h){return !!row[h.id];}).length;
      if(done/scheduled.length>=.6) kept++;
    }
    var pct=Math.round(elapsed/target*100), consistency=activeDays?Math.round(kept/activeDays*100):0;
    var complete=elapsed>=target&&consistency>=60;
    if(complete&&!d.completed){d.completed=true;d.maintenance=true;setChallenge(d);}
    return {d:d,target:target,elapsed:elapsed,left:Math.max(0,target-elapsed),pct:Math.min(100,pct),kept:kept,activeDays:activeDays,consistency:consistency,complete:complete,streak:st.current,total:st.total};
  }

  function challengeCard(){
    var x=challengeData(), title=x.complete?'Maintenance mode':'The '+x.target+' Day Arc';
    var sub=x.complete?'You finished the challenge. Keep the system alive with weekly consistency.':x.left===0?'Final check. Finish today strong.':x.left===1?'One day left. Close the arc.':x.left+' days left. Show up, not perfect.';
    var phase=x.complete?'MAINTAIN':('DAY '+x.elapsed+' / '+x.target);
    return '<section class="ritual-challenge" aria-label="Ritual challenge">'+
      '<div class="ritual-challenge-top"><div><div class="ritual-challenge-kicker">'+(x.complete?'Long game':'Active challenge')+'</div><div class="ritual-challenge-title">'+title+'</div><div class="ritual-challenge-sub">'+escapeHtml(sub)+'</div></div><span class="ritual-challenge-badge">'+phase+'</span></div>'+
      '<div class="ritual-challenge-grid"><div class="ritual-challenge-stat"><b>'+x.kept+'</b><span>kept days</span></div><div class="ritual-challenge-stat"><b>'+x.consistency+'%</b><span>consistency</span></div><div class="ritual-challenge-stat"><b>'+x.streak+'</b><span>streak</span></div></div>'+
      '<div class="ritual-challenge-track"><span style="width:'+x.pct+'%"></span></div><div class="ritual-challenge-foot"><span>'+x.pct+'% complete</span><span>'+x.target+' day arc</span></div>'+
      '<div class="ritual-challenge-actions"><button class="btn subtle" data-rv-challenge>Change arc</button><button class="btn" data-rv-recap>Share recap</button></div>'+
      '</section>';
  }

  function challengePicker(){
    var x=challengeData(), d=x.d;
    var modal=openModal(
      '<h2>Choose your arc</h2>'+
      '<p class="small muted">Pick the season you can actually finish. Your habits stay the same.</p>'+
      '<div style="display:grid;gap:8px;margin-top:14px">'+
      [['30','30 Days','Build the chain'],['66','66 Days','Become consistent'],['90','90 Days','Make it maintenance']].map(function(o){
        return '<button class="btn '+(d.mode===o[0]?'':'ghost')+'" data-rv-mode="'+o[0]+'" style="justify-content:space-between"><span>'+o[1]+'</span><span style="opacity:.7;font-size:11px">'+o[2]+'</span></button>';
      }).join('')+'</div>'+
      '<p class="small muted" style="margin-top:13px">Changing the arc does not delete your history.</p>'+
      '<div class="ritual-v2-dialog-actions"><button class="btn ghost" data-rv-close>Cancel</button><button class="btn" data-rv-close>Done</button></div>'
    );
    modal.querySelectorAll('[data-rv-mode]').forEach(function(b){b.onclick=function(){
      d.mode=b.getAttribute('data-rv-mode');d.startedAt=dateKey(new Date());d.completed=false;d.maintenance=false;setChallenge(d);modal.remove();toast('New arc started');refreshEnhancementCard();
    };});
    modal.querySelectorAll('[data-rv-close]').forEach(function(b){b.onclick=function(){modal.remove();};});
  }

  function recapData(){
    var s=getState(), ch=challengeData(), habits=Array.isArray(s.habits)?s.habits.filter(function(h){return h&&!h.archived;}):[], logs=s.log||{}, counts={};
    habits.forEach(function(h){counts[h.id]={h:h,c:0};});
    Object.keys(logs).forEach(function(dk){var row=logs[dk]||{};Object.keys(row).forEach(function(id){if(row[id]&&counts[id])counts[id].c++;});});
    var top=Object.keys(counts).map(function(id){return counts[id];}).sort(function(a,b){return b.c-a.c;})[0];
    var year=String(new Date().getFullYear()), yearLogs=Object.keys(logs).filter(function(dk){return dk.slice(0,4)===year;});
    var yearCompletions=0; yearLogs.forEach(function(dk){var row=logs[dk]||{};Object.keys(row).forEach(function(id){if(row[id])yearCompletions++;});});
    var st=stats();
    return {ch:ch,st:st,year:year,daysTracked:yearLogs.length,yearCompletions:yearCompletions,top:top?top.h.title:'Showing up',topCount:top?top.c:0,habits:habits.length};
  }

  function shareRecap(){
    var p=getProfile(), r=recapData(), W=1080,H=1920, canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;var c=canvas.getContext('2d');if(!c){toast('Recap is not supported here');return;}
    c.fillStyle='#090D0B';c.fillRect(0,0,W,H);
    var grd=c.createRadialGradient(850,180,10,850,180,620);grd.addColorStop(0,'rgba(183,243,107,.18)');grd.addColorStop(1,'rgba(183,243,107,0)');c.fillStyle=grd;c.fillRect(0,0,W,H);
    c.fillStyle='#B7F36B';c.fillRect(80,100,100,9);
    c.fillStyle='#F4F5F1';c.font='800 54px Arial';c.fillText('RITUAL',80,190);
    c.fillStyle='#8F9A92';c.font='700 25px Arial';c.fillText('RITUAL '+r.year,80,260);
    c.fillStyle='#F4F5F1';c.font='800 86px Arial';wrapCanvas(c,(p.name||'Your').toUpperCase(),80,410,900,100);
    c.fillStyle='#B7F36B';c.font='800 104px Arial';c.fillText(String(r.st.current),80,650);
    c.fillStyle='#F4F5F1';c.font='700 38px Arial';c.fillText('DAY STREAK',80,710);
    c.fillStyle='#9BA69F';c.font='600 28px Arial';c.fillText(String(r.yearCompletions)+' check-ins this year  ·  '+String(r.st.best)+' best streak',80,770);
    c.fillStyle='#18211C';roundRect(c,80,860,920,380,34);c.fill();
    c.fillStyle='#F4F5F1';c.font='800 48px Arial';c.fillText('YOUR ARC',125,945);
    c.fillStyle='#B7F36B';c.font='800 72px Arial';c.fillText(String(r.ch.elapsed)+' / '+String(r.ch.target),125,1050);
    c.fillStyle='#9BA69F';c.font='600 25px Arial';c.fillText('days travelled',125,1090);
    c.fillStyle='#F4F5F1';c.font='700 38px Arial';c.fillText(String(r.ch.consistency)+'% consistency',520,1050);
    c.fillStyle='#9BA69F';c.font='600 25px Arial';c.fillText(String(r.ch.kept)+' kept days',520,1090);
    c.fillStyle='#F4F5F1';c.font='800 44px Arial';c.fillText('Most kept',125,1165);
    c.fillStyle='#B7F36B';c.font='700 32px Arial';wrapCanvas(c,r.top,125,1225,760,44);
    c.fillStyle='#9BA69F';c.font='600 24px Arial';c.fillText(String(r.topCount)+' check-ins',125,1310);
    c.fillStyle='#F4F5F1';c.font='800 48px Arial';c.fillText('THE RECEIPT',80,1460);
    c.fillStyle='#9BA69F';c.font='600 28px Arial';c.fillText(String(r.daysTracked)+' active days this year',80,1520);
    c.fillText(String(r.habits)+' active habits',80,1570);
    c.fillText('Local. Private. Yours.',80,1620);
    c.fillStyle='#B7F36B';c.font='800 34px Arial';c.fillText('Small habits. Kept daily.',80,1770);
    c.fillStyle='#8F9A92';c.font='600 22px Arial';c.fillText('ritual · your progress, without the performance',80,1830);
    canvas.toBlob(function(blob){if(!blob){toast('Could not create recap');return;}var file=new File([blob],'ritual-recap-'+dateKey(new Date())+'.png',{type:'image/png'});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({title:'My Ritual recap',text:'My Ritual progress',files:[file]}).catch(function(){});}
      else{var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);toast('Recap saved');}
    },'image/png');
  }

  function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  
  function heroData(){
    var s=getState(), logs=s.log||{}, habits=Array.isArray(s.habits)?s.habits:[], today=dateKey();
    var totalXp=0, totalCompletions=0;
    Object.keys(logs).forEach(function(day){
      var row=logs[day]||{};
      Object.keys(row).forEach(function(id){
        if(!row[id]) return;
        var h=habits.find(function(x){return x&&x.id===id;});
        totalXp += h && h.xp ? h.xp : 10;
        totalCompletions++;
      });
    });
    var active=habits.filter(function(h){return h&&!h.archived;});
    var done=(logs[today]||{});
    var scheduled=active.filter(function(h){
      var ds=Array.isArray(h.days)?h.days:[0,1,2,3,4,5,6];
      return ds.indexOf(new Date(today+'T12:00:00').getDay())>=0;
    });
    var complete=scheduled.filter(function(h){return !!done[h.id];}).length;
    var level=Math.floor(Math.sqrt(totalXp/60))+1;
    var floor=60*Math.pow(level-1,2), next=60*Math.pow(level,2);
    var pct=Math.max(0,Math.min(100,Math.round((totalXp-floor)/(next-floor)*100)));
    var st=stats();
    var rank=st.current>=30?'Relentless':st.current>=14?'Disciplined':st.current>=7?'Momentum':'The Keeper';
    return {xp:totalXp,level:level,pct:pct,next:next,complete:complete,scheduled:scheduled.length,streak:st.current,total:totalCompletions,rank:rank};
  }

  function heroCharacter(d){
    var glow=d.level>=10?'#F4C76A':d.level>=5?'#86B8FF':'#B7F36B';
    return '<svg viewBox="0 0 180 220" role="img" aria-label="Ritual Keeper character">'+
      '<defs><radialGradient id="rhg" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="'+glow+'" stop-opacity=".32"/><stop offset="1" stop-color="'+glow+'" stop-opacity="0"/></radialGradient></defs>'+
      '<circle cx="90" cy="94" r="82" fill="url(#rhg)"/>'+ 
      '<path d="M43 192c5-39 24-57 47-57s42 18 47 57" fill="#111713" stroke="'+glow+'" stroke-width="3"/>'+ 
      '<path d="M57 139c-8-29-3-70 33-83 36 13 41 54 33 83l-16 16H73z" fill="#19211C" stroke="#F4F5F1" stroke-opacity=".22" stroke-width="2"/>'+ 
      '<path d="M69 91c7-25 35-31 46-4v24c-10 13-29 14-46 0z" fill="#090D0B" stroke="'+glow+'" stroke-width="2"/>'+ 
      '<path d="M78 103h6M96 103h6" stroke="#F4F5F1" stroke-width="4" stroke-linecap="round"/>'+ 
      '<path d="M61 132l-20 19M119 132l20 19" stroke="#F4F5F1" stroke-opacity=".32" stroke-width="8" stroke-linecap="round"/>'+ 
      '<path d="M73 172h34" stroke="'+glow+'" stroke-width="4" stroke-linecap="round"/>'+ 
      '<circle cx="90" cy="172" r="8" fill="'+glow+'" fill-opacity=".18" stroke="'+glow+'" stroke-width="2"/>'+ 
      '</svg>';
  }

  function heroCard(){
    var d=heroData();
    var left=Math.max(0,d.scheduled-d.complete);
    var directive=left===0?'Quest cleared. You showed up.':left===1?'One more move. Finish the chain.':left+' moves left. Keep the chain alive.';
    return '<section class="ritual-hero" aria-label="Ritual Keeper progress">'+
      '<div class="ritual-hero-copy">'+
        '<div class="ritual-hero-kicker">Your daily arc</div>'+ 
        '<div class="ritual-hero-title">'+escapeHtml(d.rank)+'</div>'+ 
        '<div class="ritual-hero-sub">'+escapeHtml(directive)+' Progress is local, instant, and yours.</div>'+ 
        '<div class="ritual-hero-progress" aria-label="'+d.pct+' percent to next level"><span style="width:'+d.pct+'%"></span></div>'+ 
        '<div class="ritual-hero-meta"><span class="ritual-hero-chip">LVL '+d.level+'</span><span class="ritual-hero-chip">'+d.xp+' XP</span><span class="ritual-hero-chip">'+d.complete+'/'+d.scheduled+' today</span></div>'+ 
      '</div>'+ 
      '<div class="ritual-hero-character"><span class="ritual-hero-level">KEEPER</span>'+heroCharacter(d)+'</div>'+ 
      '</section>';
  }

  function profileCard(){
    var p=getProfile(), st=stats();
    var name=p.name||'Create your profile';
    var bio=p.bio||'Your progress stays on this device.';
    return '<section class="ritual-v2-profile" aria-label="Profile">'+
      '<div class="ritual-v2-head">'+avatarMarkup(p)+'<div style="min-width:0;flex:1"><div class="ritual-v2-name">'+escapeHtml(name)+'</div><div class="ritual-v2-bio">'+escapeHtml(bio)+'</div></div></div>'+
      '<div class="ritual-v2-stats"><div class="ritual-v2-stat"><b>'+st.current+'</b><span>current streak</span></div><div class="ritual-v2-stat"><b>'+st.total+'</b><span>check-ins</span></div><div class="ritual-v2-stat"><b>'+st.consistency+'%</b><span>30-day score</span></div></div>'+
      '<div class="ritual-v2-actions"><button class="btn subtle" data-rv-edit>Profile</button><button class="btn" data-rv-share>Share achievement</button></div>'+
      '<div class="ritual-v2-actions"><button class="btn ghost" data-rv-reminders>Reminders</button><button class="btn ghost" data-rv-backup>Backup profile</button></div>'+
      '<section class="ritual-recap"><div class="ritual-recap-title">Your Ritual recap</div><div class="ritual-recap-sub">A shareable receipt of the work you have actually done.</div>'+
      '<div class="ritual-recap-grid"><div class="ritual-recap-stat"><b>'+stats().total+'</b><span>check-ins</span></div><div class="ritual-recap-stat"><b>'+stats().best+'</b><span>best streak</span></div></div>'+
      '<div class="ritual-recap-actions"><button class="btn subtle" data-rv-recap-profile>Share recap</button><button class="btn ghost" data-rv-challenge-profile>Challenge</button></div></section>'+
      '</section>';
  }

  /*
   * CRITICAL STABILITY RULE:
   * The app's main renderer owns #view. This enhancement layer may observe it,
   * but it must be idempotent. It only inserts the profile card when absent.
   * It never removes/reinserts the card merely because the observer fired.
   * Therefore its own DOM mutation cannot create an infinite MutationObserver loop.
   */
  function renderEnhancement(){
    injectStyles();
    var view=document.getElementById('view');
    var youTab=document.querySelector('#tabbar button[data-tab="you"][aria-selected="true"]');
    var todayTab=document.querySelector('#tabbar button[data-tab="today"][aria-selected="true"]');
    if(!view) return;

    if (youTab && !view.querySelector('.ritual-v2-profile')) {
      view.insertAdjacentHTML('afterbegin',profileCard());
      var card=view.querySelector('.ritual-v2-profile');
      if(card){
        var edit=card.querySelector('[data-rv-edit]');
        var share=card.querySelector('[data-rv-share]');
        var reminders=card.querySelector('[data-rv-reminders]');
        var backup=card.querySelector('[data-rv-backup]');
        var recapP=card.querySelector('[data-rv-recap-profile]');
        var challengeP=card.querySelector('[data-rv-challenge-profile]');
        if(recapP) recapP.onclick=shareRecap;
        if(challengeP) challengeP.onclick=challengePicker;
        if(edit) edit.onclick=editProfile;
        if(share) share.onclick=shareAchievement;
        if(reminders) reminders.onclick=reminderSettings;
        if(backup) backup.onclick=function(){
          var s=getState(), p=getProfile();
          var payload=Object.assign({},s,{profile:p,profileBackupVersion:2});
          var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
          var url=URL.createObjectURL(blob);
          var a=document.createElement('a');a.href=url;a.download='ritual-profile-backup-'+dateKey(new Date())+'.json';document.body.appendChild(a);a.click();a.remove();
          setTimeout(function(){URL.revokeObjectURL(url);},1500);toast('Backup downloaded');
        };
      }
    }

    if (todayTab && !view.querySelector('.ritual-challenge')) {
      view.insertAdjacentHTML('afterbegin',challengeCard());
      var cc=view.querySelector('.ritual-challenge');
      if(cc){
        var cb=cc.querySelector('[data-rv-challenge]'), cr=cc.querySelector('[data-rv-recap]');
        if(cb) cb.onclick=challengePicker;
        if(cr) cr.onclick=shareRecap;
      }
    }
  }

  var observer=new MutationObserver(function(){
    var view=document.getElementById('view');
    if (!view) return;
    var youTab=document.querySelector('#tabbar button[data-tab="you"][aria-selected="true"]');
    var todayTab=document.querySelector('#tabbar button[data-tab="today"][aria-selected="true"]');
    if ((youTab && !view.querySelector('.ritual-v2-profile')) || (todayTab && !view.querySelector('.ritual-challenge'))) {
      renderEnhancement();
    }
  });

  function boot(){
    injectStyles();
    var v=document.getElementById('view');
    if(v) observer.observe(v,{childList:true});
    setTimeout(renderEnhancement,80);
    setInterval(checkReminder,15000);
    document.addEventListener('click',function(e){
      var b=e.target.closest('#tabbar button[data-tab="you"]');
      if(b)setTimeout(renderEnhancement,50);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
