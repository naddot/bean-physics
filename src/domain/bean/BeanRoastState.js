import { clamp, darkenHexColor, interpolateHexColor } from "../../util/color.js";

export class BeanRoastState {
    static applyEnergy(bean, roastModel, energyDelta) {
        const cappedDelta = clamp(
            Math.max(0, energyDelta),
            0,
            bean.config.bean.maxEnergyPerUpdate ?? Number.POSITIVE_INFINITY
        );
        bean.totalForce += cappedDelta;
        if (cappedDelta > 0) {
            const now = performance.now();
            bean.lastEnergyChangeAt = now;
            if (cappedDelta >= (bean.config.bean.inactivityRemoval?.minMeaningfulDelta ?? 30)) {
                bean.lastMeaningfulEnergyChangeAt = now;
            }
        }
        const progress = roastModel.getRoastProgress(bean.totalForce);
        const tempC = roastModel.getTemperatureCFromForce(bean.totalForce);
        const dryingStartC = bean.config.roastStages[0]?.minC ?? bean.config.temperature.ambientC;
        const browningStartC = bean.config.temperature.browningStartC ?? 165;
        const charStartC = bean.config.temperature.charStartC ?? 255;
        const maxIndex = bean.config.roastColors.length - 1;
        const brownStartIndex = clamp(
            bean.config.roastColoring?.brownStartIndex ?? Math.floor(maxIndex * 0.35),
            1,
            Math.max(1, maxIndex - 1)
        );
        const charStartIndex = clamp(
            bean.config.roastColoring?.charStartIndex ?? Math.max(brownStartIndex + 1, maxIndex - 2),
            brownStartIndex + 1,
            maxIndex
        );

        if (tempC < dryingStartC) {
            bean.colorIndex = 0;
            bean.color = bean.startColor;
            bean.darkerColor = darkenHexColor(bean.startColor, 20);
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
                    (tempC - charStartC) / Math.max(1, bean.config.temperature.maxRoastC - charStartC),
                    0,
                    1
                );
                scaled = charStartIndex + (charProgress * (maxIndex - charStartIndex));
            }
            const lower = Math.floor(scaled);
            const upper = Math.min(maxIndex, lower + 1);
            const mix = scaled - lower;

            bean.colorIndex = Math.round(scaled);
            bean.colorPosition = scaled;
            bean.color = interpolateHexColor(bean.config.roastColors[lower], bean.config.roastColors[upper], mix);
            bean.darkerColor = darkenHexColor(bean.color, 20);
        }

        return { progress };
    }
}
