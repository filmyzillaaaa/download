let allData = [];

fetch('data.json')
  .then(res => res.json())
  .then(data => {
    allData = data;
    displayResults(data);
    initSearch();
  });

function displayResults(items) {
  const results = document.getElementById('results');
  results.innerHTML = '';
  
  items.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('card');
    
    card.innerHTML = `
      <h2>${item.title}</h2>
      <div class="card-content">${item.content}</div>
    `;
    results.appendChild(card);
  });
}

function initSearch() {
  const fuse = new Fuse(allData, {
    keys: ['title'],
    threshold: 0.4, // fuzzy search
  });
  
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query) {
      const results = fuse.search(query).map(res => res.item);
      displayResults(results);
    } else {
      displayResults(allData);
    }
  });
}
