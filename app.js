// Global State
let allVerses = [];
let uniqueWords = [];
let legalTextContent = ""; // This acts as your "legal.txt" in memory
const BIBLE_URL = 'bom.txt';

// DOM Elements
const input = document.getElementById('search-input');
const sendBtn = document.getElementById('send-btn');
const suggestionsArea = document.getElementById('suggestions-area');
const resultsArea = document.getElementById('results-area');
const modalOverlay = document.getElementById('modal-overlay');
const modalText = document.getElementById('modal-text');
const modalRef = document.querySelector('.modal-ref');
const closeBtn = document.querySelector('.close-btn');
const legalLink = document.getElementById('legal-link');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // We change the version to 'v4' to force a fresh reload of the new logic
    const savedData = localStorage.getItem('bom_data_v4'); 
    
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            allVerses = parsed.verses;
            uniqueWords = parsed.words;
            legalTextContent = parsed.legal;
            updateStatus("Ready to search.");
            return; 
        } catch (e) {
            console.warn("Saved data corrupt, reloading file...");
        }
    }
    
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
        if (response.status === 404) throw new Error("File 'bom.txt' not found.");
        if (!response.ok) throw new Error(`Network Error: ${response.status}`);

        updateStatus("Processing text...");
        const fullText = await response.text();
        
        // --- NEW SPLIT LOGIC (Line Based) ---
        // 1. Split the entire file into an array of lines
        const allLines = fullText.split(/\r?\n/);

        // 2. Extract the first 260 lines for Legal/Disclaimer
        // (We join them back together so it reads like a document)
        legalTextContent = allLines.slice(0, 260).join('\n');

        // 3. Extract the rest (Line 261 to the end) for Scriptures
        const rawScriptureText = allLines.slice(260).join('\n');

        // --- Parsing Scriptures ---
        // We split the scripture part by "Double Newline" to get paragraphs/verses
        const rawParagraphs = rawScriptureText.split(/\n\s*\n/);
        
        const tempWords = new Set();
        allVerses = []; 

        rawParagraphs.forEach((para, index) => {
            const cleanPara = para.trim().replace(/\s+/g, ' ');
            
            // Only keep it if it has real text (more than 20 chars)
            if (cleanPara.length > 20) {
                allVerses.push({ id: index, text: cleanPara });

                // Tokenize words for the search suggestions
                // Matches words with 3 or more letters
                const words = cleanPara.toLowerCase().match(/\b[a-z]{3,}\b/g);
                if (words) words.forEach(w => tempWords.add(w));
            }
        });

        uniqueWords = Array.from(tempWords).sort();

        // Save EVERYTHING to LocalStorage
        try {
            localStorage.setItem('bom_data_v4', JSON.stringify({
                verses: allVerses,
                words: uniqueWords,
                legal: legalTextContent
            }));
        } catch (e) {
            console.warn("Storage full, will fetch next time");
        }

        updateStatus("Ready to search.");
        
    } catch (err) {
        updateStatus(`Error: ${err.message}`);
    }
}

// --- Search & UI ---

input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    suggestionsArea.innerHTML = '';
    if (val.length < 2) return;

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

sendBtn.addEventListener('click', () => performSearch(input.value));
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(input.value); });

function performSearch(query) {
    if (!query) return;
    resultsArea.innerHTML = '';
    const q = query.toLowerCase();

    // Limit results to 50
    const results = allVerses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 50);

    if (results.length === 0) {
        resultsArea.innerHTML = '<div class="placeholder-msg">No matches found.</div>';
        return;
    }

    results.forEach(verse => {
        const box = document.createElement('div');
        box.className = 'verse-box';
        // Highlight logic
        const snippet = verse.text.replace(new RegExp(`(${q})`, 'gi'), '<b style="color:var(--primary);">$1</b>');
        // Create a pseudo-reference title
        const refTitle = verse.text.substring(0, 30).trim() + "...";

        box.innerHTML = `<span class="verse-ref">${refTitle}</span><div class="verse-snippet">${snippet}</div>`;
        box.onclick = () => openPopup(refTitle, verse.text);
        resultsArea.appendChild(box);
    });
    
    if (results.length === 50) {
        const hint = document.createElement('div');
        hint.style.textAlign = 'center'; hint.style.padding = '10px'; hint.style.color = 'var(--text-light)';
        hint.innerText = "Results limited to 50 verses.";
        resultsArea.appendChild(hint);
    }
}

// --- Popup & Legal Logic ---

function openPopup(title, text) {
    modalRef.innerText = title;
    modalText.innerText = text;
    modalOverlay.classList.remove('hidden');
}

// Open Legal Text when footer link is clicked
if(legalLink) {
    legalLink.onclick = (e) => {
        e.preventDefault();
        openPopup("Legal Disclosure", legalTextContent || "Loading legal text...");
    };
}

function closePopup() { modalOverlay.classList.add('hidden'); }
closeBtn.onclick = closePopup;
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closePopup(); });
