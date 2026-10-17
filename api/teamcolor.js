// 팀컬러 이용률 (넥슨 데이터센터 데일리 차트 공개 페이지)
// 넥슨이 매일 낮 12시(한국 시간)에 갱신하므로, 결과를 다음 12:10까지 캐시해서 하루 한 번 새로 받아온다.
const URL_DAILY = 'https://fconline.nexon.com/datacenter/dailysquad';
const COUNT = 21;

async function getTeamColors() {
  const html = await (await fetch(URL_DAILY)).text();
  const start = html.indexOf('id="divTeamColorInfo"');
  if (start < 0) throw new Error('teamcolor block not found');
  const re = /<img src="([^"]+)"[^>]*>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="txt">([^<]+)<\/div>\s*<div class="per">([\d,]+)명 \(([\d.]+)%\)<\/div>/g;
  const block = html.slice(start);
  const out = [];
  let m;
  while ((m = re.exec(block)) && out.length < COUNT) {
    out.push({ name: m[2].trim(), count: Number(m[3].replace(/,/g, '')), rate: Number(m[4]), logo: m[1] });
  }
  if (out.length < 5) throw new Error('teamcolor parse failed');
  return out;
}

// 다음 한국 시간 12:10까지 남은 초
function secondsUntilNextRefresh() {
  const now = Date.now();
  const kst = new Date(now + 9 * 3600 * 1000);
  const next = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 12, 10) - 9 * 3600 * 1000;
  const target = next > now ? next : next + 24 * 3600 * 1000;
  return Math.max(60, Math.round((target - now) / 1000));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const teamColors = await getTeamColors();
    res.setHeader('Cache-Control', `public, s-maxage=${secondsUntilNextRefresh()}, stale-while-revalidate=3600`);
    res.status(200).send(JSON.stringify({ fetchedAt: new Date().toISOString(), teamColors }));
  } catch (e) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(502).send(JSON.stringify({ error: 'nexon unavailable' }));
  }
};
