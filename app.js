// Global State
let allVerses = [];
let uniqueWords = [];
const BIBLE_URL = 'bom.txt'; // Must be in the same folder as index.html

// DOM Elements
const input = document.getElementById('search-input');
const sendBtn = document.getElementById('send-btn');
const suggestionsArea = document.getElementById('suggestions-area');
const resultsArea = document.getElementById('results-area');
const modalOverlay = document.getElementById('modal-overlay');
const modalText = document.getElementById('modal-text');
const modalRef = document.querySelector('.modal-ref');
const closeBtn = document.querySelector('.close-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check LocalStorage first to load instantly
    const savedData = localStorage.getItem('bom_data_v2'); // Changed to v2 to force refresh
    
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            allVerses = parsed.verses;
            uniqueWords = parsed.words;
            updateStatus("Ready to search.");
            return; 
        } catch (e) {
            console.warn("Saved data corrupt, reloading file...");
        }
    }
    
    // If no data, fetch the file
    await loadAndParseText();
});

// --- Logic ---

function updateStatus(msg) {
    const el = document.querySelector('.placeholder-msg');
    if(el) el.innerText = msg;
}

async function loadAndParseText() {
    updateStatus("Downloading scripture file...");
    
    try {
        const response = await fetch(BIBLE_URL);
        
        // Specific Error Handling for GitHub Pages
        if (response.status === 404) {
            throw new Error("File not found (404). Check filename is exactly 'bom.txt' on GitHub.");
        }
        if (!response.ok) {
            throw new Error(`Network Error: ${response.status}`);
        }

        updateStatus("Processing text...");
        let text = await response.text();
        
        // --- CLEANUP: Remove Project Gutenberg Headers/Footers ---
        // UPDATED: Start at the Title Page instead of 1 Nephi
        const startMarker = "AN ACCOUNT WRITTEN BY THE HAND OF MORMON";
        const startIndex = text.indexOf(startMarker);
        
        if (startIndex !== -1) {
            // Cut off the legal text before this point
            text = text.substring(startIndex);
            // Re-add the main title for looks
            text = "THE BOOK OF MORMON\n\n" + text;
        }

        // Parsing Logic
        // Split by double newlines (paragraphs)
        const rawParagraphs = text.split(/\r?\n\r?\n/);
        const tempWords = new Set();
        
        allVerses = []; // Reset

        rawParagraphs.forEach((para, index) => {
            const cleanPara = para.trim().replace(/\s+/g, ' ');
            
            // Filter out short headers or empty lines (Length > 20)
            if (cleanPara.length > 20) {
                allVerses.push({
                    id: index,
                    text: cleanPara
                });

                // Tokenize for suggestions (simple split)
                // Filter out common small words
                const words = cleanPara.toLowerCase().match(/\b[a-z]{3,}\b/g);
                if (words) {
                    words.forEach(w => tempWords.add(w));
                }
            }
        });

        uniqueWords = Array.from(tempWords).sort();

        // Save to LocalStorage
        try {
            localStorage.setItem('bom_data_v2', JSON.stringify({
                verses: allVerses,
                words: uniqueWords
            }));
        } catch (e) {
            console.warn("Storage full or disabled, will fetch next time");
        }

        updateStatus("Ready to search.");
        
    } catch (err) {
        updateStatus(`Error: ${err.message}`);
        console.error("Full Error Details:", err);
    }
}

// --- Search & UI ---

// 1. Suggestions (Debounced)
input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    suggestionsArea.innerHTML = '';
    
    if (val.length < 2) return;

    // Find matches (limit to 10 for performance)
    const matches = uniqueWords.filter(w => w.startsWith(val)).slice(0, 15);
    
    matches.forEach(word => {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.innerText = word;
        pill.onclick = () => {
            input.value = word;
            suggestionsArea.innerHTML = '';
            performSearch(word);
        };
        suggestionsArea.appendChild(pill);
    });
});

// 2. Trigger Search
sendBtn.addEventListener('click', () => performSearch(input.value));
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(input.value);
});

function performSearch(query) {
    if (!query) return;
    resultsArea.innerHTML = '';
    const q = query.toLowerCase();

    // Search Verses
    // Limit results to 50 to prevent freezing the browser on common words like "the"
    const results = allVerses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 50);

    if (results.length === 0) {
        resultsArea.innerHTML = '<div class="placeholder-msg">No matches found.</div>';
        return;
    }

    // Render Results
    results.forEach(verse => {
        const box = document.createElement('div');
        box.className = 'verse-box';
        
        // Highlight logic
        const snippet = verse.text.replace(new RegExp(`(${q})`, 'gi'), '<b style="color:var(--primary);">$1</b>');
        
        // Create a pseudo-reference title (First 30 chars...)
        const refTitle = verse.text.substring(0, 30).trim() + "...";

        box.innerHTML = `
            <span class="verse-ref">${refTitle}</span>
            <div class="verse-snippet">${snippet}</div>
        `;
        
        box.onclick = () => openPopup(refTitle, verse.text);
        resultsArea.appendChild(box);
    });
    
    // Hint if truncated
    if (results.length === 50) {
        const hint = document.createElement('div');
        hint.style.textAlign = 'center';
        hint.style.padding = '10px';
        hint.style.color = 'var(--text-light)';
        hint.innerText = "Results limited to 50 verses. Be more specific.";
        resultsArea.appendChild(hint);
    }
}

// --- Popup Logic ---

function openPopup(title, text) {
    modalRef.innerText = title;
    modalText.innerText = text;
    modalOverlay.classList.remove('hidden');
}

function closePopup() {
    modalOverlay.classList.add('hidden');
}

closeBtn.onclick = closePopup;

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closePopup();
    }
});
