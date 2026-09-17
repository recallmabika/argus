// =========================================================================
// ARTIS Incident Security Platform - Executive Landing Page Script
// Pure client-side modular script (Zero inline JavaScript)
// =========================================================================

let currentMapLevel = 'world';

const NODE_TELEMETRY = {
    // World Nodes
    'world-na': {
        name: 'North America Defense Gateway',
        region: 'Global Grid - Sector 01',
        status: 'MONITORING',
        latency: '24ms',
        sensors: 'Active Edge Sensors',
        description: 'Transatlantic threat telemetry feed and cloud infrastructure endpoint ingestion.'
    },
    'world-eu': {
        name: 'European Union Cyber Cell',
        region: 'Global Grid - Sector 02',
        status: 'MONITORING',
        latency: '31ms',
        sensors: 'Active Edge Sensors',
        description: 'Cross-border attack correlation and international MITRE adversary tracking.'
    },
    'world-af': {
        name: 'African Continental Core Hub',
        region: 'Global Grid - Sector 03',
        status: 'ACTIVE DEFENSE',
        latency: '12ms',
        sensors: 'Primary Command Feeds',
        description: 'Central interconnection coordinating with Pan-African SOC and SADC perimeter shields.'
    },
    'world-ap': {
        name: 'Asia-Pacific Telemetry Array',
        region: 'Global Grid - Sector 04',
        status: 'MONITORING',
        latency: '48ms',
        sensors: 'Active Edge Sensors',
        description: 'High-throughput packet inspection and distributed telemetry ingestion nodes.'
    },

    // Africa Nodes
    'africa-sadc': {
        name: 'SADC Regional Security Matrix',
        region: 'Southern Africa Grid',
        status: 'ACTIVE DEFENSE',
        latency: '8ms',
        sensors: 'Regional Interlink Array',
        description: 'Multi-institutional banking cyber defense and critical infrastructure telemetry.'
    },
    'africa-east': {
        name: 'East African Financial Corridor',
        region: 'East Africa Grid',
        status: 'MONITORING',
        latency: '22ms',
        sensors: 'Edge Gateway Sensors',
        description: 'Mobile money network telemetry and distributed financial endpoint tracking.'
    },
    'africa-west': {
        name: 'West African Infrastructure Node',
        region: 'West Africa Grid',
        status: 'MONITORING',
        latency: '29ms',
        sensors: 'Border Telemetry Relay',
        description: 'Subsea cable termination point and regional telecommunications monitoring.'
    },

    // Zimbabwe Nodes
    'zim-harare': {
        name: 'Harare National Security Operations Center (HQ)',
        region: 'Mashonaland Operations Hub',
        status: 'PRIMARY COMMAND',
        latency: '2ms',
        sensors: 'Live Host & Network Sensors',
        description: 'Headquarters for ARTIS continuous incident monitoring, Ed25519 root authority, and digital forensics studio.'
    },
    'zim-byo': {
        name: 'Bulawayo Secondary Command & DR SOC',
        region: 'Matabeleland Command Site',
        status: 'SYNCHRONIZED',
        latency: '7ms',
        sensors: 'Hot-Standby Telemetry Array',
        description: 'Redundant high-availability disaster recovery command center with independent telemetry mirrors.'
    },
    'zim-gweru': {
        name: 'Gweru Midlands Transit Gateway',
        region: 'Midlands Sensor Node',
        status: 'ONLINE',
        latency: '5ms',
        sensors: 'Fiber Backbone Probe',
        description: 'National core routing junction and government network perimeter packet telemetry.'
    },
    'zim-mutare': {
        name: 'Mutare Eastern Border Corridor Gateway',
        region: 'Manicaland Border Post',
        status: 'ACTIVE MONITORING',
        latency: '6ms',
        sensors: 'Perimeter Inspection Probes',
        description: 'Cross-border transit telemetry monitoring and regional enterprise infrastructure links.'
    },
    'zim-vicfalls': {
        name: 'Victoria Falls International Gateway',
        region: 'Matabeleland North Special Economic Zone',
        status: 'SECURE',
        latency: '9ms',
        sensors: 'International Edge Node',
        description: 'Hospitality, banking, and border security endpoint telemetry monitoring.'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initLandingTheme();
    fetchLivePlatformStats();
    setupSmoothScroll();
    setMapLevel('world');
});

function initLandingTheme() {
    const savedTheme = localStorage.getItem('argus-theme') || 'dark';
    setLandingTheme(savedTheme, false);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem('argus-theme') === 'system') {
            applyLandingThemeClass(e.matches);
        }
    });
}

function setLandingTheme(mode, save = true) {
    if (save) localStorage.setItem('argus-theme', mode);

    let isDark = mode === 'dark';
    if (mode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    applyLandingThemeClass(isDark);
    updateThemeIcon(isDark);
}

function applyLandingThemeClass(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleLandingTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    setLandingTheme(isDark ? 'light' : 'dark');
}

function updateThemeIcon(isDark) {
    const iconContainer = document.getElementById('landingThemeIcon');
    if (!iconContainer) return;
    if (isDark) {
        iconContainer.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
    } else {
        iconContainer.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
    }
}

let mapTransitionTimer = null;

function renderNodeInspectorSkeleton() {
    const nameEl = document.getElementById('nodeDetailName');
    const regionEl = document.getElementById('nodeDetailRegion');
    const statusEl = document.getElementById('nodeDetailStatus');
    const latencyEl = document.getElementById('nodeDetailLatency');
    const sensorsEl = document.getElementById('nodeDetailSensors');
    const descEl = document.getElementById('nodeDetailDesc');

    if (nameEl) nameEl.innerHTML = '<span class="inline-block h-5 w-48 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (regionEl) regionEl.innerHTML = '<span class="inline-block h-3.5 w-28 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (statusEl) statusEl.innerHTML = '<span class="inline-block h-4 w-20 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (latencyEl) latencyEl.innerHTML = '<span class="inline-block h-4 w-12 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (sensorsEl) sensorsEl.innerHTML = '<span class="inline-block h-4 w-32 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (descEl) descEl.innerHTML = '<span class="block h-3 w-full bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse mb-1.5"></span><span class="block h-3 w-3/4 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
}

function setMapLevel(level) {
    currentMapLevel = level;

    const buttons = document.querySelectorAll('.map-nav-btn');
    buttons.forEach(btn => {
        const btnLevel = btn.getAttribute('data-level');
        if (btnLevel === level) {
            btn.className = 'map-nav-btn px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 bg-blue-600 text-white shadow-lg shadow-blue-500/30';
        } else {
            btn.className = 'map-nav-btn px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600';
        }
    });

    const overlay = document.getElementById('mapLoadingSkeleton');
    if (overlay) {
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100');
    }
    renderNodeInspectorSkeleton();

    if (mapTransitionTimer) clearTimeout(mapTransitionTimer);
    mapTransitionTimer = setTimeout(() => {
        const panels = document.querySelectorAll('.map-view-panel');
        panels.forEach(panel => {
            if (panel.id === `mapPanel-${level}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        const titleEl = document.getElementById('mapLevelTitle');
        const descEl = document.getElementById('mapLevelDesc');
        const badgeEl = document.getElementById('mapLevelBadge');

        if (level === 'world') {
            if (titleEl) titleEl.textContent = 'Global Threat Telemetry Grid';
            if (descEl) descEl.textContent = 'Continuous global attack surface intelligence and cross-border adversary vector correlation.';
            if (badgeEl) {
                badgeEl.textContent = 'GLOBAL VISIBILITY';
                badgeEl.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20';
            }
            inspectNode('world-af');
        } else if (level === 'africa') {
            if (titleEl) titleEl.textContent = 'Pan-African Cyber Defense Shield';
            if (descEl) descEl.textContent = 'Regional infrastructure security and unified inter-institutional threat intelligence across SADC.';
            if (badgeEl) {
                badgeEl.textContent = 'CONTINENTAL MATRIX';
                badgeEl.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
            }
            inspectNode('africa-sadc');
        } else if (level === 'zimbabwe') {
            if (titleEl) titleEl.textContent = 'Zimbabwe National Security Operations Center';
            if (descEl) descEl.textContent = 'Primary tactical command, commercial banking protection hubs, and high-security border gateway endpoints.';
            if (badgeEl) {
                badgeEl.textContent = 'NATIONAL COMMAND';
                badgeEl.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
            }
            inspectNode('zim-harare');
        }

        if (overlay) {
            overlay.classList.add('opacity-0', 'pointer-events-none');
            overlay.classList.remove('opacity-100');
        }
    }, 180);
}

function inspectNode(nodeKey) {
    const node = NODE_TELEMETRY[nodeKey];
    if (!node) return;

    const nameEl = document.getElementById('nodeDetailName');
    const regionEl = document.getElementById('nodeDetailRegion');
    const statusEl = document.getElementById('nodeDetailStatus');
    const latencyEl = document.getElementById('nodeDetailLatency');
    const sensorsEl = document.getElementById('nodeDetailSensors');
    const descEl = document.getElementById('nodeDetailDesc');

    if (nameEl) nameEl.textContent = node.name;
    if (regionEl) regionEl.textContent = node.region;
    if (statusEl) {
        statusEl.textContent = node.status;
        if (node.status.includes('PRIMARY') || node.status.includes('ACTIVE')) {
            statusEl.className = 'font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400';
        } else {
            statusEl.className = 'font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400';
        }
    }
    if (latencyEl) latencyEl.textContent = node.latency;
    if (sensorsEl) sensorsEl.textContent = node.sensors;
    if (descEl) descEl.textContent = node.description;
}

async function fetchLivePlatformStats() {
    try {
        const devRes = await fetch('/api/v1/devices');
        if (devRes.ok) {
            const devices = await devRes.json();
            const devCountEl = document.getElementById('statLiveDevices');
            if (devCountEl) animateCounter(devCountEl, devices.length);
        }

        const alertRes = await fetch('/api/v1/alerts');
        if (alertRes.ok) {
            const alerts = await alertRes.json();
            const alertCountEl = document.getElementById('statActiveAlerts');
            if (alertCountEl) animateCounter(alertCountEl, alerts.length);
        }

        const orgRes = await fetch('/api/v1/users/organizations');
        if (orgRes.ok) {
            const orgs = await orgRes.json();
            const orgCountEl = document.getElementById('statActiveOrgs');
            if (orgCountEl) animateCounter(orgCountEl, orgs.length);
        }
    } catch (e) {
        console.warn('Live telemetry poll error:', e);
    }
}

function animateCounter(el, target) {
    if (!el) return;
    el.innerHTML = '';
    let current = 0;
    const duration = 800;
    const stepTime = 30;
    const steps = duration / stepTime;
    const increment = target / steps;

    if (target === 0) {
        el.textContent = '0';
        return;
    }

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            el.textContent = target.toString();
            clearInterval(timer);
        } else {
            el.textContent = Math.floor(current).toString();
        }
    }, stepTime);
}

function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || !href) return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}
