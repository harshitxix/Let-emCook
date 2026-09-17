document.addEventListener('DOMContentLoaded', () => {
    const logBody = document.getElementById('logBody');
    const logTable = document.getElementById('logTable');
    const emptyState = document.getElementById('emptyState');
    const clearLogBtn = document.getElementById('clearLogBtn');

    function renderLogs(logs) {
        if (!logs || logs.length === 0) {
            logTable.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        logTable.style.display = 'table';
        emptyState.style.display = 'none';
        logBody.innerHTML = '';

        // Logs are appended so newest is at the end of array. We want newest first.
        const reversedLogs = [...logs].reverse();

        reversedLogs.forEach(log => {
            const tr = document.createElement('tr');
            
            // Format timestamp
            const date = new Date(log.timestamp);
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Action Badge
            let actionBadge = '';
            if (log.actionType === 'Banner Destroyed') {
                actionBadge = '<span class="badge banner">Banner Destroyed</span>';
            } else if (log.actionType === 'Tracker Blocked') {
                actionBadge = '<span class="badge tracker">Tracker Blocked</span>';
            } else {
                actionBadge = `<span class="badge">${log.actionType}</span>`;
            }

            // Engine Badge
            let engineBadge = '';
            if (log.engine === 'AI') {
                engineBadge = '<span class="badge engine-ai">Cloud AI Vision</span>';
            } else if (log.engine === 'Regex') {
                engineBadge = '<span class="badge engine-regex">Heuristic Regex</span>';
            } else if (log.engine === 'DNR') {
                engineBadge = '<span class="badge engine-dnr">Network Filter</span>';
            } else if (log.engine === 'DOM') {
                engineBadge = '<span class="badge engine-dnr" style="background: rgba(234, 88, 12, 0.2); color: #f97316;">DOM Pixel Scanner</span>';
            } else {
                engineBadge = `<span class="badge">${log.engine || 'System'}</span>`;
            }

            tr.innerHTML = `
                <td class="timestamp">${timeString}</td>
                <td class="domain">${log.domain}</td>
                <td>${actionBadge}</td>
                <td>${engineBadge}</td>
                <td class="reason">${log.reason || ''}</td>
            `;
            
            logBody.appendChild(tr);
        });
    }

    // Initial Load
    chrome.storage.local.get(['auditLog'], (result) => {
        renderLogs(result.auditLog || []);
    });

    // Listen for real-time updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.auditLog) {
            renderLogs(changes.auditLog.newValue || []);
        }
    });

    // Clear Button
    clearLogBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the audit log?")) {
            chrome.storage.local.set({ auditLog: [] }, () => {
                renderLogs([]);
            });
        }
    });
});
