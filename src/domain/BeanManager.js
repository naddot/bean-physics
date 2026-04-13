import { Bean } from "./Bean.js";
import { EnergyTransferService } from "./bean/EnergyTransferService.js";
import { CleanupService } from "./bean/CleanupService.js";
import { CombustionLifecycleService } from "./bean/CombustionLifecycleService.js";

export class BeanManager {
    constructor(config, physicsWorld, roastModel) {
        this.config = config;
        this.physicsWorld = physicsWorld;
        this.roastModel = roastModel;
        this.beans = [];
        this.energyTransferService = new EnergyTransferService(config, roastModel);
        this.cleanupService = new CleanupService(config, physicsWorld);
        this.combustionLifecycleService = new CombustionLifecycleService(config, physicsWorld);
    }

    createBean(canvasWidth, canvasHeight) {
        const body = this.physicsWorld.createBeanBody(canvasWidth, canvasHeight);
        const startColor = this.config.startingColors[Math.floor(Math.random() * this.config.startingColors.length)];
        const bean = new Bean(body, startColor, this.config);
        this.beans.push(bean);
        return bean;
    }

    forEach(callback) {
        this.beans.forEach(callback);
    }

    getAll() {
        return this.beans;
    }

    replaceAll(nextBeans) {
        this.beans = nextBeans;
    }

    findByBody(body) {
        return this.beans.find((bean) => bean.body === body);
    }

    handleCollisionPair(pair) {
        this.energyTransferService.handleCollisionPair(this.beans, pair);
    }

    applyNeighborEnergyTransfer(deltaMs, nowMs = performance.now()) {
        this.energyTransferService.applyNeighborEnergyTransfer(this.beans, deltaMs, nowMs);
    }

    removeInactiveBeans(nowMs = performance.now()) {
        const { survivors, removed } = this.cleanupService.removeInactiveBeans(this.beans, nowMs);
        this.beans = survivors;
        return removed;
    }

    removeBrokenOrStuckBeans(nowMs = performance.now(), canvasWidth, canvasHeight) {
        const { survivors, removed } = this.cleanupService.removeBrokenOrStuckBeans(
            this.beans,
            nowMs,
            canvasWidth,
            canvasHeight
        );
        this.beans = survivors;
        return removed;
    }

    updateCombustionLifecycle(averageTempC, nowMs = performance.now(), deltaMs = 16.7) {
        const { survivors, removed } = this.combustionLifecycleService.update(
            this.beans,
            averageTempC,
            nowMs,
            deltaMs
        );
        this.beans = survivors;
        return removed;
    }

    areAllBeansPastMaillard() {
        if (this.beans.length === 0) return false;
        const maillard = this.config.roastStages.find((stage) => stage.key === "maillard");
        if (!maillard) return false;
        return this.beans.every((bean) => {
            const tempC = this.roastModel.getTemperatureCFromForce(bean.totalForce);
            return tempC >= maillard.maxC;
        });
    }
}
