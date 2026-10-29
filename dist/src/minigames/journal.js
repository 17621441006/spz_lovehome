// 森林手账：所有小游戏共用的本地存档（礼物、印章、最佳成绩、鱼类图鉴）
const KEY = 'zzb.forestJournal';

export function loadJournal() {
  let j = null;
  try { j = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  j = j && typeof j === 'object' ? j : {};
  j.items ||= {}; j.stamps ||= {}; j.best ||= {}; j.fish ||= {};
  return j;
}
export function saveJournal(j) { try { localStorage.setItem(KEY, JSON.stringify(j)); } catch { /* ignore */ } }

/** Give a list of tiered rewards for `stars`; unique rewards are only given once. */
export function grantRewards(j, rewards, stars) {
  const gained = [];
  for (const rw of rewards) {
    if (stars < rw.stars) continue;
    const had = j.items[rw.id] || 0;
    if (rw.unique && had) continue;
    j.items[rw.id] = had + rw.count; gained.push({ ...rw, first: !had });
  }
  return gained;
}
