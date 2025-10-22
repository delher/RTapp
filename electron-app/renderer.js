const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const loadBtn = document.getElementById('loadBtn');
const webviewContainer = document.getElementById('webviewContainer');
const instanceCount = document.getElementById('instanceCount');
const siteUrl = document.getElementById('siteUrl');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let webviews = [];
let instanceSettings = []; // Store per-instance settings
let currentCount = 3;
let currentUrl = 'https://chatgpt.com';

// Security: Site blacklist (known dangerous patterns)
const BLACKLISTED_PATTERNS = [
    /file:\/\//i,
    /localhost/i,
    /127\.0\.0\.1/i,
    /0\.0\.0\.0/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i
];

// Security: URL validation
function validateUrl(urlString) {
    try {
        const url = new URL(urlString);
        
        // Must be HTTPS (or HTTP for testing)
        if (!['https:', 'http:'].includes(url.protocol)) {
            return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
        }
        
        // Check blacklist
        for (const pattern of BLACKLISTED_PATTERNS) {
            if (pattern.test(urlString)) {
                return { valid: false, error: 'URL matches blacklisted pattern (localhost/file/etc)' };
            }
        }
        
        // Warn on HTTP (not HTTPS)
        if (url.protocol === 'http:') {
            console.warn(`[SECURITY] Warning: Loading insecure HTTP URL: ${urlString}`);
        }
        
        return { valid: true, url: url.href };
    } catch (error) {
        return { valid: false, error: 'Invalid URL format' };
    }
}

// Note: Prompt sanitization deliberately NOT implemented
// This is a red-teaming tool designed to send ANY prompt to test LLM responses
// Including prompts that may contain injection attempts or obfuscated content

// Parseltongue Transform Definitions
const transforms = {
    encoding: {
        'base64': (text) => btoa(unescape(encodeURIComponent(text))),
        'hex': (text) => Array.from(text).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
        'binary': (text) => Array.from(text).map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '),
        'url': (text) => encodeURIComponent(text),
        'morse': (text) => {
            const morse = {'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.', ' ':'/'};
            return text.toUpperCase().split('').map(c => morse[c] || c).join(' ');
        }
    },
    ciphers: {
        'rot13': (text) => text.replace(/[a-zA-Z]/g, c => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)),
        'caesar3': (text) => text.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c <= 'Z' ? (c.charCodeAt(0) + 3 > 90 ? 3 - 26 : 3) : (c.charCodeAt(0) + 3 > 122 ? 3 - 26 : 3)))),
        'atbash': (text) => text.replace(/[a-zA-Z]/g, c => String.fromCharCode((c <= 'Z' ? 90 : 122) - (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97)))),
        'reverse': (text) => text.split('').reverse().join('')
    },
    visual: {
        'upside-down': (text) => {
            const map = {'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ᴉ','j':'ɾ','k':'ʞ','l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x','y':'ʎ','z':'z','A':'∀','B':'q','C':'Ɔ','D':'p','E':'Ǝ','F':'Ⅎ','G':'פ','H':'H','I':'I','J':'ſ','K':'ʞ','L':'˥','M':'W','N':'N','O':'O','P':'Ԁ','Q':'Q','R':'ɹ','S':'S','T':'┴','U':'∩','V':'Λ','W':'M','X':'X','Y':'⅄','Z':'Z','0':'0','1':'Ɩ','2':'ᄅ','3':'Ɛ','4':'ㄣ','5':'ϛ','6':'9','7':'ㄥ','8':'8','9':'6','.':'˙',',':'\'','?':'¿','!':'¡','\'':',','"':',','(':')',')':'(','[':']',']':'[','{':'}','}':'{','<':'>','>':'<'};
            return text.split('').reverse().map(c => map[c] || c).join('');
        },
        'strikethrough': (text) => text.split('').map(c => c + '\u0336').join(''),
        'double-struck': (text) => {
            const map = {'A':'𝔸','B':'𝔹','C':'ℂ','D':'𝔻','E':'𝔼','F':'𝔽','G':'𝔾','H':'ℍ','I':'𝕀','J':'𝕁','K':'𝕂','L':'𝕃','M':'𝕄','N':'ℕ','O':'𝕆','P':'ℙ','Q':'ℚ','R':'ℝ','S':'𝕊','T':'𝕋','U':'𝕌','V':'𝕍','W':'𝕎','X':'𝕏','Y':'𝕐','Z':'ℤ','a':'𝕒','b':'𝕓','c':'𝕔','d':'𝕕','e':'𝕖','f':'𝕗','g':'𝕘','h':'𝕙','i':'𝕚','j':'𝕛','k':'𝕜','l':'𝕝','m':'𝕞','n':'𝕟','o':'𝕠','p':'𝕡','q':'𝕢','r':'𝕣','s':'𝕤','t':'𝕥','u':'𝕦','v':'𝕧','w':'𝕨','x':'𝕩','y':'𝕪','z':'𝕫','0':'𝟘','1':'𝟙','2':'𝟚','3':'𝟛','4':'𝟜','5':'𝟝','6':'𝟞','7':'𝟟','8':'𝟠','9':'𝟡'};
            return text.split('').map(c => map[c] || c).join('');
        }
    },
    formatting: {
        'small-caps': (text) => {
            const map = {'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'};
            return text.split('').map(c => map[c.toLowerCase()] || c).join('');
        },
        'wide': (text) => text.split('').map(c => {
            const code = c.charCodeAt(0);
            if (code >= 33 && code <= 126) return String.fromCharCode(code + 65248);
            return c;
        }).join(''),
        'circled': (text) => {
            const map = {'0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨','A':'Ⓐ','B':'Ⓑ','C':'Ⓒ','D':'Ⓓ','E':'Ⓔ','F':'Ⓕ','G':'Ⓖ','H':'Ⓗ','I':'Ⓘ','J':'Ⓙ','K':'Ⓚ','L':'Ⓛ','M':'Ⓜ','N':'Ⓝ','O':'Ⓞ','P':'Ⓟ','Q':'Ⓠ','R':'Ⓡ','S':'Ⓢ','T':'Ⓣ','U':'Ⓤ','V':'Ⓥ','W':'Ⓦ','X':'Ⓧ','Y':'Ⓨ','Z':'Ⓩ','a':'ⓐ','b':'ⓑ','c':'ⓒ','d':'ⓓ','e':'ⓔ','f':'ⓕ','g':'ⓖ','h':'ⓗ','i':'ⓘ','j':'ⓙ','k':'ⓚ','l':'ⓛ','m':'ⓜ','n':'ⓝ','o':'ⓞ','p':'ⓟ','q':'ⓠ','r':'ⓡ','s':'ⓢ','t':'ⓣ','u':'ⓤ','v':'ⓥ','w':'ⓦ','x':'ⓧ','y':'ⓨ','z':'ⓩ'};
            return text.split('').map(c => map[c] || c).join('');
        }
    },
    unicode: {
        'zwsp-inject': (text) => text.split('').join('\u200B'),
        'zwj-inject': (text) => text.split('').join('\u200D'),
        'zwnj-inject': (text) => text.split('').join('\u200C'),
        'combining-marks': (text) => text.split('').map(c => c + '\u0301\u0308').join(''),
        'zalgo-light': (text) => {
            const marks = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0308'];
            return text.split('').map(c => c + marks[Math.floor(Math.random() * marks.length)]).join('');
        }
    },
    special: {
        'leet': (text) => {
            const map = {'a':'4','e':'3','i':'1','o':'0','s':'5','t':'7','A':'4','E':'3','I':'1','O':'0','S':'5','T':'7'};
            return text.split('').map(c => map[c] || c).join('');
        },
        'emoji-regional': (text) => {
            return text.toLowerCase().split('').map(c => {
                const code = c.charCodeAt(0);
                if (code >= 97 && code <= 122) {
                    return String.fromCodePoint(0x1F1E6 + (code - 97));
                }
                return c;
            }).join('');
        }
    },
    fantasy: {
        'fraktur': (text) => {
            const map = {'A':'𝔄','B':'𝔅','C':'ℭ','D':'𝔇','E':'𝔈','F':'𝔉','G':'𝔊','H':'ℌ','I':'ℑ','J':'𝔍','K':'𝔎','L':'𝔏','M':'𝔐','N':'𝔑','O':'𝔒','P':'𝔓','Q':'𝔔','R':'ℜ','S':'𝔖','T':'𝔗','U':'𝔘','V':'𝔙','W':'𝔚','X':'𝔛','Y':'𝔜','Z':'ℨ','a':'𝔞','b':'𝔟','c':'𝔠','d':'𝔡','e':'𝔢','f':'𝔣','g':'𝔤','h':'𝔥','i':'𝔦','j':'𝔧','k':'𝔨','l':'𝔩','m':'𝔪','n':'𝔫','o':'𝔬','p':'𝔭','q':'𝔮','r':'𝔯','s':'𝔰','t':'𝔱','u':'𝔲','v':'𝔳','w':'𝔴','x':'𝔵','y':'𝔶','z':'𝔷'};
            return text.split('').map(c => map[c] || c).join('');
        },
        'script': (text) => {
            const map = {'A':'𝒜','B':'ℬ','C':'𝒞','D':'𝒟','E':'ℰ','F':'ℱ','G':'𝒢','H':'ℋ','I':'ℐ','J':'𝒥','K':'𝒦','L':'ℒ','M':'ℳ','N':'𝒩','O':'𝒪','P':'𝒫','Q':'𝒬','R':'ℛ','S':'𝒮','T':'𝒯','U':'𝒰','V':'𝒱','W':'𝒲','X':'𝒳','Y':'𝒴','Z':'𝒵','a':'𝒶','b':'𝒷','c':'𝒸','d':'𝒹','e':'ℯ','f':'𝒻','g':'ℊ','h':'𝒽','i':'𝒾','j':'𝒿','k':'𝓀','l':'𝓁','m':'𝓂','n':'𝓃','o':'ℴ','p':'𝓅','q':'𝓆','r':'𝓇','s':'𝓈','t':'𝓉','u':'𝓊','v':'𝓋','w':'𝓌','x':'𝓍','y':'𝓎','z':'𝓏'};
            return text.split('').map(c => map[c] || c).join('');
        }
    },
    ancient: {
        'runic': (text) => {
            const map = {'a':'ᚨ','b':'ᛒ','c':'ᚲ','d':'ᛞ','e':'ᛖ','f':'ᚠ','g':'ᚷ','h':'ᚺ','i':'ᛁ','j':'ᛃ','k':'ᚲ','l':'ᛚ','m':'ᛗ','n':'ᚾ','o':'ᛟ','p':'ᛈ','q':'ᚲ','r':'ᚱ','s':'ᛋ','t':'ᛏ','u':'ᚢ','v':'ᚡ','w':'ᚹ','x':'ᛪ','y':'ᛃ','z':'ᛉ'};
            return text.toLowerCase().split('').map(c => map[c] || c).join('');
        },
        'phoenician': (text) => {
            const map = {'a':'𐤀','b':'𐤁','c':'𐤂','d':'𐤃','e':'𐤄','f':'𐤅','g':'𐤂','h':'𐤇','i':'𐤉','j':'𐤉','k':'𐤊','l':'𐤋','m':'𐤌','n':'𐤍','o':'𐤏','p':'𐤐','q':'𐤒','r':'𐤓','s':'𐤔','t':'𐤕','u':'𐤅','v':'𐤅','w':'𐤅','x':'𐤎','y':'𐤉','z':'𐤆'};
            return text.toLowerCase().split('').map(c => map[c] || c).join('');
        }
    }
};

// Transform method options per category
const transformOptions = {
    none: [{ value: 'none', label: 'No Transform' }],
    encoding: [
        { value: 'base64', label: 'Base64' },
        { value: 'hex', label: 'Hexadecimal' },
        { value: 'binary', label: 'Binary' },
        { value: 'url', label: 'URL Encode' },
        { value: 'morse', label: 'Morse Code' }
    ],
    ciphers: [
        { value: 'rot13', label: 'ROT13' },
        { value: 'caesar3', label: 'Caesar +3' },
        { value: 'atbash', label: 'Atbash' },
        { value: 'reverse', label: 'Reverse' }
    ],
    visual: [
        { value: 'upside-down', label: 'Upside Down' },
        { value: 'strikethrough', label: 'Strikethrough' },
        { value: 'double-struck', label: 'Double-Struck' }
    ],
    formatting: [
        { value: 'small-caps', label: 'Small Caps' },
        { value: 'wide', label: 'Wide Text' },
        { value: 'circled', label: 'Circled' }
    ],
    unicode: [
        { value: 'zwsp-inject', label: 'Zero-Width Space Inject' },
        { value: 'zwj-inject', label: 'Zero-Width Joiner Inject' },
        { value: 'zwnj-inject', label: 'Zero-Width Non-Joiner Inject' },
        { value: 'combining-marks', label: 'Combining Marks' },
        { value: 'zalgo-light', label: 'Zalgo (Light)' }
    ],
    special: [
        { value: 'leet', label: 'Leet Speak' },
        { value: 'emoji-regional', label: 'Regional Indicator Emoji' }
    ],
    fantasy: [
        { value: 'fraktur', label: 'Fraktur' },
        { value: 'script', label: 'Script/Cursive' }
    ],
    ancient: [
        { value: 'runic', label: 'Runic' },
        { value: 'phoenician', label: 'Phoenician' }
    ]
};

function updateStatus(message, type = 'normal') {
    // Status line removed from UI, just log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function createWebviews(count, url) {
    // Clear existing webviews
    webviewContainer.innerHTML = '';
    webviews = [];
    instanceSettings = [];
    
    // Update grid layout
    webviewContainer.className = `webview-container count-${count}`;
    
    // Create new webviews with controls
    for (let i = 0; i < count; i++) {
        // Create wrapper for instance
        const wrapper = document.createElement('div');
        wrapper.className = 'instance-wrapper';
        
        // Create instance controls
        const controls = document.createElement('div');
        controls.className = 'instance-controls';
        
        // Instance label
        const label = document.createElement('span');
        label.className = 'instance-label';
        label.textContent = `#${i + 1}`;
        controls.appendChild(label);
        
        // Transform category dropdown
        const categoryLabel = document.createElement('label');
        categoryLabel.textContent = 'Transform:';
        controls.appendChild(categoryLabel);
        
        const categorySelect = document.createElement('select');
        categorySelect.className = 'transform-category';
        categorySelect.id = `category-${i}`;
        ['none', 'encoding', 'ciphers', 'visual', 'formatting', 'unicode', 'special', 'fantasy', 'ancient'].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            categorySelect.appendChild(option);
        });
        controls.appendChild(categorySelect);
        
        // Transform method dropdown
        const methodSelect = document.createElement('select');
        methodSelect.className = 'transform-method';
        methodSelect.id = `method-${i}`;
        const noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.textContent = 'No Transform';
        methodSelect.appendChild(noneOption);
        controls.appendChild(methodSelect);
        
        // Handle category change for this instance
        categorySelect.addEventListener('change', () => {
            const category = categorySelect.value;
            const options = transformOptions[category] || transformOptions.none;
            
            methodSelect.innerHTML = '';
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                methodSelect.appendChild(option);
            });
            
            // Update instance settings
            instanceSettings[i] = {
                category: category,
                method: methodSelect.value
            };
        });
        
        // Handle method change for this instance
        methodSelect.addEventListener('change', () => {
            instanceSettings[i] = {
                category: categorySelect.value,
                method: methodSelect.value
            };
        });
        
        // Initialize instance settings
        instanceSettings[i] = {
            category: 'none',
            method: 'none'
        };
        
        // Create webview
        const webview = document.createElement('webview');
        webview.id = `webview${i + 1}`;
        webview.src = url;
        webview.partition = `persist:instance${i + 1}`;
        webview.setAttribute('useragent', USER_AGENT);
        
        // Security: Webview security attributes
        webview.setAttribute('disablewebsecurity', 'false');
        webview.setAttribute('allowpopups', 'false'); // Block popups by default
        webview.setAttribute('nodeintegration', 'false');
        webview.setAttribute('nodeintegrationinsubframes', 'false');
        webview.setAttribute('webpreferences', 'contextIsolation=yes,javascript=yes');
        
        // Forward console messages
        webview.addEventListener('console-message', (e) => {
            console.log(`[Webview${i + 1}] ${e.message}`);
        });
        
        // Track when ready
        webview.addEventListener('dom-ready', () => {
            console.log(`Webview ${i + 1} ready`);
            // Adjust zoom based on instance count to show full desktop layout
            const zoomFactors = {
                1: 1.0,   // Full size for 1 instance
                2: 0.65,  // Zoom out to fit desktop layout in 2 columns
                3: 0.5,   // Zoom out more for 3 columns
                4: 0.4    // Zoom out most for 4 columns
            };
            webview.setZoomFactor(zoomFactors[count] || 1.0);
            checkAllReady();
        });
        
        // Assemble wrapper
        wrapper.appendChild(controls);
        wrapper.appendChild(webview);
        webviewContainer.appendChild(wrapper);
        webviews.push(webview);
    }
    
    updateStatus(`Loading ${count} instance(s) of ${url}...`, 'normal');
}

function checkAllReady() {
    const allReady = webviews.every(wv => {
        try {
            return wv.getWebContentsId() > 0;
        } catch (e) {
            return false;
        }
    });
    
    if (allReady && webviews.length > 0) {
        updateStatus(`${webviews.length} instance(s) loaded. Enter a prompt and click "Send to All".`, 'success');
    }
}

// Apply transform to text for a specific instance
function applyTransform(text, instanceIndex) {
    const settings = instanceSettings[instanceIndex];
    if (!settings || settings.category === 'none' || settings.method === 'none') {
        return text;
    }
    
    const category = settings.category;
    const method = settings.method;
    
    if (transforms[category] && transforms[category][method]) {
        try {
            return transforms[category][method](text);
        } catch (error) {
            console.error(`Transform error for instance ${instanceIndex + 1}:`, error);
            return text;
        }
    }
    
    return text;
}

// Handle instance count change
instanceCount.addEventListener('change', () => {
    const newCount = parseInt(instanceCount.value);
    currentCount = newCount;
    const url = siteUrl.value.trim() || currentUrl;
    createWebviews(newCount, url);
});

// Handle URL load
loadBtn.addEventListener('click', () => {
    let url = siteUrl.value.trim();
    if (!url) {
        updateStatus('Please enter a URL!', 'error');
        alert('Please enter a URL');
        return;
    }
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // Security: Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
        console.error(`[SECURITY] URL validation failed: ${validation.error}`);
        updateStatus(`Security Error: ${validation.error}`, 'error');
        alert(`Security Error: ${validation.error}`);
        return;
    }
    
    currentUrl = validation.url;
    console.log(`[SECURITY] Loading validated URL: ${currentUrl}`);
    createWebviews(currentCount, currentUrl);
});

// Handle send prompt
sendBtn.addEventListener('click', async () => {
    const rawPrompt = promptInput.value.trim();
    
    if (!rawPrompt) {
        updateStatus('Please enter a prompt!', 'error');
        return;
    }
    
    if (webviews.length === 0) {
        updateStatus('No instances loaded!', 'error');
        alert('No instances loaded. Click "Load" first.');
        return;
    }

    console.log('Sending prompt:', rawPrompt);
    updateStatus(`Sending prompt to ${webviews.length} instance(s)...`, 'normal');
    
    try {
        // Execute in all webviews with per-instance transforms
        const results = await Promise.all(
            webviews.map(async (wv, idx) => {
                try {
                    // Apply this instance's transform
                    const transformedPrompt = applyTransform(rawPrompt, idx);
                    const settings = instanceSettings[idx];
                    const transformInfo = settings.category !== 'none' 
                        ? `${settings.category}:${settings.method}` 
                        : 'none';
                    
                    console.log(`Instance ${idx + 1} (${transformInfo}):`, transformedPrompt);
                    
                    const script = `
                        (async function() {
                            try {
                                const prompt = ${JSON.stringify(transformedPrompt)};
                                console.log('🔵 Injecting prompt:', prompt);
                
                // Find the contenteditable div (ChatGPT uses ProseMirror)
                const input = document.querySelector('#prompt-textarea') || 
                             document.querySelector('div[contenteditable="true"][role="textbox"]') ||
                             document.querySelector('[contenteditable="true"]');
                
                if (!input) {
                    console.error('❌ Input not found');
                    return { success: false, error: 'Input not found' };
                }
                
                console.log('✅ Found input:', input.id || input.className);
                
                // Focus the input
                input.focus();
                
                // For contenteditable (ProseMirror), set innerHTML
                if (input.getAttribute('contenteditable') === 'true') {
                    input.innerHTML = '<p>' + prompt + '</p>';
                } else if (input.tagName === 'TEXTAREA') {
                    input.value = prompt;
                }
                
                // Dispatch multiple events to trigger React/ProseMirror
                ['input', 'change', 'keyup'].forEach(eventType => {
                    input.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                });
                
                input.dispatchEvent(new InputEvent('input', { 
                    bubbles: true, 
                    cancelable: true,
                    inputType: 'insertText',
                    data: prompt
                }));
                
                console.log('✅ Prompt set, waiting for send button...');
                
                // Wait a bit for React to process
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Find and click send button
                const sendBtn = document.querySelector('button[data-testid="send-button"]') ||
                              document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
                              document.querySelector('button[aria-label*="Send" i]') ||
                              document.querySelector('button[aria-label*="submit" i]');
                
                if (sendBtn && !sendBtn.disabled) {
                    console.log('✅ Clicking send button');
                    sendBtn.click();
                    return { success: true, method: 'button' };
                } else {
                    console.log('⚠️ Send button not found or disabled, trying Enter key');
                    // Fallback: press Enter
                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    }));
                    return { success: true, method: 'enter' };
                }
            } catch (error) {
                                console.error('❌ Error in injection script:', error);
                                return { success: false, error: error.message };
                            }
                        })();
                    `;
                    
                    const result = await wv.executeJavaScript(script);
                    console.log(`Result ${idx + 1}:`, result);
                    return result;
                } catch (error) {
                    console.error(`Error in instance ${idx + 1}:`, error);
                    return { success: false, error: error.message };
                }
            })
        );
        
        const successCount = results.filter(r => r.success).length;
        
        if (successCount === webviews.length) {
            updateStatus(`✓ Prompt sent to all ${webviews.length} instance(s)!`, 'success');
            promptInput.value = '';
        } else {
            updateStatus(`Partial success: ${successCount}/${webviews.length} instances. Check console for details.`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        updateStatus(`Error: ${error.message}`, 'error');
    }
});

// Allow Enter key in prompt input
promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

// Initialize with default settings
createWebviews(currentCount, currentUrl);
