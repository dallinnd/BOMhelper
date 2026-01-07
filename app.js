// Global State
let allVerses = [];
let uniqueWords = [];
const BIBLE_URL = './bom.txt'; // Make sure this file exists locally!

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
    const savedData = localStorage.getItem('bom_data_v1');
    
    if (savedData) {
        // Load from storage if available
        const parsed = JSON.parse(savedData);
        allVerses = parsed.verses;
        uniqueWords = parsed.words;
        document.querySelector('.placeholder-msg').innerText = "Ready to search.";
    } else {
        // Fetch and parse text
        await loadAndParseText();
    }
});

// --- Logic ---

async function loadAndParseText() {
    try {
        const response = await fetch(BIBLE_URL);
        if (!response.ok) throw new Error("Could not load text file");
        const text = await response.text();
        
        // Parsing Logic for Project Gutenberg Text
        // Assumes lines starting with numbers are verses or splits by paragraphs
        // This regex looks for double newlines to split paragraphs
        const rawParagraphs = text.split(/\r?\n\r?\n/);
        
        const tempWords = new Set();
        
        rawParagraphs.forEach((para, index) => {
            const cleanPara = para.trim().replace(/\s+/g, ' ');
            if (cleanPara.length > 0) {
                // Simple heuristic: If it looks like a verse (could refine this)
                // We store the whole paragraph as a "verse" context
                allVerses.push({
                    id: index,
                    text: cleanPara
                });

                // Tokenize for suggestions (simple split)
                const words = cleanPara.toLowerCase().match(/\b\w+\b/g);
                if (words) words.forEach(w => {
                    if(w.length > 3) tempWords.add(w); // Only words > 3 chars
                });
            }
        });

        uniqueWords = Array.from(tempWords).sort();

        // Save to LocalStorage (try/catch in case of quota limit)
        try {
            localStorage.setItem('bom_data_v1', JSON.stringify({
                verses: allVerses,
                words: uniqueWords
            }));
        } catch (e) {
            console.warn("Storage full, will fetch next time");
        }

        document.querySelector('.placeholder-msg').innerText = "Ready to search.";
        
    } catch (err) {
        document.querySelector('.placeholder-msg').innerText = "Error loading text. Ensure bom.txt is present.";
        console.error(err);
    }
}

// --- Search & UI ---

// 1. Suggestions (Debounced)
input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    suggestionsArea.innerHTML = '';
    
    if (val.length < 2) return;

    // Find first 10 matches
    const matches = uniqueWords.filter(w => w.startsWith(val)).slice(0, 10);
    
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
    const results = allVerses.filter(v => v.text.toLowerCase().includes(q));

    if (results.length === 0) {
        resultsArea.innerHTML = '<div class="placeholder-msg">No matches found.</div>';
        return;
    }

    // Render Results
    results.forEach(verse => {
        const box = document.createElement('div');
        box.className = 'verse-box';
        
        // Highlight logic
        const snippet = verse.text.replace(new RegExp(q, 'gi'), match => `<b style="color:var(--primary);">${match}</b>`);
        
        // Extract a pseudo-reference (Project Gutenberg texts don't always have strict Book Chapter:Verse format readable by machine easily, so we use a snippet)
        const refTitle = verse.text.substring(0, 25) + "...";

        box.innerHTML = `
            <span class="verse-ref">${refTitle}</span>
            <div class="verse-snippet">${snippet}</div>
        `;
        
        box.onclick = () => openPopup(refTitle, verse.text);
        resultsArea.appendChild(box);
    });
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

// Close on 'X' click
closeBtn.onclick = closePopup;

// Close on backdrop click (Clicking outside the modal content)
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closePopup();
    }
});
