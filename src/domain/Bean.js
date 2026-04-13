import { clamp, darkenHexColor, lerp } from "../util/color.js";
import { BeanRoastState } from "./bean/BeanRoastState.js";
import { BeanCombustionState } from "./bean/BeanCombustionState.js";

export class Bean {
    constructor(body, startColor, config) {
        this.body = body;
        this.config = config;
        this.totalForce = 0;
        this.colorIndex = 0;
        this.colorPosition = 0;
        this.startColor = startColor;
        this.color = startColor;
        this.darkerColor = darkenHexColor(startColor, 20);
        this.currentScale = 1;
        this.currentDensity = config.bean.density;
        this.baseRestitution = config.bean.restitution;
        this.baseFrictionAir = config.bean.frictionAir;
        const now = performance.now();
        this.lastEnergyChangeAt = now;
        this.lastMeaningfulEnergyChangeAt = now;
        this.lastMovementAt = now;
        this.lastX = body.position.x;
        this.lastY = body.position.y;
        this.hasFirstCrackPopped = false;
        this.isCombusting = false;
        this.combustionStartedAt = 0;
        this.combustionProgress = 0;
        this.combustionScale = 1;
    }

    applyCollisionEnergy(energyDelta, roastModel) {
        const { progress } = BeanRoastState.applyEnergy(this, roastModel, energyDelta);
        this.applyRoastPhysics(progress);
    }

    applyRoastPhysics(progress) {
        const roastPhysics = this.config.bean.roastPhysics;
        if (!roastPhysics?.enabled || !window.Matter?.Body) return;

        const p = clamp(progress, 0, 1);
        const targetScale = lerp(1, roastPhysics.maxExpansionScale, p);
        const targetDensity = lerp(this.config.bean.density, this.config.bean.density * roastPhysics.minDensityFactor, p);
        const targetRestitution = lerp(this.baseRestitution, this.baseRestitution * roastPhysics.minRestitutionFactor, p);
        const targetFrictionAir = lerp(this.baseFrictionAir, this.baseFrictionAir * roastPhysics.maxFrictionAirFactor, p);

        const t = roastPhysics.interpolation;
        const nextScale = lerp(this.currentScale, targetScale, t);
        const nextDensity = lerp(this.currentDensity, targetDensity, t);

        if (Math.abs(nextScale - this.currentScale) >= roastPhysics.minScaleDelta) {
            const ratio = nextScale / this.currentScale;
            window.Matter.Body.scale(this.body, ratio, ratio);
            this.currentScale = nextScale;
        }

        if (Math.abs(nextDensity - this.currentDensity) >= roastPhysics.minDensityDelta) {
            window.Matter.Body.setDensity(this.body, nextDensity);
            this.currentDensity = nextDensity;
        }

        this.body.restitution = targetRestitution;
        this.body.frictionAir = targetFrictionAir;
    }

    ignite(nowMs = performance.now()) {
        BeanCombustionState.ignite(this, nowMs);
    }

    updateCombustion(nowMs = performance.now()) {
        return BeanCombustionState.update(this, nowMs);
    }
}
