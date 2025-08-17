class RandomWebsiteViewer {
  constructor() {
    this.urls = [];
    this.isRunning = false;
    this.currentTimeout = null;
    this.currentInterval = null;
    this.timeLeft = 0;
    this.pageViewCount = 0;
    this.currentUrlIndex = -1;
    
    this.urlInput = document.getElementById('urlInput');
    this.sitemapInput = document.getElementById('sitemapInput');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.statusText = document.getElementById('statusText');
    this.timerText = document.getElementById('timerText');
    this.currentUrlText = document.getElementById('currentUrlText');
    this.websiteFrame = document.getElementById('websiteFrame');
    this.inputTypeRadios = document.querySelectorAll('input[name="inputType"]');
    this.pageCountEl = document.getElementById('pageCount');
    this.totalUrlsEl = document.getElementById('totalUrls');
    this.clearUrlsBtn = document.getElementById('clearUrlsBtn');
    this.addSampleUrlsBtn = document.getElementById('addSampleUrlsBtn');
    this.urlInputSection = document.getElementById('urlInputSection');
    
    this.initEventListeners();
    this.updateStats();
  }
  
  initEventListeners() {
    this.startBtn.addEventListener('click', () => this.startViewing());
    this.stopBtn.addEventListener('click', () => this.stopViewing());
    this.clearUrlsBtn.addEventListener('click', () => this.clearUrls());
    this.addSampleUrlsBtn.addEventListener('click', () => this.addSampleUrls());
    
    // Handle input type switching
    this.inputTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.handleInputTypeChange());
    });
    
    // Auto-format URLs as user types/pastes
    this.urlInput.addEventListener('input', () => this.formatUrlInput());
    this.urlInput.addEventListener('paste', () => {
      setTimeout(() => this.formatUrlInput(), 100);
    });
  }
  
  formatUrlInput() {
    const input = this.urlInput.value;
    const lines = input.split('\n');
    const formattedLines = [];
    
    for (let line of lines) {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        // Add https:// if no protocol is specified
        if (!line.startsWith('http://') && !line.startsWith('https://')) {
          line = 'https://' + line;
        }
        formattedLines.push(line);
      } else if (line.startsWith('#') || line === '') {
        formattedLines.push(line);
      }
    }
    
    const formatted = formattedLines.join('\n');
    if (formatted !== input) {
      const cursorPos = this.urlInput.selectionStart;
      this.urlInput.value = formatted;
      this.urlInput.setSelectionRange(cursorPos, cursorPos);
    }
    
    this.updateUrlCount();
  }
  
  updateUrlCount() {
    const urls = this.parseUrls();
    this.totalUrlsEl.textContent = urls.length;
  }
  
  clearUrls() {
    this.urlInput.value = '';
    this.updateUrlCount();
  }
  
  addSampleUrls() {
    const sampleUrls = [
      'https://www.google.com',
      'https://www.github.com', 
      'https://www.stackoverflow.com',
      'https://www.wikipedia.org',
      'https://www.reddit.com'
    ];
    
    const currentUrls = this.urlInput.value.trim();
    const newUrls = currentUrls ? currentUrls + '\n' + sampleUrls.join('\n') : sampleUrls.join('\n');
    this.urlInput.value = newUrls;
    this.formatUrlInput();
  }
  
  updateStats() {
    this.pageCountEl.textContent = this.pageViewCount;
    this.totalUrlsEl.textContent = this.urls.length;
  }
  
  handleInputTypeChange() {
    const selectedType = document.querySelector('input[name="inputType"]:checked').value;
    
    if (selectedType === 'sitemap') {
      this.urlInputSection.style.display = 'none';
      this.sitemapInput.style.display = 'block';
    } else {
      this.urlInputSection.style.display = 'block';
      this.sitemapInput.style.display = 'none';
      this.updateUrlCount();
    }
  }
  
  async fetchSitemapUrls(sitemapUrl) {
    try {
      this.statusText.textContent = 'Loading sitemap XML...';
      
      // Try different methods to fetch sitemap
      let xmlText = '';
      
      try {
        // Method 1: Direct fetch
        const response = await fetch(sitemapUrl);
        if (response.ok) {
          xmlText = await response.text();
        } else {
          throw new Error('Direct fetch failed');
        }
      } catch (error1) {
        try {
          // Method 2: Using allorigins.win proxy
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(sitemapUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            xmlText = await response.text();
          } else {
            throw new Error('Proxy fetch failed');
          }
        } catch (error2) {
          // Method 3: Using cors.sh proxy  
          const proxyUrl2 = `https://cors.sh/${sitemapUrl}`;
          const response = await fetch(proxyUrl2);
          if (response.ok) {
            xmlText = await response.text();
          } else {
            throw new Error('All fetch methods failed');
          }
        }
      }
      
      if (!xmlText) {
        throw new Error('No XML content received');
      }
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('XML parsing error');
      }
      
      // Extract URLs from sitemap
      const urls = [];
      const locElements = xmlDoc.getElementsByTagName('loc');
      
      for (let i = 0; i < locElements.length; i++) {
        const url = locElements[i].textContent.trim();
        if (url && url.startsWith('http')) {
          urls.push(url);
        }
      }
      
      if (urls.length === 0) {
        throw new Error('No URLs found in sitemap');
      }
      
      this.statusText.textContent = `Found ${urls.length} URLs in sitemap`;
      return urls;
      
    } catch (error) {
      console.error('Error fetching sitemap:', error);
      
      // Extract domain from sitemap URL for fallback
      try {
        const url = new URL(sitemapUrl);
        const domain = url.origin;
        
        this.statusText.textContent = 'Sitemap loading failed, using domain URL instead';
        return [domain];
      } catch (urlError) {
        this.statusText.textContent = 'Sitemap loading failed, using demo URLs instead';
        return [
          'https://example.com',
          'https://httpbin.org/html',
          'https://jsonplaceholder.typicode.com',
          'https://www.wikipedia.org'
        ];
      }
    }
  }
  
  parseUrls() {
    const input = this.urlInput.value.trim();
    if (!input) {
      return [];
    }
    
    const lines = input.split('\n');
    const urls = [];
    
    for (let line of lines) {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        // Add https:// if no protocol is specified
        if (!line.startsWith('http://') && !line.startsWith('https://')) {
          line = 'https://' + line;
        }
        urls.push(line);
      }
    }
    
    return urls;
  }
  
  getRandomUrl() {
    if (this.urls.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.urls.length);
    this.currentUrlIndex = randomIndex;
    return this.urls[randomIndex];
  }
  
  getRandomDuration() {
    // Random duration between 5 and 12 seconds (5000-12000 milliseconds)
    return Math.floor(Math.random() * (12000 - 5000 + 1)) + 5000;
  }
  
  loadRandomWebsite() {
    if (!this.isRunning) return;
    
    const url = this.getRandomUrl();
    if (!url) {
      this.stopViewing();
      this.statusText.textContent = 'No valid URLs found!';
      return;
    }
    
    this.pageViewCount++;
    this.updateStats();
    
    this.statusText.textContent = `Loading website ${this.pageViewCount}...`;
    this.currentUrlText.textContent = `Current URL: ${url}`;
    this.websiteFrame.src = url;
    
    const duration = this.getRandomDuration();
    this.timeLeft = Math.ceil(duration / 1000);
    
    // Clear any existing interval
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
    }
    
    // Update timer every second
    this.currentInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft > 0) {
        this.timerText.textContent = `Next website in: ${this.timeLeft} seconds`;
      } else {
        this.timerText.textContent = 'Loading next website...';
        if (this.currentInterval) {
          clearInterval(this.currentInterval);
          this.currentInterval = null;
        }
      }
    }, 1000);
    
    // Clear any existing timeout
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }
    
    // Set timeout for next website
    this.currentTimeout = setTimeout(() => {
      if (this.isRunning) {
        this.loadRandomWebsite();
      }
    }, duration);
  }
  
  async startViewing() {
    const selectedType = document.querySelector('input[name="inputType"]:checked').value;
    
    if (selectedType === 'sitemap') {
      const sitemapUrl = this.sitemapInput.value.trim();
      if (!sitemapUrl) {
        alert('Please enter a sitemap XML URL!');
        return;
      }
      
      // Fetch URLs from sitemap
      this.urls = await this.fetchSitemapUrls(sitemapUrl);
    } else {
      this.urls = this.parseUrls();
      
      if (this.urls.length === 0) {
        alert('Please enter at least one URL!');
        return;
      }
    }
    
    this.isRunning = true;
    this.pageViewCount = 0;
    this.startBtn.disabled = true;
    this.stopBtn.disabled = false;
    this.urlInput.disabled = true;
    this.sitemapInput.disabled = true;
    this.clearUrlsBtn.disabled = true;
    this.addSampleUrlsBtn.disabled = true;
    this.inputTypeRadios.forEach(radio => radio.disabled = true);
    
    this.updateStats();
    this.statusText.textContent = `Starting random website viewing with ${this.urls.length} URLs...`;
    this.timerText.textContent = '';
    this.currentUrlText.textContent = '';
    
    // Start immediately
    this.loadRandomWebsite();
  }
  
  stopViewing() {
    this.isRunning = false;
    
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
    this.urlInput.disabled = false;
    this.sitemapInput.disabled = false;
    this.clearUrlsBtn.disabled = false;
    this.addSampleUrlsBtn.disabled = false;
    this.inputTypeRadios.forEach(radio => radio.disabled = false);
    
    this.statusText.textContent = `Stopped. Viewed ${this.pageViewCount} pages total.`;
    this.timerText.textContent = '';
    this.currentUrlText.textContent = '';
    this.websiteFrame.src = 'about:blank';
  }
}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new RandomWebsiteViewer();
});











        
