import { formatDuration } from "../util/time.js";
import { clamp } from "../util/color.js";
import { BeanRenderer } from "../render/BeanRenderer.js";
import { PaddleRenderer } from "../render/PaddleRenderer.js";
import { GrinderRenderer } from "../render/GrinderRenderer.js";
import { HudChartsRenderer } from "./HudChartsRenderer.js";
import { HudInteractionModel } from "./HudInteractionModel.js";

export class HudView {
    constructor(config, ctx, hudLayout) {
        this.config = config;
        this.ctx = ctx;
        this.hudLayout = hudLayout;
        this.beanRenderer = new BeanRenderer(config, ctx);
        this.paddleRenderer = new PaddleRenderer(config, ctx);
        this.grinderRenderer = new GrinderRenderer(ctx);
        this.chartsRenderer = new HudChartsRenderer(config, ctx);
        this.interactionModel = new HudInteractionModel();
    }

    getButtonRects() {
        return this.interactionModel.getButtonRects();
    }

    drawBean(bean, nowMs = performance.now()) {
        this.beanRenderer.draw(bean, nowMs);
    }

    drawMousePaddle(paddleState) {
        this.paddleRenderer.draw(paddleState);
    }

    drawGrinder(grinderState) {
        this.grinderRenderer.draw(grinderState);
    }

    drawPowderParticles(particles, nowMs) {
        this.grinderRenderer.drawParticles(particles, nowMs);
    }

    draw(metrics, beanCount, canvasWidth, buttons) {
        const ctx = this.ctx;
        const L = this.hudLayout.compute(canvasWidth);
        const compactScale = L.mode === "mobile" ? clamp((L.headerWidth - 40) / 360, 0.82, 1) : 1;
        const titleFont = `bold ${Math.round(14 * compactScale)}px Arial`;
        const bodyFont = `${Math.round(12 * compactScale)}px Arial`;
        const tempFont = `bold ${Math.round(18 * compactScale)}px Arial`;
        const rorFont = `bold ${Math.round(16 * compactScale)}px Arial`;
        const ultraNarrow = L.mode === "mobile" && L.isUltraNarrow;
        this.interactionModel.setButtonRects(L.makeBeanRect, L.grinderRect);

        ctx.fillStyle = metrics.averageColor;
        ctx.fillRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);
        ctx.fillStyle = "rgba(10,14,20,0.56)";
        ctx.fillRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.strokeRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);

        ctx.fillStyle = "#e8edf5";
        ctx.font = titleFont;
        if (L.mode === "mobile") {
            ctx.fillText("Roasting Console", L.leftX, L.topY + 52);
        } else {
            ctx.fillText("Roasting Console", L.leftX, L.topY);
        }

        ctx.fillStyle = "#dbe2ec";
        ctx.font = bodyFont;
        const statsStartY = L.mode === "mobile" ? L.topY + 70 : L.topY;
        ctx.fillText(`Time ${formatDuration(metrics.elapsedRoastMs)}`, L.leftX, statsStartY + 20);
        ctx.fillText(`Beans ${beanCount}`, L.leftX + Math.round(110 * compactScale), statsStartY + 20);
        if (ultraNarrow) {
            ctx.fillText(`Energy ${Math.round(metrics.totalEnergy)}`, L.leftX, statsStartY + 36);
        } else {
            ctx.fillText(`Energy ${Math.round(metrics.totalEnergy)}`, Math.min(L.leftX + Math.round(200 * compactScale), L.controlsLeft - Math.round(100 * compactScale)), statsStartY + 20);
        }

        const metricYOffset = ultraNarrow ? 16 : 0;
        const metricBlockTop = statsStartY + metricYOffset;

        ctx.font = tempFont;
        ctx.fillStyle = "#f2f6ff";
        ctx.fillText(`${metrics.averageTempC.toFixed(1)} C`, L.leftX, metricBlockTop + 44);
        ctx.font = bodyFont;
        ctx.fillStyle = "#cdd7e5";
        ctx.fillText("Batch Temp", L.leftX, metricBlockTop + 59);

        const rorColor = metrics.rorCPerMin >= 0 ? "#ffb347" : "#8dc7ff";
        ctx.fillStyle = rorColor;
        ctx.font = rorFont;
        ctx.fillText(`${metrics.rorCPerMin.toFixed(1)} C/min`, L.leftX + Math.round(130 * compactScale), metricBlockTop + 44);
        ctx.font = bodyFont;
        ctx.fillStyle = "#cdd7e5";
        ctx.fillText("RoR", L.leftX + Math.round(130 * compactScale), metricBlockTop + 59);

        const stageLabelX = Math.min(L.leftX + Math.round(220 * compactScale), L.controlsLeft - Math.round(120 * compactScale));
        ctx.fillStyle = "#e6edf8";
        ctx.fillText(`Stage: ${metrics.dominantStageLabel}`, stageLabelX, metricBlockTop + 44);
        ctx.fillText(`Consistency: ${(metrics.consistency * 100).toFixed(1)}%`, stageLabelX, metricBlockTop + 59);

        ctx.fillStyle = "#dbe2ec";
        ctx.fillText(`Avg Colour ${metrics.averageColor}`, L.leftX, metricBlockTop + 78);

        this.chartsRenderer.drawStageDistribution(metrics, L.leftX, metricBlockTop + 88, L.stageBarWidth, 12, beanCount);
        const stageSummary = this.config.roastStages.map((stage) => `${stage.label.split(" ")[0]} ${metrics.stageCounts[stage.key]}`).join("  ");
        ctx.fillStyle = "#b9c4d5";
        ctx.fillText(stageSummary, L.leftX, metricBlockTop + 114);

        if (L.mode === "mobile") {
            this.chartsRenderer.drawColorDistribution(metrics, L.graphX, metricBlockTop + 126, L.graphWidth, this.config.hud.graphHeight);
            this.chartsRenderer.drawEnergyCurve(metrics, L.graphX, metricBlockTop + 186, L.graphWidth, this.config.hud.graphHeight);
        } else {
            const graphTop = L.mode === "tablet" ? (statsStartY + 74) : (L.topY + 22);
            this.chartsRenderer.drawColorDistribution(metrics, L.graphX, graphTop, L.graphWidth, this.config.hud.graphHeight);
            this.chartsRenderer.drawEnergyCurve(metrics, L.graphX, graphTop + 62, L.graphWidth, this.config.hud.graphHeight);
        }

        this.drawHudButton(L.makeBeanRect, buttons?.makeBean?.label ?? "Make bean", Boolean(buttons?.makeBean?.pressed));
        this.drawHudButton(
            L.grinderRect,
            buttons?.grinder?.label ?? "Start grinder",
            Boolean(buttons?.grinder?.pressed),
            Boolean(buttons?.grinder?.disabled)
        );
    }

    drawHudButton(rect, label, isPressed = false, isDisabled = false) {
        const ctx = this.ctx;
        const buttonScale = clamp(rect.width / 140, 0.84, 1);
        if (isDisabled) {
            ctx.fillStyle = "#505865";
            ctx.strokeStyle = "#6a7382";
        } else {
            ctx.fillStyle = isPressed ? "#a06f24" : "#7b5821";
            ctx.strokeStyle = isPressed ? "#c79343" : "#9a7233";
        }
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = isDisabled ? "#d0d5dd" : "#ffffff";
        ctx.font = `bold ${Math.round(14 * buttonScale)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, rect.x + (rect.width / 2), rect.y + (rect.height / 2));
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
    }

}
