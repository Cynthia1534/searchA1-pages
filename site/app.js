/* Public GitHub Pages client. No GitHub token, password, or write API is used here. */
const byId = id => document.getElementById(id);
const text = (node, value) => { node.textContent = value ?? ''; return node; };
const make = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) text(node, value); return node; };
const views = new Set(['discover', 'all', 'review', 'daily', 'adopted', 'reserve']);
const statusLabels = { pending: '待筛选', adopted: '已采用', reserve: '暂存备用', rejected: '不采用' };
const state = { data: null, local: {}, current: null, detailIndex: 0 };
const storageKey = 'a1-public-gallery-local-decisions-v1';

try { state.local = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { state.local = {}; }
function saveLocal() {
  try { localStorage.setItem(storageKey, JSON.stringify(state.local)); } catch { /* Browser storage may be unavailable. */ }
}
function decision(item) { return state.local[item.id] || {}; }
function status(item) { return decision(item).status || item.review_status || 'pending'; }
function updateDecision(item, patch) { state.local[item.id] = { ...decision(item), ...patch }; saveLocal(); render(); }
function labelFor(field, key) { return state.data?.taxonomy?.[field]?.[key] || key; }
function tags(item, field) { return Array.isArray(item.tags?.[field]) ? item.tags[field] : []; }
function visibleDate(value) { return value ? String(value).slice(0, 10) : '日期待确认'; }
function number(value) { return typeof value === 'number' ? value.toLocaleString('zh-CN') : '—'; }
function score(item, kind) { return item.scores?.[kind]?.score ?? null; }
function assetURL(preview) { return typeof preview === 'string' && /^assets\/[A-Za-z0-9_.-]+\.(jpg|png)$/.test(preview) ? new URL(preview, document.baseURI).href : null; }
function currentView() { const name = location.hash.slice(1); return views.has(name) ? name : 'discover'; }

function fillTaxonomy() {
  for (const [selectId, field] of [['relation','relation_tags'], ['topic','topic_tags'], ['style','style_tags']]) {
    const select = byId(selectId);
    while (select.options.length > 1) select.remove(1);
    const keys = [...new Set(state.data.materials.flatMap(item => tags(item, field)))];
    keys.sort((a,b) => labelFor(field,a).localeCompare(labelFor(field,b),'zh-CN'));
    for (const key of keys) { const option = new Option(labelFor(field,key),key); select.add(option); }
  }
}

function renderStats() {
  const items = state.data.materials;
  const stats = [
    ['已审核成片', items.filter(item => item.suitability === 'safe').length],
    ['待复核候选', items.filter(item => item.suitability === 'review').length],
    ['已采用标记', items.filter(item => status(item) === 'adopted').length],
    ['暂存备用标记', items.filter(item => status(item) === 'reserve').length],
  ];
  byId('stats').replaceChildren(...stats.map(([name, count]) => {
    const block = make('div','stat'); block.append(make('span','',name),make('strong','',String(count))); return block;
  }));
}

function viewItems(view) {
  const items = state.data.materials;
  if (view === 'all') return items.filter(item => item.suitability === 'safe');
  if (view === 'review') return items.filter(item => item.suitability === 'review');
  if (view === 'adopted') return items.filter(item => status(item) === 'adopted' && item.suitability === 'safe');
  if (view === 'reserve') return items.filter(item => status(item) === 'reserve');
  if (view === 'discover') {
    const safe = items.filter(item => item.suitability === 'safe');
    return safe.length ? safe : items.filter(item => item.suitability === 'review');
  }
  return items;
}

function filterItems(items) {
  const query = byId('search').value.trim().toLowerCase();
  const platform = byId('platform').value;
  const relation = byId('relation').value;
  const topic = byId('topic').value;
  const style = byId('style').value;
  const day = byId('day').value;
  const dataMin = byId('data-min').value;
  const creativeMin = byId('creative-min').value;
  const filtered = items.filter(item => {
    if (platform && item.platform !== platform) return false;
    if (relation && !tags(item,'relation_tags').includes(relation)) return false;
    if (topic && !tags(item,'topic_tags').includes(topic)) return false;
    if (style && !tags(item,'style_tags').includes(style)) return false;
    if (day && visibleDate(item.first_discovered_at) !== day) return false;
    if (dataMin && (score(item,'data') ?? -1) < Number(dataMin)) return false;
    if (creativeMin && (score(item,'creative') ?? -1) < Number(creativeMin)) return false;
    if (query) {
      const labels = Object.entries(item.tags || {}).flatMap(([field,values]) => (values || []).map(value => labelFor(field,value)));
      const haystack = [item.description,item.creator,item.caption,item.recommendation_reason,...labels].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  const sort = byId('sort').value;
  const order = {
    discovered: item => item.first_discovered_at || '', published: item => item.published_at || item.published_date || '',
    engagement: item => item.metrics?.likes ?? -1, creative: item => score(item,'creative') ?? -1,
  };
  return filtered.sort((a,b) => {
    const left = order[sort](a), right = order[sort](b);
    return left < right ? 1 : left > right ? -1 : a.id.localeCompare(b.id);
  });
}

function renderActiveFilters() {
  const active = byId('active-filters'); active.replaceChildren();
  for (const [id,name] of [['search','搜索'],['platform','平台'],['relation','人物'],['topic','主题'],['style','风格'],['day','日期'],['data-min','数据分'],['creative-min','创意分']]) {
    const field = byId(id); if (!field.value) continue;
    const label = field.selectedOptions?.[0]?.textContent || field.value;
    const chip = make('button','',`${name}：${label} ×`); chip.type = 'button';
    chip.addEventListener('click',() => { field.value = ''; render(); }); active.append(chip);
  }
}

function statusSelect(item, className) {
  const select = make('select',className); select.setAttribute('aria-label','本机采用状态');
  for (const [key,label] of Object.entries(statusLabels)) {
    const option = new Option(label,key);
    if (key === 'adopted' && item.suitability !== 'safe' && status(item) !== 'adopted') option.disabled = true;
    select.add(option);
  }
  select.value = status(item);
  select.addEventListener('change',event => updateDecision(item,{status:event.target.value}));
  return select;
}

function mediaVisual(item, index, container) {
  const media = item.media?.[index]; container.replaceChildren();
  const src = assetURL(media?.preview);
  if (src) { const image = make('img'); image.src = src; image.alt = `${item.description} · 第 ${index+1} 张真实预览`; image.loading = 'lazy'; container.append(image); }
  else container.append(make('span','',`第 ${index+1} 张预览未取得 · ${media?.preview_status || '来源不完整'}`));
}

function card(item) {
  const article = make('article','card');
  const media = make('div','media'), visual = make('div','visual');
  let index = 0; mediaVisual(item,index,visual); media.append(visual,make('span','platform',item.platform.toUpperCase()));
  if ((item.media || []).length > 1) {
    const count = make('span','media-count',`1 / ${item.media.length}`); media.append(count);
    for (const [direction,label] of [[-1,'‹'],[1,'›']]) {
      const button = make('button',`carousel-btn ${direction < 0 ? 'prev' : 'next'}`,label);
      button.type = 'button'; button.setAttribute('aria-label',direction < 0 ? '上一张' : '下一张');
      button.addEventListener('click',() => { index = (index + direction + item.media.length) % item.media.length; mediaVisual(item,index,visual); count.textContent = `${index+1} / ${item.media.length}`; });
      media.append(button);
    }
  }
  const body = make('div','card-body');
  body.append(make('h3','',item.description || '候选素材'));
  const byline = make('div','byline'); byline.append(make('span','',`@${item.creator || '未知账号'}`),make('span','',visibleDate(item.published_date || item.published_at))); body.append(byline);
  const chips = make('div','chips');
  for (const [field,value] of Object.entries(item.tags || {}).flatMap(([field,values]) => (values || []).map(value => [field,value])).slice(0,3)) chips.append(make('span','chip',labelFor(field,value)));
  body.append(chips);
  const meta = make('div','card-meta'); meta.append(make('span','',`♥ ${number(item.metrics?.likes)} · 评论 ${number(item.metrics?.comments)}`),make('span','',item.suitability === 'safe' ? '已审核成片' : '待复核首图／封面')); body.append(meta);
  const scores = make('div','scores'); scores.append(make('span','',`数据 ${score(item,'data') ?? '待评'}`),make('span','',`创意 ${score(item,'creative') ?? '待评'}`)); body.append(scores);
  const foot = make('div','card-footer'); foot.append(make('span',`badge ${item.suitability === 'review' ? 'review' : ''}`,item.suitability === 'review' ? '待复核' : '适合大众'));
  const details = make('button','button secondary small','查看详情 →'); details.type = 'button'; details.addEventListener('click',() => openDetail(item)); foot.append(details); body.append(foot);
  const local = make('div','local-select'), label = make('label','', '本机采用状态'); label.append(statusSelect(item)); local.append(label); body.append(local);
  article.append(media,body); return article;
}

function render() {
  if (!state.data) return;
  const view = currentView();
  const titles = {discover:'创意发现',all:'全部成片',review:'待复核候选',daily:'每日记录',adopted:'已采用',reserve:'暂存备用'};
  text(byId('view-title'),titles[view]);
  text(byId('view-description'),view === 'review' ? '仅有首图或封面的真实候选；AI 来源、整帖画面及适宜性仍待核实。' : view === 'all' ? '只展示通过完整适宜性和最终成图审核的素材。' : view === 'daily' ? '按首次发现日期查看公开快照中的素材与互动历史。' : '围绕最终成图，观察人物关系、文化主题和视觉表达。');
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active',link.dataset.nav === view));
  renderStats(); renderActiveFilters();
  const pool = viewItems(view), items = filterItems(pool);
  text(byId('section-title'),view === 'discover' && !pool.some(item => item.suitability === 'safe') ? '待复核候选 · 非正式推荐' : titles[view]);
  text(byId('result-count'),`显示 ${items.length} / ${pool.length} 条`);
  byId('cards').replaceChildren(...items.map(card));
  byId('empty').hidden = items.length !== 0;
  text(byId('empty-title'),view === 'all' && pool.length === 0 ? '暂无已审核的最终成图' : '没有匹配的素材');
  text(byId('empty-message'),view === 'all' && pool.length === 0 ? '真实候选可在“待复核候选”查看；未审核内容不会进入正式成片库。' : '调整筛选条件，或切换到其他栏目。');
  byId('loading').hidden = true;
}

function showDetailMedia() {
  const item = state.current;
  mediaVisual(item,state.detailIndex,byId('detail-visual'));
  const nav = byId('detail-media-nav'); nav.replaceChildren();
  if ((item.media || []).length < 2) return;
  item.media.forEach((media,index) => {
    const button = make('button',index === state.detailIndex ? 'active' : '',String(media.position+1)); button.type = 'button';
    button.setAttribute('aria-label',`查看第 ${index+1} 张`);
    button.addEventListener('click',() => { state.detailIndex = index; showDetailMedia(); }); nav.append(button);
  });
}

function openDetail(item) {
  state.current = item; state.detailIndex = 0; showDetailMedia();
  text(byId('detail-platform'),item.platform.toUpperCase() + (item.suitability === 'review' ? ' · 待复核候选' : ' · 已审核成片'));
  text(byId('detail-title'),item.description); text(byId('detail-meta'),`@${item.creator || '未知账号'} · 发布 ${visibleDate(item.published_date || item.published_at)} · 首次发现 ${visibleDate(item.first_discovered_at)}`);
  const chipArea = byId('detail-tags'); chipArea.replaceChildren();
  for (const [field,value] of Object.entries(item.tags || {}).flatMap(([field,values]) => (values || []).map(value => [field,value]))) chipArea.append(make('span','chip',labelFor(field,value)));
  text(byId('detail-reason'),item.recommendation_reason || '推荐理由待人工确认；单次互动量不代表增长趋势。');
  const scores = byId('detail-scores'); scores.replaceChildren();
  for (const kind of ['data','creative']) scores.append(make('span','',`${kind === 'data' ? '数据表现' : '创意发现'}：${score(item,kind) ?? '待评'} · ${item.scores?.[kind]?.reason || '暂无可信评分依据'}`));
  text(byId('detail-metrics'),`当前快照：点赞 ${number(item.metrics?.likes)} · 评论 ${number(item.metrics?.comments)} · 播放 ${number(item.metrics?.views)}`);
  byId('detail-status').replaceWith(statusSelect(item,'detail-status')); document.querySelector('.detail-status').id = 'detail-status';
  byId('detail-note').value = decision(item).note || '';
  text(byId('detail-caption'),item.caption || '原帖说明未取得');
  const history = byId('detail-history'); history.replaceChildren();
  if (!item.metric_snapshots?.length) history.append(make('p','', '暂无互动快照'));
  for (const snapshot of item.metric_snapshots || []) history.append(make('div','',`${visibleDate(snapshot.captured_at)} · 点赞 ${number(snapshot.likes)} · 评论 ${number(snapshot.comments)} · 播放 ${number(snapshot.views)}`));
  const link = byId('detail-link'); link.href = item.post_url;
  byId('detail').showModal();
}

async function load() {
  byId('loading').hidden = false; byId('error').hidden = true;
  try {
    const response = await fetch('./data/materials.json',{cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.materials)) throw new Error('素材数据格式无效');
    state.data = data; fillTaxonomy();
    text(byId('snapshot-time'),`数据快照：${visibleDate(data.generated_at)} UTC`);
    render();
  } catch (error) {
    byId('loading').hidden = true; byId('error').hidden = false;
    text(byId('error-message'),`请检查网络或稍后重试。详情：${error.message}`);
  }
}

byId('filters').addEventListener('submit',event => { event.preventDefault(); render(); });
byId('filters').addEventListener('change',render);
byId('reset').addEventListener('click',() => setTimeout(render,0));
byId('retry').addEventListener('click',load);
byId('close-detail').addEventListener('click',() => byId('detail').close());
byId('detail').addEventListener('click',event => { if (event.target === byId('detail')) byId('detail').close(); });
byId('detail-note').addEventListener('change',event => { if (state.current) updateDecision(state.current,{note:event.target.value}); });
byId('menu-button').addEventListener('click',() => { const nav = byId('mobile-nav'); nav.hidden = !nav.hidden; byId('menu-button').setAttribute('aria-expanded',String(!nav.hidden)); });
byId('mobile-nav').addEventListener('click',event => { if (event.target.closest('a')) { byId('mobile-nav').hidden = true; byId('menu-button').setAttribute('aria-expanded','false'); } });
addEventListener('hashchange',render);
load();
