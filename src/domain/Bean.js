import { clamp, darkenHexColor, interpolateHexColor, lerp } from "../util/color.js";

export class Bean {
    constructor(body, startColor, config) {
        this.body = body;
        this.config = config;
        this.totalForce = 0;
        this.colorIndex = 0;
        this.startColor = startColor;
        this.color = startColor;
        this.darkerColor = darkenHexColor(startColor, 20);
        this.currentScale = 1;
        this.currentDensity = config.bean.density;
        this.baseRestitution = config.bean.restitution;
        this.baseFrictionAir = config.bean.frictionAir;
    }

    applyCollisionEnergy(energyDelta, roastModel) {
        const cappedDelta = clamp(
            Math.max(0, energyDelta),
            0,
            this.config.bean.maxEnergyPerUpdate ?? Number.POSITIVE_INFINITY
        );
        this.totalForce += cappedDelta;
        const progress = roastModel.getRoastProgress(this.totalForce);
        const tempC = roastModel.getTemperatureCFromForce(this.totalForce);
        const dryingStartC = this.config.roastStages[0]?.minC ?? this.config.temperature.ambientC;
        const browningStartC = this.config.temperature.browningStartC ?? 165;
        const charStartC = this.config.temperature.charStartC ?? 255;
        const maxIndex = this.config.roastColors.length - 1;
        const brownStartIndex = clamp(
            this.config.roastColoring?.brownStartIndex ?? Math.floor(maxIndex * 0.35),
            1,
            Math.max(1, maxIndex - 1)
        );
        const charStartIndex = clamp(
            this.config.roastColoring?.charStartIndex ?? Math.max(brownStartIndex + 1, maxIndex - 2),
            brownStartIndex + 1,
            maxIndex
        );

        if (tempC < dryingStartC) {
            this.colorIndex = 0;
            this.color = this.startColor;
            this.darkerColor = darkenHexColor(this.startColor, 20);
        } else {
            let scaled = 0;
            if (tempC < browningStartC) {
                const earlyProgress = clamp((tempC - dryingStartC) / Math.max(1, browningStartC - dryingStartC), 0, 1);
                scaled = earlyProgress * brownStartIndex;
            } else if (tempC < charStartC) {
                const darkProgress = clamp(
                    (tempC - browningStartC) / Math.max(1, charStartC - browningStartC),
                    0,
                    1
                );
                scaled = brownStartIndex + (darkProgress * (charStartIndex - brownStartIndex));
            } else {
                const charProgress = clamp(
                    (tempC - charStartC) / Math.max(1, this.config.temperature.maxRoastC - charStartC),
                    0,
                    1
                );
                scaled = charStartIndex + (charProgress * (maxIndex - charStartIndex));
            }
            const lower = Math.floor(scaled);
            const upper = Math.min(maxIndex, lower + 1);
            const mix = scaled - lower;

            this.colorIndex = Math.round(scaled);
            this.color = interpolateHexColor(this.config.roastColors[lower], this.config.roastColors[upper], mix);
            this.darkerColor = darkenHexColor(this.color, 20);
        }
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
}
