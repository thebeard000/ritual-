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

  function profileCard(){
    var p=getProfile(), st=stats();
    var name=p.name||'Create your profile';
    var bio=p.bio||'Your progress stays on this device.';
    return '<section class="ritual-v2-profile" aria-label="Profile">'+
      '<div class="ritual-v2-head">'+avatarMarkup(p)+'<div style="min-width:0;flex:1"><div class="ritual-v2-name">'+escapeHtml(name)+'</div><div class="ritual-v2-bio">'+escapeHtml(bio)+'</div></div></div>'+
      '<div class="ritual-v2-stats"><div class="ritual-v2-stat"><b>'+st.current+'</b><span>current streak</span></div><div class="ritual-v2-stat"><b>'+st.total+'</b><span>check-ins</span></div><div class="ritual-v2-stat"><b>'+st.consistency+'%</b><span>30-day score</span></div></div>'+
      '<div class="ritual-v2-actions"><button class="btn subtle" data-rv-edit>Profile</button><button class="btn" data-rv-share>Share achievement</button></div>'+
      '<div class="ritual-v2-actions"><button class="btn ghost" data-rv-reminders>Reminders</button><button class="btn ghost" data-rv-backup>Backup profile</button></div>'+
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
    var tab=document.querySelector('#tabbar button[data-tab="you"][aria-selected="true"]');
    if(!view||!tab) return;

    if (view.querySelector('.ritual-v2-profile')) return;

    view.insertAdjacentHTML('afterbegin',profileCard());
    var card=view.querySelector('.ritual-v2-profile');
    if(!card) return;

    var edit=card.querySelector('[data-rv-edit]');
    var share=card.querySelector('[data-rv-share]');
    var reminders=card.querySelector('[data-rv-reminders]');
    var backup=card.querySelector('[data-rv-backup]');
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

  var observer=new MutationObserver(function(){
    var view=document.getElementById('view');
    if (!view) return;
    var tab=document.querySelector('#tabbar button[data-tab="you"][aria-selected="true"]');
    if (tab && !view.querySelector('.ritual-v2-profile')) renderEnhancement();
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
