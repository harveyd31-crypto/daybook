/* Daybook — read iCloud / Apple Calendar / Google / Outlook .ics files into Daybook events and tasks. */

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const dayDiff = (a, b) => Math.round((Date.UTC(...b.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(...a.split('-').map((v, i) => i === 1 ? v - 1 : +v))) / 864e5);
const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/* short stable id from any string, so importing the same file twice updates instead of duplicating */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* ---------- low level parsing ---------- */
function unfold(text) { return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n'); }
function unescape(v) { return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }
function parseLine(line) {
  // NAME;PARAM=VAL;PARAM="V:AL":value   (colons inside quoted params are allowed)
  let i = 0, inQ = false;
  for (; i < line.length; i++) { const ch = line[i]; if (ch === '"') inQ = !inQ; else if (ch === ':' && !inQ) break; }
  const head = line.slice(0, i), value = line.slice(i + 1);
  const parts = head.split(';'), name = parts.shift().toUpperCase(), params = {};
  for (const p of parts) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
  return { name, params, value };
}

/* offset in ms of a time zone at a UTC instant */
function tzOffset(ts, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; for (const x of f.formatToParts(new Date(ts))) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
}
const WIN_TZ = { 'Romance Standard Time': 'Europe/Paris', 'W. Europe Standard Time': 'Europe/Berlin', 'GMT Standard Time': 'Europe/London', 'Morocco Standard Time': 'Africa/Casablanca',
  'Eastern Standard Time': 'America/New_York', 'Pacific Standard Time': 'America/Los_Angeles', 'Central Standard Time': 'America/Chicago', 'Singapore Standard Time': 'Asia/Singapore',
  'China Standard Time': 'Asia/Shanghai', 'Arabian Standard Time': 'Asia/Dubai', 'Argentina Standard Time': 'America/Argentina/Buenos_Aires', 'Central America Standard Time': 'America/Costa_Rica', 'UTC': 'UTC' };

/* a DATE or DATE-TIME property → { allDay, date } or { allDay:false, at: Date (in this device's local time) } */
export function parseDT(value, params = {}) {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, Se, Z] = m;
  if (params.VALUE === 'DATE' || H === undefined) return { allDay: true, date: `${Y}-${Mo}-${D}` };
  const y = +Y, mo = +Mo, d = +D, h = +H, mi = +Mi, s = +(Se || 0);
  if (Z) return { allDay: false, at: new Date(Date.UTC(y, mo - 1, d, h, mi, s)) };
  let tz = params.TZID;
  if (tz) {
    tz = tz.replace(/^\//, ''); tz = WIN_TZ[tz] || tz;
    try {
      const guess = Date.UTC(y, mo - 1, d, h, mi, s);
      let utc = guess - tzOffset(guess, tz);
      const o2 = tzOffset(utc, tz); utc = guess - o2;
      return { allDay: false, at: new Date(utc) };
    } catch (e) { /* unknown zone: treat as local wall time */ }
  }
  return { allDay: false, at: new Date(y, mo - 1, d, h, mi, s) };
}
function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec((v || '').trim());
  if (!m) return null;
  return ((+m[2] || 0) * 7 * 1440 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0) + (+m[6] || 0) / 60) * (m[1] === '-' ? -1 : 1);
}
function parseRRule(v) {
  const r = {};
  for (const kv of v.split(';')) { const [k, val] = kv.split('='); if (k && val !== undefined) r[k.toUpperCase()] = val; }
  r.INTERVAL = +(r.INTERVAL || 1) || 1;
  if (r.COUNT) r.COUNT = +r.COUNT;
  r.BYDAY = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = x.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/); return m ? { n: m[1] ? +m[1] : 0, wd: WD.indexOf(m[2]) } : null; }).filter(Boolean) : [];
  r.BYMONTHDAY = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [];
  r.BYMONTH = r.BYMONTH ? r.BYMONTH.split(',').map(Number) : [];
  r.BYSETPOS = r.BYSETPOS ? r.BYSETPOS.split(',').map(Number) : [];
  return r;
}

/* ---------- whole file ---------- */
export function parseICS(text, fileName = 'Calendar') {
  const lines = unfold(text);
  if (!lines.some(l => /^BEGIN:VCALENDAR/i.test(l))) throw new Error('not-ics');
  const out = { name: '', color: '', events: [], todos: [] };
  let cur = null, depth = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const { name, params, value } = parseLine(raw);
    if (name === 'BEGIN') { depth.push(value.toUpperCase()); if (value.toUpperCase() === 'VEVENT' || value.toUpperCase() === 'VTODO') cur = { kind: value.toUpperCase(), exdates: [], props: {} }; continue; }
    if (name === 'END') { const what = depth.pop(); if (cur && what === cur.kind) { (cur.kind === 'VEVENT' ? out.events : out.todos).push(cur); cur = null; } continue; }
    const inside = depth[depth.length - 1];
    if (!cur) {
      if (inside === 'VCALENDAR') {
        if (name === 'X-WR-CALNAME') out.name = unescape(value).trim();
        else if (name === 'X-APPLE-CALENDAR-COLOR' || name === 'COLOR') out.color = value.trim();
      }
      continue;
    }
    if (inside !== cur.kind) continue; // skip VALARM etc.
    if (name === 'EXDATE') { for (const x of value.split(',')) { const p = parseDT(x, params); if (p) cur.exdates.push(p); } continue; }
    if (!(name in cur.props)) cur.props[name] = { params, value };
  }
  if (!out.name) out.name = fileName.replace(/\.ics$/i, '') || 'Calendar';
  const c = (out.color || '').match(/^#?([0-9a-f]{6})/i);
  out.color = c ? '#' + c[1].toUpperCase() : '';
  return out;
}

/* ---------- recurrence ---------- */
const wkStartMon = s => { const d = parseYmd(s); return addDays(s, -((d.getDay() + 6) % 7)); };
function matches(rule, start, s) {
  const d = parseYmd(s), sd = parseYmd(start), f = rule.FREQ;
  if (f === 'DAILY' && dayDiff(start, s) % rule.INTERVAL) return false;
  if (f === 'WEEKLY' && (dayDiff(wkStartMon(start), wkStartMon(s)) / 7) % rule.INTERVAL) return false;
  const months = (d.getFullYear() - sd.getFullYear()) * 12 + d.getMonth() - sd.getMonth();
  if (f === 'MONTHLY' && months % rule.INTERVAL) return false;
  if (f === 'YEARLY' && (d.getFullYear() - sd.getFullYear()) % rule.INTERVAL) return false;
  if (rule.BYMONTH.length) { if (!rule.BYMONTH.includes(d.getMonth() + 1)) return false; }
  else if (f === 'YEARLY' && d.getMonth() !== sd.getMonth()) return false;
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (rule.BYMONTHDAY.length) { if (!rule.BYMONTHDAY.some(n => (n > 0 ? n : dim + 1 + n) === d.getDate())) return false; }
  if (rule.BYDAY.length) {
    const ok = rule.BYDAY.some(({ n, wd }) => {
      if (wd !== d.getDay()) return false;
      if (!n || f === 'WEEKLY' || f === 'DAILY') return true;
      const nth = Math.floor((d.getDate() - 1) / 7) + 1, fromEnd = -(Math.floor((dim - d.getDate()) / 7) + 1);
      return n > 0 ? nth === n : fromEnd === n;
    });
    if (!ok) return false;
    if (rule.BYSETPOS.length && (f === 'MONTHLY' || f === 'YEARLY')) {
      // e.g. last weekday of the month: position among this month's matching days
      const days = []; for (let k = 1; k <= dim; k++) { const t = new Date(d.getFullYear(), d.getMonth(), k); if (rule.BYDAY.some(({ wd }) => wd === t.getDay())) days.push(k); }
      if (!rule.BYSETPOS.some(p => days[p > 0 ? p - 1 : days.length + p] === d.getDate())) return false;
    }
  } else if (!rule.BYMONTHDAY.length) {
    if (f === 'WEEKLY' && d.getDay() !== sd.getDay()) return false;
    if ((f === 'MONTHLY' || f === 'YEARLY') && d.getDate() !== sd.getDate()) return false;
  }
  return true;
}
/* every occurrence date from start, up to `until` (inclusive), at most `count`, scanning at most `maxDays` */
export function occurrences(rule, start, until, count, maxDays = 365 * 12) {
  const out = [];
  for (let i = 0, s = start; i <= maxDays; i++, s = addDays(s, 1)) {
    if (until && s > until) break;
    if (i === 0 || matches(rule, start, s)) { out.push(s); if (count && out.length >= count) break; }
  }
  return out;
}

/* ---------- to Daybook ---------- */
/* options: { calId, srcKey, fromDate (YYYY-MM-DD or null), today (YYYY-MM-DD), listIdFor(name) } */
export function toDaybook(parsed, opt) {
  const events = {}, tasks = [], stats = { events: 0, repeating: 0, skipped: 0 };
  const today = opt.today, from = opt.fromDate, horizon = addDays(today, 730);
  const base = uid => 'ics_' + hash(opt.srcKey + '|' + uid);
  // occurrences that were moved or changed on their own (RECURRENCE-ID) are skipped in their series
  const moved = {};
  for (const e of parsed.events) {
    const rid = e.props['RECURRENCE-ID']; const uid = e.props.UID?.value;
    if (rid && uid) { const p = parseDT(rid.value, rid.params); if (p) (moved[uid] = moved[uid] || []).push(p.allDay ? p.date : ymd(p.at)); }
  }
  for (const e of parsed.events) {
    const P = e.props, uid = P.UID?.value || (P.SUMMARY?.value || '') + (P.DTSTART?.value || '');
    if ((P.STATUS?.value || '').toUpperCase() === 'CANCELLED' || !P.DTSTART) { stats.skipped++; continue; }
    const st = parseDT(P.DTSTART.value, P.DTSTART.params); if (!st) { stats.skipped++; continue; }
    let en = P.DTEND ? parseDT(P.DTEND.value, P.DTEND.params) : null;
    const dur = P.DURATION ? parseDuration(P.DURATION.value) : null;
    let ev = { type: 'event', title: unescape(P.SUMMARY?.value || '').trim() || 'Untitled', loc: unescape(P.LOCATION?.value || '').trim(),
      notes: unescape(P.DESCRIPTION?.value || '').trim().slice(0, 4000), url: (P.URL?.value || '').trim(),
      cal: opt.calId, repeat: 'none', until: '', skip: [], src: opt.srcKey, updated: Date.now() };
    if (st.allDay) {
      let endIncl = st.date;
      if (en && en.allDay) endIncl = addDays(en.date, -1);
      else if (dur && dur >= 1440) endIncl = addDays(st.date, Math.round(dur / 1440) - 1);
      if (endIncl < st.date) endIncl = st.date;
      Object.assign(ev, { allDay: true, date: st.date, endDate: endIncl > st.date ? endIncl : '', start: '', end: '' });
    } else {
      const sAt = st.at; let eAt = en && !en.allDay ? en.at : new Date(sAt.getTime() + (dur != null ? dur : 60) * 60000);
      if (eAt <= sAt) eAt = new Date(sAt.getTime() + 30 * 60000);
      let date = ymd(sAt), endDate = ymd(eAt), end = hm(eAt);
      if (endDate > date && end === '00:00' && dayDiff(date, endDate) === 1) { endDate = date; end = '23:59'; }
      Object.assign(ev, { allDay: false, date, endDate: endDate > date ? endDate : '', start: hm(sAt), end });
    }
    const ridP = P['RECURRENCE-ID'];
    if (ridP) {
      if (from && ev.date < from && (ev.endDate || ev.date) < from) continue;
      const rp = parseDT(ridP.value, ridP.params);
      events[base(uid + '|' + (rp ? (rp.allDay ? rp.date : ymd(rp.at)) : ridP.value))] = ev; stats.events++; continue;
    }
    const skips = [...e.exdates.map(x => x.allDay ? x.date : ymd(x.at)), ...(moved[uid] || [])];
    if (!P.RRULE) {
      if (from && (ev.endDate || ev.date) < from) continue;
      events[base(uid)] = ev; stats.events++; continue;
    }
    const r = parseRRule(P.RRULE.value);
    let until = '';
    if (r.UNTIL) { const u = parseDT(r.UNTIL, {}); if (u) until = u.allDay ? u.date : ymd(u.at); }
    if (r.COUNT) { const occ = occurrences(r, ev.date, until, r.COUNT); until = occ[occ.length - 1] || ev.date; }
    if (from && until && until < from) continue;
    const startWd = parseYmd(ev.date).getDay(), days = r.BYDAY.map(b => b.wd), plainDays = r.BYDAY.every(b => !b.n);
    const isWeekdays = plainDays && days.length === 5 && [1, 2, 3, 4, 5].every(w => days.includes(w));
    const simpleExtra = !r.BYMONTH.length && !r.BYSETPOS.length;
    let mapped = null;
    if (r.FREQ === 'DAILY' && r.INTERVAL === 1 && !r.BYDAY.length && simpleExtra && !r.BYMONTHDAY.length) mapped = ['daily'];
    else if ((r.FREQ === 'DAILY' || r.FREQ === 'WEEKLY') && r.INTERVAL === 1 && isWeekdays && simpleExtra) mapped = ['weekdays'];
    else if (r.FREQ === 'WEEKLY' && (r.INTERVAL === 1 || r.INTERVAL === 2) && plainDays && simpleExtra && !r.BYMONTHDAY.length) {
      const set = days.length ? days : [startWd];
      mapped = set.map(w => ({ w, repeat: r.INTERVAL === 2 ? 'biweekly' : 'weekly' }));
    }
    else if (r.FREQ === 'MONTHLY' && r.INTERVAL === 1 && !r.BYDAY.length && simpleExtra && (!r.BYMONTHDAY.length || (r.BYMONTHDAY.length === 1 && r.BYMONTHDAY[0] === parseYmd(ev.date).getDate()))) mapped = ['monthly'];
    else if (r.FREQ === 'YEARLY' && r.INTERVAL === 1 && !r.BYDAY.length && !r.BYMONTHDAY.length && !r.BYSETPOS.length && (!r.BYMONTH.length || (r.BYMONTH.length === 1 && r.BYMONTH[0] === parseYmd(ev.date).getMonth() + 1))) mapped = ['yearly'];
    const multi = !!ev.endDate;
    if (mapped && !multi) {
      stats.repeating++;
      if (typeof mapped[0] === 'string') { events[base(uid)] = { ...ev, repeat: mapped[0], until, skip: skips }; stats.events++; }
      else for (const { w, repeat } of mapped) {
        // one series per weekday; the first date is the first matching day on or after the original start
        let s0 = ev.date; while (parseYmd(s0).getDay() !== w) s0 = addDays(s0, 1);
        if (r.INTERVAL === 2 && dayDiff(wkStartMon(ev.date), wkStartMon(s0)) / 7 % 2) s0 = addDays(s0, 7);
        if (until && s0 > until) continue;
        events[w === startWd && mapped.length === 1 ? base(uid) : base(uid + '|' + WD[w])] = { ...ev, date: s0, repeat, until, skip: skips }; stats.events++;
      }
      continue;
    }
    // anything Daybook can't repeat natively becomes individual events, up to two years ahead
    const lim = until && until < horizon ? until : horizon;
    let n = 0;
    for (const d of occurrences(r, ev.date, lim, r.COUNT)) {
      if (skips.includes(d) || (from && d < from)) continue;
      const span = ev.endDate ? dayDiff(ev.date, ev.endDate) : 0;
      events[base(uid + '|' + d)] = { ...ev, date: d, endDate: span ? addDays(d, span) : '', repeat: 'none' }; stats.events++;
      if (++n >= 600) break;
    }
    stats.repeating++;
  }
  for (const t of parsed.todos) {
    const P = t.props; const text = unescape(P.SUMMARY?.value || '').trim(); if (!text) continue;
    const due = P.DUE ? parseDT(P.DUE.value, P.DUE.params) : null;
    tasks.push({ id: 't_' + hash(opt.srcKey + '|' + (P.UID?.value || text)), text, done: (P.STATUS?.value || '').toUpperCase() === 'COMPLETED' || !!P.COMPLETED,
      due: due ? (due.allDay ? due.date : ymd(due.at)) : null, created: Date.now() });
  }
  return { events, tasks, stats };
}

/* quick summary for the preview screen */
export function summarize(parsed) {
  let first = null, last = null, rep = 0;
  for (const e of parsed.events) {
    const p = e.props.DTSTART && parseDT(e.props.DTSTART.value, e.props.DTSTART.params); if (!p) continue;
    const d = p.allDay ? p.date : ymd(p.at);
    if (!first || d < first) first = d; if (!last || d > last) last = d;
    if (e.props.RRULE) rep++;
  }
  return { count: parsed.events.length, repeating: rep, todos: parsed.todos.length, first, last };
}
