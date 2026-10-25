/* Public read-only snapshot. Decisions live only in this browser; no write token exists here. */
const $ = id => document.getElementById(id);
const el = (tag, className = '', value) => { const node = document.createElement(tag); node.className = className; if (value !== undefined) node.textContent = String(value); return node; };
const views = new Set(['all','discover','daily','review']);
const labels = {pending:'待筛选',adopted:'已采用',reserve:'暂存备用',rejected:'不采用'};
const key = 'a1-public-gallery-local-decisions-v1';
const state = {data:null,local:{},current:null,detailIndex:0,page:1,latest:[]};
try { state.local = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { state.local = {}; }
const decision = item => state.local[item.id] || {};
const status = item => decision(item).status || item.review_status || 'pending';
const tags = (item, field) => Array.isArray(item.tags?.[field]) ? item.tags[field] : [];
const label = (field, value) => state.data?.taxonomy?.[field]?.[value] || value;
const date = value => value ? String(value).slice(0,10) : '日期待确认';
const number = value => typeof value === 'number' ? value.toLocaleString('zh-CN') : '—';
const score = (item, kind) => item.scores?.[kind]?.score ?? null;
const view = () => views.has(location.hash.slice(1)) ? location.hash.slice(1) : 'all';
const asset = path => typeof path === 'string' && /^assets\/[A-Za-z0-9_.-]+\.(jpg|png)$/.test(path) ? new URL(path,document.baseURI).href : null;
const postURL = item => { try { const u = new URL(item.post_url); if (u.protocol !== 'https:') return null; const hosts = item.platform === 'instagram' ? ['instagram.com','www.instagram.com'] : ['tiktok.com','www.tiktok.com']; return hosts.includes(u.hostname) && (item.platform === 'instagram' ? /^\/(p|reel)\/[\w-]+\/?$/.test(u.pathname) : /^\/@[^/]+\/(video|photo)\/\d+\/?$/.test(u.pathname)) ? u.href : null; } catch { return null; } };
function feedback(message, error=false) { const node=$('storage-feedback'); node.textContent=message; node.style.color=error?'#a33':'#435b49'; }
function save(item, patch) { const previous=decision(item); state.local[item.id]={...previous,...patch}; try { localStorage.setItem(key,JSON.stringify(state.local)); feedback('已保存到此浏览器'); render(); return true; } catch { if (Object.keys(previous).length) state.local[item.id]=previous; else delete state.local[item.id]; feedback('保存失败：浏览器本地存储不可用',true); render(); return false; } }
function fillTaxonomy() { for (const [id,field] of [['relation','relation_tags'],['topic','topic_tags'],['style','style_tags']]) { const select=$(id); select.length=1; const values=[...new Set(state.data.materials.flatMap(item=>tags(item,field)))].sort((a,b)=>label(field,a).localeCompare(label(field,b),'zh-CN')); for (const value of values) select.add(new Option(label(field,value),value)); } }
function poolFor(name) {
  const items=state.data.materials;
  return items.filter(item=>item.suitability===(name==='review'?'review':'safe'));
}
function sortDiverse(items) {
  const buckets = new Map();
  for (const item of items) {
    const group = tags(item,'relation_tags')[0] || 'unknown';
    if (!buckets.has(group)) buckets.set(group,[]);
    buckets.get(group).push(item);
  }
  for (const group of buckets.values()) group.sort((a,b) =>
    (score(b,'creative')??0)-(score(a,'creative')??0) ||
    String(b.first_discovered_at||'').localeCompare(String(a.first_discovered_at||'')));
  const order = [...buckets.keys()].sort((a,b)=>buckets.get(a).length-buckets.get(b).length);
  const output=[];
  while (order.some(name=>buckets.get(name).length))
    for (const name of order) if (buckets.get(name).length) output.push(buckets.get(name).shift());
  return output;
}
function filtered(pool) { const q=$('search').value.trim().toLowerCase(); const filtered=pool.filter(item=>{ for(const [id,field] of [['relation','relation_tags'],['topic','topic_tags'],['style','style_tags']]) if($(id).value&&!tags(item,field).includes($(id).value)) return false; if($('platform').value&&item.platform!==$('platform').value) return false;  if($('adoption').value&&status(item)!==$('adoption').value)return false; if($('day').value&&date(item.first_discovered_at)!==$('day').value) return false; if($('published-day').value&&date(item.published_at||item.published_date)!==$('published-day').value)return false; for(const [id,kind] of [['data-min','data'],['creative-min','creative']]) if($(id).value&&(score(item,kind)??-1)<Number($(id).value)) return false; if(q){const words=[item.description,item.creator,item.caption,item.recommendation_reason,...Object.entries(item.tags||{}).flatMap(([field,values])=>(values||[]).map(v=>label(field,v)))].filter(Boolean).join(' ').toLowerCase(); if(!words.includes(q))return false;} return true; }); const sort=$('sort').value; if(sort==='diverse') return sortDiverse(filtered); const value={discovered:item=>item.first_discovered_at||'',published:item=>item.published_at||item.published_date||'',engagement:item=>item.metrics?.likes??-1,creative:item=>score(item,'creative')??-1}[sort]; return filtered.sort((a,b)=>{const x=value(a),y=value(b); return x<y?1:x>y?-1:a.id.localeCompare(b.id);}); }
function activeFilters() { const area=$('active-filters'); area.replaceChildren(); for(const [id,name] of [['search','搜索'],['platform','平台'],['relation','人物'],['topic','主题'],['adoption','采用'],['sort','排序'],['style','风格'],['day','发现日期'],['published-day','发布日期'],['data-min','数据分'],['creative-min','创意分']]) {const field=$(id);if(!field.value || id==='sort'&&field.value==='diverse')continue;const value=field.selectedOptions?.[0]?.textContent||field.value;const chip=el('button','',`${name}：${value} ×`);chip.type='button';chip.addEventListener('click',()=>{field.value=id==='sort'?'diverse':'';state.page=1;render();});area.append(chip);} }
function mediaVisual(item,index,container) { container.replaceChildren(); const entry=item.media?.[index]; const src=asset(entry?.preview); if(src){const img=el('img');img.src=src;img.loading='lazy';img.alt=`${item.description||'素材'} · 第 ${index+1} 张真实预览`;img.addEventListener('error',()=>container.replaceChildren(el('span','',`预览加载失败`)));container.append(img);} else container.append(el('span','',`预览未取得`)); }
function stateActions(item) {
  const group=el('div','state-actions');
  group.setAttribute('role','group');
  group.setAttribute('aria-label',`${item.description||'素材'} 的人工状态`);
  for(const [key,name] of [['adopted','采用'],['reserve','暂存备用'],['rejected','不采用']]) {
    const button=el('button',`state-button${status(item)===key?' selected':''}`,name);
    button.type='button';button.dataset.status=key;
    button.setAttribute('aria-pressed',String(status(item)===key));
    button.title=`${name}；再次点击可恢复待筛选。仅本浏览器保存`;
    button.addEventListener('click',()=>save(item,{status:status(item)===key?'pending':key}));
    group.append(button);
  }
  return group;
}
function row(item) {
  const article=el('article','row'+(status(item)==='adopted'?' adopted':''));
  const thumb=el('button','thumb');thumb.type='button';thumb.setAttribute('aria-label',`查看 ${item.description||'素材'} 预览`);
  mediaVisual(item,0,thumb);if((item.media||[]).length>1)thumb.append(el('span','count',`${item.media.length} 张`));
  thumb.addEventListener('click',()=>openDetail(item));article.append(thumb);
  const title=el('div','row-title');const titleButton=el('button','title',item.description||'候选素材');
  titleButton.type='button';titleButton.addEventListener('click',()=>openDetail(item));title.append(titleButton);
  const chips=el('div','chips');for(const [field,value] of Object.entries(item.tags||{}).flatMap(([field,values])=>(values||[]).map(v=>[field,v])).slice(0,3))chips.append(el('span','chip',label(field,value)));
  title.append(chips);article.append(title);
  const meta=el('div','row-meta');meta.append(el('span','platform',item.platform),el('span','account',`@${item.creator||'未知账号'}`),el('span','meta',date(item.published_at||item.published_date)));article.append(meta);
  const metrics=el('div','row-numbers numbers');metrics.append(el('strong','',`创意 ${score(item,'creative')??'待评'}`),el('div','',`赞 ${number(item.metrics?.likes)} · 评 ${number(item.metrics?.comments)}`));article.append(metrics);
  const linkCell=el('div','link-cell');const url=postURL(item);if(url){const a=el('a','',`打开 ${item.platform==='instagram'?'Instagram':'TikTok'} ↗`);a.href=url;a.target='_blank';a.rel='noopener noreferrer';linkCell.append(a);}else linkCell.append(el('span','','原帖链接不可用'));
  if(item.suitability==='review')linkCell.append(el('span','','待复核 · 非正式推荐'));article.append(linkCell,stateActions(item));return article;
}
function render() {
  if(!state.data)return;
  const current=view(),names={all:'全部素材',discover:'创意发现',daily:'每日记录',review:'待复核候选'};
  const review=state.data.materials.filter(x=>x.suitability==='review').length;
  $('view-title').textContent=names[current];
  $('view-description').textContent=current==='review'?'真实帖子候选；人工筛选状态不代表内容适宜性已审核。':`本页显示已审核素材；另有 ${review} 条仅核验封面的候选，请点击上方「待复核」查看。`;
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===current));
  $('review-count').textContent=review?`(${review})`:'';
  activeFilters();const pool=poolFor(current),items=filtered(pool);state.latest=items;
  const counts={pending:0,adopted:0,reserve:0,rejected:0};for(const item of state.data.materials) counts[status(item)]++;
  $('summary').textContent=`公开快照 ${state.data.materials.length} · 正式素材 ${state.data.materials.length-review} · 待内容审核 ${review} · 待筛选 ${counts.pending} · 已采用 ${counts.adopted} · 暂存 ${counts.reserve} · 不采用 ${counts.rejected}（本机）`;
  const pages=Math.max(1,Math.ceil(items.length/20));state.page=Math.min(state.page,pages);const offset=(state.page-1)*20;
  $('section-title').textContent=names[current];$('result-count').textContent=`${items.length} 条结果 · 第 ${state.page}/${pages} 页`;
  $('cards').replaceChildren(...items.slice(offset,offset+20).map(row));$('empty').hidden=items.length!==0;
  $('empty-title').textContent=pool.length===0?(current==='review'?'暂无待复核候选':'暂无已审核素材'):'没有匹配的素材';
  $('review-link').hidden=current==='review'||pool.length>0;
  $('empty-message').textContent=pool.length===0?'尚无完成整帖视觉审核的素材。真实候选在“待复核”区；它们不会自动成为正式推荐。':'请调整或重置筛选条件。';
  $('pagination').hidden=pages<=1;$('page-label').textContent=`${state.page} / ${pages}`;$('previous').disabled=state.page<=1;$('next').disabled=state.page>=pages;$('loading').hidden=true;
}
function statusSelect(item) {const select=el('select');for(const [value,name] of Object.entries(labels)){const option=new Option(name,value);select.add(option);}select.value=status(item);select.addEventListener('change',e=>save(item,{status:e.target.value}));return select;}
function detailMedia() {const item=state.current;mediaVisual(item,state.detailIndex,$('detail-visual'));const visual=$('detail-vision'),analysis=item.media?.[state.detailIndex]?.visual_analysis;visual.hidden=!analysis;if(analysis){const result=analysis.result;visual.textContent=`AI 单图建议 · ${analysis.model} · ${result.content_type} · 适宜性建议 ${result.appropriateness} · 视觉 ${result.visual_quality_score} / 创意 ${result.creative_novelty_score} / 市场相关 ${result.market_relevance_score} · ${result.reasoning_summary}。仅分析当前图片，不代表整帖审核。`;}const nav=$('detail-media-nav');nav.replaceChildren();if((item.media||[]).length<2)return;item.media.forEach((media,index)=>{const b=el('button',index===state.detailIndex?'active':'',String(index+1));b.type='button';b.addEventListener('click',()=>{state.detailIndex=index;detailMedia();});nav.append(b);});}
function openDetail(item) {state.current=item;state.detailIndex=0;detailMedia();$('detail-platform').textContent=item.platform.toUpperCase()+(item.suitability==='review'?' · 待复核':' · 已审核');$('detail-title').textContent=item.description||'候选素材';$('detail-meta').textContent=`@${item.creator||'未知账号'} · 发布 ${date(item.published_at||item.published_date)} · 发现 ${date(item.first_discovered_at)}`;const chips=$('detail-tags');chips.replaceChildren();for(const [field,value] of Object.entries(item.tags||{}).flatMap(([field,values])=>(values||[]).map(v=>[field,v])))chips.append(el('span','chip',label(field,value)));$('detail-reason').textContent=item.recommendation_reason||'推荐理由待确认';$('detail-scores').textContent=`数据表现 ${score(item,'data')??'待评'} · 创意发现 ${score(item,'creative')??'待评'}`;$('detail-metrics').textContent=`点赞 ${number(item.metrics?.likes)} · 评论 ${number(item.metrics?.comments)} · 播放 ${number(item.metrics?.views)}`;$('detail-status').replaceWith(statusSelect(item));document.querySelector('.detail-copy select').id='detail-status';$('detail-note').value=decision(item).note||'';$('detail-caption').textContent=item.caption||'原帖说明未取得';const history=$('detail-history');history.replaceChildren(...(item.metric_snapshots||[]).map(s=>el('div','',`${date(s.captured_at)} · 赞 ${number(s.likes)} · 评 ${number(s.comments)} · 播 ${number(s.views)}`)));const link=$('detail-link'),url=postURL(item);link.hidden=!url;if(url)link.href=url;$('detail').showModal();}
async function load(){try{$('error').hidden=true;$('loading').hidden=false;const response=await fetch('./data/materials.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();if(data.schema_version!==1||!Array.isArray(data.materials))throw new Error('素材数据格式无效');state.data=data;fillTaxonomy();$('snapshot-time').textContent=`快照 ${date(data.generated_at)}`;render();}catch(error){$('loading').hidden=true;$('error').hidden=false;$('error-message').textContent=`请检查网络并重试：${error.message}`;}}
$('filters').addEventListener('submit',e=>e.preventDefault());$('filters').addEventListener('input',()=>{state.page=1;render();});$('filters').addEventListener('change',()=>{state.page=1;render();});$('reset').addEventListener('click',()=>setTimeout(()=>{state.page=1;render();},0));$('retry').addEventListener('click',load);$('previous').addEventListener('click',()=>{state.page--;render();});$('next').addEventListener('click',()=>{state.page++;render();});$('close-detail').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('click',e=>{if(e.target===$('detail'))$('detail').close();});$('detail-note').addEventListener('change',e=>{if(state.current)save(state.current,{note:e.target.value});});addEventListener('hashchange',()=>{state.page=1;render();});load();
