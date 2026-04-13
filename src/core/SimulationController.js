export class SimulationController {
    constructor(config, canvas, ctx, physicsWorld, beanManager, analyticsService, hudView, inputController, runtimeChecks) {
        this.config = config;
        this.canvas = canvas;
        this.ctx = ctx;
        this.physicsWorld = physicsWorld;
        this.beanManager = beanManager;
        this.analyticsService = analyticsService;
        this.hudView = hudView;
        this.inputController = inputController;
        this.runtimeChecks = runtimeChecks;
        this.state = {
            spawnTimer: null,
            spawnStartedAt: 0,
            mouse: { active: false, x: 0, y: 0, vx: 0, vy: 0 },
            paddle: { active: false, x: 0, y: 0, radius: 0, angle: 0, startedAt: 0, lastUpdatedAt: 0 },
            motion: {
                accelX: 0,
                accelY: 0,
                tiltX: 0,
                tiltY: 1,
                tiltStrength: 1,
                gravityMagnitude: 0,
                tiltRateX: 0,
                tiltRateY: 0,
                lastTiltX: 0,
                lastTiltY: 1,
                lastMotionAt: 0,
                shakePending: false,
                lastShakeAt: 0
            },
            activeHudButton: null,
            lastFrameTime: 0
        };
        this.isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    init() {
        this.runtimeChecks?.runRoastModelChecks();
        this.physicsWorld.onCollisionStart((event) => {
            event.pairs.forEach((pair) => this.beanManager.handleCollisionPair(pair));
        });
        this.resizeWorld();
        this.inputController.bind();
        window.requestAnimationFrame((ts) => this.loop(ts));
    }

    resizeWorld = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.physicsWorld.resizeBounds(this.canvas.width, this.canvas.height);
    };

    startSpawnStream = (event) => {
        if (event && event.preventDefault) event.preventDefault();
        if (this.state.spawnTimer !== null) return;
        this.beanManager.createBean(this.canvas.width, this.canvas.height);
        this.state.spawnStartedAt = performance.now();
        this.scheduleNextSpawnTick();
    };

    stopSpawnStream = () => {
        if (this.state.spawnTimer === null) return;
        window.clearTimeout(this.state.spawnTimer);
        this.state.spawnTimer = null;
        this.state.spawnStartedAt = 0;
    };

    scheduleNextSpawnTick = () => {
        const elapsedSec = Math.max(0, (performance.now() - this.state.spawnStartedAt) / 1000);
        const acceleration = this.config.spawn.accelerationPerSecond ?? 0;
        const minInterval = this.config.spawn.minIntervalMs ?? this.config.spawn.intervalMs;
        const nextInterval = Math.max(
            minInterval,
            this.config.spawn.intervalMs - (elapsedSec * acceleration)
        );
        this.state.spawnTimer = window.setTimeout(() => {
            this.beanManager.createBean(this.canvas.width, this.canvas.height);
            if (this.state.activeHudButton === "makeBean") {
                this.scheduleNextSpawnTick();
            } else {
                this.state.spawnTimer = null;
            }
        }, nextInterval);
    };

    isPointInRect(x, y, rect) {
        return rect && x >= rect.x && x <= (rect.x + rect.width) && y >= rect.y && y <= (rect.y + rect.height);
    }

    spawnMousePaddle(x, y, nowMs) {
        if (!this.config.mouse.paddle?.enabled) return;
        this.state.paddle.active = true;
        this.state.paddle.x = x;
        this.state.paddle.y = y;
        this.state.paddle.radius = this.config.mouse.paddle.startRadius;
        this.state.paddle.angle = 0;
        this.state.paddle.startedAt = nowMs;
        this.state.paddle.lastUpdatedAt = nowMs;
    }

    normalizeAngle(angle) {
        let out = angle;
        while (out > Math.PI) out -= Math.PI * 2;
        while (out < -Math.PI) out += Math.PI * 2;
        return out;
    }

    updateMousePaddle(timeStamp) {
        const paddleCfg = this.config.mouse.paddle;
        if (!paddleCfg?.enabled || !this.state.paddle.active) return;
        const elapsed = timeStamp - this.state.paddle.startedAt;
        const dtSec = Math.max(0.001, (timeStamp - this.state.paddle.lastUpdatedAt) / 1000);
        const expandT = Math.min(1, elapsed / paddleCfg.expandMs);
        this.state.paddle.radius = paddleCfg.startRadius + ((paddleCfg.maxRadius - paddleCfg.startRadius) * expandT);
        this.state.paddle.angle += paddleCfg.angularSpeedRadPerSec * dtSec;
        this.state.paddle.lastUpdatedAt = timeStamp;

        const bladeArcHalf = paddleCfg.bladeArcWidthRad / 2;
        this.beanManager.forEach((bean) => {
            const dx = bean.body.position.x - this.state.paddle.x;
            const dy = bean.body.position.y - this.state.paddle.y;
            const distance = Math.sqrt((dx * dx) + (dy * dy));
            if (distance <= 0.001 || distance > this.state.paddle.radius + paddleCfg.bladeThickness) return;

            const radialX = dx / distance;
            const radialY = dy / distance;
            const beanAngle = Math.atan2(dy, dx);
            const normalizedDistance = Math.min(1, distance / Math.max(1, this.state.paddle.radius));
            const distanceFalloff = 1 - (0.35 * normalizedDistance);
            const mass = bean.body.mass;

            for (let i = 0; i < paddleCfg.bladeCount; i += 1) {
                const bladeAngle = this.state.paddle.angle + ((Math.PI * 2 * i) / paddleCfg.bladeCount);
                const diff = Math.abs(this.normalizeAngle(beanAngle - bladeAngle));
                if (diff > bladeArcHalf) continue;

                const alignment = 1 - (diff / bladeArcHalf);
                const tangentialX = -radialY;
                const tangentialY = radialX;
                const tangentialForce = paddleCfg.tangentialForceScale * alignment * distanceFalloff * mass;
                const radialForce = paddleCfg.radialForceScale * alignment * distanceFalloff * mass;
                window.Matter.Body.applyForce(bean.body, bean.body.position, {
                    x: (tangentialX * tangentialForce) + (radialX * radialForce),
                    y: (tangentialY * tangentialForce) + (radialY * radialForce)
                });

                // Mass-dominant paddle behavior: scoop and throw beans along blade travel.
                const throwSpeed =
                    paddleCfg.scoopVelocityBase +
                    (alignment * paddleCfg.scoopVelocityBoost * distanceFalloff);
                const targetVX = (tangentialX * throwSpeed) + (radialX * (throwSpeed * 0.55));
                const targetVY = (tangentialY * throwSpeed) + (radialY * (throwSpeed * 0.55));
                const blendedVX = (bean.body.velocity.x * 0.2) + (targetVX * 0.8);
                const blendedVY = (bean.body.velocity.y * 0.2) + (targetVY * 0.8);
                const speed = Math.sqrt((blendedVX * blendedVX) + (blendedVY * blendedVY));
                const cap = Math.max(1, paddleCfg.maxBeanSpeed);
                if (speed > cap) {
                    const n = cap / speed;
                    window.Matter.Body.setVelocity(bean.body, { x: blendedVX * n, y: blendedVY * n });
                } else {
                    window.Matter.Body.setVelocity(bean.body, { x: blendedVX, y: blendedVY });
                }
                break;
            }
        });
    }

    onPointerDown = (event) => {
        const clickX = event.clientX;
        const clickY = event.clientY;
        const { makeBean } = this.hudView.getButtonRects();

        if (this.isPointInRect(clickX, clickY, makeBean)) {
            this.state.activeHudButton = "makeBean";
            this.startSpawnStream(event);
            return;
        }

        this.state.mouse.active = true;
        this.state.mouse.x = clickX;
        this.state.mouse.y = clickY;
        this.state.mouse.vx = 0;
        this.state.mouse.vy = 0;
        this.spawnMousePaddle(clickX, clickY, performance.now());
    };

    onPointerMove = (event) => {
        this.state.mouse.vx = event.clientX - this.state.mouse.x;
        this.state.mouse.vy = event.clientY - this.state.mouse.y;
        this.state.mouse.x = event.clientX;
        this.state.mouse.y = event.clientY;
        if (this.state.paddle.active) {
            this.state.paddle.x = event.clientX;
            this.state.paddle.y = event.clientY;
        }
    };

    onPointerUp = () => {
        if (this.state.activeHudButton === "makeBean") {
            this.stopSpawnStream();
        }
        this.state.activeHudButton = null;
        this.state.mouse.active = false;
        this.state.mouse.vx = 0;
        this.state.mouse.vy = 0;
        this.state.paddle.active = false;
    };

    onMotion = (event) => {
        const now = performance.now();
        const rawAX = event.accelerationIncludingGravity?.x ?? 0;
        const rawAY = event.accelerationIncludingGravity?.y ?? 0;
        const az = event.accelerationIncludingGravity?.z ?? 0;
        const accelSmooth = this.config.motion.accelSmoothing ?? 0.85;
        const ax = (this.state.motion.accelX * accelSmooth) + (rawAX * (1 - accelSmooth));
        const ay = (this.state.motion.accelY * accelSmooth) + (rawAY * (1 - accelSmooth));
        this.state.motion.accelX = ax;
        this.state.motion.accelY = ay;

        const planar = Math.sqrt((ax * ax) + (ay * ay));
        const total = Math.max(0.001, Math.sqrt((ax * ax) + (ay * ay) + (az * az)));
        const tiltRatio = Math.min(1, planar / total);
        const directionalX = planar > 0.001 ? (-ax / planar) : 0;
        const directionalY = planar > 0.001 ? (ay / planar) : 1;

        this.state.motion.tiltX = directionalX;
        this.state.motion.tiltY = directionalY;
        const targetTiltStrength = Math.pow(tiltRatio, this.config.motion.uprightBoostExponent);
        const tiltStrengthSmooth = this.config.motion.tiltStrengthSmoothing ?? 0.82;
        this.state.motion.tiltStrength =
            (this.state.motion.tiltStrength * tiltStrengthSmooth) +
            (targetTiltStrength * (1 - tiltStrengthSmooth));

        const dtSec = this.state.motion.lastMotionAt > 0 ? Math.max(0.001, (now - this.state.motion.lastMotionAt) / 1000) : 0.016;
        const rawTiltRateX = (directionalX - this.state.motion.lastTiltX) / dtSec;
        const rawTiltRateY = (directionalY - this.state.motion.lastTiltY) / dtSec;
        const smooth = this.config.motion.tiltRateSmoothing;
        this.state.motion.tiltRateX = (this.state.motion.tiltRateX * smooth) + (rawTiltRateX * (1 - smooth));
        this.state.motion.tiltRateY = (this.state.motion.tiltRateY * smooth) + (rawTiltRateY * (1 - smooth));
        this.state.motion.lastTiltX = directionalX;
        this.state.motion.lastTiltY = directionalY;
        this.state.motion.lastMotionAt = now;

        const acceleration = event.acceleration;
        if (!acceleration) return;
        const shakeTotal = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
        if (shakeTotal > this.config.motion.shakeThreshold && (Date.now() - this.state.motion.lastShakeAt) > this.config.motion.shakeCooldownMs) {
            this.state.motion.lastShakeAt = Date.now();
            this.state.motion.shakePending = true;
        }
    };

    onRequestMotionPermission = () => {
        DeviceMotionEvent.requestPermission()
            .then((response) => {
                if (response !== "granted") return;
                this.inputController.bindMotionAfterPermission();
            })
            .catch(console.error);
    };

    applyMotionForces() {
        if (!this.isMobileDevice) {
            this.physicsWorld.setGravityVector(0, this.config.physics.gravityY);
            return;
        }

        const gravityMagnitude =
            this.config.motion.gravityWhenFlat +
            ((this.config.motion.gravityWhenUpright - this.config.motion.gravityWhenFlat) * this.state.motion.tiltStrength);
        const gravitySmooth = this.config.motion.gravitySmoothing ?? 0.88;
        this.state.motion.gravityMagnitude =
            (this.state.motion.gravityMagnitude * gravitySmooth) +
            (gravityMagnitude * (1 - gravitySmooth));
        this.physicsWorld.setGravityVector(
            this.state.motion.tiltX * this.state.motion.gravityMagnitude,
            this.state.motion.tiltY * this.state.motion.gravityMagnitude
        );

        const forceScale = this.config.motion.tiltForceScale * (0.4 + (this.state.motion.tiltStrength * 2.0));
        const rateScale = this.config.motion.tiltRateForceScale * (0.25 + (this.state.motion.tiltStrength * 1.75));
        this.beanManager.forEach((bean) => {
            window.Matter.Body.applyForce(bean.body, bean.body.position, {
                x: (-this.state.motion.accelX * forceScale * bean.body.mass) + (this.state.motion.tiltRateX * rateScale * bean.body.mass),
                y: (this.state.motion.accelY * forceScale * bean.body.mass) + (this.state.motion.tiltRateY * rateScale * bean.body.mass)
            });
        });

        if (this.state.motion.shakePending) {
            this.beanManager.forEach((bean) => {
                window.Matter.Body.applyForce(bean.body, bean.body.position, {
                    x: (Math.random() - 0.5) * this.config.motion.shakeForceScale * bean.body.mass,
                    y: (Math.random() - 0.5) * this.config.motion.shakeForceScale * bean.body.mass
                });
            });
            this.state.motion.shakePending = false;
        }
    }

    applyMouseForces() {
        if (!this.state.mouse.active) return;
        this.beanManager.forEach((bean) => {
            const dx = bean.body.position.x - this.state.mouse.x;
            const dy = bean.body.position.y - this.state.mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0.001 || distance > this.config.mouse.influenceRadius) return;
            const falloff = 1 - (distance / this.config.mouse.influenceRadius);
            const dragSpeed = Math.sqrt((this.state.mouse.vx ** 2) + (this.state.mouse.vy ** 2));
            const dragBoost = Math.min(this.config.mouse.maxDragBoost, 1 + (dragSpeed * this.config.mouse.dragBoostPerPixel));
            const radialForce = falloff * this.config.mouse.forceScale * dragBoost * bean.body.mass;
            window.Matter.Body.applyForce(bean.body, bean.body.position, {
                x: (dx / distance) * radialForce + (this.state.mouse.vx * this.config.mouse.velocityForceScale * bean.body.mass),
                y: (dy / distance) * radialForce + (this.state.mouse.vy * this.config.mouse.velocityForceScale * bean.body.mass)
            });
        });
    }

    loop(timeStamp) {
        const dtMs = Math.min(33.3, timeStamp - (this.state.lastFrameTime || timeStamp));
        this.state.lastFrameTime = timeStamp;
        this.applyMotionForces();
        this.updateMousePaddle(timeStamp);
        this.applyMouseForces();
        this.physicsWorld.update(dtMs);
        this.beanManager.applyNeighborEnergyTransfer(dtMs);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.beanManager.forEach((bean) => this.hudView.drawBean(bean));
        this.hudView.drawMousePaddle(this.state.paddle);
        this.analyticsService.update(this.beanManager.getAll(), timeStamp);
        this.runtimeChecks?.runAnalyticsChecks(this.analyticsService.getMetrics(), this.beanManager.getAll().length);
        this.hudView.draw(
            this.analyticsService.getMetrics(),
            this.beanManager.getAll().length,
            this.canvas.width,
            this.state.activeHudButton === "makeBean"
        );

        window.requestAnimationFrame((ts) => this.loop(ts));
    }
}
