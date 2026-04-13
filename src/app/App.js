import { CONFIG } from "../config/config.js";
import { RoastModel } from "../roast/RoastModel.js";
import { PhysicsWorld } from "../physics/PhysicsWorld.js";
import { BeanManager } from "../domain/BeanManager.js";
import { AnalyticsService } from "../analytics/AnalyticsService.js";
import { HudLayout } from "../ui/HudLayout.js";
import { HudView } from "../ui/HudView.js";
import { InputController } from "../input/InputController.js";
import { SimulationController } from "../core/SimulationController.js";
import { RuntimeChecks } from "../util/runtimeChecks.js";
import { FirstCrackAudio } from "../audio/FirstCrackAudio.js";

export class App {
    constructor() {
        this.canvas = document.getElementById("myCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.requestPermissionButton = document.getElementById("requestPermissionButton");
    }

    start() {
        const roastModel = new RoastModel(CONFIG);
        const physicsWorld = new PhysicsWorld(CONFIG);
        const beanManager = new BeanManager(CONFIG, physicsWorld, roastModel);
        const analyticsService = new AnalyticsService(CONFIG, roastModel);
        const runtimeChecks = new RuntimeChecks(CONFIG, roastModel);
        const hudLayout = new HudLayout(CONFIG);
        const hudView = new HudView(CONFIG, this.ctx, hudLayout);
        const firstCrackAudio = new FirstCrackAudio(CONFIG);

        let sim = null;
        const input = new InputController(this.canvas, this.requestPermissionButton, {
            onPointerDown: (e) => sim.onPointerDown(e),
            onPointerMove: (e) => sim.onPointerMove(e),
            onPointerUp: () => sim.onPointerUp(),
            onResize: () => sim.resizeWorld(),
            onRequestMotionPermission: () => sim.onRequestMotionPermission(),
            onMotion: (event) => sim.onMotion(event)
        });

        sim = new SimulationController(
            CONFIG,
            this.canvas,
            this.ctx,
            physicsWorld,
            beanManager,
            analyticsService,
            hudView,
            input,
            runtimeChecks,
            firstCrackAudio
        );
        sim.init();
    }
}
