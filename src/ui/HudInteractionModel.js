export class HudInteractionModel {
    constructor() {
        this.buttonRects = { makeBean: null, grinder: null };
    }

    setButtonRects(makeBeanRect, grinderRect) {
        this.buttonRects.makeBean = makeBeanRect;
        this.buttonRects.grinder = grinderRect;
    }

    getButtonRects() {
        return this.buttonRects;
    }
}
