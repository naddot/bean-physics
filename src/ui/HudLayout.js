export class HudLayout {
    constructor(config) {
        this.config = config;
    }

    compute(canvasWidth) {
        const { headerX, headerY, headerHeight, margin, controlsReserveWidth, graphHeight, buttonWidth, buttonHeight, buttonGap } = this.config.hud;
        const headerWidth = Math.max(300, canvasWidth - (headerX * 2));
        const leftX = headerX + margin;
        const topY = headerY + 18;
        const graphWidth = Math.min(230, Math.max(150, Math.floor(headerWidth * 0.22)));
        const graphX = headerX + headerWidth - graphWidth - margin;
        const controlsLeft = headerX + headerWidth - controlsReserveWidth;
        const stageBarWidth = Math.max(120, graphX - leftX - 20);

        const makeBeanRect = {
            x: graphX - buttonWidth - 18,
            y: headerY + 6,
            width: buttonWidth,
            height: buttonHeight
        };
        const debugRect = {
            x: makeBeanRect.x,
            y: makeBeanRect.y + buttonHeight + buttonGap,
            width: buttonWidth,
            height: buttonHeight
        };

        return {
            headerX,
            headerY,
            headerHeight,
            headerWidth,
            leftX,
            topY,
            graphX,
            graphWidth,
            graphHeight,
            controlsLeft,
            stageBarWidth,
            makeBeanRect,
            debugRect
        };
    }
}
