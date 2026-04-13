import { MotionForceSystem } from "./forces/MotionForceSystem.js";
import { MouseForceSystem } from "./forces/MouseForceSystem.js";
import { PaddleForceSystem } from "./forces/PaddleForceSystem.js";
import { SpawnStreamController } from "./simulation/SpawnStreamController.js";
import { FirstCrackPopTrigger } from "./audio/FirstCrackPopTrigger.js";
import { GrinderSystem } from "./grinder/GrinderSystem.js";

export class SimulationController {
    constructor(config, canvas, ctx, physicsWorld, beanManager, analyticsService, hudView, inputController, runtimeChecks, firstCrackAudio) {
        this.config = config;
        this.canvas = canvas;
        this.ctx = ctx;
        this.physicsWorld = physicsWorld;
        this.beanManager = beanManager;
        this.analyticsService = analyticsService;
        this.hudView = hudView;
        this.inputController = inputController;
        this.runtimeChecks = runtimeChecks;
        this.firstCrackAudio = firstCrackAudio;
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
            lastFrameTime: 0,
            grinderPlacementArmed: false
        };
        this.isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.motionForceSystem = new MotionForceSystem(config, physicsWorld, beanManager, this.isMobileDevice);
        this.mouseForceSystem = new MouseForceSystem(config, beanManager);
        this.paddleForceSystem = new PaddleForceSystem(config, beanManager);
        this.spawnStreamController = new SpawnStreamController(
            config,
            beanManager,
            () => ({ width: this.canvas.width, height: this.canvas.height }),
            () => this.state.activeHudButton === "makeBean"
        );
        this.firstCrackPopTrigger = new FirstCrackPopTrigger();
        this.grinderSystem = new GrinderSystem(config, beanManager, physicsWorld);
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
        this.spawnStreamController.start(this.state, event);
    };

    stopSpawnStream = () => {
        this.spawnStreamController.stop(this.state);
    };

    scheduleNextSpawnTick = () => {
        this.spawnStreamController.schedule(this.state);
    };

    isPointInRect(x, y, rect) {
        return rect && x >= rect.x && x <= (rect.x + rect.width) && y >= rect.y && y <= (rect.y + rect.height);
    }

    spawnMousePaddle(x, y, nowMs) {
        this.paddleForceSystem.spawn(this.state, x, y, nowMs);
    }

    normalizeAngle(angle) {
        return this.paddleForceSystem.normalizeAngle(angle);
    }

    updateMousePaddle(timeStamp) {
        this.paddleForceSystem.update(this.state, timeStamp);
    }

    onPointerDown = (event) => {
        this.firstCrackAudio?.prime();
        const clickX = event.clientX;
        const clickY = event.clientY;
        const { makeBean, grinder } = this.hudView.getButtonRects();
        const canStartGrinder = this.beanManager.areAllBeansPastMaillard();

        if (this.isPointInRect(clickX, clickY, makeBean)) {
            this.state.activeHudButton = "makeBean";
            this.startSpawnStream(event);
            return;
        }
        if (this.isPointInRect(clickX, clickY, grinder)) {
            if (canStartGrinder) {
                this.state.activeHudButton = "startGrinder";
                this.state.grinderPlacementArmed = true;
            }
            return;
        }
        if (this.state.grinderPlacementArmed) {
            this.grinderSystem.startAt(clickX, clickY);
            this.state.grinderPlacementArmed = false;
            return;
        }
        if (this.grinderSystem.isStarted()) {
            this.grinderSystem.setPressing(true);
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
        if (this.grinderSystem.isStarted()) {
            this.grinderSystem.setCenter(event.clientX, event.clientY);
        }
        if (this.state.paddle.active) {
            this.state.paddle.x = event.clientX;
            this.state.paddle.y = event.clientY;
        }
    };

    onPointerUp = () => {
        if (this.grinderSystem.isStarted()) {
            this.grinderSystem.setPressing(false);
        }
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
        this.motionForceSystem.onMotion(this.state, event);
    };

    onRequestMotionPermission = () => {
        this.firstCrackAudio?.prime();
        DeviceMotionEvent.requestPermission()
            .then((response) => {
                if (response !== "granted") return;
                this.inputController.bindMotionAfterPermission();
            })
            .catch(console.error);
    };

    triggerFirstCrackPops(nowMs) {
        this.firstCrackPopTrigger.trigger(this.beanManager, this.firstCrackAudio, nowMs);
    }

    applyMotionForces() {
        this.motionForceSystem.apply(this.state);
    }

    applyMouseForces() {
        this.mouseForceSystem.apply(this.state);
    }

    loop(timeStamp) {
        const dtMs = Math.min(33.3, timeStamp - (this.state.lastFrameTime || timeStamp));
        this.state.lastFrameTime = timeStamp;
        this.applyMotionForces();
        this.updateMousePaddle(timeStamp);
        this.applyMouseForces();
        this.physicsWorld.update(dtMs);
        this.beanManager.applyNeighborEnergyTransfer(dtMs, timeStamp);
        this.triggerFirstCrackPops(timeStamp);
        this.grinderSystem.update(dtMs, timeStamp, this.canvas.width, this.canvas.height);
        this.beanManager.removeInactiveBeans(timeStamp);
        this.beanManager.removeBrokenOrStuckBeans(timeStamp, this.canvas.width, this.canvas.height);
        this.analyticsService.update(this.beanManager.getAll(), timeStamp);
        const metrics = this.analyticsService.getMetrics();
        const removedByCombustion = this.beanManager.updateCombustionLifecycle(metrics.averageTempC, timeStamp, dtMs);
        if (removedByCombustion > 0) {
            this.analyticsService.update(this.beanManager.getAll(), timeStamp);
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.beanManager.forEach((bean) => this.hudView.drawBean(bean, timeStamp));
        this.hudView.drawMousePaddle(this.state.paddle);
        this.hudView.drawGrinder(this.grinderSystem.getRenderState());
        this.hudView.drawPowderParticles(this.grinderSystem.getParticles(), timeStamp);
        this.runtimeChecks?.runAnalyticsChecks(this.analyticsService.getMetrics(), this.beanManager.getAll().length);
        const canStartGrinder = this.beanManager.areAllBeansPastMaillard();
        this.hudView.draw(
            this.analyticsService.getMetrics(),
            this.beanManager.getAll().length,
            this.canvas.width,
            {
                makeBean: {
                    label: "Make bean",
                    pressed: this.state.activeHudButton === "makeBean"
                },
                grinder: {
                    label: "Start grinder",
                    pressed: this.state.activeHudButton === "startGrinder",
                    disabled: !canStartGrinder
                }
            }
        );

        window.requestAnimationFrame((ts) => this.loop(ts));
    }
}
