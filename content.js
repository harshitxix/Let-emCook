/**
 * Let'emCook - Banner Detector & Assasin
 * Phase 7: Advanced Settings Automation
 */

class BannerDetector {
    constructor(profile = 'strict', aiEnabled = false) {
        this.profile = profile;
        this.aiEnabled = aiEnabled;
        console.log(`[Let'emCook] Initializing with Privacy Profile: ${this.profile.toUpperCase()}`);

        this.bannerRegexes = [
            /(cookie|privacy|consent)\s*(settings|preferences|policy|notice)/i,
            /we\s*(use|value)\s*(cookies|privacy)/i,
            /manage\s*(cookies|choices|preferences)/i,
            /do\s*not\s*sell/i,
            /personal\s*data/i
        ];

        this.regexReject = [
            /(reject|decline|refuse|disallow)\s*(all|everything|cookies)?/i,
            /(only|strictly|accept)?\s*(essential|necessary|required)\s*(cookies)?\s*(only)?/i,
            /(continue|browse)\s*without\s*(accepting|agreeing)/i,
            /(no,?)?\s*(thank(s|\s*you))/i
        ];

        this.regexAccept = [
            /(accept|allow|agree|got\s*it)\s*(all|everything|cookies)?/i,
            /(yes,?)?\s*(i\s*accept|i'm\s*happy|i\s*am\s*happy)/i,
            /^ok$/i
        ];

        this.regexSettings = [
            /(manage|settings|customize|preferences|choices|options)/i
        ];
        
        this.regexSave = [
            /(save|confirm|submit)\s*(my)?\s*(choices|preferences|settings)/i,
            /save\s*&\s*exit/i,
            /^save$/i
        ];

        // Phase 6 Decision Engine - Dynamic Targeting
        if (this.profile === 'relaxed') {
            this.targetRegex = this.regexAccept;
            this.decisionActionName = "Accept All";
        } else {
            this.targetRegex = this.regexReject;
            this.decisionActionName = "Reject All";
        }

        // Phase 8: CMP Native API Adapters
        this.cmpAdapters = [
            {
                name: "OneTrust",
                detector: "#onetrust-consent-sdk"
            },
            {
                name: "Cookiebot",
                detector: "#CybotCookiebotDialog"
            },
            {
                name: "Usercentrics",
                detector: "#usercentrics-root"
            }
        ];
        
        // Massive net to catch buttons, links, and divs disguised as buttons
        this.buttonSelector = 'button, a, input[type="submit"], input[type="button"], [role="button"], [class*="btn"], [class*="button"], [class*="Btn"], [class*="Button"]';

        this.detectedBanner = null;
        this.hasNotified = false;
        this.isNavigatingSettings = false;
        
        const context = window.self === window.top ? "main page" : "iframe";
        console.log(`[Let'emCook] Cookie Banner Detector initialized on ${context}.`);
        
        this.initObserver();
        this.scanForBanners();
    }

    initObserver() {
        const observer = new MutationObserver((mutations) => {
            if (this.detectedBanner && !this.isNavigatingSettings) return;
            
            let shouldScan = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0 || mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                    shouldScan = true;
                    break;
                }
            }
            
            if (shouldScan) {
                clearTimeout(this.scanTimeout);
                this.scanTimeout = setTimeout(() => {
                    if (!this.isNavigatingSettings) {
                        this.scanForBanners();
                        if (this.profile !== 'relaxed') {
                            this.scanForTrackingPixels();
                        }
                    }
                }, 500);
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    scanForTrackingPixels() {
        if (!chrome.runtime?.id) return;
        
        const images = document.querySelectorAll('img:not([data-letemcook-scanned])');
        for (const img of images) {
            img.setAttribute('data-letemcook-scanned', 'true');
            
            // Check for 1x1 tracking pixels
            const width = img.width || img.getAttribute('width');
            const height = img.height || img.getAttribute('height');
            
            const isPixel = (width == 1 && height == 1) || (width == 0 && height == 0);
            const isHidden = img.style.display === 'none' || img.style.visibility === 'hidden' || img.style.opacity == '0';
            
            if (isPixel || isHidden) {
                const src = img.src || '';
                // Only flag if it's hitting a remote domain, not a local data URI
                if (src && src.startsWith('http') && !src.includes(window.location.hostname)) {
                    console.log(`[Let'emCook] 🎯 DOM Tracker Assassinated: Hidden Pixel -> ${src}`);
                    img.remove(); // Nuke the pixel from the DOM
                    
                    try {
                        chrome.runtime.sendMessage({ 
                            action: "tracker_blocked_dom",
                            domain: new URL(src).hostname,
                            src: src
                        }).catch(() => {});
                    } catch (e) {}
                }
            }
        }
    }

    scanForBanners() {
        if (!chrome.runtime?.id) {
            console.log("[Let'emCook] Extension updated. Halting old script.");
            return;
        }

        if (this.detectedBanner || this.isScanning) return;
        this.isScanning = true;

        const cooldownKey = 'letemcook_cooldown_' + window.location.hostname;
        try {
            chrome.storage.local.get([cooldownKey], (result) => {
            if (result[cooldownKey] && (Date.now() - result[cooldownKey] < 10000)) {
                console.log(`[Let'emCook] Loop Prevented: A primary button was clicked on ${window.location.hostname} moments ago. Aborting to prevent infinite reloads.`);
                this.isScanning = false;
                return;
            }

            const candidates = this.queryAllPiercing('div, section, aside, form, dialog');
            
            let highestScore = 0;
            let bestCandidate = null;

            for (const element of candidates) {
                const score = this.scoreElement(element);
                if (score > highestScore) {
                    highestScore = score;
                    bestCandidate = element;
                }
            }

            if (highestScore >= 50 && bestCandidate) {
                this.detectedBanner = bestCandidate;
                this.onBannerDetected(bestCandidate, highestScore);
            }
            this.isScanning = false;
        });
        } catch (e) {
            console.log("[Let'emCook] Context invalidated during storage read.", e);
            this.isScanning = false;
        }
    }
    scoreElement(el) {
        const rect = el.getBoundingClientRect();
        
        if (rect.width === 0 || rect.height === 0 || el.offsetParent === null) return 0;
        
        const inIframe = window.self !== window.top;
        if (!inIframe && rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.95) return 0;
        
        const textContent = el.innerText || "";
        if (textContent.length > 3000) return 0;

        let score = 0;
        const style = window.getComputedStyle(el);
        const htmlLower = el.innerHTML.toLowerCase();
        const idClass = (el.id + " " + el.className).toLowerCase();

        if (idClass.includes("footer") || el.tagName === 'FOOTER') {
            score -= 50;
        }

        if (style.position === 'fixed' || style.position === 'sticky') {
            score += 20; 
            if (parseInt(style.zIndex) > 100) score += 10;
            if (style.bottom === '0px' || style.top === '0px') score += 10;
        }
        if (el.tagName === 'DIALOG') score += 30;

        if (idClass.includes("cookie") || idClass.includes("consent") || idClass.includes("gdpr") || idClass.includes("cmp")) {
            score += 25;
        }
        if (idClass.includes("banner") || idClass.includes("popup") || idClass.includes("modal")) {
            score += 15;
        }

        let keywordMatches = 0;
        for (const regex of this.bannerRegexes) {
            if (regex.test(htmlLower)) {
                keywordMatches++;
            }
        }
        score += (keywordMatches * 10); 

        const buttons = el.querySelectorAll('button, a, input[type="submit"], [role="button"]');
        let hasActionButtons = false;
        
        buttons.forEach(btn => {
            const btnText = (btn.innerText || btn.value || btn.getAttribute('aria-label') || "").trim();
            
            if (this.regexReject.some(r => r.test(btnText))) {
                hasActionButtons = true;
                score += 25;
            } else if (this.regexAccept.some(r => r.test(btnText))) {
                hasActionButtons = true;
                score += 20;
            } else if (/(accept|reject|allow|settings|manage|choices)/i.test(btnText)) {
                hasActionButtons = true;
                score += 10;
            }
        });

        if (!hasActionButtons && score > 0) score -= 40; 

        if (inIframe && score > 0) {
            score += 25;
        }

        return score;
    }

    onBannerDetected(bannerElement, score) {
        if (this.hasNotified) return;
        this.hasNotified = true;

        if (window.self === window.top) {
            console.log(`%c[Let'emCook] COOKIE BANNER DETECTED! (Score: ${score})`, "background: #222; color: #bada55; font-size: 16px; font-weight: bold; padding: 4px;");
        }

        chrome.runtime.sendMessage({ 
            action: "banner_detected", 
            score: score,
            url: window.location.href
        }).catch(err => {});

        // Phase 8: Check if we have a native API adapter for this CMP
        let matchedCmp = null;
        for (const adapter of this.cmpAdapters) {
            if (document.querySelector(adapter.detector)) {
                matchedCmp = adapter;
                break;
            }
        }

        if (matchedCmp && this.profile !== 'balanced') {
            console.log(`[Let'emCook] Identified known CMP: ${matchedCmp.name}. Attempting native API execution...`);
            
            chrome.runtime.sendMessage({
                action: "execute_cmp_api",
                cmp: matchedCmp.name,
                profile: this.profile
            }, (response) => {
                if (response && response.status === "success" && response.apiSuccess) {
                    console.log(`[Let'emCook] Native API Execution SUCCESS for ${matchedCmp.name}! Banner assassinated without DOM clicks.`);
                    const cooldownKey = 'letemcook_cooldown_' + window.location.hostname;
                    chrome.storage.local.set({ [cooldownKey]: Date.now() }, () => {
                        chrome.runtime.sendMessage({ action: "banner_assassinated", url: window.location.href }).catch(err => {});
                    });
                } else {
                    console.log(`[Let'emCook] Native API Execution FAILED or unsupported for ${matchedCmp.name}. Attempting AI/Visual fallbacks.`);
                    this.executeAIHeuristics(bannerElement).then(aiSuccess => {
                        if (!aiSuccess) this.executeVisualHeuristics(bannerElement);
                    });
                }
            });
        } else {
            // No native adapter, or profile is balanced (which requires UI interaction anyway)
            setTimeout(() => {
                this.executeAIHeuristics(bannerElement).then(aiSuccess => {
                    if (!aiSuccess) this.executeVisualHeuristics(bannerElement);
                });
            }, 300);
        }
    }

    // Ultimate weapon to pierce through Shadow DOM boundaries
    queryAllPiercing(selector, root = document) {
        let results = Array.from(root.querySelectorAll(selector));
        
        // Find all elements that might have a shadow root
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                results = results.concat(this.queryAllPiercing(selector, el.shadowRoot));
            }
        }
        return results;
    }

    isElementVisible(el) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return true;
    }

    huntForButton(regexArray, contextRoot = document) {
        const getBtnText = (el) => (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || "").trim();

        const isButtonValid = (el, text) => {
            if (text.length === 0 || text.length > 50) return false;
            if (!this.isElementVisible(el)) return false;
            
            // Prevent clicking containers that hold actual buttons inside them
            if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'INPUT') {
                if (el.querySelector('button, a, input')) return false;
            }
            
            return regexArray.some(r => r.test(text));
        };

        let bestButton = null;
        let highestScore = -1;

        const evaluateAndScore = (elements, baseScore) => {
            for (const el of elements) {
                const text = getBtnText(el);
                if (isButtonValid(el, text)) {
                    let score = baseScore;
                    
                    // Shorter text is statistically more likely to be a real button
                    score += (50 - text.length); 

                    // Penalize multi-line text (often used in toggles with descriptions like H&M)
                    if (text.includes('\n')) score -= 20;

                    // Reward strong action verbs
                    if (/(reject|decline|disallow|refuse|save|confirm|only)/i.test(text)) score += 15;

                    // Penalize descriptive labels and toggle state text
                    if (/(always active|toggle|switch|on|off)/i.test(text)) score -= 30;

                    if (score > highestScore) {
                        highestScore = score;
                        bestButton = el;
                    }
                }
            }
        };

        // Pass 1: Primary Semantic Buttons (highest base score)
        const primarySelectors = 'button, a, input[type="submit"], input[type="button"], [role="button"]';
        evaluateAndScore(this.queryAllPiercing(primarySelectors, contextRoot), 50);

        // Pass 2: Secondary Class-based Buttons (medium base score)
        const secondarySelectors = '[class*="btn"], [class*="button"], [class*="Btn"], [class*="Button"]';
        evaluateAndScore(this.queryAllPiercing(secondarySelectors, contextRoot), 30);

        // Pass 3: Disguised Button Sniper (lowest base score)
        const sneakyElements = this.queryAllPiercing('div, span, p, label, li', contextRoot);
        const filteredSneaky = Array.from(sneakyElements).filter(el => {
            if (el.children.length > 2) return false;
            const style = window.getComputedStyle(el);
            return (style.cursor === 'pointer' || el.hasAttribute('onclick') || el.hasAttribute('tabindex'));
        });
        evaluateAndScore(filteredSneaky, 10);

        return bestButton;
    }

    triggerClick(element) {
        // Bypass CSP errors caused by extensions clicking "javascript:" links
        let originalHref = null;
        if (element.tagName === 'A' && element.hasAttribute('href') && element.getAttribute('href').toLowerCase().startsWith('javascript:')) {
            originalHref = element.getAttribute('href');
            element.removeAttribute('href'); // Strip the dangerous href temporarily
        }

        // Fire a full suite of mouse events to simulate a real human click
        const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
        events.forEach(eventName => {
            const event = new MouseEvent(eventName, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });
            element.dispatchEvent(event);
        });

        // Also fire native click to ensure built-in form submission and button behaviors trigger properly
        try {
            element.click();
        } catch (e) {}

        if (originalHref) {
            element.setAttribute('href', originalHref); // Restore the href
        }
    }

    async executeAIHeuristics(bannerElement) {
        if (!this.aiEnabled) {
            return false;
        }

        console.log("[Let'emCook] Engaging Cloud AI Vision (Gemini API)...");

        try {
            const bannerText = (bannerElement.innerText || "").substring(0, 1000); // Increased slightly for cloud
            const buttons = Array.from(this.queryAllPiercing('button, a, input[type="submit"], [role="button"]', bannerElement));
            const buttonLabels = buttons
                .map(b => (b.innerText || b.value || b.getAttribute('aria-label') || "").trim())
                .filter(text => text.length > 0 && text.length < 50);

            if (buttonLabels.length === 0) {
                console.log("[Let'emCook] No buttons found for AI to analyze.");
                return false;
            }

            const prompt = `You are a privacy assistant evaluating a cookie banner.
Banner text: "${bannerText.replace(/\n/g, ' ')}"
Available buttons: [${buttonLabels.join('], [')}]
My privacy profile is '${this.profile.toUpperCase()}'.
If I am Strict, pick the button to reject or decline all non-essential cookies.
If I am Relaxed, pick the button to accept or allow all cookies.
If I am Balanced, pick the button to open cookie settings or preferences.
Which EXACT button should I click? Reply ONLY with the exact text of the button.`;

            // Proxy the request through background.js to bypass CSP restrictions
            const response = await new Promise((resolve) => {
                try {
                    if (!chrome.runtime?.id) {
                        resolve(null);
                        return;
                    }
                    chrome.runtime.sendMessage({
                        action: "query_gemini_api",
                        prompt: prompt,
                        profile: this.profile
                    }, resolve);
                } catch (e) {
                    resolve(null);
                }
            });

            if (!response || response.status === "error") {
                console.log("[Let'emCook] Cloud AI API failed or not configured. Falling back to Regex Engine.", response ? response.error : "");
                return false;
            }

            const aiResponseText = response.text;
            console.log("[Let'emCook] Cloud AI Vision decided on:", aiResponseText);
            
            const targetText = aiResponseText.trim().toLowerCase();
            
            let matchedButton = null;
            for (const btn of buttons) {
                const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || "").trim().toLowerCase();
                if (text && (text === targetText || text.includes(targetText) || targetText.includes(text))) {
                    matchedButton = btn;
                    break;
                }
            }
            
            if (matchedButton) {
                console.log(`[Let'emCook] Phase 9 AI Execution: Safely executing on:`, matchedButton.innerText.trim() || matchedButton.tagName);
                const cooldownKey = 'letemcook_cooldown_' + window.location.hostname;
                try {
                    if (chrome.runtime?.id) {
                        chrome.storage.local.set({ [cooldownKey]: Date.now() }, () => {
                            this.triggerClick(matchedButton);
                            try {
                                if (chrome.runtime?.id) {
                                    chrome.runtime.sendMessage({ 
                                        action: "banner_assassinated", 
                                        url: window.location.href, 
                                        engine: "AI",
                                        reason: `Cloud AI analyzed the DOM and executed a click on: ${matchedButton.innerText.trim() || matchedButton.tagName}`
                                    }).catch(err => {});
                                }
                            } catch (e) {}
                        });
                    } else {
                        this.triggerClick(matchedButton);
                    }
                } catch (e) {
                    this.triggerClick(matchedButton);
                }
                return true;
            } else {
                console.log("[Let'emCook] AI recommended a button that wasn't found in the DOM. Falling back to Regex Engine.");
                return false;
            }
        } catch (error) {
            console.error("[Let'emCook] Cloud AI Engine crashed:", error);
            return false;
        }
    }

    executeVisualHeuristics(bannerElement) {
        console.log("[Let'emCook] Engaging Regex Heuristic Engine.");
        let bestButton = null;
        
        // Phase 6 Decision Engine Logic
        if (this.profile === 'balanced') {
            console.log("[Let'emCook] Profile is Balanced. Bypassing primary buttons and forcing Phase 7 (Settings Automation) to save default preferences.");
        } else {
            bestButton = this.huntForButton(this.targetRegex, bannerElement);
        }

        if (bestButton) {
            console.log(`[Let'emCook] Phase 6 Decision Engine: Safely executing ${this.decisionActionName} on:`, bestButton.innerText.trim() || bestButton.tagName);
            const cooldownKey = 'letemcook_cooldown_' + window.location.hostname;
            chrome.storage.local.set({ [cooldownKey]: Date.now() }, () => {
                this.triggerClick(bestButton);
                chrome.runtime.sendMessage({ 
                    action: "banner_assassinated", 
                    url: window.location.href,
                    engine: 'Regex',
                    reason: `Executed ${this.decisionActionName} on: ${bestButton.innerText.trim() || bestButton.tagName}`
                }).catch(err => {});
            });
        } else {
            // PHASE 7: Advanced Automation (Navigate to Settings)
            if (sessionStorage.getItem('letemcook_settings_clicked')) {
                console.log("[Let'emCook] Loop Prevented: We already clicked a Settings button recently and it likely caused a page reload. Aborting to prevent an infinite loop.");
                return;
            }

            let settingsButton = this.huntForButton(this.regexSettings, bannerElement) || this.huntForButton(this.regexSettings, document);
            
            if (settingsButton) {
                console.log("[Let'emCook] Phase 7 Engaged: Reject button hidden. Navigating to Settings via:", settingsButton.innerText.trim() || settingsButton.tagName);
                this.isNavigatingSettings = true;
                sessionStorage.setItem('letemcook_settings_clicked', 'true');
                
                this.triggerClick(settingsButton);

                let attempts = 0;
                const pollInterval = setInterval(() => {
                    attempts++;
                    const success = this.attemptToSaveSettings();
                    
                    if (success) {
                        clearInterval(pollInterval);
                    } else if (attempts >= 10) {
                        console.log("[Let'emCook] Phase 7 Failed: Could not find a Save/Reject button in the settings modal after 5 seconds.");
                        clearInterval(pollInterval);
                        this.isNavigatingSettings = false;
                    }
                }, 500);

            } else {
                console.log("[Let'emCook] No semantic 'Reject' or 'Settings' button found on the entire page. Aborting.");
            }
        }
    }

    attemptToSaveSettings() {
        console.log("[Let'emCook] Phase 7: Scanning Settings Modal for Reject/Save button...");
        
        let targetButton = null;
        let isPrimaryAction = false;

        // In Balanced mode, we only want to Save Defaults. In Strict/Relaxed, we actively hunt for Reject/Accept inside the modal.
        if (this.profile !== 'balanced') {
            targetButton = this.huntForButton(this.targetRegex, document);
            if (targetButton) {
                isPrimaryAction = true;
                console.log(`[Let'emCook] Phase 7: Found hidden ${this.decisionActionName} button:`, targetButton.innerText.trim() || targetButton.tagName);
            }
        }

        if (!targetButton) {
            targetButton = this.huntForButton(this.regexSave, document);
            if (targetButton) {
                console.log("[Let'emCook] Phase 7: Found Save Preferences button:", targetButton.innerText.trim() || targetButton.tagName);
            }
        }

        if (targetButton) {
            console.log(`[Let'emCook] Phase 7 Success! Executing Save on:`, targetButton.innerText.trim() || targetButton.tagName);
            this.isNavigatingSettings = false; // Reset state
            const cooldownKey = 'letemcook_cooldown_' + window.location.hostname;
            chrome.storage.local.set({ [cooldownKey]: Date.now() }, () => {
                this.triggerClick(targetButton);
                
                // If we clicked "Reject All", the site might STILL require us to click "Save Settings" to close the modal!
                if (isPrimaryAction) {
                    setTimeout(() => {
                        const finalSave = this.huntForButton(this.regexSave, document);
                        if (finalSave) {
                            console.log("[Let'emCook] Phase 7 Multi-Step: Also clicking Save Preferences to close the modal.");
                            this.triggerClick(finalSave);
                        }
                    }, 800);
                }

                try {
                    if (chrome.runtime?.id) {
                        chrome.runtime.sendMessage({ 
                            action: "banner_assassinated", 
                            url: window.location.href,
                            engine: 'Regex',
                            reason: `Executed Phase 7 Settings Click on: ${targetButton.innerText.trim() || targetButton.tagName}`
                        }).catch(err => {});
                    }
                } catch (e) {}
            });
            return true;
        } else {
            console.log("[Let'emCook] Phase 7: Waiting for Save/Reject button to appear in settings...");
            return false;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}

// Bootstrap
function initExtension() {
    if (!chrome.runtime?.id || !chrome.storage) {
        console.log("[Let'emCook] Extension context invalid during initialization.");
        return;
    }
    
    try {
        chrome.storage.local.get(['extensionEnabled', 'privacyProfile', 'aiEnabled', 'siteRules'], (result) => {
            if (chrome.runtime.lastError) return;
            
            const hostname = window.location.hostname;
            const siteRules = result.siteRules || {};
            const siteRule = siteRules[hostname] || {};
            
            const isEnabledGlobally = result.extensionEnabled !== false;
            const isEnabledLocally = siteRule.enabled !== false;
            
            if (isEnabledGlobally && isEnabledLocally) {
                const effectiveProfile = siteRule.profile && siteRule.profile !== 'default' 
                    ? siteRule.profile 
                    : (result.privacyProfile || 'strict');
                    
                new BannerDetector(effectiveProfile, result.aiEnabled === true);
            } else {
                console.log(`[Let'emCook] Extension is paused (Global: ${isEnabledGlobally}, Site: ${isEnabledLocally}).`);
            }
        });
    } catch (e) {
        console.log("[Let'emCook] Failed to initialize extension.", e);
    }
}
