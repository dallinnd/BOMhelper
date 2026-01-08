// Global State
let allVerses = [];
let uniqueWords = [];
let legalTextContent = ""; // Stores the legal text for the footer link
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
    const savedData = localStorage.getItem('bom_data_v3'); // v3 to force update
    
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            allVerses = parsed.verses;
            uniqueWords = parsed.words;
            legalTextContent = parsed.legal; // Retrieve saved legal text
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
        
        // --- SPLIT LOGIC ---
        // We split the file into two parts: Legal (Before Title Page) and Scriptures (After)
        const splitMarker = "AN ACCOUNT WRITTEN BY THE HAND OF MORMON";
        const splitIndex = fullText.indexOf(splitMarker);
        
        let scriptureText = "";

        if (splitIndex !== -1) {
            // PART 1: Save Legal Text
            legalTextContent = fullText.substring(0, splitIndex);
            
            // PART 2: Save Scripture Text (and add the title back)
            scriptureText = splitMarker + fullText.substring(splitIndex + splitMarker.length);
        } else {
            // Fallback if marker not found
            scriptureText = fullText;
            legalTextContent = "Legal text marker not found.";
        }

        // Parse ONLY the scriptureText for search
        const rawParagraphs = scriptureText.split(/\r?\n\r?\n/);
        const tempWords = new Set();
        allVerses = []; 

        rawParagraphs.forEach((para, index) => {
            const cleanPara = para.trim().replace(/\s+/g, ' ');
            if (cleanPara.length > 20) {
                allVerses.push({ id: index, text: cleanPara });

                // Tokenize words
                const words = cleanPara.toLowerCase().match(/\b[a-z]{3,}\b/g);
                if (words) words.forEach(w => tempWords.add(w));
            }
        });

        uniqueWords = Array.from(tempWords).sort();

        // Save EVERYTHING to LocalStorage
        try {
            localStorage.setItem('bom_data_v3', JSON.stringify({
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

    const results = allVerses.filter(v => v.text.toLowerCase().includes(q)).slice(0, 50);

    if (results.length === 0) {
        resultsArea.innerHTML = '<div class="placeholder-msg">No matches found.</div>';
        return;
    }

    results.forEach(verse => {
        const box = document.createElement('div');
        box.className = 'verse-box';
        const snippet = verse.text.replace(new RegExp(`(${q})`, 'gi'), '<b style="color:var(--primary);">$1</b>');
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
    modalText.innerText = text; // Just text, preserves line breaks if using white-space: pre-wrap
    modalOverlay.classList.remove('hidden');
}

// Open Legal Text when footer link is clicked
legalLink.onclick = (e) => {
    e.preventDefault();
    openPopup("Legal Disclosure", legalTextContent || "Loading legal text...");
};

function closePopup() { modalOverlay.classList.add('hidden'); }
closeBtn.onclick = closePopup;
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closePopup(); });
