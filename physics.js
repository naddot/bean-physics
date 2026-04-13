const MatterRef = window.Matter;

if (!MatterRef) {
    throw new Error("Matter.js is required but was not loaded.");
}

const { Engine, World, Bodies, Body, Events } = MatterRef;

const CONFIG = {
    physics: { gravityY: 0.9, positionIterations: 8, velocityIterations: 6, constraintIterations: 2, wallThickness: 80 },
    bean: { radius: 16, restitution: 0.75, friction: 0.03, frictionAir: 0.008, density: 0.0017, initialVelocityX: 8, initialVelocityY: 7 },
    spawn: { intervalMs: 90 },
    mouse: { influenceRadius: 120, dragBoostPerPixel: 0.11, maxDragBoost: 2.8, forceScale: 0.0045, velocityForceScale: 0.00024, clickBurstRadius: 70, clickBurstForceScale: 0.0095 },
    motion: { tiltForceScale: 0.00018, shakeThreshold: 25, shakeCooldownMs: 1000, shakeForceScale: 0.08 },
    analytics: { histogramBins: 8, sampleIntervalMs: 250, maxHistoryPoints: 180, energyImpactScale: 40 },
    roastThresholds: [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 500000, 700000, 820000, 900000, 950000, 1000000, 1000500, 1000750, 1000950, 1001000],
    roastColors: ["#d3fc8d", "#e0fc8d", "#fcfc8d", "#ffff61", "#ebcc34", "#ebb134", "#d19b26", "#d68418", "#d9800d", "#ad6103", "#8c4e03", "#995829", "#804f2d", "#6b462b", "#5c3e29", "#453021", "#36271c", "#1f1611", "#0d0a07"],
    startingColors: ["#5cff82", "#67e083", "#5cbd73", "#73bd5c", "#98ed7e", "#b2ed7e", "#c3fa93", "#c7e87b", "#e6fc8d", "#8dfcb0"],
    hud: { panelX: 10, panelWidth: 260, distributionY: 95, panelHeight: 90, curveY: 210 },
    draw: { beanBaseRadius: 12 }
};

const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const spawnButton = document.getElementById("spawnButton");
const debugButton = document.getElementById("debugButton");
const requestPermissionButton = document.getElementById("requestPermissionButton");

const engine = Engine.create({
    gravity: { x: 0, y: CONFIG.physics.gravityY },
    positionIterations: CONFIG.physics.positionIterations,
    velocityIterations: CONFIG.physics.velocityIterations,
    constraintIterations: CONFIG.physics.constraintIterations
});

const state = {
    debugEnabled: false,
    boundaries: [],
    beans: [],
    spawnTimer: null,
    mouse: { active: false, x: 0, y: 0, vx: 0, vy: 0 },
    motion: { accelX: 0, accelY: 0, shakePending: false, lastShakeAt: 0 },
    analytics: { totalEnergy: 0, averageColor: "#000000", consistency: 1, distribution: Array(CONFIG.analytics.histogramBins).fill(0), energyHistory: [], lastSampleTime: 0 },
    lastFrameTime: 0
};

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + ((b - a) * t);
}

function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}

function rgbToHex(r, g, b) {
    const toHex = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darkenHexColor(hex, percent) {
    const rgb = hexToRgb(hex);
    return rgbToHex(rgb.r * (1 - percent / 100), rgb.g * (1 - percent / 100), rgb.b * (1 - percent / 100));
}

function interpolateHexColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

function getRoastProgress(totalForce) {
    const thresholds = CONFIG.roastThresholds;
    const maxIndex = CONFIG.roastColors.length - 1;

    if (totalForce <= thresholds[0]) return (totalForce / thresholds[0]) * (1 / maxIndex);

    for (let i = 1; i < thresholds.length; i += 1) {
        if (totalForce <= thresholds[i]) {
            const localT = (totalForce - thresholds[i - 1]) / (thresholds[i] - thresholds[i - 1]);
            return (i - 1 + localT) / maxIndex;
        }
    }

    return 1;
}

function resizeWorld() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (state.boundaries.length > 0) {
        World.remove(engine.world, state.boundaries);
    }

    const t = CONFIG.physics.wallThickness;
    state.boundaries = [
        Bodies.rectangle(canvas.width / 2, -t / 2, canvas.width, t, { isStatic: true }),
        Bodies.rectangle(canvas.width / 2, canvas.height + t / 2, canvas.width, t, { isStatic: true }),
        Bodies.rectangle(-t / 2, canvas.height / 2, t, canvas.height, { isStatic: true }),
        Bodies.rectangle(canvas.width + t / 2, canvas.height / 2, t, canvas.height, { isStatic: true })
    ];
    World.add(engine.world, state.boundaries);
}

function createBean() {
    const radius = CONFIG.bean.radius;
    const body = Bodies.circle(
        radius + Math.random() * (canvas.width - radius * 2),
        radius + Math.random() * (canvas.height - radius * 2),
        radius,
        { restitution: CONFIG.bean.restitution, friction: CONFIG.bean.friction, frictionAir: CONFIG.bean.frictionAir, density: CONFIG.bean.density }
    );
    Body.setVelocity(body, { x: (Math.random() - 0.5) * CONFIG.bean.initialVelocityX, y: (Math.random() - 0.6) * CONFIG.bean.initialVelocityY });
    World.add(engine.world, body);

    const startColor = CONFIG.startingColors[Math.floor(Math.random() * CONFIG.startingColors.length)];
    state.beans.push({ body, totalForce: 0, colorIndex: 0, color: startColor, darkerColor: darkenHexColor(startColor, 20) });
}

function updateBeanRoast(bean, energyDelta) {
    bean.totalForce += Math.max(0, energyDelta);
    const progress = clamp(getRoastProgress(bean.totalForce), 0, 1);
    const scaled = progress * (CONFIG.roastColors.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(CONFIG.roastColors.length - 1, lower + 1);
    const mix = scaled - lower;

    bean.colorIndex = Math.round(scaled);
    bean.color = interpolateHexColor(CONFIG.roastColors[lower], CONFIG.roastColors[upper], mix);
    bean.darkerColor = darkenHexColor(bean.color, 20);
}

function applyMotionForces() {
    state.beans.forEach((bean) => {
        Body.applyForce(bean.body, bean.body.position, {
            x: -state.motion.accelX * CONFIG.motion.tiltForceScale * bean.body.mass,
            y: state.motion.accelY * CONFIG.motion.tiltForceScale * bean.body.mass
        });
    });

    if (state.motion.shakePending) {
        state.beans.forEach((bean) => {
            Body.applyForce(bean.body, bean.body.position, {
                x: (Math.random() - 0.5) * CONFIG.motion.shakeForceScale * bean.body.mass,
                y: (Math.random() - 0.5) * CONFIG.motion.shakeForceScale * bean.body.mass
            });
        });
        state.motion.shakePending = false;
    }
}

function applyMouseForces() {
    if (!state.mouse.active) return;

    state.beans.forEach((bean) => {
        const dx = bean.body.position.x - state.mouse.x;
        const dy = bean.body.position.y - state.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0.001 || distance > CONFIG.mouse.influenceRadius) return;

        const falloff = 1 - (distance / CONFIG.mouse.influenceRadius);
        const dragSpeed = Math.sqrt((state.mouse.vx * state.mouse.vx) + (state.mouse.vy * state.mouse.vy));
        const dragBoost = Math.min(CONFIG.mouse.maxDragBoost, 1 + (dragSpeed * CONFIG.mouse.dragBoostPerPixel));
        const radialForce = falloff * CONFIG.mouse.forceScale * dragBoost * bean.body.mass;
        Body.applyForce(bean.body, bean.body.position, {
            x: (dx / distance) * radialForce + (state.mouse.vx * CONFIG.mouse.velocityForceScale * bean.body.mass),
            y: (dy / distance) * radialForce + (state.mouse.vy * CONFIG.mouse.velocityForceScale * bean.body.mass)
        });
    });
}

function updateAnalytics(timeStamp) {
    const count = state.beans.length;
    const bins = Array(CONFIG.analytics.histogramBins).fill(0);
    if (count === 0) {
        state.analytics.totalEnergy = 0;
        state.analytics.averageColor = "#000000";
        state.analytics.consistency = 1;
        state.analytics.distribution = bins;
        return;
    }

    let totalEnergy = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let sum = 0;
    let sumSquares = 0;

    state.beans.forEach((bean) => {
        totalEnergy += bean.totalForce;
        const rgb = hexToRgb(bean.color);
        r += rgb.r;
        g += rgb.g;
        b += rgb.b;
        sum += bean.colorIndex;
        sumSquares += bean.colorIndex * bean.colorIndex;
        const bin = Math.min(CONFIG.analytics.histogramBins - 1, Math.floor((bean.colorIndex / Math.max(1, CONFIG.roastColors.length - 1)) * CONFIG.analytics.histogramBins));
        bins[bin] += 1;
    });

    const mean = sum / count;
    const stdDev = Math.sqrt(Math.max(0, (sumSquares / count) - (mean * mean)));

    state.analytics.totalEnergy = totalEnergy;
    state.analytics.averageColor = rgbToHex(r / count, g / count, b / count);
    state.analytics.consistency = Math.max(0, 1 - (stdDev / Math.max(1, CONFIG.roastColors.length - 1)));
    state.analytics.distribution = bins;

    if ((timeStamp - state.analytics.lastSampleTime) >= CONFIG.analytics.sampleIntervalMs) {
        state.analytics.energyHistory.push(totalEnergy);
        state.analytics.lastSampleTime = timeStamp;
        if (state.analytics.energyHistory.length > CONFIG.analytics.maxHistoryPoints) {
            state.analytics.energyHistory.shift();
        }
    }
}

function drawBean(bean) {
    const base = CONFIG.draw.beanBaseRadius;
    ctx.save();
    ctx.translate(bean.body.position.x, bean.body.position.y);
    ctx.rotate(bean.body.angle);
    ctx.scale(bean.body.circleRadius / base, bean.body.circleRadius / base);
    ctx.translate(-base, -base);

    const shapePath = new Path2D("M19.151 4.868a6.744 6.744 0 00-5.96-1.69 12.009 12.009 0 00-6.54 3.47 11.988 11.988 0 00-3.48 6.55 6.744 6.744 0 001.69 5.95 6.406 6.406 0 004.63 1.78 11.511 11.511 0 007.87-3.56C21.3 13.428 22.1 7.818 19.151 4.868Z");
    const detailPath = new Path2D("M19.151,4.868a6.744,6.744,0,0,0-5.96-1.69,12.009,12.009,0,0,0-6.54,3.47,11.988,11.988,0,0,0-3.48,6.55,6.744,6.744,0,0,0,1.69,5.95,6.406,6.406,0,0,0,4.63,1.78,11.511,11.511,0,0,0,7.87-3.56C21.3,13.428,22.1,7.818,19.151,4.868Zm-14.99,8.48a11.041,11.041,0,0,1,3.19-5.99,10.976,10.976,0,0,1,5.99-3.19,8.016,8.016,0,0,1,1.18-.09,5.412,5.412,0,0,1,3.92,1.49.689.689,0,0,1,.11.13,6.542,6.542,0,0,1-2.12,1.23,7.666,7.666,0,0,0-2.96,1.93,7.666,7.666,0,0,0-1.93,2.96,6.589,6.589,0,0,1-1.71,2.63,6.7,6.7,0,0,1-2.63,1.71,7.478,7.478,0,0,0-2.35,1.36A6.18,6.18,0,0,1,4.161,13.348Zm12.49,3.31c-3.55,3.55-8.52,4.35-11.08,1.79a1.538,1.538,0,0,1-.12-.13,6.677,6.677,0,0,1,2.13-1.23,7.862,7.862,0,0,0,2.96-1.93,7.738,7.738,0,0,0,1.93-2.96,6.589,6.589,0,0,1,1.71-2.63,6.589,6.589,0,0,1,2.63-1.71,7.6,7.6,0,0,0,2.34-1.37C20.791,9.2,19.821,13.488,16.651,16.658Z");

    ctx.fillStyle = bean.color;
    ctx.fill(shapePath);
    ctx.strokeStyle = bean.darkerColor;
    ctx.lineWidth = 1;
    ctx.stroke(detailPath);
    if (state.debugEnabled) {
        ctx.beginPath();
        ctx.arc(base, base, base, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,0,0,0.35)";
        ctx.stroke();
    }
    ctx.restore();
}

function drawDistribution(x, y, width, height) {
    const bins = state.analytics.distribution;
    const maxCount = Math.max(1, ...bins);
    const gap = 4;
    const barWidth = (width - ((bins.length - 1) * gap)) / bins.length;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, width, height);

    bins.forEach((count, i) => {
        if (count <= 0) return;
        const barHeight = Math.round((count / maxCount) * (height - 4));
        if (barHeight <= 0) return;
        const startIdx = Math.floor((i / bins.length) * CONFIG.roastColors.length);
        const endIdx = Math.max(startIdx, Math.floor(((i + 1) / bins.length) * CONFIG.roastColors.length) - 1);
        const midIdx = Math.floor((startIdx + endIdx) / 2);
        ctx.fillStyle = CONFIG.roastColors[clamp(midIdx, 0, CONFIG.roastColors.length - 1)];
        ctx.fillRect(x + i * (barWidth + gap), y + height - barHeight, barWidth, barHeight);
    });

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(x, y, width, height);
}

function drawEnergyCurve(x, y, width, height) {
    const history = state.analytics.energyHistory;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(x, y, width, height);
    if (history.length < 2) return;

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = Math.max(1, max - min);
    ctx.beginPath();
    history.forEach((value, index) => {
        const px = x + (index / (history.length - 1)) * width;
        const py = y + height - (((value - min) / range) * (height - 4)) - 2;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#ffad33";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawHud() {
    const x = CONFIG.hud.panelX;
    const width = CONFIG.hud.panelWidth;
    const graphHeight = CONFIG.hud.panelHeight;
    const distributionY = CONFIG.hud.distributionY;
    const curveY = CONFIG.hud.curveY;

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(`Total Objects: ${state.beans.length}`, 10, 20);
    ctx.fillText(`Roast Energy: ${Math.round(state.analytics.totalEnergy)}`, 10, 40);
    ctx.fillText(`Consistency: ${(state.analytics.consistency * 100).toFixed(1)}%`, 10, 60);
    ctx.fillStyle = state.analytics.averageColor;
    ctx.fillRect(10, 70, 24, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.strokeRect(10, 70, 24, 14);
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText(`Avg Colour ${state.analytics.averageColor}`, 40, 81);

    drawDistribution(x, distributionY, width, graphHeight);
    drawEnergyCurve(x, curveY, width, graphHeight);
}

function handleCollisionStart(event) {
    event.pairs.forEach((pair) => {
        const beanA = state.beans.find((bean) => bean.body === pair.bodyA);
        const beanB = state.beans.find((bean) => bean.body === pair.bodyB);
        if (!beanA || !beanB) return;
        const rvx = pair.bodyA.velocity.x - pair.bodyB.velocity.x;
        const rvy = pair.bodyA.velocity.y - pair.bodyB.velocity.y;
        const normal = pair.collision.normal;
        const impact = Math.abs((rvx * normal.x) + (rvy * normal.y));
        const energyDelta = impact * (pair.bodyA.mass + pair.bodyB.mass) * CONFIG.analytics.energyImpactScale;
        updateBeanRoast(beanA, energyDelta * 0.5);
        updateBeanRoast(beanB, energyDelta * 0.5);
    });
}

function startSpawnStream(event) {
    if (event) event.preventDefault();
    if (state.spawnTimer !== null) return;
    createBean();
    state.spawnTimer = window.setInterval(createBean, CONFIG.spawn.intervalMs);
}

function stopSpawnStream() {
    if (state.spawnTimer === null) return;
    window.clearInterval(state.spawnTimer);
    state.spawnTimer = null;
}

function handleMouseDown(event) {
    state.mouse.active = true;
    state.mouse.x = event.clientX;
    state.mouse.y = event.clientY;
    state.mouse.vx = 0;
    state.mouse.vy = 0;

    state.beans.forEach((bean) => {
        const dx = bean.body.position.x - state.mouse.x;
        const dy = bean.body.position.y - state.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0.001 || distance >= CONFIG.mouse.clickBurstRadius) return;
        const burst = (1 - (distance / CONFIG.mouse.clickBurstRadius)) * CONFIG.mouse.clickBurstForceScale * bean.body.mass;
        Body.applyForce(bean.body, bean.body.position, { x: (dx / distance) * burst, y: (dy / distance) * burst });
    });
}

function handleMouseMove(event) {
    state.mouse.vx = event.clientX - state.mouse.x;
    state.mouse.vy = event.clientY - state.mouse.y;
    state.mouse.x = event.clientX;
    state.mouse.y = event.clientY;
}

function handleMouseUp() {
    state.mouse.active = false;
    state.mouse.vx = 0;
    state.mouse.vy = 0;
}

function handleMotion(event) {
    state.motion.accelX = event.accelerationIncludingGravity?.x ?? 0;
    state.motion.accelY = event.accelerationIncludingGravity?.y ?? 0;
    const acceleration = event.acceleration;
    if (!acceleration) return;

    const total = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
    if (total > CONFIG.motion.shakeThreshold && (Date.now() - state.motion.lastShakeAt) > CONFIG.motion.shakeCooldownMs) {
        state.motion.lastShakeAt = Date.now();
        state.motion.shakePending = true;
    }
}

function requestMotionPermission() {
    DeviceMotionEvent.requestPermission()
        .then((response) => {
            if (response !== "granted") return;
            window.addEventListener("devicemotion", handleMotion);
            requestPermissionButton.style.display = "none";
        })
        .catch(console.error);
}

function bootstrapInputs() {
    spawnButton.addEventListener("mousedown", startSpawnStream);
    spawnButton.addEventListener("touchstart", startSpawnStream, { passive: false });
    spawnButton.addEventListener("mouseup", stopSpawnStream);
    spawnButton.addEventListener("mouseleave", stopSpawnStream);
    spawnButton.addEventListener("touchend", stopSpawnStream);
    spawnButton.addEventListener("touchcancel", stopSpawnStream);

    debugButton.addEventListener("click", () => {
        state.debugEnabled = !state.debugEnabled;
        debugButton.textContent = state.debugEnabled ? "Debug: ON" : "Debug: OFF";
    });

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    window.addEventListener("resize", resizeWorld);
    window.addEventListener("orientationchange", () => setTimeout(resizeWorld, 200));

    if (isIOS() && typeof DeviceMotionEvent.requestPermission === "function") {
        requestPermissionButton.style.display = "block";
        requestPermissionButton.addEventListener("click", requestMotionPermission);
    } else {
        window.addEventListener("devicemotion", handleMotion);
    }
}

function gameLoop(timeStamp) {
    const dtMs = Math.min(33.3, timeStamp - (state.lastFrameTime || timeStamp));
    state.lastFrameTime = timeStamp;
    applyMotionForces();
    applyMouseForces();
    Engine.update(engine, dtMs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.beans.forEach(drawBean);
    updateAnalytics(timeStamp);
    drawHud();

    window.requestAnimationFrame(gameLoop);
}

function init() {
    Events.on(engine, "collisionStart", handleCollisionStart);
    resizeWorld();
    bootstrapInputs();
    window.requestAnimationFrame(gameLoop);
}

init();
