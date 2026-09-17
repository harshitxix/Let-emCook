document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('masterToggle');
    const killCountElement = document.getElementById('killCount');
    const statusPulse = document.getElementById('statusPulse');
    const statusText = document.getElementById('statusText');
    const profileRadios = document.querySelectorAll('input[name="profile"]');
    const aiToggle = document.getElementById('aiToggle');
    const aiSettingsPanel = document.getElementById('aiSettingsPanel');
    const geminiApiKey = document.getElementById('geminiApiKey');
    
    // Site Override Elements
    const currentDomainLabel = document.getElementById('currentDomainLabel');
    const siteToggle = document.getElementById('siteToggle');
    const siteProfileOverride = document.getElementById('siteProfileOverride');
    
    let currentHostname = null;

    // Load initial state from storage
    chrome.storage.local.get(['extensionEnabled', 'bannersAssassinated', 'trackersBlocked', 'privacyProfile', 'aiEnabled', 'geminiApiKey'], (result) => {
        // Handle Toggle State
        const isEnabled = result.extensionEnabled !== false; // Default true
        toggleSwitch.checked = isEnabled;
        
        // Handle AI Toggle State
        aiToggle.checked = result.aiEnabled === true; // Default false
        if (aiToggle.checked) aiSettingsPanel.classList.add('active');

        // Handle API Key
        if (result.geminiApiKey) {
            geminiApiKey.value = result.geminiApiKey;
        }

        // Handle Profile
        const currentProfile = result.privacyProfile || 'strict';
        const profileRadio = document.getElementById(currentProfile);
        if (profileRadio) profileRadio.checked = true;

        updateStatusUI(isEnabled, currentProfile);

        // Handle Kill Count
        const kills = result.bannersAssassinated || 0;
        animateNumber(killCountElement, 0, kills, 1000);
        
        // Handle Tracker Count
        const trackers = result.trackersBlocked || 0;
        const trackerCountElement = document.getElementById('trackerCount');
        if (trackerCountElement) {
            animateNumber(trackerCountElement, 0, trackers, 1000);
        }
        
        // Handle Current Site overrides
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    currentHostname = url.hostname;
                    currentDomainLabel.innerText = currentHostname;
                    
                    const siteRules = result.siteRules || {};
                    const rule = siteRules[currentHostname] || {};
                    
                    siteToggle.checked = rule.enabled !== false;
                    siteProfileOverride.value = rule.profile || 'default';
                } catch (e) {
                    currentDomainLabel.innerText = "unknown site";
                    siteToggle.disabled = true;
                    siteProfileOverride.disabled = true;
                }
            } else {
                currentDomainLabel.innerText = "No active page";
                siteToggle.disabled = true;
                siteProfileOverride.disabled = true;
            }
        });
    });

    // Listen for toggle changes
    toggleSwitch.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        const currentProfile = document.querySelector('input[name="profile"]:checked').value;
        chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
            updateStatusUI(isEnabled, currentProfile);
        });
    });

    // Listen for AI toggle changes
    aiToggle.addEventListener('change', (e) => {
        const aiEnabled = e.target.checked;
        chrome.storage.local.set({ aiEnabled: aiEnabled });
        
        if (aiEnabled) {
            aiSettingsPanel.classList.add('active');
        } else {
            aiSettingsPanel.classList.remove('active');
        }
    });

    // Listen for API Key changes
    let debounceTimer;
    geminiApiKey.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            chrome.storage.local.set({ geminiApiKey: e.target.value.trim() });
        }, 500);
    });

    // Listen for profile changes
    profileRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const currentProfile = e.target.value;
            const isEnabled = toggleSwitch.checked;
            chrome.storage.local.set({ privacyProfile: currentProfile }, () => {
                updateStatusUI(isEnabled, currentProfile);
            });
        });
    });
    
    // Listen for Site Toggle changes
    siteToggle.addEventListener('change', (e) => {
        if (!currentHostname) return;
        const isEnabled = e.target.checked;
        chrome.storage.local.get(['siteRules'], (result) => {
            const siteRules = result.siteRules || {};
            if (!siteRules[currentHostname]) siteRules[currentHostname] = {};
            siteRules[currentHostname].enabled = isEnabled;
            chrome.storage.local.set({ siteRules });
        });
    });

    // Listen for Site Profile Override changes
    siteProfileOverride.addEventListener('change', (e) => {
        if (!currentHostname) return;
        const profile = e.target.value;
        chrome.storage.local.get(['siteRules'], (result) => {
            const siteRules = result.siteRules || {};
            if (!siteRules[currentHostname]) siteRules[currentHostname] = {};
            
            if (profile === 'default') {
                delete siteRules[currentHostname].profile;
            } else {
                siteRules[currentHostname].profile = profile;
            }
            
            chrome.storage.local.set({ siteRules });
        });
    });

    function updateStatusUI(isEnabled, profile) {
        if (isEnabled) {
            statusPulse.classList.remove('off');
            const profileLabels = {
                'strict': 'Actively rejecting all cookies...',
                'balanced': 'Saving balanced preferences...',
                'relaxed': 'Actively accepting all cookies...'
            };
            statusText.innerText = profileLabels[profile] || "Actively scanning pages...";
        } else {
            statusPulse.classList.add('off');
            statusText.innerText = "Extension paused.";
        }
    }
    
    // Listen for Audit Log button
    const viewAuditLogBtn = document.getElementById('viewAuditLogBtn');
    if (viewAuditLogBtn) {
        viewAuditLogBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        });
    }

    // Smooth number counting animation
    function animateNumber(element, start, end, duration) {
        if (start === end) {
            element.innerText = end;
            return;
        }
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // Ease out quad
            const easeProgress = progress * (2 - progress);
            element.innerText = Math.floor(easeProgress * (end - start) + start);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.innerText = end;
            }
        };
        window.requestAnimationFrame(step);
    }
});
