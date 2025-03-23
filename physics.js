const GameState = {
    secondsPassed: 0,
    oldTimeStamp: 0,
    gameObjects: [],
    debug: {
        enabled: false,
        showHitboxes: true,
        showVelocityVectors: true,
        showForceValues: true
    }
};

// Constants and input-related state variables
const g = 9.81 * 10;
const minSeparation = 2; // Fine-tuned minimum distance to prevent sticking


const mouse = {
    type: "mouse",
    x: 0,
    y: 0,
    vx: 1,
    vy: 1,
    mass: 707,
    radius: 50,
    active: false
};

const motion = {
    accelX: 0,
    accelY: 0,
    accelZ: 0,
    lastAccelX: 0,
    lastAccelY: 0,
    lastAccelZ: 0,
    smoothingFactor: 0.8,
    shakeThreshold: 25,
    shakeCooldown: 1000,
    lastShakeTime: 0,
    shakePending: false
};


const restitution = 0.80;

// Canvas setup
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const CanvasManager = {
    resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
};

const MotionManager = {
    handleMotion(event) {
        console.log("handleMotion fired"); // ✅ DEBUG LINE
        if (event.accelerationIncludingGravity) {
            let { x: rawX, y: rawY, z: rawZ } = event.accelerationIncludingGravity;
            console.log(`rawX: ${rawX}, rawY: ${rawY}`); // ✅ DEBUG LINE
            
            // Apply adaptive smoothing - less smoothing for rapid changes, more for subtle ones
            const adaptiveSmoothingX = Math.min(0.9, Math.max(0.5, motion.smoothingFactor - Math.abs(rawX - motion.lastAccelX) * 0.05));
            const adaptiveSmoothingY = Math.min(0.9, Math.max(0.5, motion.smoothingFactor - Math.abs(rawY - motion.lastAccelY) * 0.05));
            
            motion.accelX = adaptiveSmoothingX * motion.lastAccelX + (1 - adaptiveSmoothingX) * rawX;
            motion.accelY = adaptiveSmoothingY * motion.lastAccelY + (1 - adaptiveSmoothingY) * rawY;
            motion.accelZ = motion.smoothingFactor * motion.lastAccelZ + (1 - motion.smoothingFactor) * rawZ;
            
            motion.lastAccelX = motion.accelX;
            motion.lastAccelY = motion.accelY;
            motion.lastAccelZ = motion.accelZ;
            
            if (GameState.debug.enabled) {
                console.log(`Raw accel: X=${rawX.toFixed(2)}, Y=${rawY.toFixed(2)}, Z=${rawZ.toFixed(2)}`);
                console.log(`Smoothed accel: X=${motion.accelX.toFixed(2)}, Y=${motion.accelY.toFixed(2)}, Z=${motion.accelZ.toFixed(2)}`);
            }
        }
    },

    detectShake(event) {
        if (!event.acceleration) return;
        let accX = event.acceleration.x;
        let accY = event.acceleration.y;
        let accZ = event.acceleration.z;
        let deltaX = Math.abs(accX - motion.lastAccelX);
        let deltaY = Math.abs(accY - motion.lastAccelY);
        let deltaZ = Math.abs(accZ - motion.lastAccelZ);
        let totalChange = deltaX + deltaY + deltaZ;
    
        if (totalChange > motion.shakeThreshold && Date.now() - motion.lastShakeTime > motion.shakeCooldown) {
            motion.lastShakeTime = Date.now();
            motion.shakePending = true; // <-- trigger shake in loop
        }
    
        motion.lastAccelX = accX;
        motion.lastAccelY = accY;
        motion.lastAccelZ = accZ;
    },
    
    applyMotionToBeans() {
        // ✅ Inject fake motion when debug mode is on
        if (GameState.debug.enabled) {
            motion.accelX = Math.sin(Date.now() / 1000) * 0.5;
            motion.accelY = Math.cos(Date.now() / 1000) * 0.5;
        }
        console.log(`Tilt applied: accelX=${motion.accelX}, accelY=${motion.accelY}`); // ✅ DEBUG
        const ios = isIOS();
        const tiltFactor = 30.0; // Increased tilt sensitivity
        const maxTiltForce = 15; // Maximum force applied by tilting
        const massScaling = true; // Whether to scale tilt effect by mass
        
        GameState.gameObjects.forEach(obj => {
            if (obj instanceof Circle) {
                // Calculate tilt force with mass consideration
                let tiltForceX = (ios ? -motion.accelX : motion.accelX) * tiltFactor;
                let tiltForceY = (ios ? -motion.accelY : motion.accelY) * tiltFactor;
                
                // Apply mass scaling if enabled (heavier objects respond less to tilt)
                if (massScaling) {
                    const massEffect = Math.max(0.5, Math.min(1.5, 1000 / obj.mass));
                    tiltForceX *= massEffect;
                    tiltForceY *= massEffect;
                }
                
                // Limit maximum tilt force
                tiltForceX = Math.max(-maxTiltForce, Math.min(maxTiltForce, tiltForceX));
                tiltForceY = Math.max(-maxTiltForce, Math.min(maxTiltForce, tiltForceY));
                
                // Apply forces with realistic acceleration
                obj.vx += tiltForceX * GameState.secondsPassed;
                obj.vy += tiltForceY * GameState.secondsPassed;
                console.log(`Bean ${obj.id || ''} vx=${obj.vx}, vy=${obj.vy}`); // ✅ DEBUG LINE

                
                // Apply air resistance (more for faster objects)
                const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
                const airResistance = 0.01 + (speed * 0.001); // Progressive air resistance
                
                if (speed > 0.1) {
                    obj.vx *= (1 - airResistance * GameState.secondsPassed);
                    obj.vy *= (1 - airResistance * GameState.secondsPassed);
                }
            }
        });
    }
};

function applyShakeEffect() {
    GameState.gameObjects.forEach(obj => {
        if (obj instanceof Circle) {
            obj.vx += (Math.random() - 0.75) * 400;
            obj.vy += (Math.random() - 0.75) * 400;
        }
    });
    console.log("Shake detected! Beans shaken!");
}

// Motion permission for iOS
function requestMotionPermission() {
    DeviceMotionEvent.requestPermission().then(response => {
        if (response === "granted") {
            console.log("Motion permission granted");
            window.addEventListener("devicemotion", MotionManager.handleMotion);
            window.addEventListener("devicemotion", MotionManager.detectShake);
            document.getElementById('requestPermissionButton').style.display = 'none';
        } else {
            console.log("Permission not granted:", response);
        }
    }).catch(console.error);
}


function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function darkenHexColor(hex, percent) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.max(0, r - (r * percent / 100));
    g = Math.max(0, g - (g * percent / 100));
    b = Math.max(0, b - (b * percent / 100));

    let newHex = '#' + 
                ('0' + Math.round(r).toString(16)).slice(-2) + 
                ('0' + Math.round(g).toString(16)).slice(-2) + 
                ('0' + Math.round(b).toString(16)).slice(-2);

    return newHex;
}

function bindEventListeners() {
    window.addEventListener("resize", CanvasManager.resize);
    window.addEventListener("orientationchange", () => {
        setTimeout(() => {
            CanvasManager.resize();
        }, 300);
    });
    canvas.addEventListener("mousedown", e => {
        mouse.active = true;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.vx = 0;
        mouse.vy = 0;
    });
    canvas.addEventListener("mouseup", () => {
        mouse.active = false;
    });
    canvas.addEventListener("mousemove", e => {
        if (mouse.active) {
            mouse.vx = e.clientX - mouse.x;
            mouse.vy = e.clientY - mouse.y;
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }
    });
}

window.addEventListener("load", () => {
    CanvasManager.resize();
    bindEventListeners();
    init();
});

class GameObject {
    constructor(context, x, y, vx, vy, mass, angle, angularVelocity) {
        this.context = context;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
        this.totalForce = 0;
        this.colorIndex = 0;
        this.angle = angle;
        this.angularVelocity = angularVelocity;
        this.isColliding = false;
    }
}

class Circle extends GameObject {
    constructor(context, x, y, vx, vy, radius, mass) {
        super(context, x, y, vx, vy, mass);
        this.radius = radius;
        this.totalForce = 0;
        this.colorIndex = 0;
        this.colors = ['#d3fc8d','#e0fc8d', '#fcfc8d', '#ffff61', '#ebcc34', '#ebb134', '#d19b26', '#d68418', '#d9800d', '#ad6103', '#8c4e03', '#995829', '#804f2d', '#6b462b', '#5c3e29', '#453021', '#36271c', '#1f1611', '#0d0a07'];
        this.startingColors = ['#5cff82', '#67e083', '#5cbd73', '#73bd5c', '#98ed7e', '#b2ed7e', '#c3fa93', '#c7e87b', '#e6fc8d', '#8dfcb0'];

        this.color = this.startingColors[Math.floor(Math.random() * this.startingColors.length)];
        this.darkerColor = darkenHexColor(this.color, 20);
        
        // Animation properties
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.birthTime = Date.now();
    }

    // Update color based on the total force and defined thresholds
    updateColorBasedOnForce() {
        const forceThresholds = [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 500000, 700000, 820000, 900000, 950000, 1000000, 1000500, 1000750, 1000950, 1001000];

        for (let i = 0; i < forceThresholds.length; i++) {
            if (this.totalForce >= forceThresholds[i] && this.colorIndex <= i) {
                this.colorIndex = i + 1;
            }
        }

        if (this.colorIndex >= 0 && this.colorIndex < this.colors.length) {
            this.color = this.colors[this.colorIndex];
            this.darkerColor = darkenHexColor(this.color, 20);
        }
    }
    draw() {
        // Update scale for pop-in animation
        if (this.scale < this.targetScale) {
            // Smooth animation over 300ms
            const animationDuration = 300;
            const elapsedTime = Date.now() - this.birthTime;
            const progress = Math.min(1, elapsedTime / animationDuration);
            
            // Ease-out function for smoother animation
            this.scale = this.targetScale * (1 - Math.pow(1 - progress, 3));
        }
        
        this.context.save();
        this.context.translate(this.x, this.y);
        this.context.rotate(this.angle);

        // Apply scale for pop-in effect
        const baseRadius = 12; // Based on visual center of bean SVG
        const scale = this.radius / baseRadius * this.scale;
        this.context.scale(scale, scale);
        this.context.translate(-baseRadius, -baseRadius); // Center the bean shape around its center

        // Define the SVG path using Path2D
        let path = new Path2D("M19.151 4.868a6.744 6.744 0 00-5.96-1.69 12.009 12.009 0 00-6.54 3.47 11.988 11.988 0 00-3.48 6.55 6.744 6.744 0 001.69 5.95 6.406 6.406 0 004.63 1.78 11.511 11.511 0 007.87-3.56C21.3 13.428 22.1 7.818 19.151 4.868Z");

        // Fill the path
        this.context.fillStyle = this.color;
        this.context.fill(path);

        // Outline
        let outlinePath = new Path2D("M19.151,4.868a6.744,6.744,0,0,0-5.96-1.69,12.009,12.009,0,0,0-6.54,3.47,11.988,11.988,0,0,0-3.48,6.55,6.744,6.744,0,0,0,1.69,5.95,6.406,6.406,0,0,0,4.63,1.78,11.511,11.511,0,0,0,7.87-3.56C21.3,13.428,22.1,7.818,19.151,4.868Zm-14.99,8.48a11.041,11.041,0,0,1,3.19-5.99,10.976,10.976,0,0,1,5.99-3.19,8.016,8.016,0,0,1,1.18-.09,5.412,5.412,0,0,1,3.92,1.49.689.689,0,0,1,.11.13,6.542,6.542,0,0,1-2.12,1.23,7.666,7.666,0,0,0-2.96,1.93,7.666,7.666,0,0,0-1.93,2.96,6.589,6.589,0,0,1-1.71,2.63,6.7,6.7,0,0,1-2.63,1.71,7.478,7.478,0,0,0-2.35,1.36A6.18,6.18,0,0,1,4.161,13.348Zm12.49,3.31c-3.55,3.55-8.52,4.35-11.08,1.79a1.538,1.538,0,0,1-.12-.13,6.677,6.677,0,0,1,2.13-1.23,7.862,7.862,0,0,0,2.96-1.93,7.738,7.738,0,0,0,1.93-2.96,6.589,6.589,0,0,1,1.71-2.63,6.589,6.589,0,0,1,2.63-1.71,7.6,7.6,0,0,0,2.34-1.37C20.791,9.2,19.821,13.488,16.651,16.658Z");
        this.context.strokeStyle = this.darkerColor;
        this.context.lineWidth = 1;
        this.context.stroke(outlinePath);

        // Draw internal hitbox only when debug mode is enabled
        if (GameState.debug.enabled && GameState.debug.showHitboxes) {
            this.context.beginPath();
            this.context.arc(baseRadius, baseRadius, baseRadius, 0, Math.PI * 2);
            this.context.strokeStyle = 'rgba(255, 0, 0, 0.4)';
            this.context.lineWidth = 1;
            this.context.stroke();
        }

        this.context.restore();
    }

    update() {
        // Apply gravity
        this.vy += g * GameState.secondsPassed;
        
        // Apply air resistance (more realistic for faster objects)
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 0.1) {
            const airDrag = 0.02 + (speed * 0.0005); // Progressive air resistance
            this.vx *= (1 - airDrag * GameState.secondsPassed);
            this.vy *= (1 - airDrag * GameState.secondsPassed);
        }
        
        // Update position
        this.x += this.vx * GameState.secondsPassed;
        this.y += this.vy * GameState.secondsPassed;
        
        // Update rotation with more realistic angular physics
        // Angular velocity changes based on linear velocity (rolling effect)
        const rollingEffect = 0.05;
        if (Math.abs(this.vx) > 1) {
            // Beans roll in the direction they're moving
            const targetAngularVelocity = -this.vx / (this.radius * 2) * rollingEffect;
            // Gradually adjust angular velocity toward target
            this.angularVelocity += (targetAngularVelocity - this.angularVelocity) * 0.1;
        }
        
        // Apply angular damping
        this.angularVelocity *= (1 - 0.05 * GameState.secondsPassed);
        
        // Update angle
        this.angle += this.angularVelocity * GameState.secondsPassed;
        
        // Limit maximum speed to prevent physics issues
        const maxSpeed = 1000;
        if (speed > maxSpeed) {
            const scaleFactor = maxSpeed / speed;
            this.vx *= scaleFactor;
            this.vy *= scaleFactor;
        }
        
        // Update scale for pop-in animation
        if (this.scale < this.targetScale) {
            const animationDuration = 300; // ms
            const elapsedTime = Date.now() - this.birthTime;
            const progress = Math.min(1, elapsedTime / animationDuration);
            
            // Ease-out function for smoother animation
            this.scale = this.targetScale * (1 - Math.pow(1 - progress, 3));
        }
        console.log(`Bean ${this.id || ''}: vx=${this.vx.toFixed(2)}, vy=${this.vy.toFixed(2)}, x=${this.x.toFixed(2)}, y=${this.y.toFixed(2)}`);

    }
}     


// Debug mode toggle function
function toggleDebugMode() {
    GameState.debug.enabled = !GameState.debug.enabled;
    const debugButton = document.getElementById('debugButton');
    debugButton.textContent = GameState.debug.enabled ? 'Debug: ON' : 'Debug: OFF';
    
    // Log debug state to console
    console.log(`Debug mode ${GameState.debug.enabled ? 'enabled' : 'disabled'}`);
}

function init() {
    const canvas = document.getElementById('myCanvas');
    const context = canvas.getContext('2d');
    document.getElementById('spawnButton').addEventListener('click', spawnCircle);
    document.getElementById('debugButton').addEventListener('click', toggleDebugMode);
    
    // Only show the permission button if the device is iOS
    if (isIOS() && typeof DeviceMotionEvent.requestPermission === "function") {
        document.getElementById('requestPermissionButton').style.display = 'block';
        document.getElementById('requestPermissionButton').addEventListener('click', requestMotionPermission);
    } else {
        // If not iOS, just start listening for motion events
        window.addEventListener("devicemotion", MotionManager.handleMotion);
        window.addEventListener("devicemotion", MotionManager.detectShake);
    }
    window.requestAnimationFrame(gameLoop);
}


function gameLoop(timeStamp) {
    GameState.secondsPassed = (timeStamp - GameState.oldTimeStamp) / 1000;
    GameState.secondsPassed = Math.min(GameState.secondsPassed, 0.1);
    console.log("Seconds passed:", GameState.secondsPassed);
    GameState.oldTimeStamp = timeStamp;
    
    clearCanvas();
     // Apply tilt-based motion
     MotionManager.applyMotionToBeans();

     // Apply shake effect if triggered
     if (motion.shakePending) {
         applyShakeEffect();
         motion.shakePending = false;
     }
    GameState.gameObjects.forEach(obj => {obj.update();});
    detectCollisions();
    detectEdgeCollisions();
     detectMouseCollisions();
    GameState.gameObjects.forEach(obj => obj.draw());
    drawStats();

    window.requestAnimationFrame(gameLoop);
}

document.getElementById('requestPermissionButton').addEventListener('click', requestMotionPermission);

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawStats() {
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    
    // Always show basic stats
    let totalObjects = GameState.gameObjects.length;
    ctx.fillText(`Total Objects: ${totalObjects}`, 10, 20);
    
    // Show debug info only when debug mode is enabled
    if (GameState.debug.enabled) {
        let totalForce = GameState.gameObjects.reduce((sum, obj) => sum + obj.totalForce, 0);
        let avgForce = totalObjects > 0 ? totalForce / totalObjects : 0;
        let forceDeviation = Math.sqrt(GameState.gameObjects.reduce((sum, obj) => sum + Math.pow(obj.totalForce - avgForce, 2), 0) / totalObjects || 0);
        
        ctx.fillText(`Average Force: ${avgForce.toFixed(2)}`, 10, 40);
        ctx.fillText(`Force Deviation: ${forceDeviation.toFixed(2)}`, 10, 60);
        ctx.fillText(`Accel X: ${motion.accelX.toFixed(2)}`, 10, 80);
        ctx.fillText(`Accel Y: ${motion.accelY.toFixed(2)}`, 10, 100);
        ctx.fillText(`Last shake time: ${motion.lastShakeTime}`, 10, 120);
        ctx.fillText(`Debug Mode: ON`, 10, 140);
        
        // Draw FPS
        const fps = Math.round(1 / GameState.secondsPassed);
        ctx.fillText(`FPS: ${fps}`, 10, 160);
    } else {
        ctx.fillText(`Debug Mode: OFF`, 10, 40);
    }
}

function detectMouseCollisions() {
    if (!mouse.active) return;
    GameState.gameObjects.forEach(obj => {
        let dx = obj.x - mouse.x;
        let dy = obj.y - mouse.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= obj.radius + mouse.radius) {
            let overlap = obj.radius + mouse.radius - distance;
            obj.x += (overlap / 2) * (dx / distance);
            obj.y += (overlap / 2) * (dy / distance);
            obj.vx = -Math.abs(obj.vx) * restitution;
            obj.vy = -Math.abs(obj.vy) * restitution;
            resolveCollision(obj, {
                x: mouse.x,
                y: mouse.y,
                vx: mouse.vx + 2,
                vy: mouse.vy + 2,
                mass: mouse.mass
            });
        }
    });
}

function detectCollisions() {
    for (let obj of GameState.gameObjects) {
        obj.isColliding = false;
    }

    for (let i = 0; i < GameState.gameObjects.length; i++) {
        for (let j = i + 1; j < GameState.gameObjects.length; j++) {
            let obj1 = GameState.gameObjects[i];
            let obj2 = GameState.gameObjects[j];
            if (circleIntersect(obj1.x, obj1.y, obj1.radius, obj2.x, obj2.y, obj2.radius)) {
                obj1.isColliding = true;
                obj2.isColliding = true;
                resolveCollision(obj1, obj2);
            }
        }
    }
}

function detectEdgeCollisions() {
    const floorBuffer = 10;
    const wallRestitution = restitution * 0.9; // Slightly less bouncy walls for more realism
    const floorFriction = 0.98; // Increased floor friction for more realistic movement

    GameState.gameObjects.forEach(obj => {
        let collided = false;
        
        // LEFT WALL
        if ((obj.x - obj.radius) <= 0) {
            // Calculate impact velocity for more realistic bounce
            const impactVelocity = Math.abs(obj.vx);
            obj.vx = impactVelocity * wallRestitution;
            obj.x = obj.radius;
            
            // Add some vertical velocity variation for more natural bounces
            obj.vy += (Math.random() - 0.5) * impactVelocity * 0.1;
            
            // Add angular velocity based on impact
            obj.angularVelocity += impactVelocity * 0.01;
            
            collided = true;
        }

        // RIGHT WALL
        if ((obj.x + obj.radius) >= canvas.width) {
            const impactVelocity = Math.abs(obj.vx);
            obj.vx = -impactVelocity * wallRestitution;
            obj.x = canvas.width - obj.radius;
            
            // Add some vertical velocity variation for more natural bounces
            obj.vy += (Math.random() - 0.5) * impactVelocity * 0.1;
            
            // Add angular velocity based on impact
            obj.angularVelocity -= impactVelocity * 0.01;
            
            collided = true;
        }

        // CEILING
        if ((obj.y - obj.radius) <= 0) {
            const impactVelocity = Math.abs(obj.vy);
            obj.vy = impactVelocity * wallRestitution;
            obj.y = obj.radius;
            
            // Add some horizontal velocity variation for more natural bounces
            obj.vx += (Math.random() - 0.5) * impactVelocity * 0.1;
            
            collided = true;
        }

        // FLOOR
        const floorY = canvas.height - obj.radius - floorBuffer;
        if ((obj.y + obj.radius) >= canvas.height - floorBuffer) {
            const impactVelocity = Math.abs(obj.vy);
            
            // More realistic floor bounce with velocity-dependent restitution
            // Harder impacts have less restitution (energy loss)
            const dynamicRestitution = Math.max(0.3, restitution - (impactVelocity * 0.0005));
            obj.vy = -impactVelocity * dynamicRestitution;
            obj.y = floorY;

            // Apply stronger horizontal friction ONLY on the floor
            // Friction increases with impact velocity
            const frictionFactor = Math.max(floorFriction, 1 - (impactVelocity * 0.0005));
            obj.vx *= frictionFactor;
            
            // Apply rolling physics - beans roll in the direction they're moving
            const rollingEffect = 0.2;
            const targetAngularVelocity = -obj.vx / (obj.radius * 2) * rollingEffect;
            obj.angularVelocity = obj.angularVelocity * 0.8 + targetAngularVelocity * 0.2;
            
            // Stop very slow movement
            if (Math.abs(obj.vx) < 0.5) obj.vx = 0;
            if (Math.abs(obj.vy) < 0.5) obj.vy = 0;
            
            collided = true;
        }
        
        // Add a small "bump" effect when colliding with edges
        if (collided && GameState.debug.enabled) {
            obj.isColliding = true; // Highlight in debug mode
        }
        
        // Draw debug visualizations if enabled
        if (GameState.debug.enabled) {
            // Draw hitbox
            if (GameState.debug.showHitboxes) {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
                ctx.strokeStyle = obj.isColliding ? 'rgba(255, 0, 0, 0.7)' : 'rgba(255, 0, 0, 0.4)';
                ctx.lineWidth = obj.isColliding ? 2 : 1;
                ctx.stroke();
            }
            
            // Draw velocity vectors
            if (GameState.debug.showVelocityVectors && (Math.abs(obj.vx) > 0.1 || Math.abs(obj.vy) > 0.1)) {
                const vectorScale = 0.1; // Scale factor for vector visualization
                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y);
                ctx.lineTo(obj.x + obj.vx * vectorScale, obj.y + obj.vy * vectorScale);
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Draw arrowhead
                const angle = Math.atan2(obj.vy, obj.vx);
                const arrowSize = 5;
                ctx.beginPath();
                ctx.moveTo(obj.x + obj.vx * vectorScale, obj.y + obj.vy * vectorScale);
                ctx.lineTo(
                    obj.x + obj.vx * vectorScale - arrowSize * Math.cos(angle - Math.PI / 6),
                    obj.y + obj.vy * vectorScale - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    obj.x + obj.vx * vectorScale - arrowSize * Math.cos(angle + Math.PI / 6),
                    obj.y + obj.vy * vectorScale - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                ctx.fill();
            }
            
            // Draw force values
            if (GameState.debug.showForceValues) {
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
                ctx.fillText(`F: ${Math.round(obj.totalForce)}`, obj.x - 15, obj.y - obj.radius - 5);
            }
        }
    });
}



function circleIntersect(x1, y1, r1, x2, y2, r2) {
    let squareDistance = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    return squareDistance <= (r1 + r2) ** 2;
}

function resolveCollision(obj1, obj2) {
    // Calculate collision vector and distance
    let vCollision = { x: obj2.x - obj1.x, y: obj2.y - obj1.y };
    let distance = Math.sqrt(vCollision.x ** 2 + vCollision.y ** 2);
    
    // Prevent objects from sticking together
    if (distance < minSeparation) return;

    // Normalize collision vector
    let vCollisionNorm = { x: vCollision.x / distance, y: vCollision.y / distance };
    
    // Calculate relative velocity
    let vRelativeVelocity = { x: obj1.vx - obj2.vx, y: obj1.vy - obj2.vy };
    
    // Calculate speed in the direction of the collision
    let speed = vRelativeVelocity.x * vCollisionNorm.x + vRelativeVelocity.y * vCollisionNorm.y;
    
    // If objects are moving away from each other, no collision response needed
    if (speed < 0) return;

    // Calculate impulse scalar
    let impulse = (2 * speed * restitution) / (obj1.mass + obj2.mass);
    
    // Calculate force for color change and apply impulse to velocities
    if (obj2.type === "mouse") {
        // Special case for mouse interactions
        let force1 = impulse * obj2.mass * 2; // Increased force for mouse
        obj1.totalForce += force1 * 0.25;
        obj1.updateColorBasedOnForce();
        
        // Apply squared velocity for more dramatic mouse effect
        obj1.vx = Math.sign(obj1.vx - impulse * obj2.mass * vCollisionNorm.x) * 
                 Math.pow(Math.abs(obj1.vx - impulse * obj2.mass * vCollisionNorm.x), 1.2);
        obj1.vy = Math.sign(obj1.vy - impulse * obj2.mass * vCollisionNorm.y) * 
                 Math.pow(Math.abs(obj1.vy - impulse * obj2.mass * vCollisionNorm.y), 1.2);
                 
        // Add some random spin for more natural movement
        obj1.angularVelocity += (Math.random() - 0.5) * 10;
    } else {
        // Normal object-to-object collision
        let force1 = impulse * obj2.mass;
        obj1.totalForce += force1 * 0.25;
        obj1.updateColorBasedOnForce();
        
        // Apply impulse to velocity
        obj1.vx -= impulse * obj2.mass * vCollisionNorm.x;
        obj1.vy -= impulse * obj2.mass * vCollisionNorm.y;
        
        // Apply angular velocity change based on collision point
        // This creates a more realistic rotation effect during collisions
        const tangentVelocity = vRelativeVelocity.x * -vCollisionNorm.y + vRelativeVelocity.y * vCollisionNorm.x;
        obj1.angularVelocity += tangentVelocity * 0.05;
        
        // Apply impulse to second object if it's not a mouse
        let force2 = impulse * obj1.mass;
        obj2.vx += impulse * obj1.mass * vCollisionNorm.x;
        obj2.vy += impulse * obj1.mass * vCollisionNorm.y;
        obj2.totalForce += force2 * 0.25;
        
        // Update color of second object
        if (typeof obj2.updateColorBasedOnForce === 'function') {
            obj2.updateColorBasedOnForce();
        }
        
        // Apply angular velocity to second object
        obj2.angularVelocity -= tangentVelocity * 0.05;
    }
    
    // Add a small bounce effect if one object is stationary (on floor)
    const isObj1Resting = Math.abs(obj1.vx) < 0.1 && Math.abs(obj1.vy) < 0.1;
    const isObj2Resting = Math.abs(obj2.vx) < 0.1 && Math.abs(obj2.vy) < 0.1;
    const bounceBoost = 2.0; // Increased bounce effect
    
    if (isObj1Resting && Math.abs(obj2.vy) > 0.5) {
        obj1.vy -= bounceBoost;
        // Add a bit of horizontal movement for more natural behavior
        obj1.vx += (Math.random() - 0.5) * bounceBoost;
    } else if (isObj2Resting && Math.abs(obj1.vy) > 0.5) {
        obj2.vy -= bounceBoost;
        // Add a bit of horizontal movement for more natural behavior
        obj2.vx += (Math.random() - 0.5) * bounceBoost;
    }
}

// Spawning logic
function spawnCircle() {
    // Create beans with varied sizes
    const minRadius = 15;
    const maxRadius = 30;
    //const visualRadius = minRadius + Math.random() * (maxRadius - minRadius);
    const visualRadius = 20 
    const hitboxRadius = visualRadius * 0.8; // Slightly smaller hitbox for better alignment with bean shape
    
    // Position with slight preference for the center of the screen
    const centerBias = 0.3; // How much to bias toward center (0-1)
    const randomX = Math.random();
    const randomY = Math.random();
    
    // Apply center bias using a weighted average
    const biasedX = randomX * (1 - centerBias) + 0.5 * centerBias;
    const biasedY = randomY * (1 - centerBias) + 0.5 * centerBias;
    
    // Calculate position
    const x = biasedX * (canvas.width - 2 * hitboxRadius) + hitboxRadius;
    const y = biasedY * (canvas.height - 2 * hitboxRadius) + hitboxRadius;
    
    // More varied velocities with a slight upward bias (for more interesting initial movement)
    const speedVariation = 250; // Higher value for more varied initial speeds
    const vx = (Math.random() - 0.5) * speedVariation;
    const vy = (Math.random() - 0.7) * speedVariation; // Slight upward bias (-0.7 instead of -0.5)
    
    // Mass is proportional to volume (r³) for more realistic physics
    const mass = Math.pow(hitboxRadius, 3) * 0.1;
    
    // Random initial angle and spin
    const angle = Math.random() * 2 * Math.PI;
    const angularVelocity = (Math.random() - 0.5) * 8; // More initial spin
    
    // Create the bean
    const newCircle = new Circle(ctx, x, y, vx, vy, hitboxRadius, mass, angle, angularVelocity);
    newCircle.visualRadius = visualRadius;
    
    // Add a small "pop-in" effect
    newCircle.scale = 0.1; // Start small
    newCircle.targetScale = 1.0; // Grow to full size
    
    // Add to game objects
    GameState.gameObjects.push(newCircle);
    
    // Add a small force burst when spawning multiple beans
    if (GameState.gameObjects.length > 1 && Math.random() > 0.7) {
        // Find nearby beans and push them away slightly
        const spawnForce = 100;
        GameState.gameObjects.forEach(obj => {
            if (obj !== newCircle) {
                const dx = obj.x - newCircle.x;
                const dy = obj.y - newCircle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 100) { // Only affect nearby beans
                    const forceMagnitude = spawnForce * (1 - distance / 100);
                    obj.vx += (dx / distance) * forceMagnitude;
                    obj.vy += (dy / distance) * forceMagnitude;
                }
            }
        });
    }
}
