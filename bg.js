chrome.runtime.onInstalled.addListener(() => {
    // Initialize default settings when the extension is installed or updated
    chrome.storage.local.get(['extensionEnabled', 'bannersAssassinated', 'privacyProfile', 'siteRules'], (result) => {
        if (chrome.runtime.lastError || !result) {
            console.error("[Let'emCook] Storage error on install:", chrome.runtime.lastError);
            return;
        }
        if (result.extensionEnabled === undefined) {
            chrome.storage.local.set({ extensionEnabled: true });
        }
        if (result.bannersAssassinated === undefined) {
            chrome.storage.local.set({ bannersAssassinated: 0 });
        }
        if (result.siteRules === undefined) {
            chrome.storage.local.set({ siteRules: {} });
        }
        
        // Initial ruleset application based on profile
        const profile = result.privacyProfile || 'strict';
        updateDnrRuleset(profile);
        
        if (result.siteRules) {
            updateDynamicDnrRules(result.siteRules);
        }
    });
});

async function updateDynamicDnrRules(siteRules) {
    if (!chrome.declarativeNetRequest) return;
    siteRules = siteRules || {};
    
    try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(r => r.id);
        
        const newRules = [];
        let ruleIdCounter = 1000;
        
        for (const [hostname, rule] of Object.entries(siteRules)) {
            if (rule.enabled === false || rule.profile === 'relaxed') {
                newRules.push({
                    id: ruleIdCounter++,
                    priority: 100,
                    action: { type: "allowAllRequests" },
                    condition: {
                        initiatorDomains: [hostname],
                        resourceTypes: ["main_frame", "sub_frame", "script", "image", "xmlhttprequest", "ping", "websocket"]
                    }
                });
            }
        }
        
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });
        console.log(`[Let'emCook] Applied ${newRules.length} dynamic site exception rules.`);
    } catch (err) {
        console.error("[Let'emCook] Failed to update dynamic rules:", err);
    }
}

function updateDnrRuleset(profile) {
    if (profile === 'relaxed') {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: ["ruleset_1"]
        });
        console.log("[Let'emCook] Relaxed mode: Tracker blocking disabled.");
    } else {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: ["ruleset_1"]
        });
        console.log("[Let'emCook] Strict/Balanced mode: Tracker blocking enabled.");
    }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.privacyProfile) {
            updateDnrRuleset(changes.privacyProfile.newValue);
        }
        if (changes.siteRules) {
            updateDynamicDnrRules(changes.siteRules.newValue);
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "banner_detected") {
        console.log(`[Let'emCook] COOKIE BANNER DETECTED on: ${request.url} (Score: ${request.score})`);
        sendResponse({ status: "success" });
    }
    
    if (request.action === "banner_assassinated") {
        console.log(`[Let'emCook] BANNER ASSASSINATED on: ${request.url}`);
        
        chrome.storage.local.get(['bannersAssassinated'], (result) => {
            let currentCount = result.bannersAssassinated || 0;
            chrome.storage.local.set({ bannersAssassinated: currentCount + 1 });
        });
        
        logAction({
            actionType: 'Banner Assassinated',
            domain: new URL(request.url).hostname,
            engine: request.engine || 'Unknown',
            reason: request.reason || 'Killed banner'
        });
        
        sendResponse({ status: "success" });
    }
    
    if (request.action === "tracker_blocked_dom") {
        chrome.storage.local.get(['trackersBlocked'], (result) => {
            let currentCount = result.trackersBlocked || 0;
            chrome.storage.local.set({ trackersBlocked: currentCount + 1 });
        });
        
        logAction({
            actionType: 'Tracker Blocked',
            domain: request.domain || 'unknown',
            engine: 'DOM',
            reason: `Removed tracking pixel: ${request.src}`
        });
        
        sendResponse({ status: "success" });
    }
    if (request.action === "execute_cmp_api") {
        console.log(`[Let'emCook] Hooking into native CMP API for ${request.cmp} (Profile: ${request.profile})`);
        
        let apiFunc = null;
        
        // Native CMP API Registry (with Async Polling)
        if (request.cmp === "OneTrust") {
            apiFunc = (profile) => {
                return new Promise((resolve) => {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        if (typeof window.OneTrust !== 'undefined') {
                            clearInterval(interval);
                            if (profile === 'relaxed' && window.OneTrust.AcceptAll) {
                                window.OneTrust.AcceptAll(); resolve(true);
                            } else if (profile === 'strict' && window.OneTrust.RejectAll) {
                                window.OneTrust.RejectAll(); resolve(true);
                            } else {
                                resolve(false);
                            }
                        } else if (attempts >= 10) {
                            clearInterval(interval); resolve(false);
                        }
                        attempts++;
                    }, 500);
                });
            };
        } else if (request.cmp === "Cookiebot") {
            apiFunc = (profile) => {
                return new Promise((resolve) => {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        if (typeof window.Cookiebot !== 'undefined' && window.Cookiebot.submitCustomConsent) {
                            clearInterval(interval);
                            if (profile === 'relaxed') {
                                window.Cookiebot.submitCustomConsent(true, true, true); resolve(true);
                            } else if (profile === 'strict') {
                                window.Cookiebot.submitCustomConsent(false, false, false); resolve(true);
                            } else {
                                resolve(false);
                            }
                        } else if (attempts >= 10) {
                            clearInterval(interval); resolve(false);
                        }
                        attempts++;
                    }, 500);
                });
            };
        } else if (request.cmp === "Usercentrics") {
            apiFunc = (profile) => {
                return new Promise((resolve) => {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        if (typeof window.UC_UI !== 'undefined') {
                            clearInterval(interval);
                            if (profile === 'relaxed' && window.UC_UI.acceptAllConsents) {
                                window.UC_UI.acceptAllConsents().catch(() => {}); resolve(true);
                            } else if (profile === 'strict' && window.UC_UI.rejectAllConsents) {
                                window.UC_UI.rejectAllConsents().catch(() => {}); resolve(true);
                            } else {
                                resolve(false);
                            }
                        } else if (attempts >= 10) {
                            clearInterval(interval); resolve(false);
                        }
                        attempts++;
                    }, 500);
                });
            };
        }

        if (apiFunc) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: apiFunc,
                args: [request.profile]
            }).then((results) => {
                const success = results && results[0] && results[0].result;
                sendResponse({ status: "success", apiSuccess: success });
            }).catch((err) => {
                console.error("[Let'emCook] Native API Execution Failed:", err);
                sendResponse({ status: "error", error: err.message });
            });
            return true; // Keep message channel open for async response
        } else {
            sendResponse({ status: "error", error: "CMP API not registered in background." });
        }
    }
    
    if (request.action === "query_gemini_api") {
        console.log(`[Let'emCook] Proxying request to Gemini API (Profile: ${request.profile})...`);
        
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                sendResponse({ status: "error", error: "No API key found in storage." });
                return;
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
            const body = {
                contents: [{ parts: [{ text: request.prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 20
                }
            };

            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    console.error("[Let'emCook] Gemini API returned error:", JSON.stringify(data.error));
                    sendResponse({ status: "error", error: data.error.message || JSON.stringify(data.error) });
                } else if (data.candidates && data.candidates.length > 0) {
                    const aiResponseText = data.candidates[0].content?.parts?.[0]?.text;
                    if (aiResponseText) {
                        sendResponse({ status: "success", text: aiResponseText });
                    } else {
                        sendResponse({ status: "error", error: "Gemini returned empty response (likely Safety Filter block): " + JSON.stringify(data) });
                    }
                } else {
                    sendResponse({ status: "error", error: "Empty response from Gemini API: " + JSON.stringify(data) });
                }
            })
            .catch(err => {
                console.error("[Let'emCook] Failed to fetch from Gemini:", err);
                sendResponse({ status: "error", error: err.toString() });
            });
        });
        
        return true; 
    }
    
    return true; 
});

function logAction(entry) {
    chrome.storage.local.get(['auditLog'], (result) => {
        let logs = result.auditLog || [];
        entry.timestamp = Date.now();
        logs.push(entry);
        if (logs.length > 100) logs = logs.slice(logs.length - 100);
        chrome.storage.local.set({ auditLog: logs });
    });
}
