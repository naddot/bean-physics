export class InputController {
    constructor(canvas, requestPermissionButton, options) {
        this.canvas = canvas;
        this.requestPermissionButton = requestPermissionButton;
        this.options = options;
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    bind() {
        this.canvas.addEventListener("mousedown", this.options.onPointerDown);
        this.canvas.addEventListener("mousemove", this.options.onPointerMove);
        this.canvas.addEventListener("mouseup", this.options.onPointerUp);
        this.canvas.addEventListener("mouseleave", this.options.onPointerUp);

        this.canvas.addEventListener("touchstart", (event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            event.preventDefault();
            this.options.onPointerDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
        }, { passive: false });
        this.canvas.addEventListener("touchmove", (event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            event.preventDefault();
            this.options.onPointerMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
        this.canvas.addEventListener("touchend", (event) => {
            event.preventDefault();
            this.options.onPointerUp();
        }, { passive: false });
        this.canvas.addEventListener("touchcancel", this.options.onPointerUp, { passive: true });

        window.addEventListener("resize", this.options.onResize);
        window.addEventListener("orientationchange", () => setTimeout(this.options.onResize, 200));

        if (this.isIOS() && typeof DeviceMotionEvent.requestPermission === "function") {
            this.requestPermissionButton.style.display = "block";
            this.requestPermissionButton.addEventListener("click", this.options.onRequestMotionPermission);
        } else {
            window.addEventListener("devicemotion", this.options.onMotion);
        }
    }

    bindMotionAfterPermission() {
        window.addEventListener("devicemotion", this.options.onMotion);
        this.requestPermissionButton.style.display = "none";
    }
}
