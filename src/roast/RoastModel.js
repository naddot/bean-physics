import { clamp } from "../util/color.js";

export class RoastModel {
    constructor(config) {
        this.config = config;
    }

    getRoastProgress(totalForce) {
        const thresholds = this.config.roastThresholds;
        const segmentCount = Math.max(1, thresholds.length - 1);

        if (totalForce <= thresholds[0]) return (totalForce / thresholds[0]) * (1 / segmentCount);

        for (let i = 1; i < thresholds.length; i += 1) {
            if (totalForce <= thresholds[i]) {
                const localT = (totalForce - thresholds[i - 1]) / (thresholds[i] - thresholds[i - 1]);
                return (i - 1 + localT) / segmentCount;
            }
        }

        return 1;
    }

    getTemperatureCFromForce(totalForce) {
        const progress = clamp(this.getRoastProgress(totalForce), 0, 1);
        const curved = Math.pow(progress, this.config.temperature.curveGamma);
        return this.config.temperature.ambientC + (curved * (this.config.temperature.maxRoastC - this.config.temperature.ambientC));
    }

    getRoastStageForTemp(tempC) {
        let previousStage = null;
        for (let i = 0; i < this.config.roastStages.length; i += 1) {
            const stage = this.config.roastStages[i];
            if (tempC >= stage.minC && tempC < stage.maxC) {
                return stage;
            }
            if (tempC >= stage.maxC) {
                previousStage = stage;
            }
        }
        if (tempC < this.config.roastStages[0].minC) {
            return { key: "warmup", label: "Warm-up", minC: this.config.temperature.ambientC, maxC: this.config.roastStages[0].minC };
        }
        if (previousStage) {
            return previousStage;
        }
        return this.config.roastStages[this.config.roastStages.length - 1];
    }
}
