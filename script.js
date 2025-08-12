// script.js
// JSON-driven media app with Fuse.js fuzzy search and nice UI
const DATA_FILE = 'data.json';

const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const suggestBox = document.getElementById('suggestBox');
const grid = document.getElementById('grid');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
const filtersEl = document.getElementById('filters');

const modal = document.getElementById('modal');
const modalBack = document.getElementById('modalBack');
const modalBody = document.getElementById('modalBody');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');

let DATA = [];
let fuse = null;
let currentCat = 'all';
let categories = ['all'];

function escapeHtml(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// load JSON
async function loadData(){
  try{
    const res = await fetch(DATA_FILE);
    if(!res.ok) throw new Error('Cannot load data.json');
    const json = await res.json();
    DATA = json;
    buildCategories();
    initFuse();
    renderList(DATA);
  }catch(err){
    console.error(err);
    grid.innerHTML = `<div style="color:#f88;padding:20px">डेटा लोड में समस्या — data.json चेक करो।</div>`;
  }
}

// categories from data
function buildCategories(){
  const set = new Set(['all']);
  DATA.forEach(i=>{
    const c = (i.type || 'other').toLowerCase();
    set.add(c);
  });
  categories = Array.from(set);
  filtersEl.innerHTML = '';
  categories.forEach(cat=>{
    const btn = document.createElement('button');
    btn.className = 'chip' + (cat==='all' ? ' active' : '');
    btn.textContent = (cat==='all') ? 'सब दिखाएं' : capitalize(cat);
    btn.dataset.cat = cat;
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = cat;
      applyFilter(searchInput.value.trim());
    });
    filtersEl.appendChild(btn);
  });
}

// Fuse setup
function initFuse(){
  const options = {
    keys: [
      {name: 'title', weight: 0.7},
      {name: 'tags', weight: 0.15},
      {name: 'type', weight: 0.1},
      {name: 'content', weight: 0.05}
    ],
    threshold: 0.40,
    ignoreLocation: true,
    includeScore: true,
    useExtendedSearch: true
  };
  fuse = new Fuse(DATA, options);
}

// render cards
function renderList(items){
  grid.innerHTML = '';
  if(!items || items.length === 0){
    emptyEl.classList.remove('hide');
    countEl.textContent = '0 परिणाम';
    return;
  }
  emptyEl.classList.add('hide');
  countEl.textContent = `${items.length} परिणाम`;

  const frag = document.createDocumentFragment();
  items.forEach(item=>{
    const c = document.createElement('article');
    c.className = 'card';
    // create thumbnail preview from content if iframe or img or link
    let thumbHtml = '<div class="thumb"><div style="padding:6px;color:var(--muted);font-size:12px">No Preview</div></div>';
    // try to extract image src from content
    const contentLower = (item.content || '').toLowerCase();
    const imgMatch = (item.content || '').match(/<img[^>]+src=['"]([^'"]+)['"]/i);
    const iframeMatch = (item.content || '').match(/src=['"]([^'"]+)['"]/i);
    if(imgMatch) {
      thumbHtml = `<div class="thumb"><img loading="lazy" src="${imgMatch[1]}" alt="${escapeHtml(item.title)}"></div>`;
    } else if(iframeMatch && iframeMatch[1].includes('youtube')) {
      // use youtube thumbnail
      const vid = parseYouTubeId(iframeMatch[1]);
      if(vid){
        const t = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
        thumbHtml = `<div class="thumb"><img loading="lazy" src="${t}" alt="${escapeHtml(item.title)}"></div>`;
      }
    } else {
      thumbHtml = `<div class="thumb"><img loading="lazy" src="https://via.placeholder.com/320x180?text=${encodeURIComponent(item.type||'media')}" alt=""></div>`;
    }

    c.innerHTML = `
      ${thumbHtml}
      <div class="meta">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${capitalize(item.type || 'other')} • ${escapeHtml(item.tagline || '')}</p>
        <div class="tags">${(item.tags||[]).slice(0,3).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    `;
    c.addEventListener('click', ()=> openModal(item));
    frag.appendChild(c);
  });

  grid.appendChild(frag);
}

// open modal with item content
function openModal(item){
  modal.classList.remove('hide');
  modal.setAttribute('aria-hidden','false');
  // clear
  modalBody.innerHTML = '';
  modalTitle.textContent = item.title || '';

  // Insert content. Expect item.content contains safe HTML (iframe/img/a).
  // If you worry about XSS, sanitize or allow only known tags.
  const wrapper = document.createElement('div');
  wrapper.className = 'player-wrap';
  wrapper.innerHTML = item.content || '';
  // Make iframes responsive
  wrapper.querySelectorAll('iframe').forEach(ifr=>{
    ifr.style.width = '100%';
    ifr.style.height = '360px';
    ifr.setAttribute('loading','lazy');
    ifr.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    ifr.setAttribute('allowfullscreen','');
  });
  // images: ensure max-width
  wrapper.querySelectorAll('img').forEach(img=>{
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
  });
  // links: open in new tab
  wrapper.querySelectorAll('a').forEach(a=>{
    a.setAttribute('target','_blank');
    a.setAttribute('rel','noopener');
  });

  modalBody.appendChild(wrapper);
  // scroll modal to top
  modalBody.scrollTop = 0;
}

// helpers
function parseYouTubeId(url){
  if(!url) return null;
  // common patterns
  const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function capitalize(s=''){ if(!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }

// search logic (debounced)
function debounce(fn, wait=160){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; }

const doSearch = debounce((q)=>{
  applyFilter(q);
}, 160);

searchInput.addEventListener('input', (e)=>{
  const q = e.target.value.trim();
  if(q.length) clearBtn.style.opacity = 1; else clearBtn.style.opacity = 0;
  doSearch(q);
  showSuggestions(q);
});

clearBtn.addEventListener('click', ()=>{
  searchInput.value = '';
  clearBtn.style.opacity = 0;
  applyFilter('');
  suggestBox.classList.add('hide');
  searchInput.focus();
});

// suggestions using Fuse (top 6)
function showSuggestions(q){
  if(!q || q.length < 1){ suggestBox.classList.add('hide'); return; }
  const res = fuse.search(q, {limit:8}).map(r=>r.item);
  if(!res || res.length === 0){ suggestBox.classList.add('hide'); return; }
  suggestBox.innerHTML = '';
  res.forEach(it=>{
    const d = document.createElement('div');
    d.className = 's-item';
    d.innerHTML = `<strong>${escapeHtml(it.title)}</strong> <small>• ${capitalize(it.type)}</small>`;
    d.addEventListener('click', ()=>{
      openModal(it);
      suggestBox.classList.add('hide');
    });
    suggestBox.appendChild(d);
  });
  suggestBox.classList.remove('hide');
}

// apply filter by category + query
function applyFilter(q=''){
  let items = DATA.slice();
  if(currentCat && currentCat !== 'all'){
    items = items.filter(i => (i.type||'').toLowerCase() === currentCat.toLowerCase());
  }
  if(q && q.length > 0 && fuse){
    const res = fuse.search(q);
    items = res.map(r => r.item).filter(it => (currentCat==='all') || (it.type && it.type.toLowerCase() === currentCat.toLowerCase()));
  }
  renderList(items);
}

// click outside suggestions to hide
document.addEventListener('click', (e)=>{
  if(!document.querySelector('.searchbox').contains(e.target)){
    suggestBox.classList.add('hide');
  }
});

// modal close
modalBack.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
function closeModal(){
  modal.classList.add('hide');
  modal.setAttribute('aria-hidden','true');
  modalBody.innerHTML = '';
  modalTitle.textContent = '';
}

// init
loadData();
