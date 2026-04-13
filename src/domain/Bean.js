import { darkenHexColor, interpolateHexColor } from "../util/color.js";

export class Bean {
    constructor(body, startColor, config) {
        this.body = body;
        this.config = config;
        this.totalForce = 0;
        this.colorIndex = 0;
        this.color = startColor;
        this.darkerColor = darkenHexColor(startColor, 20);
    }

    applyCollisionEnergy(energyDelta, roastModel) {
        this.totalForce += Math.max(0, energyDelta);
        const progress = roastModel.getRoastProgress(this.totalForce);
        const scaled = progress * (this.config.roastColors.length - 1);
        const lower = Math.floor(scaled);
        const upper = Math.min(this.config.roastColors.length - 1, lower + 1);
        const mix = scaled - lower;

        this.colorIndex = Math.round(scaled);
        this.color = interpolateHexColor(this.config.roastColors[lower], this.config.roastColors[upper], mix);
        this.darkerColor = darkenHexColor(this.color, 20);
    }
}
