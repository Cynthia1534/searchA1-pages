/* Public snapshot. Human decisions are stored only in this browser. */
const $ = id => document.getElementById(id);
const el = (tag, className = '', value) => {
  const node = document.createElement(tag);
  node.className = className;
  if (value !== undefined) node.textContent = String(value);
  return node;
};
const storageKey = 'a1-public-gallery-local-decisions-v1';
const viewStatus = {all:null, unprocessed:'pending', later:'reserve', adopted:'adopted', rejected:'rejected'};
const viewNames = {all:'全部素材', unprocessed:'未处理', later:'待采用', adopted:'已采用', rejected:'不采用'};
const statusNames = {pending:'未处理', reserve:'待采用', adopted:'已采用', rejected:'不采用'};
const state = {data:null, local:{}, current:null, detailIndex:0, page:1};
try { state.local = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { state.local = {}; }
const decision = item => state.local[item.id] || {};
const status = item => statusNames[decision(item).status] ? decision(item).status :
  (statusNames[item.review_status] ? item.review_status : 'pending');
const tags = (item, field) => Array.isArray(item.tags?.[field]) ? item.tags[field] : [];
const label = (field, value) => state.data?.taxonomy?.[field]?.[value] || value;
const date = value => value ? String(value).slice(0,10) : '日期待确认';
const captureDay = item => {
  const value = item.first_discovered_at;
  if (!value) return '日期待确认';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return date(value);
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(parsed);
  const part = kind => parts.find(p => p.type === kind)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const formatDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${Number(value.slice(0,4))}年${Number(value.slice(5,7))}月${Number(value.slice(8,10))}日` : value;
const number = value => typeof value === 'number' ? value.toLocaleString('zh-CN') : '—';
const score = (item, kind) => item.scores?.[kind]?.score ?? null;
const view = () => Object.hasOwn(viewStatus, location.hash.slice(1)) ? location.hash.slice(1) : 'all';
const asset = path => typeof path === 'string' && /^assets\/[A-Za-z0-9_.-]+\.(jpg|png)$/.test(path) ? new URL(path, document.baseURI).href : null;
const postURL = item => {
  try {
    const url = new URL(item.post_url);
    if (url.protocol !== 'https:') return null;
    const hosts = item.platform === 'instagram' ? ['instagram.com','www.instagram.com'] : ['tiktok.com','www.tiktok.com'];
    const path = item.platform === 'instagram' ? /^\/(p|reel)\/[\w-]+\/?$/ : /^\/@[^/]+\/(video|photo)\/\d+\/?$/;
    return hosts.includes(url.hostname) && path.test(url.pathname) ? url.href : null;
  } catch { return null; }
};
let feedbackTimer;
function feedback(message, error=false) {
  const node = $('storage-feedback');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.hidden = false;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { node.hidden = true; }, 3800);
}
function save(item, patch) {
  const previous = decision(item);
  if (Object.entries(patch).every(([key, value]) => (key === 'status' ? status(item) : previous[key]) === value)) {
    feedback(`当前已是「${statusNames[status(item)]}」`);
    return true;
  }
  state.local[item.id] = {...previous, ...patch};
  try {
    localStorage.setItem(storageKey, JSON.stringify(state.local));
    const newStatus = status(item);
    feedback(patch.status ? (newStatus === 'pending' ? '已恢复未处理' : `已加入${statusNames[newStatus]}`) : '备注已保存到此浏览器');
    render();
    return true;
  } catch {
    if (Object.keys(previous).length) state.local[item.id] = previous;
    else delete state.local[item.id];
    feedback('保存失败：此浏览器的本地存储不可用', true);
    render();
    return false;
  }
}
function fillOptions() {
  for (const [id, field] of [['relation','relation_tags'], ['topic','topic_tags'], ['style','style_tags']]) {
    const select = $(id);
    select.length = 1;
    const values = [...new Set(state.data.materials.flatMap(item => tags(item, field)))].sort((a,b) => label(field,a).localeCompare(label(field,b),'zh-CN'));
    values.forEach(value => select.add(new Option(label(field,value),value)));
  }
  const days = [...new Set(state.data.materials.map(captureDay))].sort().reverse();
  const daySelect = $('day');
  daySelect.length = 1;
  days.forEach(value => daySelect.add(new Option(formatDay(value), value)));
}
function matches(item) {
  if (viewStatus[view()] && status(item) !== viewStatus[view()]) return false;
  if ($('platform').value && item.platform !== $('platform').value) return false;
  if ($('day').value && captureDay(item) !== $('day').value) return false;
  if ($('day-from').value && captureDay(item) < $('day-from').value) return false;
  if ($('day-to').value && captureDay(item) > $('day-to').value) return false;
  if ($('suitability').value && item.suitability !== $('suitability').value) return false;
  for (const [id, field] of [['relation','relation_tags'], ['topic','topic_tags'], ['style','style_tags']]) {
    if ($(id).value && !tags(item, field).includes($(id).value)) return false;
  }
  const query = $('search').value.trim().toLowerCase();
  if (!query) return true;
  const haystack = [item.description,item.creator,item.caption,item.recommendation_reason,...Object.entries(item.tags||{}).flatMap(([field,values]) => (values||[]).map(value => label(field,value)))].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}
function compareItems(a,b) {
  const sort = $('sort').value;
  const value = {
    discovered: item => item.first_discovered_at || '',
    published: item => item.published_at || item.published_date || '',
    engagement: item => item.metrics?.likes ?? -1,
    creative: item => score(item,'creative') ?? -1
  }[sort];
  const x = value(a), y = value(b);
  return x < y ? 1 : x > y ? -1 : a.id.localeCompare(b.id);
}
function activeFilters() {
  const area = $('active-filters');
  area.replaceChildren();
  for (const [id,name] of [['search','搜索'],['day','采集日期'],['platform','平台'],['relation','人物'],['topic','主题'],['style','风格'],['day-from','起始'],['day-to','结束'],['suitability','内容审核'],['sort','排序']]) {
    const field = $(id);
    if (!field.value || (id === 'sort' && field.value === 'discovered')) continue;
    const value = field.selectedOptions?.[0]?.textContent || field.value;
    const chip = el('button','',`${name}：${value} ×`);
    chip.type = 'button';
    chip.addEventListener('click', () => { field.value = id === 'sort' ? 'discovered' : ''; state.page=1; render(); });
    area.append(chip);
  }
}
function mediaVisual(item,index,container) {
  container.replaceChildren();
  const src = asset(item.media?.[index]?.preview);
  if (!src) { container.append(el('span','','预览未取得')); return; }
  const img = el('img');
  img.src=src; img.loading='lazy'; img.alt=`${item.description||'素材'} · 第 ${index+1} 张真实预览`;
  img.addEventListener('error', () => container.replaceChildren(el('span','','预览加载失败')));
  container.append(img);
}
function stateActions(item) {
  const box = el('div','status-cell');
  const current = status(item);
  box.append(el('span',`status-label ${current}`,statusNames[current]));
  const group = el('div','state-actions');
  group.setAttribute('role','group');
  group.setAttribute('aria-label',`${item.description||'素材'} 的人工状态`);
  for (const [value,name] of [['adopted','采用'],['reserve','暂存备用'],['rejected','不采用']]) {
    const button = el('button',`state-button${current===value?' selected':''}`,name);
    button.type='button'; button.dataset.status=value;
    button.setAttribute('aria-pressed',String(current===value));
    button.addEventListener('click', () => save(item,{status:value}));
    group.append(button);
  }
  box.append(group);
  if (current !== 'pending') {
    const reset = el('button','undo','恢复未处理');
    reset.type='button';
    reset.addEventListener('click', () => save(item,{status:'pending'}));
    box.append(reset);
  }
  return box;
}
function row(item) {
  const article = el('article',`row ${status(item)}`);
  article.dataset.id=item.id;
  const thumb = el('button','thumb');
  thumb.type='button'; thumb.setAttribute('aria-label',`查看 ${item.description||'素材'} 预览`);
  mediaVisual(item,0,thumb);
  if ((item.media||[]).length > 1) thumb.append(el('span','count',`${item.media.length} 张`));
  thumb.addEventListener('click', () => openDetail(item));
  article.append(thumb);
  const title = el('div','row-title');
  const titleButton = el('button','title',item.description||'候选素材');
  titleButton.type='button'; titleButton.addEventListener('click', () => openDetail(item));
  title.append(titleButton);
  const chips = el('div','chips');
  for (const [field,value] of Object.entries(item.tags||{}).flatMap(([field,values]) => (values||[]).map(v => [field,v])).slice(0,3)) chips.append(el('span','chip',label(field,value)));
  title.append(chips);
  article.append(title);
  const meta = el('div','row-meta');
  meta.append(el('span','platform',item.platform==='instagram'?'Instagram':'TikTok'),el('span','account',`@${item.creator||'未知账号'}`),el('span','meta',`发布 ${date(item.published_at||item.published_date)}`),el('span','meta',`采集 ${captureDay(item)}`));
  article.append(meta);
  const metrics = el('div','row-numbers');
  metrics.append(el('strong','',`创意 ${score(item,'creative')??'待评'}`),el('span','',`赞 ${number(item.metrics?.likes)} · 评 ${number(item.metrics?.comments)}`));
  article.append(metrics);
  const linkCell = el('div','link-cell');
  const url = postURL(item);
  if (url) { const link=el('a','',`打开原帖 ↗`);link.href=url;link.target='_blank';link.rel='noopener noreferrer';linkCell.append(link); }
  else linkCell.append(el('span','','原帖链接不可用'));
  if (item.suitability === 'review') linkCell.append(el('span','review-note','仅预览初筛'));
  article.append(linkCell,stateActions(item));
  return article;
}
function render() {
  if (!state.data) return;
  const materials = state.data.materials;
  const current = view();
  const counts = {all:materials.length, unprocessed:0, later:0, adopted:0, rejected:0};
  const statusViews = {pending:'unprocessed',reserve:'later',adopted:'adopted',rejected:'rejected'};
  materials.forEach(item => counts[statusViews[status(item)]]++);
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav===current);
    link.setAttribute('aria-current', link.dataset.nav===current ? 'page' : 'false');
  });
  document.querySelectorAll('[data-count]').forEach(node => { node.textContent=counts[node.dataset.count]; });
  $('view-title').textContent=viewNames[current];
  $('section-title').textContent=viewNames[current];
  $('view-description').textContent='按首次采集日期归档；仅按预览适宜性初筛，普通摄影也可收录。';
  const review = materials.filter(item => item.suitability==='review').length;
  $('summary').textContent=`公开快照 ${materials.length} 条 · 仅预览初筛 ${review} 条 · 人工状态仅此浏览器保存`;
  activeFilters();
  const items = materials.filter(matches);
  const groups = new Map();
  for (const item of items) { const day=captureDay(item); if (!groups.has(day)) groups.set(day,[]); groups.get(day).push(item); }
  const days = [...groups.keys()].sort().reverse();
  days.forEach(day => groups.get(day).sort(compareItems));
  const ordered = days.flatMap(day => groups.get(day));
  const pages = Math.max(1,Math.ceil(ordered.length/20));
  state.page=Math.min(state.page,pages);
  const shown=ordered.slice((state.page-1)*20,state.page*20);
  const shownGroups = new Map();
  for (const item of shown) { const day=captureDay(item); if (!shownGroups.has(day)) shownGroups.set(day,[]); shownGroups.get(day).push(item); }
  const cards=$('cards'); cards.replaceChildren();
  for (const [day, dayItems] of shownGroups) {
    const section=el('section','date-group'); section.dataset.day=day;
    const heading=el('h2','date-title'); heading.append(el('span','',formatDay(day)),el('small','',`${groups.get(day).length} 条`));
    section.append(heading,...dayItems.map(row));
    cards.append(section);
  }
  $('result-count').textContent=`${ordered.length} 条结果`;
  $('empty').hidden=ordered.length!==0;
  $('pagination').hidden=pages<=1;
  $('page-label').textContent=`${state.page} / ${pages}`;
  $('previous').disabled=state.page<=1;
  $('next').disabled=state.page>=pages;
  $('loading').hidden=true;
}
function detailMedia() {
  const item=state.current;
  mediaVisual(item,state.detailIndex,$('detail-visual'));
  const visual=$('detail-vision'), analysis=item.media?.[state.detailIndex]?.visual_analysis;
  visual.hidden=!analysis;
  if (analysis) { const result=analysis.result; visual.textContent=`AI 单图建议 · ${analysis.model} · ${result.content_type} · 适宜性建议 ${result.appropriateness} · 视觉 ${result.visual_quality_score} / 创意 ${result.creative_novelty_score} / 市场相关 ${result.market_relevance_score} · ${result.reasoning_summary}。仅分析当前图片，不代表整帖审核。`; }
  const nav=$('detail-media-nav'); nav.replaceChildren();
  if ((item.media||[]).length<2) return;
  item.media.forEach((_,index) => { const button=el('button',index===state.detailIndex?'active':'',String(index+1));button.type='button';button.addEventListener('click',()=>{state.detailIndex=index;detailMedia();});nav.append(button); });
}
function openDetail(item) {
  state.current=item;state.detailIndex=0;detailMedia();
  $('detail-platform').textContent=(item.platform==='instagram'?'Instagram':'TikTok')+(item.suitability==='review'?' · 仅预览初筛':' · 整帖已审核');
  $('detail-title').textContent=item.description||'候选素材';
  $('detail-meta').textContent=`@${item.creator||'未知账号'} · 发布 ${date(item.published_at||item.published_date)} · 采集 ${captureDay(item)}`;
  const chips=$('detail-tags');chips.replaceChildren();
  for (const [field,value] of Object.entries(item.tags||{}).flatMap(([field,values])=>(values||[]).map(v=>[field,v]))) chips.append(el('span','chip',label(field,value)));
  $('detail-reason').textContent=item.recommendation_reason||'推荐理由待确认';
  $('detail-scores').textContent=`数据表现 ${score(item,'data')??'待评'} · 创意发现 ${score(item,'creative')??'待评'}`;
  $('detail-metrics').textContent=`点赞 ${number(item.metrics?.likes)} · 评论 ${number(item.metrics?.comments)} · 播放 ${number(item.metrics?.views)}`;
  const select=$('detail-status');select.replaceChildren();
  for (const [value,name] of Object.entries(statusNames)) select.add(new Option(name,value));
  select.value=status(item);
  $('detail-note').value=decision(item).note||'';
  $('detail-caption').textContent=item.caption||'原帖说明未取得';
  $('detail-history').replaceChildren(...(item.metric_snapshots||[]).map(snapshot=>el('div','',`${date(snapshot.captured_at)} · 赞 ${number(snapshot.likes)} · 评 ${number(snapshot.comments)} · 播 ${number(snapshot.views)}`)));
  const link=$('detail-link'), url=postURL(item);link.hidden=!url;if(url)link.href=url;
  $('detail').showModal();
}
async function load() {
  try {
    $('error').hidden=true;$('loading').hidden=false;
    const response=await fetch('./data/materials.json',{cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if (data.schema_version!==1 || !Array.isArray(data.materials)) throw new Error('素材数据格式无效');
    const seen=new Set(); data.materials=data.materials.filter(item=>{ if(!item.id||seen.has(item.id)) return false;seen.add(item.id);return true; });
    state.data=data;fillOptions();
    $('snapshot-time').textContent=`快照 ${date(data.generated_at)}`;
    render();
  } catch (error) { $('loading').hidden=true;$('error').hidden=false;$('error-message').textContent=`请检查网络并重试：${error.message}`; }
}
$('filters').addEventListener('submit',event=>event.preventDefault());
for (const eventName of ['input','change']) $('filters').addEventListener(eventName,()=>{state.page=1;render();});
$('filters').addEventListener('reset',()=>setTimeout(()=>{state.page=1;render();},0));
$('retry').addEventListener('click',load);
$('previous').addEventListener('click',()=>{state.page--;render();});
$('next').addEventListener('click',()=>{state.page++;render();});
$('close-detail').addEventListener('click',()=>$('detail').close());
$('detail').addEventListener('click',event=>{if(event.target===$('detail')) $('detail').close();});
$('detail-status').addEventListener('change',event=>{if(state.current) save(state.current,{status:event.target.value});});
$('detail-note').addEventListener('change',event=>{if(state.current) save(state.current,{note:event.target.value});});
addEventListener('hashchange',()=>{state.page=1;render();});
load();
