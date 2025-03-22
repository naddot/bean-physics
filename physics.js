const GameState = {
    secondsPassed: 0,
    oldTimeStamp: 0,
    gameObjects: []
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
    lastShakeTime: 0,
    shakeThreshold: 5,
    shakeCooldown: 1000
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
        if (event.accelerationIncludingGravity) {
            let { x: rawX, y: rawY } = event.accelerationIncludingGravity;
            motion.accelX = motion.smoothingFactor * motion.lastAccelX + (1 - motion.smoothingFactor) * rawX;
            motion.accelY = motion.smoothingFactor * motion.lastAccelY + (1 - motion.smoothingFactor) * rawY;
            motion.lastAccelX = motion.accelX;
            motion.lastAccelY = motion.accelY;
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
            applyShakeEffect();
        }
        motion.lastAccelX = accX;
        motion.lastAccelY = accY;
        motion.lastAccelZ = accZ;
    },

    applyMotionToBeans() {
        const ios = isIOS();
        GameState.gameObjects.forEach(obj => {
            if (obj instanceof Circle) {
                obj.vx -= (ios ? -motion.accelX : motion.accelX) * 2;
                obj.vy += (ios ? -motion.accelY : motion.accelY) * 2;
            }
        });
    }
};

function applyShakeEffect() {
    GameState.gameObjects.forEach(obj => {
        if (obj instanceof Circle) {
            obj.vx += (Math.random() - 0.5) * 400;
            obj.vy += (Math.random() - 0.5) * 400;
        }
    });
    console.log("Shake detected! Beans shaken!");
}

// Motion permission for iOS
function requestMotionPermission() {
    DeviceMotionEvent.requestPermission().then(response => {
        if (response === "granted") {
            window.addEventListener("devicemotion", MotionManager.handleMotion);
            window.addEventListener("devicemotion", MotionManager.detectShake);
            document.getElementById('requestPermissionButton').style.display = 'none';
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
        this.context.save();
        this.context.translate(this.x, this.y);
        this.context.rotate(this.angle);

        const baseRadius = 12; // Based on visual center of bean SVG
        const scale = this.radius / baseRadius;
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

        // DEBUG: Draw radius hitbox centered
        //this.context.beginPath();
        //this.context.arc(baseRadius, baseRadius, baseRadius, 0, Math.PI * 2);
        //this.context.strokeStyle = 'rgba(255, 0, 0, 0.4)';
        //this.context.lineWidth = 1;
        //this.context.stroke();

        this.context.restore();
    }
    

        update() {
            this.vy += g * GameState.secondsPassed;
            this.x += this.vx * GameState.secondsPassed;
            this.y += this.vy * GameState.secondsPassed;
            this.angle += this.angularVelocity * GameState.secondsPassed;
        }
}     


function init() {
    const canvas = document.getElementById('myCanvas');
    const context = canvas.getContext('2d');
    document.getElementById('spawnButton').addEventListener('click', spawnCircle);
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
    GameState.oldTimeStamp = timeStamp;
    
    clearCanvas();
    MotionManager.applyMotionToBeans();
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
    let totalObjects = GameState.gameObjects.length;
    let totalForce = GameState.gameObjects.reduce((sum, obj) => sum + obj.totalForce, 0);
    let avgForce = totalObjects > 0 ? totalForce / totalObjects : 0;
    let forceDeviation = Math.sqrt(GameState.gameObjects.reduce((sum, obj) => sum + Math.pow(obj.totalForce - avgForce, 2), 0) / totalObjects || 0);

    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Total Objects: ${totalObjects}`, 10, 20);
    ctx.fillText(`Average Force: ${avgForce.toFixed(2)}`, 10, 40);
    ctx.fillText(`Force Deviation: ${forceDeviation.toFixed(2)}`, 10, 60);
    ctx.fillText(`Accel X: ${motion.accelX.toFixed(2)}`, 10, 80);
    ctx.fillText(`Accel Y: ${motion.accelY.toFixed(2)}`, 10, 100);
    ctx.fillText(`Last shake time: ${motion.lastShakeTime}`, 10, 120);
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

    GameState.gameObjects.forEach(obj => {
        // LEFT WALL
        if ((obj.x - obj.radius) <= 0) {
            obj.vx = Math.abs(obj.vx) * restitution;
            obj.x = obj.radius;
        }

        // RIGHT WALL
        if ((obj.x + obj.radius) >= canvas.width) {
            obj.vx = -Math.abs(obj.vx) * restitution;
            obj.x = canvas.width - obj.radius;
        }

        // CEILING
        if ((obj.y - obj.radius) <= 0) {
            obj.vy = Math.abs(obj.vy);
            obj.y = obj.radius;
        }

        // FLOOR
        const floorY = canvas.height - obj.radius - floorBuffer;
        if ((obj.y + obj.radius) >= canvas.height - floorBuffer) {
            obj.vy = -Math.abs(obj.vy);
            obj.y = floorY;

            // Apply stronger horizontal friction ONLY on the floor
            obj.vx *= 0.99;
            obj.angularVelocity *= 0.99;
            if (Math.abs(obj.vx) < 0.1) obj.vx = 0;
            if (Math.abs(obj.vy) < 0.1) obj.vy = 0;
        }
        // DEBUG: draw radius hitbox
        //ctx.beginPath();
        //ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        //ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
        //ctx.lineWidth = 1;
        //ctx.stroke();
    });
}



function circleIntersect(x1, y1, r1, x2, y2, r2) {
    let squareDistance = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    return squareDistance <= (r1 + r2) ** 2;
}

function resolveCollision(obj1, obj2) {
    let vCollision = { x: obj2.x - obj1.x, y: obj2.y - obj1.y };
    let distance = Math.sqrt(vCollision.x ** 2 + vCollision.y ** 2);
    if (distance < minSeparation) return; // prevent sticking

    let vCollisionNorm = { x: vCollision.x / distance, y: vCollision.y / distance };
    let vRelativeVelocity = { x: obj1.vx - obj2.vx, y: obj1.vy - obj2.vy };
    let speed = vRelativeVelocity.x * vCollisionNorm.x + vRelativeVelocity.y * vCollisionNorm.y;
    if (speed < 0) return;

    let impulse = (2 * speed) / (obj1.mass + obj2.mass);

    let force1 = impulse * obj2.mass;
    obj1.totalForce += force1 * 0.25;
    obj1.updateColorBasedOnForce();
    obj1.vx -= impulse * obj2.mass * vCollisionNorm.x;
    obj1.vy -= impulse * obj2.mass * vCollisionNorm.y;

    if (obj2.type === "mouse") {
        obj1.vx = obj1.vx ** 2;
        obj1.vy = obj1.vy ** 2;
    }

    if (obj2.type === "mouse") {
        let force2 = impulse * obj1.mass;
        obj2.vx += impulse * obj1.mass * vCollisionNorm.x;
        obj2.vy += impulse * obj1.mass * vCollisionNorm.y;
        obj2.totalForce += force2 * 0.25;
        if (typeof obj2.updateColorBasedOnForce === 'function') {
            obj2.updateColorBasedOnForce();
        }
    }
     // Add a small bounce effect if one object is stationary (on floor)
     const isObj1Resting = Math.abs(obj1.vx) < 0.01 && Math.abs(obj1.vy) < 0.01;
     const isObj2Resting = Math.abs(obj2.vx) < 0.01 && Math.abs(obj2.vy) < 0.01;
     const bounceBoost = 1.5; // subtle vertical boost
     if (isObj1Resting && obj2.vy > 0) {
         obj1.vy -= bounceBoost;
     } else if (isObj2Resting && obj1.vy > 0) {
         obj2.vy -= bounceBoost;
     }
}

// Spawning logic
function spawnCircle() {
    const visualRadius = 20; // Random radius between 10 and 40
    const hitboxRadius = visualRadius * 0.8; // Slightly smaller hitbox for better alignment with bean shape
    const x = Math.random() * (canvas.width - 2 * hitboxRadius) + hitboxRadius; // Random X within canvas
    const y = Math.random() * (canvas.height - 2 * hitboxRadius) + hitboxRadius; // Random Y within canvas
    const vx = (Math.random() - 0.5) * 200; // Random X velocity
    const vy = (Math.random() - 0.5) * 200; // Random Y velocity
    const mass = hitboxRadius ** 2; // Quadratic mass based on area
    const angle = Math.random() * 2 * Math.PI; // Random angle
    const angularVelocity = (Math.random() - 0.5) * 4; // Angular velocity between -2 and 2
    const newCircle = new Circle(ctx, x, y, vx, vy, hitboxRadius, mass, angle, angularVelocity);
    newCircle.visualRadius = visualRadius; // Store visual radius separately
    GameState.gameObjects.push(newCircle);
}
