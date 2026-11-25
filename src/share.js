/*
 * X への投稿。文面の入った投稿画面を開くだけで、投稿するかどうかは本人が決める。
 * （画像つきのカードは、index.html の og:image から X が作る）
 *   https://docs.x.com/x-for-websites/post-button/guides/web-intent
 */

export const SITE_URL = "https://me1td0wn76.github.io/tabako/"; // 公開先。変えたら index.html の og:url / og:image も変える
const INTENT = "https://x.com/intent/tweet";
const HASHTAG = "WINDPROOF";

export function postUrl(text) {
  const query = { text, url: SITE_URL, hashtags: HASHTAG };
  return `${INTENT}?${Object.entries(query)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&")}`;
}

// リンクに文面を入れる。文面がないときは隠す
export function setPost(link, text) {
  link.hidden = !text;
  if (text) link.href = postUrl(text);
}

export const POSTS = {
  game: "ライターとマッチの火を、風とお邪魔から守りきるゲーム。ブラウザーで無料で遊べます。",
  lit: ({ label, tool, time, rank, isBest }) =>
    rank === "F"
      ? `【${label}】${tool}で ${time} 秒。火はついたけど、ランク F……。`
      : `【${label}】${tool}で ${time} 秒、ランク ${rank} で着火！${isBest ? "自己ベスト更新。" : ""}`,
  failed: ({ label, tool, reason }) => `【${label}】${tool}の火を守れなかった……（${reason}）`,
  unlimited: ({ count, time, isBest }) =>
    count > 0 ? `【UNLIMITED】${count} 本つけた！（合計 ${time} 秒）${isBest ? "自己ベスト更新。" : ""}` : "【UNLIMITED】1 本もつけられなかった……。",
  chill: ({ place, count }) => `【まったり喫煙】${place}で ${count} 本。……ふぅ。`,
  spot: ({ name, visited, total }) => `【ぶらり喫煙の旅】${name}で一服。（喫煙所 ${visited} / ${total}）`,
  stroll: ({ visited, total }) =>
    visited >= total ? `【ぶらり喫煙の旅】${total} か所の喫煙所、すべてで一服した！` : `【ぶらり喫煙の旅】喫煙所めぐり、${total} か所のうち ${visited} か所で一服。`,
};
