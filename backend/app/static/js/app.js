let ws;
let map;
let mapTileLayer;
let markers = {};
let mitreChart;
let activeDeviceData = null;
let currentThemeSetting = localStorage.getItem('argus-theme') || 'dark';

// ==========================================
// Custom Option Fields (TomSelect Integration)
// ==========================================
function initGlobalTomSelects(root) {
    if (typeof TomSelect === 'undefined') return;
    const container = root || document;
    const selects = container.querySelectorAll('select:not([data-no-tomselect]):not(.no-tomselect)');
    selects.forEach(select => {
        if (select.closest('.no-tomselect-container')) return;
        if (select.tomselect) {
            select.tomselect.sync();
            return;
        }
        if (select.classList.contains('tomselected')) return;
        try {
            const ts = new TomSelect(select, {
                create: false,
                maxItems: 1,
                allowEmptyOption: true,
                dropdownParent: 'body',
                controlInput: null
            });
            ts.on('change', () => {
                if (typeof select.onchange === 'function') {
                    select.onchange();
                }
            });
        } catch (e) {
            console.debug('TomSelect init skipped:', e);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    restoreSidebarState();
    initMap();
    initChart();
    restoreLayoutState();
    initWebSocket();
    initGlobalTomSelects();
    fetchUserProfile();
    fetchInitialData();
    fetchForensicDevices();
    setInterval(fetchInitialData, 10000); // 10s fallback poll
    setInterval(fetchForensicDevices, 8000); // 8s device discovery poll

    // Close profile dropdown when clicking outside
    window.addEventListener('click', (e) => {
        const wrapper = document.getElementById('profileDropdownWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            closeProfileDropdown();
        }
    });

    // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleSidebar();
        }

        // Handle active MessageBox modal
        const msgModal = document.getElementById('argusMessageBoxModal');
        if (msgModal && !msgModal.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                e.preventDefault();
                const cancelBtn = document.getElementById('argusMsgCancelBtn');
                const isConfirm = cancelBtn && !cancelBtn.classList.contains('hidden');
                resolveArgusMessageBox(isConfirm ? false : true);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                resolveArgusMessageBox(true);
            }
        }
    });

    // Sync layout on viewport resize
    window.addEventListener('resize', () => {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('mobileBackdrop');
        if (!sidebar) return;
        if (window.innerWidth >= 1024) {
            if (backdrop) backdrop.classList.add('hidden');
            sidebar.classList.remove('sidebar-open');
            const saved = localStorage.getItem('artis-sidebar-collapsed');
            if (saved === 'true') sidebar.classList.add('sidebar-collapsed');
            else sidebar.classList.remove('sidebar-collapsed');
        } else {
            sidebar.classList.remove('sidebar-collapsed');
        }
        syncSidebarToggleIcon();
    });
});

// ==========================================
// Modular Panel Pull & Drag-and-Drop System
// ==========================================
let draggedCardId = null;

function handleDragStart(e, cardId) {
    draggedCardId = cardId;
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.add('opacity-40', 'scale-[0.98]');
    }
}

function handleDragEnd(e) {
    if (draggedCardId) {
        const card = document.getElementById(draggedCardId);
        if (card) {
            card.classList.remove('opacity-40', 'scale-[0.98]');
        }
    }
    document.querySelectorAll('.panel-slot').forEach(slot => {
        slot.classList.remove('ring-2', 'ring-slate-900 dark:ring-white', 'bg-slate-900/10 dark:bg-white/10', 'rounded-2xl', 'border-2', 'border-dashed', 'border-slate-900 dark:border-white');
    });
    draggedCardId = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const slot = e.currentTarget;
    if (!slot.classList.contains('ring-2')) {
        slot.classList.add('ring-2', 'ring-slate-900 dark:ring-white', 'bg-slate-900/10 dark:bg-white/10', 'rounded-2xl', 'border-2', 'border-dashed', 'border-slate-900 dark:border-white');
    }
}

function handleDragLeave(e) {
    const slot = e.currentTarget;
    slot.classList.remove('ring-2', 'ring-slate-900 dark:ring-white', 'bg-slate-900/10 dark:bg-white/10', 'rounded-2xl', 'border-2', 'border-dashed', 'border-slate-900 dark:border-white');
}

function handleDrop(e, targetSlotId) {
    e.preventDefault();
    const targetSlot = document.getElementById(targetSlotId);
    if (targetSlot) {
        targetSlot.classList.remove('ring-2', 'ring-slate-900 dark:ring-white', 'bg-slate-900/10 dark:bg-white/10', 'rounded-2xl', 'border-2', 'border-dashed', 'border-slate-900 dark:border-white');
    }

    const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
    if (!cardId) return;

    swapCardToSlot(cardId, targetSlotId);
}

function pullToMain(cardId) {
    swapCardToSlot(cardId, 'slot-1');
}

function swapCardToSlot(cardId, targetSlotId) {
    const cardToMove = document.getElementById(cardId);
    const targetSlot = document.getElementById(targetSlotId);
    if (!cardToMove || !targetSlot) return;

    const sourceSlot = cardToMove.parentElement;
    if (!sourceSlot || sourceSlot.id === targetSlotId) return; // already in this slot

    const cardInTarget = targetSlot.firstElementChild;
    if (!cardInTarget) {
        targetSlot.appendChild(cardToMove);
    } else {
        // Swap the two cards
        targetSlot.appendChild(cardToMove);
        sourceSlot.appendChild(cardInTarget);
    }

    // Visual pulse feedback on newly positioned card
    cardToMove.classList.add('ring-2', 'ring-slate-900 dark:ring-white', 'ring-offset-2');
    setTimeout(() => cardToMove.classList.remove('ring-2', 'ring-slate-900 dark:ring-white', 'ring-offset-2'), 800);

    // Re-invalidate map and chart to re-render smoothly in their new dimensions
    if (map) {
        setTimeout(() => map.invalidateSize(), 150);
        setTimeout(() => map.invalidateSize(), 400);
    }
    if (mitreChart) {
        setTimeout(() => mitreChart.resize(), 150);
    }

    updatePullButtonLabels();
    saveLayoutState();
}

function updatePullButtonLabels() {
    const slot1 = document.getElementById('slot-1');
    if (!slot1) return;
    const mainCard = slot1.firstElementChild;
    const mainCardId = mainCard ? mainCard.id : null;

    ['card-threats', 'card-matrix', 'card-devices', 'card-map'].forEach(id => {
        const btn = document.getElementById(`btn-pull-${id}`);
        if (!btn) return;
        const labelSpan = btn.querySelector('.label');
        if (id === mainCardId) {
            btn.className = 'pull-btn px-3.5 py-1 rounded-sm text-[11px] font-mono bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-900 dark:border-white/30 transition flex items-center justify-center space-x-1 font-bold min-w-[110px] cursor-default';
            btn.title = 'Currently pinned on Primary Stage';
            if (labelSpan) labelSpan.innerText = 'Primary Stage';
        } else {
            btn.className = 'pull-btn px-3.5 py-1 rounded-sm text-[11px] font-mono border border-slate-200 dark:border-cyber-700/60 hover:bg-slate-100 dark:hover:bg-cyber-700 transition flex items-center justify-center space-x-1 text-slate-600 dark:text-slate-300 min-w-[110px]';
            btn.title = 'Pull into Main Big Stage';
            if (labelSpan) labelSpan.innerText = 'Pull to Main';
        }
    });
}

function saveLayoutState() {
    const layout = {
        'slot-1': document.getElementById('slot-1')?.firstElementChild?.id,
        'slot-2': document.getElementById('slot-2')?.firstElementChild?.id,
        'slot-3': document.getElementById('slot-3')?.firstElementChild?.id,
        'slot-4': document.getElementById('slot-4')?.firstElementChild?.id,
    };
    localStorage.setItem('argus-layout', JSON.stringify(layout));
}

function restoreLayoutState() {
    const saved = localStorage.getItem('argus-layout');
    if (!saved) {
        updatePullButtonLabels();
        return;
    }
    try {
        const layout = JSON.parse(saved);
        ['slot-1', 'slot-2', 'slot-3', 'slot-4'].forEach(slotId => {
            const cardId = layout[slotId];
            if (cardId) {
                const card = document.getElementById(cardId);
                const slot = document.getElementById(slotId);
                if (card && slot && card.parentElement !== slot) {
                    slot.appendChild(card);
                }
            }
        });
        if (map) setTimeout(() => map.invalidateSize(), 200);
        if (mitreChart) setTimeout(() => mitreChart.resize(), 200);
    } catch(e) {
        console.error('Failed to restore layout', e);
    }
    updatePullButtonLabels();
}

function resetLayout() {
    localStorage.removeItem('argus-layout');
    const defaultMapping = {
        'slot-1': 'card-threats',
        'slot-2': 'card-matrix',
        'slot-3': 'card-devices',
        'slot-4': 'card-map'
    };
    Object.entries(defaultMapping).forEach(([slotId, cardId]) => {
        const card = document.getElementById(cardId);
        const slot = document.getElementById(slotId);
        if (card && slot) slot.appendChild(card);
    });
    if (map) setTimeout(() => map.invalidateSize(), 200);
    if (mitreChart) setTimeout(() => mitreChart.resize(), 200);
    updatePullButtonLabels();
}

async function fetchUserProfile() {
    try {
        const res = await fetch('/api/v1/users/me');
        if (!res.ok) return;
        const user = await res.json();

        // Topbar
        const topbarName = document.getElementById('topbarFullName');
        const topbarId = document.getElementById('topbarUserId');
        if (topbarName) topbarName.innerText = user.full_name;
        if (topbarId) topbarId.innerText = user.user_id;

        // Dropdown Card
        const menuName = document.getElementById('menuFullName');
        const menuId = document.getElementById('menuUserId');
        const menuOrg = document.getElementById('menuOrgName');
        const menuRole = document.getElementById('menuRole');
        if (menuName) menuName.innerText = user.full_name;
        if (menuId) menuId.innerText = user.user_id;
        if (menuOrg) menuOrg.innerText = user.organization_name;
        if (menuRole) menuRole.innerText = user.role.toUpperCase();

        // Settings Modal
        const settingsName = document.getElementById('settingsFullName');
        const settingsId = document.getElementById('settingsUserId');
        const settingsRoleOrg = document.getElementById('settingsRoleOrg');
        if (settingsName) settingsName.innerText = user.full_name;
        if (settingsId) settingsId.innerText = user.user_id;
        if (settingsRoleOrg) settingsRoleOrg.innerText = `Role: ${user.role} • Org: ${user.organization_name}`;
    } catch (e) {
        console.error('Failed to fetch user profile:', e);
    }
}

// Profile Dropdown handlers
function toggleProfileDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');
    const chevron = document.getElementById('profileChevron');
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
        dropdown.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        dropdown.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

function closeProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    const chevron = document.getElementById('profileChevron');
    if (dropdown) dropdown.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
}

function openSettingsModal() {
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

// =========================================================================
// Artis Executive MessageBox Subsystem
// Replaces browser alerts & confirms with themed, non-blocking modal dialogs.
// =========================================================================
let argusMessageBoxResolver = null;

function showArgusAlert(options) {
    if (typeof options === 'string') {
        options = { message: options };
    }
    return openArgusMessageBox({
        type: options.type || 'info',
        title: options.title || 'System Notification',
        message: options.message || '',
        badge: options.badge,
        digest: options.digest,
        digestLabel: options.digestLabel,
        details: options.details,
        confirmText: options.confirmText || 'Acknowledge',
        showCancel: false
    });
}

function showArgusConfirm(options) {
    if (typeof options === 'string') {
        options = { message: options };
    }
    return openArgusMessageBox({
        type: options.type || 'warning',
        title: options.title || 'Action Confirmation',
        message: options.message || '',
        badge: options.badge || 'CONFIRMATION',
        details: options.details,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        showCancel: true
    });
}

function openArgusMessageBox({
    type = 'info',
    title = 'System Notice',
    message = '',
    badge = '',
    digest = '',
    digestLabel = 'SHA-256 Digest',
    details = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false
}) {
    return new Promise((resolve) => {
        argusMessageBoxResolver = resolve;

        const modal = document.getElementById('argusMessageBoxModal');
        const card = document.getElementById('argusMsgCard');
        const accent = document.getElementById('argusMsgAccent');
        const iconWrapper = document.getElementById('argusMsgIconWrapper');
        const icon = document.getElementById('argusMsgIcon');
        const titleEl = document.getElementById('argusMsgTitle');
        const badgeEl = document.getElementById('argusMsgBadge');
        const descEl = document.getElementById('argusMsgDescription');
        const digestBox = document.getElementById('argusMsgDigestBox');
        const digestLabelEl = document.getElementById('argusMsgDigestLabel');
        const digestValEl = document.getElementById('argusMsgDigestVal');
        const detailsBox = document.getElementById('argusMsgDetailsBox');
        const cancelBtn = document.getElementById('argusMsgCancelBtn');
        const confirmBtn = document.getElementById('argusMsgConfirmBtn');

        if (!modal) {
            resolve(showCancel ? false : true);
            return;
        }

        titleEl.textContent = title;
        descEl.textContent = message;

        if (badge) {
            badgeEl.textContent = badge;
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }

        if (digest) {
            digestLabelEl.textContent = digestLabel;
            digestValEl.textContent = digest;
            digestBox.classList.remove('hidden');
        } else {
            digestBox.classList.add('hidden');
        }

        if (details) {
            detailsBox.textContent = details;
            detailsBox.classList.remove('hidden');
        } else {
            detailsBox.classList.add('hidden');
        }

        confirmBtn.textContent = confirmText;
        if (showCancel) {
            cancelBtn.textContent = cancelText;
            cancelBtn.classList.remove('hidden');
        } else {
            cancelBtn.classList.add('hidden');
        }

        accent.className = 'absolute top-0 left-6 right-6 h-1 rounded-full shadow-sm';
        iconWrapper.className = 'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border';
        confirmBtn.className = 'px-5 py-2 rounded-sm min-w-[110px] text-xs font-semibold text-white shadow-md transition flex items-center justify-center';

        if (type === 'success') {
            accent.classList.add('bg-slate-900', 'dark:bg-white');
            iconWrapper.classList.add('bg-slate-200', 'dark:bg-white/10', 'text-slate-900', 'dark:text-white', 'border-slate-300', 'dark:border-white/20');
            confirmBtn.classList.add('bg-slate-900', 'hover:bg-black', 'dark:bg-white', 'dark:hover:bg-slate-200', 'text-white', 'dark:text-black');
            badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20';
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>';
        } else if (type === 'danger') {
            accent.classList.add('bg-slate-900', 'dark:bg-white');
            iconWrapper.classList.add('bg-slate-200', 'dark:bg-white/10', 'text-slate-900', 'dark:text-white', 'border-slate-300', 'dark:border-white/20');
            confirmBtn.classList.add('bg-slate-900', 'hover:bg-black', 'dark:bg-white', 'dark:hover:bg-slate-200', 'text-white', 'dark:text-black');
            badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20';
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>';
        } else if (type === 'warning') {
            accent.classList.add('bg-slate-900', 'dark:bg-white');
            iconWrapper.classList.add('bg-slate-200', 'dark:bg-white/10', 'text-slate-900', 'dark:text-white', 'border-slate-300', 'dark:border-white/20');
            confirmBtn.classList.add('bg-slate-900', 'hover:bg-black', 'dark:bg-white', 'dark:hover:bg-slate-200', 'text-white', 'dark:text-black');
            badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20';
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
        } else {
            accent.classList.add('bg-slate-900', 'dark:bg-white');
            iconWrapper.classList.add('bg-slate-900/10 dark:bg-white/10', 'text-slate-900', 'dark:text-white', 'border-slate-900 dark:border-white/20');
            confirmBtn.classList.add('bg-slate-900', 'hover:bg-black', 'dark:bg-white', 'dark:hover:bg-slate-200', 'text-white', 'dark:text-black');
            badgeEl.className = 'text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-900 dark:border-white/20';
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
        }

        modal.classList.remove('hidden');
        setTimeout(() => {
            if (card) {
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }
            if (confirmBtn) confirmBtn.focus();
        }, 10);
    });
}

function resolveArgusMessageBox(result) {
    const modal = document.getElementById('argusMessageBoxModal');
    const card = document.getElementById('argusMsgCard');
    if (card) {
        card.classList.remove('scale-100');
        card.classList.add('scale-95');
    }
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        if (argusMessageBoxResolver) {
            argusMessageBoxResolver(result);
            argusMessageBoxResolver = null;
        }
    }, 120);
}

function copyArgusDigest() {
    const valEl = document.getElementById('argusMsgDigestVal');
    const textEl = document.getElementById('argusMsgCopyText');
    if (!valEl) return;
    navigator.clipboard.writeText(valEl.textContent.trim()).then(() => {
        if (textEl) {
            textEl.textContent = 'Copied!';
            setTimeout(() => { textEl.textContent = 'Copy'; }, 2000);
        }
    });
}

// Intercept any legacy native alert() or confirm() throughout the entire system
window.alert = function(msg) {
    return showArgusAlert({ message: msg });
};
window.confirm = function(msg) {
    return showArgusConfirm({ message: msg });
};

function lockSession() {
    closeProfileDropdown();
    showArgusAlert({
        title: 'SOC Session Locked',
        badge: 'SECURITY SUSPENSION',
        message: 'Your operational console has been locked. Re-authenticate to access sensitive telemetry.',
        type: 'warning',
        confirmText: 'Acknowledge'
    });
}

// Theme Management: Light, Dark, System
function initTheme() {
    setTheme(currentThemeSetting, false);

    // Listen for system theme changes if set to auto
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (currentThemeSetting === 'system') {
            applyThemeClass(e.matches);
        }
    });
}

function setTheme(mode, save = true) {
    currentThemeSetting = mode;
    if (save) localStorage.setItem('argus-theme', mode);

    // Update UI buttons in sidebar and profile dropdown
    ['light', 'dark', 'system'].forEach(m => {
        const btn = document.getElementById(`themeBtn-${m}`);
        if (btn) {
            btn.className = (m === mode)
                ? 'py-1 rounded-sm bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow font-semibold flex items-center justify-center space-x-1'
                : 'py-1 rounded-sm flex items-center justify-center space-x-1 hover:text-slate-900 dark:hover:text-white transition';
        }
        const menuBtn = document.getElementById(`menuThemeBtn-${m}`);
        if (menuBtn) {
            menuBtn.className = (m === mode)
                ? 'py-1 rounded-sm bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow font-semibold flex items-center justify-center space-x-1'
                : 'py-1 rounded-sm flex items-center justify-center space-x-1 hover:text-slate-900 dark:hover:text-white transition';
        }
    });

    let isDark = false;
    if (mode === 'dark') isDark = true;
    else if (mode === 'light') isDark = false;
    else if (mode === 'system') isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    applyThemeClass(isDark);
}

function applyThemeClass(isDark) {
    const html = document.documentElement;
    if (isDark) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }

    // Update Map tile layer if needed
    if (map && !mapTileLayer) {
        mapTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
    }

    // Update Chart.js labels color and border
    if (mitreChart) {
        mitreChart.options.plugins.legend.labels.color = isDark ? '#E2E8F0' : '#1E293B';
        if (mitreChart.data.datasets && mitreChart.data.datasets[0]) {
            mitreChart.data.datasets[0].borderColor = isDark ? '#121215' : '#FFFFFF';
        }
        mitreChart.update();
    }
}

function cycleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    if (!sidebar) return;

    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
        sidebar.classList.toggle('sidebar-open');
        const isOpen = sidebar.classList.contains('sidebar-open');
        if (backdrop) {
            if (isOpen) backdrop.classList.remove('hidden');
            else backdrop.classList.add('hidden');
        }
    } else {
        sidebar.classList.toggle('sidebar-collapsed');
        const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
        localStorage.setItem('artis-sidebar-collapsed', isCollapsed ? 'true' : 'false');
    }
    syncSidebarToggleIcon();

    // Invalidate Leaflet map & Chart resize to immediately fill full viewport width
    setTimeout(() => {
        if (map) map.invalidateSize();
        if (mitreChart) mitreChart.resize();
    }, 150);
    setTimeout(() => {
        if (map) map.invalidateSize();
        if (mitreChart) mitreChart.resize();
    }, 350);
}

function syncSidebarToggleIcon() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    if (!sidebar) return;
    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
    
    if (toggleBtn) {
        const foldIcon = toggleBtn.querySelector('.sidebar-icon-fold');
        const hamburgerIcon = toggleBtn.querySelector('.sidebar-icon-hamburger');
        if (foldIcon && hamburgerIcon) {
            if (isCollapsed) {
                foldIcon.classList.add('hidden');
                hamburgerIcon.classList.remove('hidden');
            } else {
                foldIcon.classList.remove('hidden');
                hamburgerIcon.classList.add('hidden');
            }
        }
    }
}

function restoreSidebarState() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    if (!sidebar) return;

    if (window.innerWidth >= 1024) {
        const saved = localStorage.getItem('artis-sidebar-collapsed');
        if (saved === 'true') {
            sidebar.classList.add('sidebar-collapsed');
        } else {
            sidebar.classList.remove('sidebar-collapsed');
        }
        if (backdrop) backdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('sidebar-open');
        if (backdrop) backdrop.classList.add('hidden');
    }
    syncSidebarToggleIcon();
}

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl || typeof L === 'undefined') return;
    map = L.map('map').setView([40.7128, -74.0060], 4);
    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    mapTileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
}

function initChart() {
    const chartEl = document.getElementById('mitreChart');
    if (!chartEl || typeof Chart === 'undefined') return;
    const isDark = document.documentElement.classList.contains('dark');
    const ctx = chartEl.getContext('2d');
    mitreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Execution', 'Collection', 'Exfiltration', 'Discovery', 'Initial Access'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: ['#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#10B981'],
                borderColor: isDark ? '#121215' : '#FFFFFF',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: isDark ? '#E2E8F0' : '#1E293B', font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 10, weight: '600' } }
                }
            }
        }
    });
}

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        const dot = document.getElementById('wsStatusDot');
        const txt = document.getElementById('wsStatusText');
        if (dot) dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
        if (txt) {
            txt.innerText = 'LIVE FEED';
            txt.className = 'font-mono font-bold text-emerald-600 dark:text-emerald-400';
        }

        const cDot = document.getElementById('wsStatusDotCollapsed');
        const cTxt = document.getElementById('wsStatusTextCollapsed');
        if (cDot) cDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
        if (cTxt) {
            cTxt.innerText = 'LIVE';
            cTxt.className = 'text-[7.5px] font-mono font-bold uppercase tracking-wider leading-none mt-1 text-emerald-600 dark:text-emerald-400';
        }
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ALERT') {
            prependAlert(data.alert);
            fetchStats();
        } else if (data.type === 'DEVICE_UPDATE') {
            fetchDevices();
        }
    };

    ws.onclose = () => {
        const dot = document.getElementById('wsStatusDot');
        const txt = document.getElementById('wsStatusText');
        if (dot) dot.className = 'h-2 w-2 rounded-full bg-red-500';
        if (txt) txt.innerText = 'DISCONNECTED';

        const cDot = document.getElementById('wsStatusDotCollapsed');
        const cTxt = document.getElementById('wsStatusTextCollapsed');
        if (cDot) cDot.className = 'h-2 w-2 rounded-full bg-red-500';
        if (cTxt) {
            cTxt.innerText = 'OFF';
            cTxt.className = 'text-[7.5px] font-mono font-bold uppercase tracking-wider leading-none mt-1 text-red-500';
        }
        setTimeout(initWebSocket, 3000);
    };
}

// ==========================================
// Skeleton Placeholder Screen Generators
// ==========================================
function renderAlertsSkeleton(container, count = 3) {
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="alert-skeleton p-3 rounded-lg border border-slate-200 dark:border-cyber-700/50 bg-slate-50 dark:bg-cyber-800/40 space-y-2">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 w-2/3">
                        <div class="w-14 h-4 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                        <div class="w-1/2 h-4 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                    </div>
                    <div class="w-12 h-3 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                </div>
                <div class="w-4/5 h-3 bg-slate-200 dark:bg-cyber-700/50 rounded animate-pulse"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderDevicesSkeleton(tbody, rows = 4) {
    if (!tbody) return;
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += `
            <tr class="device-skeleton">
                <td class="py-3 px-3"><div class="h-3.5 w-28 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-3 px-3"><div class="h-3.5 w-16 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-3 px-3"><div class="h-3.5 w-20 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-3 px-3"><div class="h-3.5 w-24 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-3 px-3"><div class="h-4 w-14 bg-slate-200 dark:bg-cyber-700/60 rounded-full animate-pulse"></div></td>
                <td class="py-3 px-3"><div class="h-4 w-16 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-3 px-3 text-right"><div class="h-6 w-14 ml-auto bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

function renderForensicDevicesSkeleton(grid, count = 2) {
    if (!grid) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="forensic-skeleton p-4 bg-slate-50 dark:bg-cyber-800/40 rounded-xl border border-slate-200 dark:border-cyber-700/60 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 w-2/3">
                        <div class="w-8 h-8 rounded-lg bg-slate-200 dark:bg-cyber-700/70 animate-pulse"></div>
                        <div class="space-y-1.5 flex-1">
                            <div class="h-3.5 w-3/4 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                            <div class="h-2.5 w-1/2 bg-slate-200 dark:bg-cyber-700/50 rounded animate-pulse"></div>
                        </div>
                    </div>
                    <div class="h-4 w-16 bg-slate-200 dark:bg-cyber-700/70 rounded-full animate-pulse"></div>
                </div>
                <div class="flex gap-2 pt-2">
                    <div class="h-7 flex-1 bg-slate-200 dark:bg-cyber-700/60 rounded-lg animate-pulse"></div>
                    <div class="h-7 w-20 bg-slate-200 dark:bg-cyber-700/60 rounded-lg animate-pulse"></div>
                </div>
            </div>
        `;
    }
    grid.innerHTML = html;
}

function renderAuditSkeleton(list, count = 3) {
    if (!list) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="audit-skeleton p-2.5 bg-slate-100 dark:bg-cyber-800/50 rounded border border-slate-200 dark:border-cyber-700/50 space-y-1.5">
                <div class="flex justify-between">
                    <div class="h-3 w-20 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                    <div class="h-3 w-12 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                </div>
                <div class="h-3.5 w-3/4 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div>
                <div class="h-2.5 w-1/2 bg-slate-200 dark:bg-cyber-700/50 rounded animate-pulse"></div>
            </div>
        `;
    }
    list.innerHTML = html;
}

function renderForensicFilesSkeleton(tbody, rows = 5) {
    if (!tbody) return;
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += `
            <tr class="file-skeleton">
                <td class="py-2.5 px-4 flex items-center space-x-2">
                    <div class="w-4 h-4 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse flex-shrink-0"></div>
                    <div class="h-3.5 w-36 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                </td>
                <td class="py-2.5 px-3"><div class="h-3 w-14 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-12 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-20 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
                <td class="py-2.5 px-4 text-right"><div class="h-6 w-20 ml-auto bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></div></td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

function renderModalTabSkeleton(contentDiv) {
    if (!contentDiv) return;
    contentDiv.innerHTML = `
        <div class="space-y-3">
            <div class="p-3 bg-slate-100 dark:bg-cyber-800/60 rounded-xl border border-slate-200 dark:border-cyber-700/50 space-y-2">
                <div class="flex justify-between items-center">
                    <div class="h-4 w-36 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                    <div class="h-3 w-16 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                </div>
                <div class="h-3 w-3/4 bg-slate-200 dark:bg-cyber-700/50 rounded animate-pulse"></div>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-cyber-800/60 rounded-xl border border-slate-200 dark:border-cyber-700/50 space-y-2">
                <div class="flex justify-between items-center">
                    <div class="h-4 w-28 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                    <div class="h-3 w-16 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                </div>
                <div class="h-3 w-2/3 bg-slate-200 dark:bg-cyber-700/50 rounded animate-pulse"></div>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-cyber-800/60 rounded-xl border border-slate-200 dark:border-cyber-700/50 space-y-2">
                <div class="flex justify-between items-center">
                    <div class="h-4 w-32 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                    <div class="h-3 w-16 bg-slate-200 dark:bg-cyber-700/70 rounded animate-pulse"></div>
                </div>
                <div class="h-3 w-1/2 bg-slate-200 dark:bg-cyber-700/50 rounded animate-pulse"></div>
            </div>
        </div>
    `;
}

async function fetchInitialData() {
    await Promise.all([
        fetchAlerts(),
        fetchDevices(),
        fetchStats(),
        fetchAudit()
    ]);
}

async function fetchStats() {
    try {
        const res = await fetch('/api/v1/alerts/stats/summary');
        const stats = await res.json();
        const statActive = document.getElementById('statActiveThreats');
        if (statActive) statActive.innerText = stats.open || 0;
        const statActivePage = document.getElementById('statActiveThreatsPage');
        if (statActivePage) statActivePage.innerText = stats.open || 0;
        const sideActive = document.getElementById('sideActiveThreats');
        if (sideActive) sideActive.innerText = stats.open || 0;
        const sideThreatsTip = document.getElementById('sideActiveThreatsTooltip');
        if (sideThreatsTip) sideThreatsTip.innerText = `${stats.open || 0} Live`;
        const statCrit = document.getElementById('statCriticalHigh');
        if (statCrit) statCrit.innerText = `${stats.critical} / ${stats.high}`;
        const statCritPage = document.getElementById('statCriticalHighPage');
        if (statCritPage) statCritPage.innerText = `${stats.critical} / ${stats.high}`;
    } catch (e) {
        console.error(e);
    }
}

async function fetchAlerts() {
    try {
        const res = await fetch('/api/v1/alerts?limit=25');
        const alerts = await res.json();
        const container = document.getElementById('alertContainer');
        if (!container) return;
        if (alerts && alerts.length > 0) {
            container.innerHTML = '';
            const tacticCounts = { 'Execution': 0, 'Collection': 0, 'Exfiltration': 0, 'Discovery': 0, 'Initial Access': 0 };
            alerts.forEach(a => {
                appendAlertElement(container, a);
                if (a.mitre_tactic && tacticCounts.hasOwnProperty(a.mitre_tactic)) {
                    tacticCounts[a.mitre_tactic]++;
                }
            });
            if (mitreChart) {
                mitreChart.data.datasets[0].data = Object.values(tacticCounts);
                mitreChart.update();
            }
        } else {
            container.innerHTML = `
                <div class="text-center py-20 text-slate-400 text-xs">
                    Listening for telemetry events... Run agent or threat test to stream live incidents.
                </div>
            `;
        }
    } catch (e) {
        console.error(e);
    }
}

function prependAlert(alert) {
    if (streamPaused) return; // Don't append new alerts when stream is paused
    const container = document.getElementById('alertContainer');
    if (!container) return;
    if (container.querySelector('.alert-skeleton') || container.innerText.includes('Listening for telemetry')) {
        container.innerHTML = '';
    }
    const el = createAlertElement(alert);
    el.classList.add('pulse-red');
    container.prepend(el);
    setTimeout(() => el.classList.remove('pulse-red'), 4000);

    if (mitreChart && alert.mitre_tactic) {
        const labels = mitreChart.data.labels;
        const idx = labels.indexOf(alert.mitre_tactic);
        if (idx !== -1) {
            mitreChart.data.datasets[0].data[idx] = (mitreChart.data.datasets[0].data[idx] || 0) + 1;
            mitreChart.update();
        }
    }
}

function appendAlertElement(container, alert) {
    container.appendChild(createAlertElement(alert));
}

function createAlertElement(alert) {
    const div = document.createElement('div');
    const sevBorder = {
        'CRITICAL': 'border-l-rose-500',
        'HIGH': 'border-l-orange-500',
        'MEDIUM': 'border-l-amber-500',
        'LOW': 'border-l-slate-400'
    };
    const sevBadge = {
        'CRITICAL': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        'HIGH': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
        'MEDIUM': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        'LOW': 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-400/30'
    };
    const borderClass = sevBorder[alert.severity] || sevBorder['LOW'];
    const badgeClass = sevBadge[alert.severity] || sevBadge['LOW'];

    const rawCmd = alert.raw_command || alert.process_command || '';
    const mitreTactic = alert.mitre_tactic || '';
    const mitreId = alert.mitre_technique_id || 'TXXXX';
    const mitreName = alert.mitre_technique_name || 'Generic';
    const hostName = alert.hostname || alert.device_id || '—';
    const userName = alert.user || alert.username || '';
    const timestamp = new Date(alert.detected_at).toLocaleTimeString();

    div.className = `alert-card p-3 rounded-sm border border-slate-200 dark:border-cyber-700/50 border-l-[3px] ${borderClass} bg-white dark:bg-cyber-card flex flex-col transition hover:shadow-md hover:border-slate-300 dark:hover:border-cyber-600`;
    div.setAttribute('data-severity', alert.severity || 'LOW');
    div.setAttribute('data-host', hostName);
    div.innerHTML = `
        <!-- Title Row -->
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2 min-w-0">
                <span class="px-1.5 py-0.5 rounded-sm font-mono font-bold text-[10px] uppercase border ${badgeClass} flex-shrink-0">${alert.severity}</span>
                <span class="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">${alert.title}</span>
            </div>
            <span class="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">${timestamp}</span>
        </div>

        <!-- Description -->
        <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">${alert.description}</p>

        ${rawCmd ? `
        <!-- Raw Payload / Command -->
        <div class="mt-2 border-t border-slate-100 dark:border-cyber-700/30 pt-2">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">Payload / Command</span>
                <button onclick="copyPayload(this)" data-payload="${rawCmd.replace(/"/g, '&quot;')}" class="px-2 py-0.5 rounded-sm text-[9px] font-mono text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-cyber-700/50 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-cyber-600 transition" title="Copy to clipboard">COPY</button>
            </div>
            <pre class="text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-cyber-900/40 p-2 rounded-sm border border-slate-100 dark:border-cyber-700/30 overflow-x-auto whitespace-pre-wrap break-all max-h-[60px] custom-scrollbar">${rawCmd}</pre>
        </div>
        ` : ''}

        <!-- MITRE & Host Info -->
        <div class="mt-2 border-t border-slate-100 dark:border-cyber-700/30 pt-2 flex items-center justify-between flex-wrap gap-1.5">
            <div class="flex items-center space-x-1.5 flex-wrap gap-1">
                <span class="px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold bg-slate-100 dark:bg-cyber-700/40 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-cyber-600/50">${mitreId}</span>
                <span class="text-[10px] text-slate-500 dark:text-slate-400">${mitreName}</span>
                ${mitreTactic ? `<span class="px-1.5 py-0.5 rounded-sm text-[9px] font-mono bg-slate-50 dark:bg-cyber-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-cyber-700/40">${mitreTactic}</span>` : ''}
            </div>
            <div class="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span class="font-mono">Host: <b class="text-slate-700 dark:text-slate-200">${hostName}</b></span>
                ${userName ? `<span class="font-mono">User: <b class="text-slate-700 dark:text-slate-200">${userName}</b></span>` : ''}
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-2 border-t border-slate-100 dark:border-cyber-700/30 pt-2 flex items-center justify-end space-x-2">
            <button onclick="openAttackChain('${alert.id}')" class="px-3 py-1 rounded-sm text-[10px] font-semibold min-w-[90px] text-center border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white transition">Attack Chain</button>
            <button onclick="openDeviceDetail('${alert.device_id}')" class="px-3 py-1 rounded-sm text-[10px] font-semibold min-w-[90px] text-center border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white transition">Remediate</button>
            <button onclick="resolveAlert('${alert.id}', this)" class="px-3 py-1 rounded-sm text-[10px] font-semibold min-w-[70px] text-center border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white transition">Resolve</button>
        </div>
    `;
    return div;
}

async function resolveAlert(alertId, btn) {
    try {
        await fetch(`/api/v1/alerts/${alertId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'RESOLVED' })
        });
        btn.parentElement.innerHTML = '<span class="text-slate-500 dark:text-slate-400 font-bold">Resolved</span>';
        fetchStats();
    } catch (e) {
        console.error(e);
    }
}

// ── Threat Stream: Copy Payload ──
function copyPayload(btn) {
    const payload = btn.getAttribute('data-payload');
    if (!payload) return;
    navigator.clipboard.writeText(payload).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'COPIED';
        btn.classList.add('text-slate-700', 'dark:text-slate-200');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('text-slate-700', 'dark:text-slate-200'); }, 1500);
    }).catch(() => {
        // Fallback for insecure contexts
        const ta = document.createElement('textarea');
        ta.value = payload;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const orig = btn.textContent;
        btn.textContent = 'COPIED';
        setTimeout(() => { btn.textContent = orig; }, 1500);
    });
}

// ── Threat Stream: Filtering ──
let streamPaused = false;
let activeSevFilter = 'ALL';
let activeHostFilter = '';

function filterStreamCards() {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    const cards = container.querySelectorAll('.alert-card');
    cards.forEach(card => {
        const sev = card.getAttribute('data-severity') || '';
        const host = (card.getAttribute('data-host') || '').toLowerCase();
        const text = card.textContent.toLowerCase();
        let show = true;
        if (activeSevFilter !== 'ALL' && sev !== activeSevFilter) show = false;
        if (activeHostFilter && !host.includes(activeHostFilter) && !text.includes(activeHostFilter)) show = false;
        card.style.display = show ? '' : 'none';
    });
}

function setStreamSevFilter(sev, btn) {
    activeSevFilter = sev;
    // Update active tab styling
    const tabs = document.querySelectorAll('.stream-sev-tab');
    tabs.forEach(t => {
        t.classList.remove('bg-slate-200', 'dark:bg-cyber-700', 'text-slate-900', 'dark:text-white', 'font-bold');
        t.classList.add('text-slate-500', 'dark:text-slate-400');
    });
    btn.classList.add('bg-slate-200', 'dark:bg-cyber-700', 'text-slate-900', 'dark:text-white', 'font-bold');
    btn.classList.remove('text-slate-500', 'dark:text-slate-400');
    filterStreamCards();
}

function toggleStreamPause() {
    streamPaused = !streamPaused;
    const btn = document.getElementById('streamPauseBtn');
    const icon = document.getElementById('streamPauseIcon');
    const label = document.getElementById('streamPauseLabel');
    if (btn) {
        if (streamPaused) {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
            if (label) label.textContent = 'Resume';
            btn.classList.add('text-amber-600', 'dark:text-amber-400', 'border-amber-400/40');
            btn.classList.remove('border-slate-200', 'dark:border-cyber-700/50');
        } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>';
            if (label) label.textContent = 'Pause';
            btn.classList.remove('text-amber-600', 'dark:text-amber-400', 'border-amber-400/40');
            btn.classList.add('border-slate-200', 'dark:border-cyber-700/50');
        }
    }
}

async function fetchDevices() {
    try {
        const res = await fetch('/api/v1/devices');
        const devices = await res.json();
        const statEnds = document.getElementById('statEndpoints');
        if (statEnds) statEnds.innerText = devices.length;
        const sideEnds = document.getElementById('sideEndpoints');
        if (sideEnds) sideEnds.innerText = devices.length;
        const sideEndpointsTip = document.getElementById('sideEndpointsTooltip');
        if (sideEndpointsTip) sideEndpointsTip.innerText = `${devices.length} Fleet`;

        const tbody = document.getElementById('devicesTableBody');
        if (!tbody) return;
        if (devices && devices.length > 0) {
            tbody.innerHTML = '';
            devices.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 dark:hover:bg-cyber-800/50 transition';
                const statusBadge = d.status === 'COMPROMISED'
                    ? '<span class="px-2 py-0.5 rounded bg-red-500/20 text-red-500 font-bold border border-red-500/30">COMPROMISED</span>'
                    : '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">ONLINE</span>';

                const riskColor = d.risk_score > 60 ? 'text-slate-900 dark:text-white font-bold' : (d.risk_score > 25 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400');

                tr.innerHTML = `
                    <td class="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">${d.hostname}</td>
                    <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400">${d.os_type}</td>
                    <td class="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">${d.current_user || 'system'}</td>
                    <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400">${d.branch_name}</td>
                    <td class="py-2.5 px-3 font-mono font-bold ${riskColor}">${d.risk_score} / 100</td>
                    <td class="py-2.5 px-3">${statusBadge}</td>
                    <td class="py-2.5 px-3 text-right">
                        <button onclick="openDeviceDetail('${d.id}')" class="px-2.5 py-1 rounded bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-cyber-600 font-medium text-[11px] transition">Inspect</button>
                    </td>
                `;
                tbody.appendChild(tr);

                // Update Leaflet marker
                if (d.latitude && d.longitude) {
                    if (!markers[d.id]) {
                        markers[d.id] = L.marker([parseFloat(d.latitude), parseFloat(d.longitude)])
                            .addTo(map)
                            .bindPopup(`<b>${d.branch_name}</b><br>Device: ${d.hostname}<br>Risk: ${d.risk_score}`);
                    }
                }
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-400">No devices connected yet. Launch agent-desktop to enroll.</td></tr>';
        }
    } catch (e) {
        console.error(e);
    }
}

async function openDeviceDetail(deviceId) {
    try {
        const modal = document.getElementById('deviceModal');
        const title = document.getElementById('modalDeviceTitle');
        const sub = document.getElementById('modalDeviceSub');
        const contentDiv = document.getElementById('modalTabContent');

        if (title) title.innerText = 'Connecting Node...';
        if (sub) sub.innerText = 'Fetching endpoint telemetry and security logs...';
        renderModalTabSkeleton(contentDiv);
        if (modal) modal.classList.remove('hidden');

        const res = await fetch(`/api/v1/devices/${deviceId}`);
        activeDeviceData = await res.json();

        if (title) title.innerText = `${activeDeviceData.device.hostname} — Telemetry Inspector`;
        if (sub) sub.innerText = `OS: ${activeDeviceData.device.os_type} | User: ${activeDeviceData.device.current_user || 'unknown'} | Branch: ${activeDeviceData.device.branch_name}`;

        const statusPill = document.getElementById('modalDeviceStatusPill');
        const qBtnText = document.getElementById('btnQuarantineText');
        const isQuarantined = activeDeviceData.device.status === 'QUARANTINED';
        if (statusPill) {
            const currentStatus = activeDeviceData.device.status || 'ONLINE';
            statusPill.innerHTML = isQuarantined
                ? `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>${currentStatus}</span>`
                : `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>${currentStatus}</span>`;
            statusPill.className = isQuarantined
                ? 'px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center space-x-1.5'
                : 'px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center space-x-1.5';
        }
        if (qBtnText) {
            qBtnText.innerText = isQuarantined ? 'Restore Network' : 'Quarantine Host';
        }

        switchTab('processes');
        fetchAudit();
    } catch (e) {
        console.error(e);
    }
}

function closeDeviceModal() {
    document.getElementById('deviceModal').classList.add('hidden');
}

function switchTab(tabName) {
    ['processes', 'browser', 'clipboard', 'print'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (t === tabName) {
            btn.className = 'pb-2 border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold';
        } else {
            btn.className = 'pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200';
        }
    });

    const contentDiv = document.getElementById('modalTabContent');
    if (!activeDeviceData || !activeDeviceData.recent_events) {
        contentDiv.innerHTML = '<p class="text-slate-400">No events logged.</p>';
        return;
    }

    const events = activeDeviceData.recent_events;
    if (tabName === 'processes') {
        const procs = events.filter(e => e.event_type === 'PROCESS_START');
        if (procs.length === 0) contentDiv.innerHTML = '<p class="text-slate-400">No process start events logged.</p>';
        else {
            let html = '<div class="space-y-2">';
            procs.forEach(p => {
                html += `
                    <div class="p-2.5 bg-slate-100 dark:bg-cyber-800 rounded border border-slate-200 dark:border-cyber-700/50 flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white">${p.payload.process_name || 'Process'}</span>
                            <span class="text-slate-500 dark:text-slate-400 font-mono text-[11px] ml-2">PID: ${p.payload.pid || '-'}</span>
                            <p class="font-mono text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-xl mt-0.5">${p.payload.command_line || '-'}</p>
                        </div>
                        <span class="text-slate-400 text-[10px] font-mono">${new Date(p.timestamp).toLocaleTimeString()}</span>
                    </div>
                `;
            });
            html += '</div>';
            contentDiv.innerHTML = html;
        }
    } else if (tabName === 'browser') {
        const visits = events.filter(e => e.event_type === 'BROWSER_VISIT');
        if (visits.length === 0) contentDiv.innerHTML = '<p class="text-slate-400">No browser visit events logged.</p>';
        else {
            let html = '<div class="space-y-2">';
            visits.forEach(v => {
                html += `
                    <div class="p-2.5 bg-slate-100 dark:bg-cyber-800 rounded border border-slate-200 dark:border-cyber-700/50 flex justify-between items-center">
                        <div class="truncate max-w-xl">
                            <span class="font-semibold text-slate-900 dark:text-white">${v.payload.title || 'Visited URL'}</span>
                            <p class="text-slate-700 dark:text-slate-300 font-mono text-[10px] truncate">${v.payload.url || '-'}</p>
                        </div>
                        <span class="text-slate-400 text-[10px] font-mono">${new Date(v.timestamp).toLocaleTimeString()}</span>
                    </div>
                `;
            });
            html += '</div>';
            contentDiv.innerHTML = html;
        }
    } else if (tabName === 'clipboard') {
        const clips = events.filter(e => e.event_type === 'CLIPBOARD_SYNC');
        if (clips.length === 0) contentDiv.innerHTML = '<p class="text-slate-400">No clipboard sync events logged.</p>';
        else {
            let html = '<div class="space-y-2">';
            clips.forEach(c => {
                html += `
                    <div class="p-2.5 bg-slate-100 dark:bg-cyber-800 rounded border border-slate-200 dark:border-cyber-700/50 flex justify-between items-center">
                        <div class="truncate max-w-xl">
                            <span class="font-mono text-slate-800 dark:text-slate-200">${c.payload.content || '-'}</span>
                        </div>
                        <span class="text-slate-400 text-[10px] font-mono">${new Date(c.timestamp).toLocaleTimeString()}</span>
                    </div>
                `;
            });
            html += '</div>';
            contentDiv.innerHTML = html;
        }
    } else if (tabName === 'print') {
        const prints = events.filter(e => e.event_type === 'PRINT_JOB');
        if (prints.length === 0) contentDiv.innerHTML = '<p class="text-slate-400">No print jobs logged.</p>';
        else {
            let html = '<div class="space-y-2">';
            prints.forEach(pr => {
                html += `
                    <div class="p-2.5 bg-slate-100 dark:bg-cyber-800 rounded border border-slate-200 dark:border-cyber-700/50 flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white">${pr.payload.document_name || 'Document'}</span>
                            <span class="text-slate-500 dark:text-slate-400 text-[11px] ml-2">Printer: ${pr.payload.printer_name} | Pages: ${pr.payload.pages}</span>
                        </div>
                        <span class="text-slate-400 text-[10px] font-mono">${new Date(pr.timestamp).toLocaleTimeString()}</span>
                    </div>
                `;
            });
            html += '</div>';
            contentDiv.innerHTML = html;
        }
    }
}

function openReportModal() {
    document.getElementById('reportResultBlock').classList.add('hidden');
    const modal = document.getElementById('reportModal');
    modal.classList.remove('hidden');
    initGlobalTomSelects(modal);
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

async function submitGenerateReport() {
    const btn = document.getElementById('btnSubmitGenerate');
    btn.innerText = 'Signing...';
    btn.disabled = true;

    const title = document.getElementById('reportTitleInput').value;
    const reportType = document.getElementById('reportTypeSelect').value;

    try {
        const res = await fetch('/api/v1/reports/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, report_type: reportType })
        });
        const data = await res.json();
        document.getElementById('reportShaSpan').innerText = data.sha256_hash;
        document.getElementById('reportDownloadBtn').href = data.download_url;
        document.getElementById('reportResultBlock').classList.remove('hidden');
        fetchAudit();
    } catch (e) {
        showArgusAlert({
            title: 'Report Generation Failed',
            badge: 'ERROR',
            message: 'Unable to cryptographically compile and sign incident assessment report.',
            details: String(e),
            type: 'danger'
        });
    } finally {
        btn.innerText = 'Generate & Sign';
        btn.disabled = false;
    }
}

function openVerifyModal() {
    document.getElementById('verifyResultBox').classList.add('hidden');
    document.getElementById('verifyModal').classList.remove('hidden');
}

function closeVerifyModal() {
    document.getElementById('verifyModal').classList.add('hidden');
}

async function submitVerifyReport() {
    const fileInput = document.getElementById('verifyFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        showArgusAlert({
            title: 'Report File Required',
            badge: 'INPUT REQUIRED',
            message: 'Please select an incident report PDF file from your device before initiating signature verification.',
            type: 'warning'
        });
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch('/api/v1/reports/verify', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        const box = document.getElementById('verifyResultBox');
        box.className = 'p-3 rounded-lg text-xs space-y-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
        box.innerHTML = `
            <div class="font-bold flex items-center space-x-1.5 text-slate-900 dark:text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>${data.status}</span>
            </div>
            <p class="text-slate-600 dark:text-slate-300">${data.message}</p>
            <div class="font-mono text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                <b>SHA-256:</b> ${data.sha256_checksum}<br>
                <b>Key Fingerprint:</b> ${data.public_key_fingerprint}
            </div>
        `;
        box.classList.remove('hidden');
    } catch (e) {
        showArgusAlert({
            title: 'Verification Failed',
            badge: 'SIGNATURE ERROR',
            message: 'Cryptographic validation could not be completed for the uploaded report.',
            details: String(e),
            type: 'danger'
        });
    }
}

function toggleAuditDrawer() {
    const drawer = document.getElementById('auditDrawer');
    drawer.classList.toggle('translate-x-full');
    fetchAudit();
}

async function fetchAudit() {
    try {
        const res = await fetch('/api/v1/audit?limit=20');
        const logs = await res.json();
        const statAudit = document.getElementById('statAuditCount');
        if (statAudit) statAudit.innerText = logs.length;
        const sideAudit = document.getElementById('sideAuditCount');
        if (sideAudit) sideAudit.innerText = logs.length;
        const sideAuditTip = document.getElementById('sideAuditTooltip');
        if (sideAuditTip) sideAuditTip.innerText = `${logs.length} Logs`;
        const list = document.getElementById('auditList');
        if (!list) return;
        if (logs && logs.length > 0) {
            list.innerHTML = '';
            logs.forEach(l => {
                const item = document.createElement('div');
                item.className = 'p-2.5 bg-slate-100 dark:bg-cyber-800 rounded border border-slate-200 dark:border-cyber-700/50 space-y-1';
                item.innerHTML = `
                    <div class="flex justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        <span class="font-semibold text-slate-900 dark:text-white">${l.actor_username}</span>
                        <span>${new Date(l.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="font-semibold text-slate-800 dark:text-slate-200">${l.action}</div>
                    <div class="text-[10px] text-slate-500 dark:text-slate-400">Target: ${l.target_resource} (${l.target_id || '-'})</div>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p class="text-slate-400 text-center py-10">No audit events logged yet.</p>';
        }
    } catch (e) {
        console.error(e);
    }
}

// =========================================================================
// Digital Forensics Device Bridge & Interactive Screen Navigation Engine
// =========================================================================
let cachedForensicDevices = {};
let currentForensicDeviceId = null;
let currentForensicDevice = null;
let currentForensicPath = '/sdcard';
let autoStreamTimer = null;
let currentScreenResolution = { width: 1080, height: 2400 };
let lastScreenshotBlob = null;
let isCanvasDragging = false;
let dragStartCoords = null;
let dragStartTime = 0;
let activeForensicTab = 'screen';
let currentForensicWindowId = 'desktop';
let currentTargetWindows = [];
let lastWheelDispatchTime = 0;

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

async function fetchForensicDevices() {
    const grid = document.getElementById('forensicDevicesGrid');
    if (grid && (!grid.children.length || grid.querySelector('.p-6'))) {
        renderForensicDevicesSkeleton(grid, 2);
    }

    try {
        const res = await fetch('/api/v1/forensics/devices');
        if (!res.ok) return;
        const data = await res.json();
        const devices = data.devices || [];

        cachedForensicDevices = {};
        devices.forEach(d => {
            cachedForensicDevices[d.id] = d;
        });

        const badge = document.getElementById('sideForensicsCount');
        if (badge) badge.innerText = devices.length;
        const forensicsTip = document.getElementById('sideForensicsTooltip');
        if (forensicsTip) forensicsTip.innerText = `${devices.length} Target${devices.length === 1 ? '' : 's'}`;

        const grid = document.getElementById('forensicDevicesGrid');
        if (!grid) return;

        if (devices.length === 0) {
            grid.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs col-span-full border border-dashed border-slate-200 dark:border-cyber-700/60 rounded-xl space-y-2">
                    <p class="font-semibold text-slate-600 dark:text-slate-300">No hardware targets currently attached to USB bus or Wi-Fi ports</p>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">Connect an Android phone via USB cable (with USB debugging), plug in a USB drive, or click "Pair Wireless" to connect over Wi-Fi.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        devices.forEach(dev => {
            const card = document.createElement('div');
            card.className = "p-4 bg-slate-50 dark:bg-cyber-800/50 rounded-xl border border-slate-200 dark:border-cyber-700/60 space-y-3 shadow-xs hover:border-slate-400 dark:hover:border-white/40 transition flex flex-col justify-between";

            const isStorage = dev.type === 'storage' || dev.type === 'USB_STORAGE';
            const isHost = dev.type === 'host' || dev.type === 'HOST_WORKSTATION';
            const isWireless = dev.connection && (dev.connection.toLowerCase().includes('wireless') || dev.connection.toLowerCase().includes('wi-fi'));

            let typeBadgeClass = isWireless 
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : (isStorage
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : (isHost
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-bold'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-white/20'));

            let typeLabel = isWireless ? 'WI-FI ADB' : (isStorage ? 'MASS STORAGE' : (isHost ? 'LOCAL HOST' : 'USB CABLE'));

            let iconSvg = isStorage 
                ? `<svg class="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 2v4m4-4v4M7 6h10a1 1 0 011 1v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7a1 1 0 011-1z"/></svg>`
                : (isHost
                    ? `<svg class="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21" stroke-linecap="round"/><line x1="12" x2="12" y1="17" y2="21" stroke-linecap="round"/></svg>`
                    : `<svg class="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18" stroke-linecap="round"/></svg>`);

            const platformName = dev.platform || (dev.details && (dev.details.os || dev.details.fstype)) || (isHost ? 'Windows Host' : (isStorage ? 'USB Storage' : 'Android'));
            const batteryText = typeof dev.battery === 'object' && dev.battery && dev.battery.level !== undefined 
                ? `${dev.battery.level}%` 
                : (typeof dev.battery === 'string' && dev.battery !== 'N/A' ? dev.battery : (isHost ? 'AC Power' : 'Bus Power'));
            const capacityText = dev.details && dev.details.capacity ? dev.details.capacity : (dev.total_space ? formatBytes(dev.total_space) : null);

            const isOnline = (dev.status || '').toUpperCase() === 'ONLINE' || (dev.status || '').toUpperCase() === 'CONNECTED';
            const isQuarantined = (dev.status || '').toUpperCase() === 'QUARANTINED';
            const statusHtml = isOnline
                ? `<span class="inline-flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>ONLINE</span></span>`
                : (isQuarantined
                    ? `<span class="inline-flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>QUARANTINED</span></span>`
                    : `<span class="text-slate-900 dark:text-white font-semibold uppercase">${dev.status}</span>`);

            card.innerHTML = `
                <div class="space-y-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center space-x-2.5 min-w-0">
                            <div class="w-7 h-7 rounded-sm bg-slate-200/50 dark:bg-cyber-700/40 flex items-center justify-center flex-shrink-0">
                                ${iconSvg}
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-bold text-slate-900 dark:text-white text-xs truncate" title="${dev.model || dev.name}">${dev.model || dev.name}</h4>
                                <div class="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">ID: ${dev.id}</div>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-sm text-[10px] font-mono border font-semibold flex-shrink-0 whitespace-nowrap ${typeBadgeClass}">${typeLabel}</span>
                    </div>

                    <div class="pt-2 border-t border-slate-200/60 dark:border-cyber-700/40 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                        <div>Status: ${statusHtml}</div>
                        <div class="truncate" title="${platformName}">Platform: <span class="text-slate-700 dark:text-slate-300 font-semibold">${platformName}</span></div>
                        <div>Power: <span class="text-slate-700 dark:text-slate-300 font-semibold">${batteryText}</span></div>
                        ${capacityText ? `<div class="truncate">Storage: <span class="text-slate-700 dark:text-slate-300 font-semibold">${capacityText}</span></div>` : ''}
                    </div>
                </div>

                <div class="pt-3 flex items-center space-x-2">
                    ${!isStorage ? `
                        <button onclick="openForensicStudio('${dev.id}')" class="flex-1 py-2 px-3 rounded-sm bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow-sm whitespace-nowrap">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            <span>Open Studio & Control</span>
                        </button>
                    ` : `
                        <button onclick="openForensicStorage('${dev.id}')" class="flex-1 py-2 px-3 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5 whitespace-nowrap">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                            <span>Acquire Storage Files</span>
                        </button>
                    `}

                    ${isWireless ? `
                        <button onclick="disconnectForensicDevice('${dev.id}')" title="Disconnect Wireless Target" class="p-2 rounded-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition flex-shrink-0">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    ` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Device fetch error:", err);
    }
}

// ==========================================
// Wireless Connect Modal Handler
// ==========================================
function openWirelessConnectModal() {
    const modal = document.getElementById('wirelessConnectModal');
    if (!modal) return;
    const msg = document.getElementById('wirelessStatusMsg');
    if (msg) {
        msg.className = "hidden p-2.5 rounded-lg text-xs font-medium";
        msg.innerText = "";
    }
    modal.classList.remove('hidden');
}

function closeWirelessConnectModal() {
    const modal = document.getElementById('wirelessConnectModal');
    if (modal) modal.classList.add('hidden');
}

async function submitWirelessConnect() {
    const ipInput = document.getElementById('wirelessIp');
    const portInput = document.getElementById('wirelessPort');
    const btn = document.getElementById('btnSubmitWireless');
    const msg = document.getElementById('wirelessStatusMsg');

    const ip = ipInput ? ipInput.value.trim() : '';
    const port = portInput ? parseInt(portInput.value.trim()) || 5555 : 5555;

    if (!ip) {
        if (msg) {
            msg.className = "p-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-cyber-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20";
            msg.innerText = "Please provide target device IP address.";
        }
        return;
    }

    if (btn) btn.disabled = true;
    if (msg) {
        msg.className = "p-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-cyber-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20";
        msg.innerText = `Attempting ADB handshake with ${ip}:${port}...`;
    }

    try {
        const res = await fetch('/api/v1/forensics/connect-wireless', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Connection failed");

        if (msg) {
            msg.className = "p-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-cyber-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20";
            msg.innerText = data.message || "Connected successfully!";
        }

        setTimeout(() => {
            closeWirelessConnectModal();
            fetchForensicDevices();
        }, 1200);
    } catch (err) {
        if (msg) {
            msg.className = "p-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-cyber-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20";
            msg.innerText = err.message;
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function disconnectForensicDevice(deviceId) {
    const confirmed = await showArgusConfirm({
        title: 'Disconnect Endpoint',
        badge: 'DISCONNECT CONFIRMATION',
        message: `Are you sure you want to terminate the wireless connection to endpoint "${deviceId}"? Active ADB bridges and forensic monitoring sessions will be closed.`,
        confirmText: 'Disconnect Endpoint',
        cancelText: 'Cancel',
        type: 'danger'
    });
    if (!confirmed) return;
    try {
        await fetch(`/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/disconnect`, { method: 'POST' });
        fetchForensicDevices();
    } catch (err) {
        console.error(err);
        showArgusAlert({
            title: 'Disconnection Failed',
            badge: 'ERROR',
            message: `Unable to disconnect wireless endpoint "${deviceId}": ${err.message}`,
            type: 'danger'
        });
    }
}

// ==========================================
// Forensic Studio Navigation & Control Logic
// ==========================================
function openForensicStudio(deviceId) {
    currentForensicDeviceId = deviceId;
    currentForensicDevice = cachedForensicDevices[deviceId] || { id: deviceId, name: 'Target Device', platform: 'Android' };

    const modal = document.getElementById('forensicStudioModal');
    if (!modal) return;

    const isHost = (deviceId === 'HOST-LOCAL-BRIDGE' || currentForensicDevice.type === 'host' || currentForensicDevice.type === 'HOST_WORKSTATION');
    const isWireless = currentForensicDevice.connection && (currentForensicDevice.connection.toLowerCase().includes('wireless') || currentForensicDevice.connection.toLowerCase().includes('wi-fi'));

    const nameEl = document.getElementById('studioDeviceName');
    if (nameEl) nameEl.innerText = isHost ? 'Local Host Workstation (Windows)' : (currentForensicDevice.model || currentForensicDevice.name || 'Target Device');

    const idEl = document.getElementById('studioDeviceId');
    if (idEl) idEl.innerText = currentForensicDevice.id;

    const platEl = document.getElementById('studioDevicePlatform');
    if (platEl) platEl.innerText = isHost ? 'Windows 11 / x64 Host Workstation' : (currentForensicDevice.platform || 'Android');

    const typeBadge = document.getElementById('studioDeviceTypeBadge');
    if (typeBadge) {
        typeBadge.innerText = isHost ? 'LOCAL HOST' : (isWireless ? 'WI-FI ADB' : 'USB CABLE');
    }

    const protoBadge = document.getElementById('studioProtocolBadge');
    if (protoBadge) {
        protoBadge.innerText = isHost ? 'Windows Native OS Bridge' : (isWireless ? 'ADB over Wi-Fi' : 'ADB USB Cable');
    }

    const mouseHelp = document.getElementById('mouseHelpText');
    if (mouseHelp) {
        mouseHelp.innerText = isHost 
            ? 'Left-Click • Right-Click Menu • Wheel Scroll • Smooth Pointer' 
            : 'Click to Tap • Drag to Swipe • Hardware Keys';
    }

    // Toggle between Host Workstation deck and Mobile phone deck
    const deckWorkstation = document.getElementById('deckWorkstationControls');
    const deckAndroid = document.getElementById('deckAndroidControls');
    const windowSelectGroup = document.getElementById('windowSelectGroup');
    const iconContainer = document.getElementById('studioDeviceIcon');

    if (isHost) {
        if (deckWorkstation) deckWorkstation.classList.remove('hidden');
        if (deckAndroid) deckAndroid.classList.add('hidden');
        if (windowSelectGroup) windowSelectGroup.classList.remove('hidden');
        if (iconContainer) {
            iconContainer.innerHTML = `<svg class="w-4 h-4 text-slate-900 dark:text-white" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21" stroke-linecap="round"/><line x1="12" x2="12" y1="17" y2="21" stroke-linecap="round"/></svg>`;
        }
        currentForensicWindowId = 'desktop';
        fetchForensicWindows();
    } else {
        if (deckWorkstation) deckWorkstation.classList.add('hidden');
        if (deckAndroid) deckAndroid.classList.remove('hidden');
        if (windowSelectGroup) windowSelectGroup.classList.add('hidden');
        if (iconContainer) {
            iconContainer.innerHTML = `<svg class="w-4 h-4 text-slate-900 dark:text-white" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18" stroke-linecap="round"/></svg>`;
        }
    }

    modal.classList.remove('hidden');
    switchForensicTab('screen');
    setupCanvasListeners();
    fetchScreenFrame();
    fetchDeviceTriage(deviceId);

    const autoChk = document.getElementById('chkAutoStream');
    if (autoChk && autoChk.checked) {
        toggleAutoStream(true);
    }
}

async function fetchForensicWindows() {
    if (!currentForensicDeviceId || currentForensicDeviceId !== 'HOST-LOCAL-BRIDGE') return;
    try {
        const res = await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/windows`);
        if (!res.ok) return;
        const data = await res.json();
        currentTargetWindows = data.windows || [];

        const select = document.getElementById('forensicWindowSelect');
        if (!select) return;

        const currentVal = select.value;
        let html = `
            <option value="desktop">🖥️ Full Desktop (Display 1 - 1920x1080)</option>
            <option value="active">🪟 Active / Foreground Window</option>
        `;

        currentTargetWindows.forEach(w => {
            const isSel = (currentVal === w.hwnd) ? 'selected' : '';
            const star = w.is_active ? '⭐ ' : '🪟 ';
            const titleSafe = (w.title || 'Window').replace(/[<>&"]/g, '');
            html += `<option value="${w.hwnd}" ${isSel}>${star}${titleSafe} (${w.width}x${w.height})</option>`;
        });

        select.innerHTML = html;
        if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        }
    } catch (err) {
        console.error("Error loading windows:", err);
    }
}

function onForensicWindowChange() {
    const select = document.getElementById('forensicWindowSelect');
    if (select) {
        currentForensicWindowId = select.value;
    }
    const hint = document.getElementById('canvasGestureHint');
    if (hint) {
        const selText = select ? select.options[select.selectedIndex]?.text : '';
        hint.innerHTML = `<span class="text-white font-bold">Target:</span> <span class="text-white font-medium">${selText}</span> <span class="text-slate-600">•</span> <span class="text-emerald-400">Off-Screen Hardware DC Direct Capture</span>`;
    }
    fetchScreenFrame();
}

function openForensicStorage(deviceId) {
    openForensicStudio(deviceId);
    switchForensicTab('files');
    loadForensicFiles(currentForensicDevice.mount_point || 'E:\\');
}

function closeForensicStudio() {
    const modal = document.getElementById('forensicStudioModal');
    if (modal) modal.classList.add('hidden');
    toggleAutoStream(false);
    currentForensicDeviceId = null;
    currentForensicDevice = null;
}

function switchForensicTab(tab) {
    activeForensicTab = tab;
    const paneScreen = document.getElementById('studioPaneScreen');
    const paneFiles = document.getElementById('studioPaneFiles');
    const paneTriage = document.getElementById('studioPaneTriage');

    const btnScreen = document.getElementById('tabBtnScreen');
    const btnFiles = document.getElementById('tabBtnFiles');
    const btnTriage = document.getElementById('tabBtnTriage');

    // Reset tabs styling
    [btnScreen, btnFiles, btnTriage].forEach(b => {
        if (b) {
            b.className = "px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1.5 transition text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
        }
    });

    // Hide panes
    if (paneScreen) paneScreen.classList.add('hidden');
    if (paneFiles) paneFiles.classList.add('hidden');
    if (paneTriage) paneTriage.classList.add('hidden');

    if (tab === 'screen') {
        if (paneScreen) paneScreen.classList.remove('hidden');
        if (btnScreen) btnScreen.className = "px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition bg-white dark:bg-cyber-700 text-slate-900 dark:text-white shadow-xs";
        const autoChk = document.getElementById('chkAutoStream');
        if (autoChk && autoChk.checked) toggleAutoStream(true);
        fetchScreenFrame();
    } else if (tab === 'files') {
        if (paneFiles) paneFiles.classList.remove('hidden');
        if (btnFiles) btnFiles.className = "px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition bg-white dark:bg-cyber-700 text-amber-600 dark:text-white shadow-xs";
        toggleAutoStream(false);
        loadForensicFiles(currentForensicPath);
    } else if (tab === 'triage') {
        if (paneTriage) paneTriage.classList.remove('hidden');
        if (btnTriage) btnTriage.className = "px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition bg-white dark:bg-cyber-700 text-emerald-600 dark:text-white shadow-xs";
        toggleAutoStream(false);
        fetchDeviceTriage(currentForensicDeviceId);
    }
}

// ==========================================
// Visual Mouse & Touch Interactive Canvas
// ==========================================
function setupCanvasListeners() {
    const canvas = document.getElementById('forensicScreenCanvas');
    if (!canvas || canvas.dataset.listenersBound) return;
    canvas.dataset.listenersBound = "true";

    // Track mousemove over canvas for smooth virtual pointer
    canvas.addEventListener('mousemove', (e) => {
        if (!currentForensicDeviceId) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

        // Update virtual pointer overlay position
        const pointer = document.getElementById('canvasMousePointer');
        const container = document.getElementById('canvasContainer');
        if (pointer && container) {
            const cRect = container.getBoundingClientRect();
            pointer.style.left = `${e.clientX - cRect.left}px`;
            pointer.style.top = `${e.clientY - cRect.top}px`;
            pointer.classList.remove('hidden');
        }

        // Update live coordinate readout in gesture hint bar
        const hint = document.getElementById('canvasGestureHint');
        if (hint) {
            hint.innerHTML = `<span class="text-white font-bold">X: ${Math.round(canvasX)}</span> <span class="text-slate-600">|</span> <span class="text-white font-bold">Y: ${Math.round(canvasY)}</span> <span class="text-slate-600">•</span> <span>Left-Click to Select • Right-Click for Context • Scroll Wheel to Navigate</span>`;
        }
    });

    canvas.addEventListener('mouseleave', () => {
        const pointer = document.getElementById('canvasMousePointer');
        if (pointer) pointer.classList.add('hidden');
        const hint = document.getElementById('canvasGestureHint');
        if (hint) {
            hint.innerText = "Ready for analyst navigation. Left-click to click, right-click for context menu, mouse wheel to scroll.";
        }
    });

    // Standard Click (Left Click)
    canvas.addEventListener('click', async (e) => {
        if (!currentForensicDeviceId || isCanvasDragging) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
        const startX = Math.max(0, Math.min(Math.round(canvasX), canvas.width));
        const startY = Math.max(0, Math.min(Math.round(canvasY), canvas.height));

        const isHost = (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE');
        const hint = document.getElementById('canvasGestureHint');
        if (hint) hint.innerText = `Executing ${isHost ? 'LEFT CLICK' : 'TAP'} at (${startX}, ${startY})...`;
        showCanvasTapEffect(startX, startY);

        try {
            await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'click',
                    x: startX,
                    y: startY,
                    window_id: isHost ? currentForensicWindowId : null
                })
            });
            setTimeout(fetchScreenFrame, 300);
        } catch (err) {
            console.error("Click error:", err);
        }
    });

    // Right Click (Context Menu)
    canvas.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (!currentForensicDeviceId) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
        const startX = Math.max(0, Math.min(Math.round(canvasX), canvas.width));
        const startY = Math.max(0, Math.min(Math.round(canvasY), canvas.height));

        const hint = document.getElementById('canvasGestureHint');
        if (hint) hint.innerText = `Executing RIGHT CLICK at (${startX}, ${startY})...`;
        showCanvasRightClickEffect(startX, startY);

        try {
            await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'right_click',
                    x: startX,
                    y: startY,
                    window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null
                })
            });
            setTimeout(fetchScreenFrame, 300);
        } catch (err) {
            console.error("Right-click error:", err);
        }
    });

    // Double Click
    canvas.addEventListener('dblclick', async (e) => {
        if (!currentForensicDeviceId) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
        const startX = Math.max(0, Math.min(Math.round(canvasX), canvas.width));
        const startY = Math.max(0, Math.min(Math.round(canvasY), canvas.height));

        showCanvasTapEffect(startX, startY);
        try {
            await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'double_click',
                    x: startX,
                    y: startY,
                    window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null
                })
            });
            setTimeout(fetchScreenFrame, 350);
        } catch (err) {
            console.error("Double-click error:", err);
        }
    });

    // Mouse Wheel (Smooth Scrolling)
    canvas.addEventListener('wheel', async (e) => {
        e.preventDefault();
        if (!currentForensicDeviceId) return;
        const now = Date.now();
        if (now - lastWheelDispatchTime < 140) return;
        lastWheelDispatchTime = now;

        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
        const delta = e.deltaY < 0 ? 120 : -120;

        const hint = document.getElementById('canvasGestureHint');
        if (hint) hint.innerText = `Executing WHEEL SCROLL ${delta > 0 ? 'UP' : 'DOWN'}...`;

        try {
            await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'wheel',
                    delta: delta,
                    x: Math.round(canvasX),
                    y: Math.round(canvasY),
                    window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null
                })
            });
            setTimeout(fetchScreenFrame, 300);
        } catch (err) {
            console.error("Wheel error:", err);
        }
    }, { passive: false });

    // Drag / Swipe Tracking
    canvas.addEventListener('mousedown', (e) => {
        if (!currentForensicDeviceId || e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        dragStartCoords = {
            clientX: e.clientX,
            clientY: e.clientY,
            canvasX: (e.clientX - rect.left) * (canvas.width / rect.width),
            canvasY: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
        dragStartTime = Date.now();
        isCanvasDragging = false;
    });

    window.addEventListener('mouseup', async (e) => {
        if (!dragStartCoords || !currentForensicDeviceId) {
            dragStartCoords = null;
            isCanvasDragging = false;
            return;
        }
        const canvas = document.getElementById('forensicScreenCanvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const endCanvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const endCanvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
        const dt = Date.now() - dragStartTime;

        const dx = endCanvasX - dragStartCoords.canvasX;
        const dy = endCanvasY - dragStartCoords.canvasY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const startX = Math.max(0, Math.min(Math.round(dragStartCoords.canvasX), canvas.width));
        const startY = Math.max(0, Math.min(Math.round(dragStartCoords.canvasY), canvas.height));
        const endX = Math.max(0, Math.min(Math.round(endCanvasX), canvas.width));
        const endY = Math.max(0, Math.min(Math.round(endCanvasY), canvas.height));

        dragStartCoords = null;

        // Only treat as drag if moved more than 25px
        if (dist >= 25) {
            isCanvasDragging = true;
            setTimeout(() => { isCanvasDragging = false; }, 100);
            const durationMs = Math.min(Math.max(dt, 150), 800);
            const hint = document.getElementById('canvasGestureHint');
            if (hint) hint.innerText = `Executing DRAG (${startX}, ${startY}) -> (${endX}, ${endY})...`;
            showCanvasSwipeEffect(startX, startY, endX, endY);
            try {
                await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'drag',
                        x1: startX,
                        y1: startY,
                        x2: endX,
                        y2: endY,
                        duration: durationMs,
                        window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null
                    })
                });
                setTimeout(fetchScreenFrame, 450);
            } catch (err) {
                console.error("Drag error:", err);
            }
        }
    });
}

function showCanvasTapEffect(x, y) {
    const canvas = document.getElementById('forensicScreenCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#06b6d4';
    ctx.stroke();
    ctx.restore();
}

function showCanvasRightClickEffect(x, y) {
    const canvas = document.getElementById('forensicScreenCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
}

function showCanvasSwipeEffect(x1, y1, x2, y2) {
    const canvas = document.getElementById('forensicScreenCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, 12, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();
    ctx.restore();
}

async function sendMouseAction(actionType) {
    if (!currentForensicDeviceId) return;
    const canvas = document.getElementById('forensicScreenCanvas');
    const midX = canvas ? canvas.width / 2 : 960;
    const midY = canvas ? canvas.height / 2 : 540;
    const hint = document.getElementById('canvasGestureHint');
    if (hint) hint.innerText = `Dispatching ${actionType.replace('_', ' ').toUpperCase()}...`;

    let payload = { action: actionType, window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null };
    if (actionType === 'left_click') {
        payload.action = 'click';
        payload.x = midX;
        payload.y = midY;
        showCanvasTapEffect(midX, midY);
    } else if (actionType === 'right_click') {
        payload.action = 'right_click';
        payload.x = midX;
        payload.y = midY;
        showCanvasRightClickEffect(midX, midY);
    } else if (actionType === 'double_click') {
        payload.action = 'double_click';
        payload.x = midX;
        payload.y = midY;
        showCanvasTapEffect(midX, midY);
    } else if (actionType === 'wheel_up') {
        payload.action = 'wheel';
        payload.delta = 120;
    } else if (actionType === 'wheel_down') {
        payload.action = 'wheel';
        payload.delta = -120;
    }

    try {
        await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        setTimeout(fetchScreenFrame, 300);
    } catch (err) {
        console.error("Mouse action error:", err);
    }
}

async function fetchScreenFrame() {
    if (!currentForensicDeviceId) return;
    const canvas = document.getElementById('forensicScreenCanvas');
    if (!canvas) return;
    try {
        const winParam = (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE' && currentForensicWindowId) 
            ? `&window_id=${encodeURIComponent(currentForensicWindowId)}` 
            : '';
        const res = await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/screen?quality=94${winParam}&t=${Date.now()}`);
        if (!res.ok) return;
        const blob = await res.blob();
        lastScreenshotBlob = blob;

        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            canvas.width = img.naturalWidth || 1920;
            canvas.height = img.naturalHeight || 1080;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            currentScreenResolution = { width: canvas.width, height: canvas.height };

            const tag = document.getElementById('screenResolutionTag');
            if (tag) tag.innerText = `${canvas.width}x${canvas.height} [100% Crisp]`;

            const ratioTag = document.getElementById('studioRatioBadge');
            if (ratioTag) ratioTag.innerText = canvas.height > canvas.width ? 'Portrait' : 'Landscape';
        };
        img.src = url;
    } catch (err) {
        console.error("Frame capture error:", err);
    }
}

function toggleAutoStream(enable) {
    if (autoStreamTimer) {
        clearInterval(autoStreamTimer);
        autoStreamTimer = null;
    }
    if (enable && currentForensicDeviceId && activeForensicTab === 'screen') {
        autoStreamTimer = setInterval(fetchScreenFrame, 1200);
    }
}

async function sendHardwareKey(keyName) {
    if (!currentForensicDeviceId) return;
    const hint = document.getElementById('canvasGestureHint');
    if (hint) hint.innerText = `Dispatching key: ${keyName}...`;
    try {
        await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'key', 
                key: keyName,
                window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null
            })
        });
        setTimeout(fetchScreenFrame, 350);
    } catch (err) {
        console.error(err);
    }
}

async function sendRemoteText() {
    if (!currentForensicDeviceId) return;
    const input = document.getElementById('remoteTextInput');
    const text = input ? input.value : '';
    if (!text) return;
    try {
        await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'text', 
                text: text,
                window_id: (currentForensicDeviceId === 'HOST-LOCAL-BRIDGE') ? currentForensicWindowId : null
            })
        });
        if (input) input.value = '';
        setTimeout(fetchScreenFrame, 350);
    } catch (err) {
        console.error(err);
    }
}

async function downloadForensicScreenshot() {
    if (!lastScreenshotBlob && currentForensicDeviceId) {
        await fetchScreenFrame();
    }
    if (!lastScreenshotBlob) return;

    const buffer = await lastScreenshotBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256Hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const url = URL.createObjectURL(lastScreenshotBlob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `ARTIS_EVIDENCE_SCREEN_${currentForensicDeviceId}_${ts}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showArgusAlert({
        title: 'Visual Evidence Frame Acquired',
        badge: 'CHAIN OF CUSTODY SECURED',
        message: 'Evidence frame capture was cryptographically hashed and downloaded to local storage.',
        digest: sha256Hex,
        digestLabel: 'SHA-256 Digest',
        type: 'success',
        confirmText: 'Acknowledge'
    });
}

// ==========================================
// Evidence File Explorer & Integrity Logic
// ==========================================
async function loadForensicFiles(targetPath) {
    if (!currentForensicDeviceId) return;
    const pathInput = document.getElementById('forensicCurrentPath');
    const path = targetPath !== undefined ? targetPath : (pathInput ? pathInput.value : '/sdcard');
    if (pathInput) pathInput.value = path;
    currentForensicPath = path;

    const tbody = document.getElementById('forensicFilesTableBody');
    if (!tbody) return;
    renderForensicFilesSkeleton(tbody, 5);

    try {
        const res = await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/files?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        const items = data.files || data.items || [];
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 font-mono text-xs">Directory is empty or inaccessible.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 dark:hover:bg-cyber-800/40 transition group";
            const isDir = item.is_dir !== undefined ? item.is_dir : (item.type === 'directory');
            const icon = isDir 
                ? `<svg class="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`
                : `<svg class="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;

            const clickAction = isDir 
                ? `onclick="loadForensicFiles('${item.path.replace(/\\/g, '/')}')"` 
                : '';

            const cursorClass = isDir ? 'cursor-pointer' : '';
            const sizeText = isDir ? '-' : formatBytes(item.size);

            tr.innerHTML = `
                <td class="py-2.5 px-4 flex items-center space-x-2 font-mono font-medium ${cursorClass} text-slate-800 dark:text-slate-200" ${clickAction}>
                    ${icon}
                    <span class="truncate max-w-xs hover:text-white transition">${item.name}</span>
                </td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">${isDir ? 'Directory' : 'File'}</td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">${sizeText}</td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400">${item.modified || '-'}</td>
                <td class="py-2.5 px-4 text-right">
                    ${!isDir ? `
                        <button onclick="downloadForensicFile('${item.path.replace(/\\/g, '/')}')" class="px-2 py-1 rounded bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-mono text-[10px] font-semibold transition flex items-center space-x-1 ml-auto">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            <span>SHA-256 Acquire</span>
                        </button>
                    ` : `
                        <button onclick="loadForensicFiles('${item.path.replace(/\\/g, '/')}')" class="px-2 py-1 rounded bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-mono text-[10px] transition">
                            Open
                        </button>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Load files error:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 font-mono text-xs">Error browsing files: ${err.message}</td></tr>`;
    }
}

function navigateForensicPath(dir) {
    if (dir === '..') {
        let current = currentForensicPath || '/sdcard';
        current = current.replace(/\\/g, '/').replace(/\/$/, '');
        const lastSlash = current.lastIndexOf('/');
        if (lastSlash >= 0) {
            const up = current.substring(0, lastSlash) || '/';
            loadForensicFiles(up);
        } else {
            loadForensicFiles('/');
        }
    }
}

async function downloadForensicFile(filePath) {
    if (!currentForensicDeviceId) return;
    const logText = document.getElementById('evidenceLogText');
    if (logText) logText.innerText = `Acquiring file & computing SHA-256 hash: ${filePath}...`;

    const downloadUrl = `/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/files/download?path=${encodeURIComponent(filePath)}`;
    try {
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error("File download failed with status " + res.status);

        const sha256 = res.headers.get('X-Forensic-SHA256') || 'SHA-256 Digest Verified';
        const blob = await res.blob();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = filePath.split('/').pop().split('\\').pop() || 'evidence_file';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (logText) {
            logText.innerHTML = `<span class="text-slate-900 dark:text-white font-bold">ACQUIRED:</span> ${filename} • <b class="text-slate-700 dark:text-slate-300">SHA-256:</b> ${sha256}`;
        }
    } catch (err) {
        console.error(err);
        if (logText) logText.innerText = `Acquisition error: ${err.message}`;
    }
}

// ==========================================
// Device Triage & Live Shell Logic
// ==========================================
async function fetchDeviceTriage(deviceId) {
    const id = deviceId || currentForensicDeviceId;
    if (!id) return;
    try {
        const res = await fetch(`/api/v1/forensics/devices/${encodeURIComponent(id)}/triage`);
        if (!res.ok) return;
        const data = await res.json();

        const isHost = (id === 'HOST-LOCAL-BRIDGE' || (currentForensicDevice && currentForensicDevice.type === 'host'));
        const sysInfo = data.system_info || {};

        const osEl = document.getElementById('triageOs');
        if (osEl) {
            osEl.innerText = isHost 
                ? (data.os_version || 'Windows 11') 
                : `${data.model || sysInfo.hostname || 'Target'} (${data.os_version || sysInfo.os || 'Android'})`;
        }

        const archEl = document.getElementById('triageArch');
        if (archEl) {
            archEl.innerText = data.architecture || (sysInfo.cores ? `${sysInfo.cores} Cores` : 'x64');
        }

        const pkgEl = document.getElementById('triagePackages');
        const pkgCount = Array.isArray(data.packages) ? data.packages.length : (data.packages_count || 0);
        if (pkgEl) pkgEl.innerText = `${pkgCount} pkgs`;

        const procEl = document.getElementById('triageProcs');
        const procsList = data.processes || data.running_processes || [];
        if (procEl) procEl.innerText = `${procsList.length} procs`;

        if (data.battery && data.battery.level !== undefined) {
            const b = document.getElementById('studioBatteryBadge');
            if (b) {
                b.classList.remove('hidden');
                b.innerText = `BAT: ${data.battery.level}% (${data.battery.status || (data.battery.plugged ? 'AC' : 'Batt')})`;
            }
        }

        // Dynamically update shell presets for Windows Host vs Android mobile
        const presets = document.getElementById('shellPresetsContainer');
        if (presets) {
            if (isHost) {
                presets.innerHTML = `
                    <span class="text-slate-500 mr-1">Presets:</span>
                    <button onclick="injectPresetCommand('systeminfo')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="System Info">systeminfo</button>
                    <button onclick="injectPresetCommand('ipconfig')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Network Configuration">ipconfig</button>
                    <button onclick="injectPresetCommand('tasklist')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Running Processes">tasklist</button>
                    <button onclick="injectPresetCommand('netstat -ano')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Network Ports">netstat</button>
                    <button onclick="injectPresetCommand('installed apps')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Installed Software">installed apps</button>
                    <button onclick="injectPresetCommand('battery')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Power Status">battery</button>
                `;
            } else {
                presets.innerHTML = `
                    <span class="text-slate-500 mr-1">Presets:</span>
                    <button onclick="injectPresetCommand('getprop')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">getprop</button>
                    <button onclick="injectPresetCommand('ip addr')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">ip addr</button>
                    <button onclick="injectPresetCommand('pm list packages -3')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">pm list</button>
                    <button onclick="injectPresetCommand('dumpsys battery')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">battery</button>
                    <button onclick="injectPresetCommand('ps -A')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">ps</button>
                `;
            }
        }

        const shellInput = document.getElementById('forensicShellInput');
        if (shellInput) {
            shellInput.placeholder = isHost
                ? "Enter PowerShell / CMD command (e.g. tasklist, ipconfig, netstat -ano, systeminfo)..."
                : "Enter ADB shell command (e.g. getprop, ps -A, ls -la, pm list)...";
        }
    } catch (err) {
        console.error("Triage error:", err);
    }
}

async function runForensicShell(presetCmd) {
    if (!currentForensicDeviceId) return;
    const input = document.getElementById('forensicShellInput');
    const cmd = presetCmd !== undefined ? presetCmd : (input ? input.value.trim() : '');
    if (!cmd) return;
    if (input && presetCmd === undefined) input.value = '';

    const term = document.getElementById('forensicShellOutput');
    if (term) {
        term.innerHTML += `\n<span class="text-white font-bold">$ ${cmd}</span>\n<span class="text-slate-500">Executing on device subsystem...</span>`;
        term.scrollTop = term.scrollHeight;
    }

    try {
        const res = await fetch(`/api/v1/forensics/devices/${encodeURIComponent(currentForensicDeviceId)}/shell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        if (term) {
            const output = data.output || data.stdout || (data.stderr ? `Error: ${data.stderr}` : `Exit code: ${data.exit_code}`);
            term.innerHTML += `\n${escapeHtml(output)}\n`;
            term.scrollTop = term.scrollHeight;
        }
    } catch (err) {
        if (term) {
            term.innerHTML += `\n<span class="text-slate-300 font-semibold">Execution failed: ${err.message}</span>\n`;
            term.scrollTop = term.scrollHeight;
        }
    }
}

function injectPresetCommand(cmd) {
    const input = document.getElementById('forensicShellInput');
    if (input) input.value = cmd;
    runForensicShell(cmd);
}

// =========================================================================
// Active SOC Remediation Directives
// =========================================================================
async function handleQuarantineToggle() {
    if (!activeDeviceData || !activeDeviceData.device) return;
    const dev = activeDeviceData.device;
    const isQuarantined = dev.status === 'QUARANTINED';
    const action = isQuarantined ? 'RESTORE_NETWORK' : 'ISOLATE_NETWORK';

    const confirmMsg = isQuarantined
        ? `Restore standard network routing on endpoint ${dev.hostname}? Quarantine firewall rules will be removed.`
        : `QUARANTINE ENDPOINT ${dev.hostname}? Workstation external traffic will be cut off immediately while keeping central SOC telemetry active.`;

    const confirmed = await showArgusConfirm({
        title: isQuarantined ? 'Restore Network Connectivity' : 'Emergency Host Quarantine',
        message: confirmMsg,
        confirmText: isQuarantined ? 'Restore Host' : 'Quarantine Now',
        type: isQuarantined ? 'info' : 'danger'
    });

    if (!confirmed) return;

    try {
        const res = await fetch(`/api/v1/devices/${encodeURIComponent(dev.id)}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command_type: action,
                parameters: {}
            })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            dev.status = isQuarantined ? 'ONLINE' : 'QUARANTINED';
            const statusPill = document.getElementById('modalDeviceStatusPill');
            const qBtnText = document.getElementById('btnQuarantineText');
            if (statusPill) {
                statusPill.innerText = dev.status;
                statusPill.className = dev.status === 'QUARANTINED'
                    ? 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white dark:bg-white dark:text-black border border-current'
                    : 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20';
            }
            if (qBtnText) {
                qBtnText.innerText = dev.status === 'QUARANTINED' ? 'Restore Network' : 'Quarantine Host';
            }

            await showArgusAlert({
                type: 'success',
                title: 'Remediation Directive Queued',
                message: `Action ${action} dispatched for ${dev.hostname}. Status: ${dev.status}. Audit ID: ${data.command.id.slice(0, 8)}.`
            });
            fetchDevices();
            fetchAudit();
        } else {
            await showArgusAlert({ type: 'danger', title: 'Command Error', message: data.detail || 'Failed to dispatch command.' });
        }
    } catch (err) {
        console.error('Quarantine command error:', err);
        await showArgusAlert({ type: 'danger', title: 'Network Error', message: err.message });
    }
}

function promptKillProcess() {
    const modal = document.getElementById('killProcessModal');
    const input = document.getElementById('killProcessInput');
    if (input) input.value = '';
    if (modal) modal.classList.remove('hidden');
    if (input) setTimeout(() => input.focus(), 50);
}

function closeKillProcessModal() {
    const modal = document.getElementById('killProcessModal');
    if (modal) modal.classList.add('hidden');
}

async function submitKillProcess() {
    if (!activeDeviceData || !activeDeviceData.device) return;
    const input = document.getElementById('killProcessInput');
    const target = input ? input.value.trim() : '';
    if (!target) {
        await showArgusAlert({ type: 'warning', title: 'Input Required', message: 'Please enter a target PID or process executable name.' });
        return;
    }

    const dev = activeDeviceData.device;
    const isPid = /^\d+$/.test(target);
    const params = isPid ? { pid: parseInt(target, 10) } : { process_name: target };

    closeKillProcessModal();

    try {
        const res = await fetch(`/api/v1/devices/${encodeURIComponent(dev.id)}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command_type: 'TERMINATE_PROCESS',
                parameters: params
            })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            await showArgusAlert({
                type: 'success',
                title: 'Process Termination Dispatched',
                message: `Termination directive queued for ${isPid ? 'PID ' + target : 'process ' + target} on host ${dev.hostname}.`
            });
            fetchAudit();
        } else {
            await showArgusAlert({ type: 'danger', title: 'Command Error', message: data.detail || 'Failed to queue process termination.' });
        }
    } catch (err) {
        console.error('Process kill error:', err);
        await showArgusAlert({ type: 'danger', title: 'Network Error', message: err.message });
    }
}

async function triggerForensicTriage() {
    if (!activeDeviceData || !activeDeviceData.device) return;
    const dev = activeDeviceData.device;
    try {
        const res = await fetch(`/api/v1/devices/${encodeURIComponent(dev.id)}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command_type: 'CAPTURE_FORENSIC_TRIAGE',
                parameters: {}
            })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            await showArgusAlert({
                type: 'success',
                title: 'Forensic Triage Requested',
                message: `Endpoint ${dev.hostname} will immediately catalog running tasks, network sockets, and system drivers.`
            });
            fetchAudit();
        }
    } catch (err) {
        console.error('Triage error:', err);
    }
}

async function triggerWorkstationSnapshot() {
    if (!activeDeviceData || !activeDeviceData.device) return;
    const dev = activeDeviceData.device;
    try {
        const res = await fetch(`/api/v1/devices/${encodeURIComponent(dev.id)}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command_type: 'CAPTURE_CAMERA_SNAPSHOT',
                parameters: { reason: 'Manual Analyst Identity Verification' }
            })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            await showArgusAlert({
                type: 'success',
                title: 'Webcam Directive Dispatched',
                message: `Hardware webcam capture initiated on ${dev.hostname}. Snapshot will be logged into the audit timeline.`
            });
            fetchAudit();
        }
    } catch (err) {
        console.error('Camera snap error:', err);
    }
}

// =========================================================================
// Threat Hunting & Telemetry Search Engine
// =========================================================================
let currentHuntTimeRange = '24h';

function openThreatHuntingModal() {
    const modal = document.getElementById('threatHuntingModal');
    if (modal) {
        modal.classList.remove('hidden');
        initGlobalTomSelects(modal);
        executeHunt();
    }
}

function closeThreatHuntingModal() {
    const modal = document.getElementById('threatHuntingModal');
    if (modal) modal.classList.add('hidden');
}

function setHuntTimeRange(range, btn) {
    currentHuntTimeRange = range;
    const container = document.getElementById('huntTimeButtons');
    if (container) {
        container.querySelectorAll('.hunt-time-btn').forEach(b => {
            b.className = 'hunt-time-btn px-3 py-1 rounded-sm text-xs font-mono text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition';
        });
    }
    if (btn) {
        btn.className = 'hunt-time-btn px-3 py-1 rounded-sm text-xs font-mono bg-slate-900 dark:bg-white text-white dark:text-black font-bold transition';
    }
    executeHunt();
}

async function executeHunt() {
    const qInput = document.getElementById('huntQueryInput');
    const evTypeSelect = document.getElementById('huntEventTypeSelect');
    const sevSelect = document.getElementById('huntSeveritySelect');
    const tbody = document.getElementById('huntResultsTableBody');
    const countSpan = document.getElementById('huntResultsCount');
    const scopeSpan = document.getElementById('huntTimeScope');

    const q = qInput ? qInput.value.trim() : '';
    const event_type = evTypeSelect ? evTypeSelect.value : '';
    const severity = sevSelect ? sevSelect.value : '';

    if (scopeSpan) {
        const labels = { '1h': 'Last 1 Hour', '6h': 'Last 6 Hours', '24h': 'Last 24 Hours', '7d': 'Last 7 Days', 'all': 'Complete History' };
        scopeSpan.innerText = `Window: ${labels[currentHuntTimeRange] || currentHuntTimeRange}`;
    }

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                    <div class="flex items-center justify-center space-x-2">
                        <svg class="w-5 h-5 text-slate-900 dark:text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                        <span>Scanning database telemetry records...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams({
            time_range: currentHuntTimeRange,
            limit: '100'
        });
        if (q) params.append('q', q);
        if (event_type) params.append('event_type', event_type);
        if (severity) params.append('severity', severity);

        const res = await fetch(`/api/v1/telemetry/search?${params.toString()}`);
        const data = await res.json();

        if (countSpan) countSpan.innerText = `Showing ${data.events.length} of ${data.total} matching events`;

        if (!tbody) return;
        if (!data.events || data.events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-slate-400">No telemetry events matched the specified search criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.events.forEach((ev, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-cyber-800/50 transition font-mono text-xs';

            const summary = summarizeEventPayload(ev.event_type, ev.payload);
            const sevBadge = ev.severity_hint === 'CRITICAL'
                ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-white dark:bg-white dark:text-black">CRIT</span>'
                : (ev.severity_hint === 'HIGH' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-cyber-700 text-slate-900 dark:text-white border border-slate-300 dark:border-cyber-600">HIGH</span>' : '<span class="text-slate-400 text-[10px]">INFO</span>');

            tr.innerHTML = `
                <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">${new Date(ev.timestamp).toLocaleString()}</td>
                <td class="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">${ev.event_type}</td>
                <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">${ev.username || 'unknown'} <span class="text-slate-400 text-[10px]">(${ev.device_id.slice(0, 10)})</span></td>
                <td class="py-2.5 px-3">${sevBadge}</td>
                <td class="py-2.5 px-3 text-slate-700 dark:text-slate-300 truncate max-w-md" title="${escapeHtml(summary)}">${escapeHtml(summary)}</td>
                <td class="py-2.5 px-3 text-right whitespace-nowrap">
                    <button onclick="toggleHuntPayload('hunt-payload-${idx}')" class="px-2 py-0.5 rounded bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 dark:hover:bg-cyber-600 text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-cyber-600 transition">JSON</button>
                </td>
            `;
            tbody.appendChild(tr);

            // Collapsible JSON Row
            const detailTr = document.createElement('tr');
            detailTr.id = `hunt-payload-${idx}`;
            detailTr.className = 'hidden bg-slate-100 dark:bg-cyber-950 font-mono text-[11px]';
            detailTr.innerHTML = `
                <td colspan="6" class="p-3">
                    <div class="p-3 bg-white dark:bg-cyber-900 rounded-lg border border-slate-200 dark:border-cyber-700 overflow-x-auto custom-scrollbar text-slate-800 dark:text-slate-200">
                        <pre>${escapeHtml(JSON.stringify(ev.payload, null, 2))}</pre>
                    </div>
                </td>
            `;
            tbody.appendChild(detailTr);
        });

    } catch (err) {
        console.error('Threat hunt query error:', err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Search error: ${err.message}</td></tr>`;
    }
}

function summarizeEventPayload(eventType, payload) {
    if (!payload) return '-';
    if (eventType === 'PROCESS_START') {
        return `${payload.name || 'proc'} (PID: ${payload.pid || '?'}) ${payload.cmdline ? '— ' + payload.cmdline.slice(0, 100) : ''}`;
    } else if (eventType === 'BROWSER_VISIT') {
        return `${payload.browser || 'Web'}: ${payload.url || payload.title || '-'}`;
    } else if (eventType === 'CLIPBOARD_CHANGE') {
        return `Copied [${payload.length_chars || 0} chars]: "${(payload.preview || '').slice(0, 60)}"`;
    } else if (eventType === 'PRINT_JOB') {
        return `Spooled document: ${payload.document_name || '-'} on ${payload.printer_name || '-'} (${payload.pages || 1} pgs)`;
    } else if (eventType === 'CAMERA_ALERT') {
        return `Webcam capture trigger: ${payload.reason || '-'}`;
    } else if (eventType === 'FORENSIC_TRIAGE') {
        return `Triage: ${payload.process_count || 0} procs, ${payload.open_sockets || 0} sockets cataloged`;
    }
    return JSON.stringify(payload).slice(0, 80);
}

function toggleHuntPayload(id) {
    const row = document.getElementById(id);
    if (row) row.classList.toggle('hidden');
}

function exportHunt(format) {
    const qInput = document.getElementById('huntQueryInput');
    const evTypeSelect = document.getElementById('huntEventTypeSelect');
    const sevSelect = document.getElementById('huntSeveritySelect');

    const q = qInput ? qInput.value.trim() : '';
    const event_type = evTypeSelect ? evTypeSelect.value : '';
    const severity = sevSelect ? sevSelect.value : '';

    const params = new URLSearchParams({
        format: format,
        time_range: currentHuntTimeRange,
        limit: '2000'
    });
    if (q) params.append('q', q);
    if (event_type) params.append('event_type', event_type);
    if (severity) params.append('severity', severity);

    const downloadUrl = `/api/v1/telemetry/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `artis_hunt_${format}_export`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// =========================================================================
// MITRE ATT&CK Visual Incident Timeline & Attack Chain
// =========================================================================
async function openAttackChain(alertId) {
    const modal = document.getElementById('attackChainModal');
    const titleEl = document.getElementById('chainAlertTitle');
    const subEl = document.getElementById('chainAlertSub');
    const sevEl = document.getElementById('chainAlertSeverity');
    const stagesGrid = document.getElementById('chainStagesGrid');
    const timelineList = document.getElementById('chainTimelineList');
    const countSpan = document.getElementById('chainTimelineCount');

    if (modal) modal.classList.remove('hidden');
    if (stagesGrid) stagesGrid.innerHTML = '<div class="col-span-full py-6 text-center text-slate-400">Reconstructing MITRE ATT&amp;CK kill chain...</div>';
    if (timelineList) timelineList.innerHTML = '';

    try {
        const res = await fetch(`/api/v1/alerts/${encodeURIComponent(alertId)}/attack-chain`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const chain = await res.json();

        if (titleEl) titleEl.innerText = chain.alert.title;
        if (sevEl) {
            sevEl.innerText = chain.alert.severity;
            sevEl.className = chain.alert.severity === 'CRITICAL'
                ? 'px-2 py-0.5 rounded font-mono font-bold text-[9px] uppercase bg-slate-900 text-white dark:bg-white dark:text-black'
                : 'px-2 py-0.5 rounded font-mono font-bold text-[9px] uppercase bg-slate-200 dark:bg-cyber-700 text-slate-900 dark:text-white border border-slate-300 dark:border-cyber-600';
        }
        if (subEl) {
            subEl.innerText = `Host: ${chain.device.hostname} | Risk Score: ${chain.device.risk_score}/100 | Status: ${chain.device.status} | Tactic: ${chain.alert.mitre_tactic || 'Generic'}`;
        }
        if (countSpan) countSpan.innerText = `${chain.timeline.length} Events Correlated`;

        // Render MITRE Progression Stages Grid
        if (stagesGrid) {
            stagesGrid.innerHTML = '';
            chain.stages.forEach(st => {
                const card = document.createElement('div');
                if (st.observed) {
                    card.className = 'p-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black border border-slate-800 dark:border-slate-200 flex flex-col justify-between shadow-md';
                    card.innerHTML = `
                        <div class="flex items-center justify-between">
                            <span class="text-[9px] font-mono font-bold uppercase tracking-wider">${st.tactic}</span>
                            <span class="h-2 w-2 rounded-full bg-white dark:bg-slate-900 animate-pulse"></span>
                        </div>
                        <div class="mt-2 text-xs font-mono font-bold">${st.count} DETECTED</div>
                        <p class="text-[9px] opacity-80 mt-0.5 line-clamp-1">${st.description}</p>
                    `;
                } else {
                    card.className = 'p-3 rounded-xl bg-slate-50 dark:bg-cyber-800/40 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-cyber-700/60 flex flex-col justify-between';
                    card.innerHTML = `
                        <div class="flex items-center justify-between">
                            <span class="text-[9px] font-mono font-semibold uppercase tracking-wider">${st.tactic}</span>
                        </div>
                        <div class="mt-2 text-[10px] font-mono">UNOBSERVED</div>
                        <p class="text-[9px] opacity-60 mt-0.5 line-clamp-1">${st.description}</p>
                    `;
                }
                stagesGrid.appendChild(card);
            });
        }

        // Render Chronological Timeline
        if (timelineList) {
            timelineList.innerHTML = '';
            if (chain.timeline.length === 0) {
                timelineList.innerHTML = '<div class="py-8 text-center text-slate-400">No correlated events within this attack timeframe.</div>';
                return;
            }

            chain.timeline.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                const isTarget = item.is_target;
                itemDiv.className = isTarget
                    ? 'p-4 rounded-xl bg-white dark:bg-cyber-card border-2 border-slate-900 dark:border-white shadow-lg space-y-2'
                    : 'p-3.5 rounded-xl bg-slate-50 dark:bg-cyber-800/40 border border-slate-200 dark:border-cyber-700/60 space-y-1.5';

                itemDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-0.5 rounded font-mono font-bold text-[9px] uppercase ${isTarget ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'bg-slate-200 dark:bg-cyber-700 text-slate-900 dark:text-white'}">${item.severity}</span>
                            <span class="font-bold text-slate-900 dark:text-white text-xs">${item.title}</span>
                            ${isTarget ? '<span class="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-slate-100 dark:bg-cyber-800 border border-current text-slate-900 dark:text-white uppercase">ANCHOR INCIDENT</span>' : ''}
                        </div>
                        <span class="text-[10px] font-mono text-slate-400">${item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        <span>Tactic: <b>${item.tactic}</b></span>
                        <span>Technique: <b>${item.technique_id || 'TXXXX'}</b> (${item.technique_name || 'Generic'})</span>
                        <span>Status: <b>${item.status}</b></span>
                    </div>
                    ${item.suggested_remediation ? `<div class="p-2 bg-slate-100 dark:bg-cyber-900 rounded-lg text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-cyber-700 font-mono"><b>Remediation:</b> ${item.suggested_remediation}</div>` : ''}
                `;
                timelineList.appendChild(itemDiv);
            });
        }

    } catch (err) {
        console.error('Attack chain error:', err);
        if (stagesGrid) stagesGrid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400">Failed to load attack chain: ${err.message}</div>`;
    }
}

function closeAttackChainModal() {
    const modal = document.getElementById('attackChainModal');
    if (modal) modal.classList.add('hidden');
}

// =========================================================================
// Enterprise Alert Forwarding & Webhook Dispatch
// =========================================================================
function openWebhooksModal() {
    const modal = document.getElementById('webhooksModal');
    if (modal) {
        modal.classList.remove('hidden');
        initGlobalTomSelects(modal);
        fetchWebhooks();
    }
}

function closeWebhooksModal() {
    const modal = document.getElementById('webhooksModal');
    if (modal) modal.classList.add('hidden');
}

async function fetchWebhooks() {
    const container = document.getElementById('webhooksListContainer');
    if (!container) return;
    container.innerHTML = '<div class="py-6 text-center text-slate-400 font-mono text-xs">Loading alert forwarding channels...</div>';

    try {
        const res = await fetch('/api/v1/alerts/webhooks');
        const webhooks = await res.json();

        if (!webhooks || webhooks.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-slate-400 bg-slate-50 dark:bg-cyber-800/40 rounded-xl border border-slate-200 dark:border-cyber-700/60">No external forwarding channels configured yet. Add a Discord, Slack, or SIEM webhook above.</div>';
            return;
        }

        container.innerHTML = '';
        webhooks.forEach(wh => {
            const card = document.createElement('div');
            card.className = 'p-3 bg-white dark:bg-cyber-900 rounded-xl border border-slate-200 dark:border-cyber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
            
            // Mask URL for security
            const maskedUrl = wh.url.length > 35 ? `${wh.url.slice(0, 25)}...${wh.url.slice(-8)}` : wh.url;

            card.innerHTML = `
                <div class="min-w-0">
                    <div class="flex items-center space-x-2">
                        <span class="font-bold text-slate-900 dark:text-white text-xs">${wh.name}</span>
                        <span class="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] uppercase bg-slate-200 dark:bg-cyber-700 text-slate-800 dark:text-slate-200">${wh.webhook_type}</span>
                        <span class="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-100 dark:bg-cyber-800 text-slate-500">Min: ${wh.min_severity}</span>
                    </div>
                    <div class="font-mono text-[10px] text-slate-400 mt-1 truncate" title="${escapeHtml(wh.url)}">${escapeHtml(maskedUrl)}</div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <button onclick="testWebhook('${wh.id}', this)" class="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-800 dark:text-slate-200 font-medium text-[11px] border border-slate-200 dark:border-cyber-600 transition">Test Ping</button>
                    <button onclick="deleteWebhook('${wh.id}')" class="px-2 py-1 rounded-md bg-slate-100 dark:bg-cyber-700 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 text-slate-500 text-[11px] transition">Delete</button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error('Fetch webhooks error:', err);
        container.innerHTML = `<div class="py-4 text-center text-slate-400">Failed to load webhooks: ${err.message}</div>`;
    }
}

async function registerWebhook() {
    const nameInput = document.getElementById('whNameInput');
    const urlInput = document.getElementById('whUrlInput');
    const typeSelect = document.getElementById('whTypeSelect');
    const sevSelect = document.getElementById('whSeveritySelect');

    const name = nameInput ? nameInput.value.trim() : '';
    const url = urlInput ? urlInput.value.trim() : '';
    const webhook_type = typeSelect ? typeSelect.value : 'GENERIC_JSON';
    const min_severity = sevSelect ? sevSelect.value : 'HIGH';

    if (!name || !url) {
        await showArgusAlert({ type: 'warning', title: 'Input Required', message: 'Please enter both a destination name and a valid webhook URL.' });
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        await showArgusAlert({ type: 'warning', title: 'Invalid URL', message: 'Webhook URL must start with http:// or https://' });
        return;
    }

    try {
        const res = await fetch('/api/v1/alerts/webhooks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                url,
                webhook_type,
                min_severity,
                is_enabled: true
            })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || `HTTP ${res.status}`);
        }

        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';

        await showArgusAlert({
            type: 'success',
            title: 'Webhook Registered',
            message: `Alert forwarding channel '${name}' successfully configured for ${min_severity} detections.`
        });
        fetchWebhooks();

    } catch (err) {
        console.error('Register webhook error:', err);
        await showArgusAlert({ type: 'danger', title: 'Registration Failed', message: err.message });
    }
}

async function testWebhook(webhookId, btn) {
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Testing...';
    }
    try {
        const res = await fetch(`/api/v1/alerts/webhooks/${encodeURIComponent(webhookId)}/test`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            await showArgusAlert({
                type: 'success',
                title: 'Webhook Verified',
                message: `Test dispatch acknowledged by endpoint (HTTP ${data.status_code}). Integration verified.`
            });
        } else {
            await showArgusAlert({
                type: 'danger',
                title: 'Verification Failed',
                message: `Destination rejected test dispatch: ${data.message}`
            });
        }
    } catch (err) {
        console.error('Test webhook error:', err);
        await showArgusAlert({ type: 'danger', title: 'Test Error', message: err.message });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Test Ping';
        }
    }
}

async function deleteWebhook(webhookId) {
    const confirmed = await showArgusConfirm({
        title: 'Delete Webhook Channel',
        message: 'Are you sure you want to remove this alert forwarding destination? It will no longer receive security dispatches.',
        confirmText: 'Delete Destination',
        type: 'danger'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/v1/alerts/webhooks/${encodeURIComponent(webhookId)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            fetchWebhooks();
        }
    } catch (err) {
        console.error('Delete webhook error:', err);
    }
}

