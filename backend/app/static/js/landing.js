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
    initNavScrollTrigger();
    initHeroMapCanvas();
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

// =========================================================================
// Scroll-Revealed Navigation Bar (Visible only when scrolling past hero)
// =========================================================================
function initNavScrollTrigger() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    const onScroll = () => {
        // When user scrolls down past 220px (leaving top of hero)
        if (window.scrollY > 220) {
            nav.classList.remove('-translate-y-full', 'opacity-0', 'pointer-events-none');
            nav.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        } else {
            nav.classList.add('-translate-y-full', 'opacity-0', 'pointer-events-none');
            nav.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

// =========================================================================
// Cinematic World Map Hero Canvas Telemetry (Video-like fluid animation)
// =========================================================================
let heroCanvasAnimId = null;

function initHeroMapCanvas() {
    const canvas = document.getElementById('heroMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODES = [
        { name: 'Harare', x: 0.55, y: 0.70 },
        { name: 'Johannesburg', x: 0.54, y: 0.77 },
        { name: 'Nairobi', x: 0.58, y: 0.54 },
        { name: 'Lagos', x: 0.46, y: 0.51 },
        { name: 'London', x: 0.48, y: 0.28 },
        { name: 'Frankfurt', x: 0.51, y: 0.29 },
        { name: 'New York', x: 0.28, y: 0.32 },
        { name: 'San Francisco', x: 0.18, y: 0.34 },
        { name: 'Tokyo', x: 0.84, y: 0.36 },
        { name: 'Singapore', x: 0.76, y: 0.55 },
        { name: 'Sydney', x: 0.88, y: 0.79 },
        { name: 'Dubai', x: 0.61, y: 0.41 },
        { name: 'Sao Paulo', x: 0.35, y: 0.74 }
    ];

    const CONNECTIONS = [
        [0, 1], [0, 2], [0, 4], [1, 2], [2, 11],
        [3, 4], [3, 5], [4, 6], [4, 5], [5, 11],
        [6, 7], [6, 12], [7, 8], [8, 9], [9, 10],
        [11, 8], [11, 9]
    ];

    // Initialize packets traveling along links
    const packets = CONNECTIONS.map(([fromIdx, toIdx], i) => ({
        from: fromIdx,
        to: toIdx,
        progress: (i * 0.17) % 1,
        speed: 0.003 + (i % 4) * 0.0015
    }));

    // Active node pulse rings
    const rings = NODES.map((_, i) => ({
        radius: (i * 4) % 14,
        maxRadius: 16,
        speed: 0.15 + (i % 3) * 0.05
    }));

    let width = 0;
    let height = 0;

    function resize() {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    function draw() {
        // Pause animation when scrolled deep past the hero
        if (window.scrollY > 900) {
            heroCanvasAnimId = requestAnimationFrame(draw);
            return;
        }

        ctx.clearRect(0, 0, width, height);

        const isDark = document.documentElement.classList.contains('dark');
        const lineColor = isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.18)';
        const packetColor = isDark ? 'rgba(34, 211, 238, 0.85)' : 'rgba(14, 165, 233, 0.85)';
        const nodeColor = isDark ? 'rgba(56, 189, 248, 0.7)' : 'rgba(2, 132, 199, 0.7)';
        const ringColor = isDark ? 'rgba(56, 189, 248, ' : 'rgba(2, 132, 199, ';

        // 1. Draw static and curved network connection arcs
        CONNECTIONS.forEach(([fromIdx, toIdx]) => {
            const n1 = NODES[fromIdx];
            const n2 = NODES[toIdx];
            const x1 = n1.x * width;
            const y1 = n1.y * height;
            const x2 = n2.x * width;
            const y2 = n2.y * height;

            const midX = (x1 + x2) / 2;
            const midY = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.12;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(midX, midY, x2, y2);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // 2. Draw packets moving along curved routes
        packets.forEach(p => {
            p.progress += p.speed;
            if (p.progress >= 1) p.progress = 0;

            const n1 = NODES[p.from];
            const n2 = NODES[p.to];
            const x1 = n1.x * width;
            const y1 = n1.y * height;
            const x2 = n2.x * width;
            const y2 = n2.y * height;

            const midX = (x1 + x2) / 2;
            const midY = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.12;

            const t = p.progress;
            // Quadratic Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
            const curX = Math.pow(1 - t, 2) * x1 + 2 * (1 - t) * t * midX + Math.pow(t, 2) * x2;
            const curY = Math.pow(1 - t, 2) * y1 + 2 * (1 - t) * t * midY + Math.pow(t, 2) * y2;

            ctx.beginPath();
            ctx.arc(curX, curY, 2, 0, Math.PI * 2);
            ctx.fillStyle = packetColor;
            ctx.fill();
        });

        // 3. Draw nodes and radar pulse rings
        NODES.forEach((n, idx) => {
            const nx = n.x * width;
            const ny = n.y * height;

            // Pulse ring
            const ring = rings[idx];
            ring.radius += ring.speed;
            if (ring.radius >= ring.maxRadius) ring.radius = 2;
            const alpha = Math.max(0, 1 - ring.radius / ring.maxRadius) * 0.45;

            ctx.beginPath();
            ctx.arc(nx, ny, ring.radius, 0, Math.PI * 2);
            ctx.strokeStyle = ringColor + alpha + ')';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Core node dot
            ctx.beginPath();
            ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor;
            ctx.fill();
        });

        heroCanvasAnimId = requestAnimationFrame(draw);
    }

    draw();
}

let mapTransitionTimer = null;

function renderNodeInspectorSkeleton() {
    const nameEl = document.getElementById('nodeDetailName');
    const regionEl = document.getElementById('nodeDetailRegion');
    const statusEl = document.getElementById('nodeDetailStatus');
    const latencyEl = document.getElementById('nodeDetailLatency');
    const sensorsEl = document.getElementById('nodeDetailSensors');
    const descEl = document.getElementById('nodeDetailDesc');

    if (nameEl) nameEl.innerHTML = '<span class="inline-block h-4 w-40 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (regionEl) regionEl.innerHTML = '<span class="inline-block h-3 w-24 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (statusEl) statusEl.innerHTML = '<span class="inline-block h-3.5 w-16 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (latencyEl) latencyEl.innerHTML = '<span class="inline-block h-3.5 w-12 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (sensorsEl) sensorsEl.innerHTML = '<span class="inline-block h-3.5 w-28 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
    if (descEl) descEl.innerHTML = '<span class="block h-3 w-full bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse mb-1.5"></span><span class="block h-3 w-3/4 bg-slate-200 dark:bg-cyber-700/60 rounded animate-pulse"></span>';
}

function setMapLevel(level) {
    currentMapLevel = level;

    const buttons = document.querySelectorAll('.map-nav-btn');
    buttons.forEach(btn => {
        const btnLevel = btn.getAttribute('data-level');
        if (btnLevel === level) {
            btn.className = 'map-nav-btn px-4 py-1.5 rounded-lg text-xs font-normal tracking-wide transition bg-blue-600 text-white';
        } else {
            btn.className = 'map-nav-btn px-4 py-1.5 rounded-lg text-xs font-light tracking-wide transition text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600';
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
                badgeEl.className = 'text-[10px] font-mono font-normal px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20';
            }
            inspectNode('world-af');
        } else if (level === 'africa') {
            if (titleEl) titleEl.textContent = 'Pan-African Cyber Defense Shield';
            if (descEl) descEl.textContent = 'Regional infrastructure security and unified inter-institutional threat intelligence across SADC.';
            if (badgeEl) {
                badgeEl.textContent = 'CONTINENTAL MATRIX';
                badgeEl.className = 'text-[10px] font-mono font-normal px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
            }
            inspectNode('africa-sadc');
        } else if (level === 'zimbabwe') {
            if (titleEl) titleEl.textContent = 'Zimbabwe National Security Operations Center';
            if (descEl) descEl.textContent = 'Primary tactical command, commercial banking protection hubs, and high-security border gateway endpoints.';
            if (badgeEl) {
                badgeEl.textContent = 'NATIONAL COMMAND';
                badgeEl.className = 'text-[10px] font-mono font-normal px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
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
            statusEl.className = 'font-mono text-xs font-normal text-cyan-600 dark:text-cyan-400';
        } else {
            statusEl.className = 'font-mono text-xs font-normal text-emerald-600 dark:text-emerald-400';
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

// =========================================================================
// Executive Demo Request Modal Management
// =========================================================================
function openDemoModal() {
    const modal = document.getElementById('demoModal');
    if (!modal) return;
    const form = document.getElementById('demoRequestForm');
    const success = document.getElementById('demoSuccessState');
    if (form) form.classList.remove('hidden');
    if (success) success.classList.add('hidden');
    
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100', 'pointer-events-auto');
    const card = modal.querySelector('.demo-modal-card');
    if (card) {
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
    }
}

function closeDemoModal() {
    const modal = document.getElementById('demoModal');
    if (!modal) return;
    const card = modal.querySelector('.demo-modal-card');
    if (card) {
        card.classList.remove('scale-100');
        card.classList.add('scale-95');
    }
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function handleDemoSubmit(e) {
    e.preventDefault();
    const token = 'ARTIS-DEMO-' + Math.floor(1000 + Math.random() * 9000);
    const refEl = document.getElementById('demoRefId');
    if (refEl) refEl.textContent = token;
    
    const form = document.getElementById('demoRequestForm');
    const success = document.getElementById('demoSuccessState');
    if (form) form.classList.add('hidden');
    if (success) success.classList.remove('hidden');
}

// Close demo modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDemoModal();
    }
});

// Close demo modal on backdrop click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('demoModal');
    if (modal && e.target === modal) {
        closeDemoModal();
    }
});
