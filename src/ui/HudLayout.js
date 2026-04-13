export class HudLayout {
    constructor(config) {
        this.config = config;
    }

    compute(canvasWidth) {
        const { headerX, headerY, headerHeight, margin, controlsReserveWidth, graphHeight, buttonWidth, buttonHeight } = this.config.hud;
        const headerWidth = Math.max(300, canvasWidth - (headerX * 2));
        const leftX = headerX + margin;
        const topY = headerY + 18;
        const isMobile = headerWidth < 700;
        const isTablet = !isMobile && headerWidth < 950;
        const isUltraNarrow = isMobile && headerWidth < 430;

        let graphWidth = Math.min(230, Math.max(150, Math.floor(headerWidth * 0.22)));
        let graphX = headerX + headerWidth - graphWidth - margin;
        let controlsLeft = headerX + headerWidth - controlsReserveWidth;
        let stageBarWidth = Math.max(120, graphX - leftX - 20);
        let resolvedHeaderHeight = headerHeight;

        let makeBeanRect;

        if (isMobile) {
            const compactButtonWidth = Math.max(160, Math.floor(headerWidth - (margin * 2)));
            makeBeanRect = {
                x: leftX,
                y: headerY + 8,
                width: compactButtonWidth,
                height: buttonHeight
            };
            graphX = leftX;
            graphWidth = headerWidth - (margin * 2);
            controlsLeft = leftX;
            stageBarWidth = graphWidth;
            resolvedHeaderHeight = isUltraNarrow ? 314 : 290;
        } else if (isTablet) {
            makeBeanRect = {
                x: headerX + headerWidth - (buttonWidth + margin),
                y: headerY + 8,
                width: buttonWidth,
                height: buttonHeight
            };
            graphX = headerX + headerWidth - graphWidth - margin;
            controlsLeft = makeBeanRect.x - 16;
            stageBarWidth = Math.max(120, controlsLeft - leftX);
            resolvedHeaderHeight = 220;
        } else {
            makeBeanRect = {
                x: graphX - buttonWidth - 18,
                y: headerY + 6,
                width: buttonWidth,
                height: buttonHeight
            };
        }

        return {
            mode: isMobile ? "mobile" : (isTablet ? "tablet" : "desktop"),
            isUltraNarrow,
            headerX,
            headerY,
            headerHeight: resolvedHeaderHeight,
            headerWidth,
            leftX,
            topY,
            graphX,
            graphWidth,
            graphHeight,
            controlsLeft,
            stageBarWidth,
            makeBeanRect
        };
    }
}
