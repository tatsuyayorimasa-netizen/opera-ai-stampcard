/**
 * 東京オペラシティビル株式会社 様 AI研修 出席スタンプカード
 * スプレッドシートの「拡張機能 > Apps Script」に貼り付けて使います。
 *
 * ▼ ここだけ編集してください ▼
 */
const CONFIG = {
  courseTitle: 'AI活用研修',
  client: '東京オペラシティビル株式会社',
  organizer: '株式会社フェローズ',
  venue: '東京オペラシティタワー',
  // 背景写真。自社撮影・提供写真のURL（Googleドライブの共有リンク不可、画像の直リンク）に差し替え推奨。
  // 初期値は Wikimedia Commons の写真です。使う場合は下の photoCredit の表記を残してください。
  photoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tokyo_Opera_City_Tower.JPG?width=1600',
  photoCredit: '写真: Wikimedia Commons「Tokyo Opera City Tower.JPG」',
  photoCreditUrl: 'https://commons.wikimedia.org/wiki/File:Tokyo_Opera_City_Tower.JPG',
  // 管理ページのパスワード。必ず変更してください。
  adminPassword: 'ここに管理用パスワード',
  // 各回の情報。keyword に言葉を入れると、当日その合言葉を知っている人だけ押印できます（空欄なら不要）。
  sessions: [
    { no: 1, date: '2026-10-20', time: '14:00–16:00', theme: '生成AIの基本と社内ルール', keyword: '' },
    { no: 2, date: '2026-11-04', time: '14:00–16:00', theme: '文書作成・要約の実践',     keyword: ''   },
    { no: 3, date: '2026-11-18', time: '14:00–16:00', theme: 'データ整理と資料づくり',   keyword: '' },
    { no: 4, date: '2026-12-02', time: '14:00–16:00', theme: '自部署の業務に組み込む',   keyword: ''   }
  ]
};
/* ▲ 編集ここまで ▲ */

const SHEET_LOG = '出席ログ';
const SHEET_MATRIX = '出席一覧';
const LOG_HEADER = ['記録日時', '回', '氏名', '所属', '満足度(5)', '理解度(5)', '業務で使えそうか', '次回に期待すること', '感想・質問'];

/** 画面をApps Scriptから直接出す場合（index ファイルがあるとき）。GitHub Pages で使う場合は動作確認用の応答だけ返す */
function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle(CONFIG.courseTitle + ' 出席カード')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    return json_({ ok: true, data: 'stampcard api is running' });
  }
}

/** GitHub Pages の画面からの呼び出し口。本文は {"fn": 関数名, "args": [...]} */
const API = { getConfig: getConfig, getStamps: getStamps, submit: submit, adminLogin: adminLogin, adminSavePhotos: adminSavePhotos };
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const fn = API[req.fn];
    if (!fn) throw new Error('不明な操作です。');
    return json_({ ok: true, data: fn.apply(null, req.args || []) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 画面に渡す設定（合言葉・パスワードは渡さない） */
function getConfig() {
  const photos = getPhotos_();
  return {
    courseTitle: CONFIG.courseTitle,
    client: CONFIG.client,
    organizer: CONFIG.organizer,
    venue: CONFIG.venue,
    photoUrl: photos.main || CONFIG.photoUrl,
    photoCredit: photos.main ? '' : CONFIG.photoCredit,
    photoCreditUrl: photos.main ? '' : CONFIG.photoCreditUrl,
    left: photos.left,
    right: photos.right,
    sessions: CONFIG.sessions.map(s => ({
      no: s.no, date: s.date, time: s.time, theme: s.theme, needsKeyword: !!s.keyword
    }))
  };
}

/* ===== 管理ページ ===== */

function checkAdmin_(pw) {
  if (String(pw || '') !== String(CONFIG.adminPassword)) {
    Utilities.sleep(800);
    throw new Error('パスワードが違います。');
  }
}

/** ログインして集計を返す */
function adminLogin(pw) {
  checkAdmin_(pw);
  return adminData_();
}

/** 写真の保存（左右それぞれ最大3枚＋メイン1枚） */
function adminSavePhotos(pw, photos) {
  checkAdmin_(pw);
  const clean = list => (list || []).slice(0, 3).map(p => ({
    url: toImageUrl_(p.url), caption: String(p.caption || '').slice(0, 30)
  })).filter(p => p.url);
  const data = {
    main: toImageUrl_(photos && photos.main),
    left: clean(photos && photos.left),
    right: clean(photos && photos.right)
  };
  PropertiesService.getScriptProperties().setProperty('photos', JSON.stringify(data));
  return data;
}

function getPhotos_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('photos');
    const d = raw ? JSON.parse(raw) : {};
    return { main: d.main || '', left: d.left || [], right: d.right || [] };
  } catch (e) {
    return { main: '', left: [], right: [] };
  }
}

/** GoogleドライブのリンクをそのままのURLでも表示できる形に直す */
function toImageUrl_(u) {
  u = String(u || '').trim();
  if (!/^https:\/\//.test(u)) return '';
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  return u;
}

function adminData_() {
  const sh = logSheet_();
  const last = sh.getLastRow();
  const rows = last >= 2 ? sh.getRange(2, 1, last - 1, LOG_HEADER.length).getValues() : [];
  const sessions = CONFIG.sessions.map(s => {
    const rs = rows.filter(r => Number(r[1]) === s.no);
    const avg = i => rs.length ? Math.round(rs.reduce((a, r) => a + Number(r[i] || 0), 0) / rs.length * 10) / 10 : null;
    const tally = i => rs.reduce((o, r) => { if (r[i]) o[r[i]] = (o[r[i]] || 0) + 1; return o; }, {});
    return {
      no: s.no, date: s.date, theme: s.theme, keyword: s.keyword,
      count: rs.length,
      satisfaction: avg(4), understanding: avg(5),
      usefulness: tally(6), wish: tally(7),
      people: rs.map(r => ({ name: r[2], dept: r[3], at: Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'M/d HH:mm') })),
      comments: rs.filter(r => String(r[8]).trim()).map(r => ({ name: r[2], text: String(r[8]) }))
    };
  });
  const names = {};
  rows.forEach(r => { names[normalize_(r[2]) + '|' + normalize_(r[3])] = 1; });
  return {
    sheetUrl: SpreadsheetApp.getActive().getUrl(),
    totalPeople: Object.keys(names).length,
    sessions: sessions,
    photos: getPhotos_()
  };
}

/** 氏名＋所属で、押印済みの回を返す */
function getStamps(name, dept) {
  const n = normalize_(name), d = normalize_(dept);
  const sh = logSheet_();
  const last = sh.getLastRow();
  const result = {};
  if (last < 2) return result;
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  rows.forEach(r => {
    if (normalize_(r[2]) === n && (!d || normalize_(r[3]) === d)) {
      result[r[1]] = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'M/d');
    }
  });
  return result;
}

/** 出席＋アンケートを記録 */
function submit(p) {
  const name = String(p.name || '').trim();
  const dept = String(p.dept || '').trim();
  const no = Number(p.session);
  const s = CONFIG.sessions.find(x => x.no === no);
  if (!name) throw new Error('氏名を入力してください。');
  if (!s) throw new Error('研修の回を選んでください。');
  if (s.keyword && normalize_(p.keyword) !== normalize_(s.keyword)) {
    throw new Error('合言葉が違います。会場でお伝えした言葉を入力してください。');
  }
  if (!p.satisfaction || !p.understanding) throw new Error('満足度と理解度を選んでください。');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const already = getStamps(name, dept);
    if (already[no]) throw new Error('第' + no + '回はすでに押印済みです（' + already[no] + '）。');
    const now = new Date();
    logSheet_().appendRow([
      now, no, name, dept,
      Number(p.satisfaction), Number(p.understanding),
      String(p.usefulness || ''), String(p.wish || ''), String(p.comment || '').slice(0, 1000)
    ]);
    rebuildMatrix_();
    const stamps = getStamps(name, dept);
    return { stamps: stamps, date: Utilities.formatDate(now, 'Asia/Tokyo', 'M/d') };
  } finally {
    lock.releaseLock();
  }
}

/** 氏名×回の一覧シートを作り直す（手動実行も可） */
function rebuildMatrix_() {
  const ss = SpreadsheetApp.getActive();
  const log = logSheet_();
  let mx = ss.getSheetByName(SHEET_MATRIX) || ss.insertSheet(SHEET_MATRIX);
  mx.clear();
  const nos = CONFIG.sessions.map(s => s.no);
  const header = ['氏名', '所属'].concat(nos.map(n => '第' + n + '回')).concat(['出席数']);
  const people = {};
  const last = log.getLastRow();
  if (last >= 2) {
    log.getRange(2, 1, last - 1, 4).getValues().forEach(r => {
      const k = r[2] + '|' + r[3];
      if (!people[k]) people[k] = { name: r[2], dept: r[3], got: {} };
      people[k].got[r[1]] = Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'M/d');
    });
  }
  const rows = Object.keys(people).sort().map(k => {
    const p = people[k];
    const marks = nos.map(n => p.got[n] ? '○ ' + p.got[n] : '');
    return [p.name, p.dept].concat(marks).concat([marks.filter(Boolean).length]);
  });
  mx.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#1F2A44').setFontColor('#FFFFFF');
  if (rows.length) mx.getRange(2, 1, rows.length, header.length).setValues(rows);
  mx.setFrozenRows(1);
  mx.autoResizeColumns(1, header.length);
}
function rebuildMatrix() { rebuildMatrix_(); }

function logSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG, 0);
    sh.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER])
      .setFontWeight('bold').setBackground('#1F2A44').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm');
  }
  return sh;
}

/** 全角/半角・空白・大小文字の揺れをそろえる */
function normalize_(v) {
  return String(v || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

/** 初回だけ手動で実行：シートを用意して権限を承認する */
function setup() {
  logSheet_();
  rebuildMatrix_();
}
