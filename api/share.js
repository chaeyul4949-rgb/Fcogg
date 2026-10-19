// 공유 링크(/s/닉네임) 미리보기: 카카오톡·디스코드 등에 닉네임·전적이 담긴 카드가 뜨게 한다.
const API_KEY = 'live_d06fb08ceb057166fe0968ad4cadfd9a1fed2ccee836739c1df8110f165cacdfefe8d04e6d233bd35cf2fabdeb93fb0d';
const BASE = 'https://open.api.nexon.com';
const SITE = 'https://fcogg.xyz';
const TYPE_NAMES = { 50: '공식경기', 52: '감독모드', 40: '친선경기', 60: '볼타', 30: '리그 친선' };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path) {
  const r = await fetch(BASE + path, { headers: { 'x-nxopen-api-key': API_KEY } });
  if (!r.ok) throw new Error('nexon ' + r.status);
  return r.json();
}

async function summary(nick, type) {
  const { ouid } = await api(`/fconline/v1/id?nickname=${encodeURIComponent(nick)}`);
  const [basic, maxDiv, divisions, ids] = await Promise.all([
    api(`/fconline/v1/user/basic?ouid=${ouid}`).catch(() => null),
    api(`/fconline/v1/user/maxdivision?ouid=${ouid}`).catch(() => []),
    api('/static/fconline/meta/division.json').catch(() => []),
    api(`/fconline/v1/user/match?ouid=${ouid}&matchtype=${type}&offset=0&limit=10`).catch(() => []),
  ]);
  const nameOf = (id) => (divisions.find((d) => d.divisionId === id) || {}).divisionName;
  const ORDER = ['슈퍼챔피언스', '챔피언스', '슈퍼챌린지', '챌린지', '마스터', '월드클래스', '프로', '세미프로', '유망주'];
  const rank = (d) => {
    const n = String(nameOf(d.division) || '').replace(/\s/g, '');
    const g = ORDER.findIndex((k) => n.startsWith(k) && !(k === '챔피언스' && n.startsWith('슈퍼')) && !(k === '챌린지' && n.startsWith('슈퍼')) && !(k === '프로' && n.startsWith('세미')));
    return g < 0 ? 999 : g * 10 + (parseInt(n.replace(/\D/g, ''), 10) || 0);
  };
  const list = (maxDiv || []).filter((d) => d.matchType === type);
  const cands = list.length ? list : (maxDiv || []).filter((d) => d.matchType === 50);
  const best = cands.reduce((a, d) => (!a || rank(d) < rank(a) ? d : a), null);
  const tier = best ? nameOf(best.division) : null;
  const details = await Promise.all((ids || []).map((id) => api(`/fconline/v1/match-detail?matchid=${id}`).catch(() => null)));
  let w = 0, d = 0, l = 0, form = '', curTier = null;
  for (const m of details) {
    const me = m && m.matchInfo && m.matchInfo.find((i) => i.ouid === ouid);
    if (curTier === null && me && me.division && (type === 50 || type === 52)) curTier = nameOf(me.division) || null;
    const res = me && me.matchDetail && me.matchDetail.matchResult;
    if (res === '승') { w++; form += '승'; } else if (res === '무') { d++; form += '무'; } else if (res === '패') { l++; form += '패'; }
  }
  return { nick: (basic && basic.nickname) || nick, level: basic && basic.level, tier, curTier, w, d, l, form };
}

module.exports = async (req, res) => {
  const nick = String(req.query.nick || '').trim().slice(0, 30);
  const type = TYPE_NAMES[+req.query.type] ? +req.query.type : 50;
  const target = `${SITE}/?nick=${encodeURIComponent(nick)}${type !== 50 ? '&type=' + type : ''}`;
  let title = nick ? `${nick}님의 FC 온라인 전적 | FCO.GG` : 'FCO.GG | FC 온라인 전적 검색';
  let desc = '구단의 모든 기록, 분석의 시작. FC 온라인 전적 검색 · AI 경기 분석 · 팀컬러/특성 티어리스트';

  if (nick) {
    try {
      const s = await Promise.race([summary(nick, type), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
      const games = s.w + s.d + s.l;
      title = `${s.nick}님의 FC 온라인 전적 | FCO.GG`;
      const parts = [];
      if (s.curTier) parts.push(`현재 ${s.curTier}`);
      if (s.tier) parts.push(`최고 ${s.tier}`);
      if (s.level) parts.push(`Lv.${s.level}`);
      if (games) parts.push(`최근 ${games}경기 ${s.w}승 ${s.d}무 ${s.l}패 (승률 ${Math.round((s.w / games) * 100)}%)`);
      if (s.form) parts.push(s.form.slice(0, 5).split('').join(' '));
      if (parts.length) desc = `${TYPE_NAMES[type]} · ${parts.join(' · ')}`;
    } catch (e) { /* 넥슨 API 실패 시 기본 문구로 */ }
  }

  const selfUrl = `${SITE}/s/${encodeURIComponent(nick)}${type !== 50 ? '?type=' + type : ''}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FCO.GG">
<meta property="og:url" content="${esc(selfUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og-banner-v4.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og-banner-v4.png">
</head><body style="background:#1E2430;color:#fff;font-family:sans-serif;text-align:center;padding-top:40vh">
<a href="${esc(target)}" style="color:#4A8FEA">${esc(title)} 보러 가기</a>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`);
};
