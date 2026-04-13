import { clamp } from "../util/color.js";

export class HudChartsRenderer {
    constructor(config, ctx) {
        this.config = config;
        this.ctx = ctx;
    }

    drawStageDistribution(metrics, x, y, width, height, totalBeans) {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(14,18,24,0.78)";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.strokeRect(x, y, width, height);
        if (totalBeans <= 0) return;

        const stageColors = { drying: "#d9e86a", maillard: "#ebb84a", firstCrack: "#d58a2f", development: "#9f5b2e", secondCrack: "#4b2f23" };
        const presentStages = this.config.roastStages.filter((stage) => (metrics.stageCounts[stage.key] || 0) > 0);
        if (presentStages.length === 0) return;

        let cursorX = Math.round(x);
        const rightEdge = Math.round(x + width);
        presentStages.forEach((stage, index) => {
            const count = metrics.stageCounts[stage.key] || 0;
            let segWidth = Math.round((count / totalBeans) * width);
            if (index === presentStages.length - 1) {
                segWidth = Math.max(0, rightEdge - cursorX);
            }
            if (segWidth <= 0) return;
            ctx.fillStyle = stageColors[stage.key] || "#999999";
            ctx.fillRect(cursorX, Math.round(y), segWidth, Math.round(height));
            cursorX += segWidth;
        });
    }

    drawColorDistribution(metrics, x, y, width, height) {
        const ctx = this.ctx;
        const bins = metrics.distribution;
        const maxCount = Math.max(1, ...bins);
        const gap = 4;
        const visibleBins = bins
            .map((count, i) => ({ count, i }))
            .filter((entry) => entry.count > 0);
        const barWidth = (width - ((bins.length - 1) * gap)) / bins.length;
        ctx.fillStyle = "rgba(14,18,24,0.88)";
        ctx.fillRect(x, y, width, height);
        visibleBins.forEach((entry) => {
            const i = entry.i;
            const count = entry.count;
            const barHeight = Math.round((count / maxCount) * Math.round(height - 4));
            if (barHeight <= 0) return;
            const startIdx = Math.floor((i / bins.length) * this.config.roastColors.length);
            const endIdx = Math.max(startIdx, Math.floor(((i + 1) / bins.length) * this.config.roastColors.length) - 1);
            const midIdx = Math.floor((startIdx + endIdx) / 2);
            const barX = Math.round(x + i * (barWidth + gap));
            const barY = Math.round(y + height - barHeight);
            const drawWidth = Math.max(0, Math.round(barWidth));
            if (drawWidth <= 0) return;
            ctx.fillStyle = metrics.distributionColors?.[i] || this.config.roastColors[clamp(midIdx, 0, this.config.roastColors.length - 1)];
            ctx.fillRect(barX, barY, drawWidth, barHeight);
        });
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(x, y, width, height);
    }

    drawEnergyCurve(metrics, x, y, width, height) {
        const ctx = this.ctx;
        const history = metrics.energyHistory;
        ctx.fillStyle = "rgba(14,18,24,0.88)";
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
}
