// script.js
// App: JSON-driven playlist + Fuse.js fuzzy search + category filter + player
// Author: You
// Keep this file in same folder as index.html + data.json

const DATA_PATH = 'data.json'; // same folder

// UI elements
const listArea = document.getElementById('listArea');
const searchInput = document.getElementById('searchInput');
const suggestions = document.getElementById('suggestions');
const clearSearch = document.getElementById('clearSearch');
const catBtns = document.querySelectorAll('.cat-btn');
const noResults = document.getElementById('noResults');

const playerArea = document.getElementById('playerArea');
const mediaPlayer = document.getElementById('mediaPlayer');
const playerThumb = document.getElementById('playerThumb');
const playerTitle = document.getElementById('playerTitle');
const playerCategory = document.getElementById('playerCategory');
const closePlayer = document.getElementById('closePlayer');

let rawData = [];
let fuse = null;
let currentCategory = 'all';
let lastResults = [];

// debounce util
function debounce(fn, wait=220){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this,args), wait);
  }
}

// fetch data.json
async function loadData(){
  try{
    const res = await fetch(DATA_PATH);
    if(!res.ok) throw new Error('data.json load failed');
    const data = await res.json();
    rawData = data;
    initFuse();
    renderList(rawData);
  }catch(err){
    console.error(err);
    listArea.innerHTML = `<p style="color:#f88">डेटा लोड नहीं हुआ — data.json चेक करें।</p>`;
  }
}

// setup Fuse
function initFuse(){
  const options = {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'category', weight: 0.2 },
      { name: 'tags', weight: 0.1 }
    ],
    threshold: 0.35, // fuzzy threshold (lower = stricter)
    includeScore: true,
    shouldSort: true,
    ignoreLocation: true,
    useExtendedSearch: false,
  };
  fuse = new Fuse(rawData, options);
}

// Render grid of cards
function renderList(items){
  listArea.innerHTML = '';
  if(!items || items.length === 0){
    noResults.classList.remove('hide');
    return;
  }
  noResults.classList.add('hide');

  const frag = document.createDocumentFragment();
  items.forEach((it, idx)=>{
    const a = document.createElement('article');
    a.className = 'card';
    a.tabIndex = 0;
    a.innerHTML = `
      <img loading="lazy" src="${it.thumbnail}" alt="${escapeHtml(it.title)}" />
      <div class="meta">
        <h4>${highlightText(it.title, searchInput.value)}</h4>
        <p>${escapeHtml(capitalize(it.category))} • ${it.duration || ''}</p>
      </div>
    `;
    a.addEventListener('click', ()=> playItem(it));
    a.addEventListener('keydown', (e)=> { if(e.key === 'Enter') playItem(it); });
    frag.appendChild(a);
  });
  listArea.appendChild(frag);
}

// play selected item
function playItem(item){
  playerArea.classList.remove('hide');
  playerThumb.src = item.thumbnail || '';
  playerTitle.textContent = item.title;
  playerCategory.textContent = capitalize(item.category);
  mediaPlayer.src = item.url;
  mediaPlayer.play().catch(()=>{ /* autoplay might be blocked */ });
  window.scrollTo({ top:0, behavior:'smooth' });
}

// close player
closePlayer.addEventListener('click', ()=> {
  playerArea.classList.add('hide');
  mediaPlayer.pause();
  mediaPlayer.src = '';
});

// category filtering
catBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    catBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.cat;
    applyFilters();
  });
});

// apply category + search
function applyFilters(){
  const q = searchInput.value.trim();
  let items = rawData.slice();

  if(currentCategory !== 'all'){
    items = items.filter(i => i.category.toLowerCase() === currentCategory.toLowerCase());
  }

  if(q.length >= 1 && fuse){
    const fuseRes = fuse.search(q);
    // map to items that are also in current category (since Fuse searched rawData)
    const mapped = fuseRes
      .map(r => r.item)
      .filter(it => (currentCategory === 'all') || (it.category.toLowerCase() === currentCategory.toLowerCase()));
    lastResults = mapped;
    renderList(mapped);
    renderSuggestions(mapped.slice(0,6));
  }else{
    lastResults = items;
    renderList(items);
    suggestions.classList.add('hide');
  }
}

// suggestions dropdown
function renderSuggestions(items){
  if(!items || items.length === 0){
    suggestions.classList.add('hide'); return;
  }
  suggestions.innerHTML = '';
  items.forEach(it=>{
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<strong>${escapeHtml(it.title)}</strong> <small style="color:var(--muted)"> • ${escapeHtml(it.category)}</small>`;
    div.addEventListener('click', ()=>{
      playItem(it);
      suggestions.classList.add('hide');
    });
    suggestions.appendChild(div);
  });
  suggestions.classList.remove('hide');
}

// search input events (debounced)
const doSearch = debounce(()=>{
  applyFilters();
}, 180);

searchInput.addEventListener('input', (e)=>{
  if(e.target.value.trim().length === 0){
    clearSearch.classList.add('hide');
  }else clearSearch.classList.remove('hide');
  doSearch();
});

clearSearch.addEventListener('click', ()=>{
  searchInput.value = '';
  clearSearch.classList.add('hide');
  applyFilters();
  searchInput.focus();
});

// Utility helpers
function escapeHtml(s=''){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function capitalize(s=''){ return s.charAt(0).toUpperCase() + s.slice(1); }

// highlight matches in titles (simple)
function highlightText(text, q){
  if(!q) return escapeHtml(text);
  try{
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    return escapeHtml(text).replace(re, (m)=>`<mark style="background:rgba(110,231,183,0.18);color:inherit;border-radius:4px;padding:0 4px">${m}</mark>`);
  }catch(e){
    return escapeHtml(text);
  }
}

// click outside suggestions to hide
document.addEventListener('click', (e)=>{
  if(!document.querySelector('.search-wrap').contains(e.target)){
    suggestions.classList.add('hide');
  }
});

// init app
loadData();
