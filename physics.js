let secondsPassed = 0;
let oldTimeStamp = 0;
let gameObjects = [];
const g = 9.81*10; // Gravitational acceleration
let mouseX = 0;
let mouseY = 0;
const mouseMass = 700;
let mouseVX = 1;
let mouseVY = 1;
const mouseRadius = 50; // Invisible radius for interaction
let mouseActive = false;
let accelX = 0, accelY = 0, accelZ = 0;
let lastAccelX = 0, lastAccelY = 0;
let smoothingFactor = 0.8; // Adjust for smoother movement
let lastShakeTime = 0; // Prevents repeated shakes
const shakeThreshold = 15; // Adjust sensitivity (higher = harder shake)
const shakeCooldown = 1000; // 1 second cooldown between shakes

// Set a restitution, a lower value will lose more energy when colliding
const restitution = 0.90;

// Select the canvas and get the context
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const canvas = document.getElementById("myCanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function detectShake(event) {
    if (!event.accelerationIncludingGravity) return;

    let accelX = event.accelerationIncludingGravity.x;
    let accelY = event.accelerationIncludingGravity.y;
    let accelZ = event.accelerationIncludingGravity.z;

    // Calculate change in acceleration (difference between frames)
    let deltaX = Math.abs(accelX - lastAccelX);
    let deltaY = Math.abs(accelY - lastAccelY);
    let deltaZ = Math.abs(accelZ - lastAccelZ);
    
    // Total acceleration change
    let totalChange = deltaX + deltaY + deltaZ;

    // If total acceleration change is above threshold, register as a shake
    if (totalChange > shakeThreshold) {
        let currentTime = Date.now();
        
        // Apply shake effect if cooldown has passed
        if (currentTime - lastShakeTime > shakeCooldown) {
            lastShakeTime = currentTime; // Update last shake time
            applyShakeEffect(); // Apply the effect to the beans
        }
    }

    // Store last acceleration values for next frame
    lastAccelX = accelX;
    lastAccelY = accelY;
    lastAccelZ = accelZ;
}

// Function to apply velocity burst to all beans
function applyShakeEffect() {
    gameObjects.forEach(obj => {
        if (obj instanceof Circle) {
            obj.vx += (Math.random() - 0.5) * 400; // Random shake impulse
            obj.vy += (Math.random() - 0.5) * 400;
        }
    });
    console.log("Shake detected! Beans shaken!");
    // Show shake message
    let shakeMessage = document.getElementById("shakeMessage");
    shakeMessage.style.opacity = "1";

    // Hide message after 2 seconds
    setTimeout(() => {
        shakeMessage.style.opacity = "0";
    }, 2000);
}

// Modify motion event listener to detect shakes
window.addEventListener("devicemotion", detectShake);

// Request permission for motion data (iOS-specific)
function requestMotionPermission() {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        DeviceMotionEvent.requestPermission()
            .then(response => {
                if (response === "granted") {
                    window.addEventListener("devicemotion", handleMotion);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener("devicemotion", handleMotion);
    }
}

// Handles motion data
function handleMotion(event) {
    if (event.accelerationIncludingGravity) {
        let rawX = event.accelerationIncludingGravity.x;
        let rawY = event.accelerationIncludingGravity.y;

        // Apply a smoothing filter
        accelX = smoothingFactor * lastAccelX + (1 - smoothingFactor) * rawX;
        accelY = smoothingFactor * lastAccelY + (1 - smoothingFactor) * rawY;

        lastAccelX = accelX;
        lastAccelY = accelY;
    }
}

// Apply motion data to game objects
function applyMotionToBeans() {
    gameObjects.forEach(obj => {
        if (obj instanceof Circle) {
            obj.vx += accelX * 2; // Adjust multiplier for sensitivity
            obj.vy -= accelY * 2; // Invert Y to match screen orientation
        }
    });
}


function darkenHexColor(hex, percent) {
    // Remove the '#' from the beginning if it's there
    hex = hex.replace('#', '');

    // Convert the hex to RGB values
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Darken each color channel
    r = Math.max(0, r - (r * percent / 100));
    g = Math.max(0, g - (g * percent / 100));
    b = Math.max(0, b - (b * percent / 100));

    // Convert the RGB values back to hex
    let newHex = '#' + 
                ('0' + Math.round(r).toString(16)).slice(-2) + 
                ('0' + Math.round(g).toString(16)).slice(-2) + 
                ('0' + Math.round(b).toString(16)).slice(-2);

    return newHex;
}

// Run on load and resize
window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);
// Mouse event listeners
canvas.addEventListener("mousedown", (event) => {
    mouseActive = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseVX = 0;
    mouseVY = 0;
});

canvas.addEventListener("mouseup", () => {
    mouseActive = false;
});

canvas.addEventListener("mousemove", (event) => {
    if (mouseActive) {
        mouseVX = event.clientX - mouseX;
        mouseVY = event.clientY - mouseY;
        mouseX = event.clientX;
        mouseY = event.clientY;
    }
});


// Resize the canvas when the window resizes
window.addEventListener('resize', () => {
    resizeCanvas();
    // Optionally, reinitialize or reposition objects if needed
});

class GameObject {
    constructor(context, x, y, vx, vy, mass, angle, angularVelocity) {
        this.context = context;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
        this.totalForce = 0; // Initialize total force property
        this.colorIndex = 0; // Initialize color index
        this.angle = angle;  // Initial angle (in radians)
        this.angularVelocity = angularVelocity;  // Rotational velocity (in radians per second)
        this.isColliding = false;
    }
}

class Circle extends GameObject {
    constructor(context, x, y, vx, vy, radius, mass) {
        super(context, x, y, vx, vy, mass);
        this.radius = radius;
        this.totalForce = 0; // Initialize total force property
        this.colorIndex = 0; // Initialize color index to start with the first color of updated color palette
        this.colors = ['#fcfc8d', '#ffff61', '#ebcc34', '#ebb134', '#d19b26', '#d68418', '#d9800d', '#ad6103', '#8c4e03', '#995829', '#804f2d', '#6b462b', '#5c3e29', '#453021', '#36271c', '#1f1611', '#0d0a07']; // Updated color palette
        this.startingColors = ['#5cff82', '#67e083', '#5cbd73', '#73bd5c', '#98ed7e', '#b2ed7e', '#c3fa93', '#c7e87b', '#e6fc8d', '#8dfcb0']; // Initial color palette
        
        // Pick a random color from the starting colors
        this.color = this.startingColors[Math.floor(Math.random() * this.startingColors.length)];
        this.darkerColor = darkenHexColor(this.color, 20);
    }

    // Update color based on the total force and defined thresholds
    updateColorBasedOnForce() {
        const forceThresholds = [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 500000, 700000, 820000, 900000, 950000, 1000000  ]; // Example force thresholds

        // Find the next color index based on the force threshold
        for (let i = 0; i < forceThresholds.length; i++) {
            if (this.totalForce >= forceThresholds[i] && this.colorIndex <= i) {
                this.colorIndex = i + 1; // Move to the next color
            }
        }

        // Update the color based on the color index
        this.color = this.colors[this.colorIndex];
        this.darkerColor = darkenHexColor(this.color, 20);
    }

    draw() {
        this.context.save();  // Save the current state
        this.context.fillStyle = this.color;
        
        // Move the coordinate system to (this.x, this.y)
        this.context.translate(this.x, this.y);
        this.context.rotate(this.angle);  // Rotate the canvas by the object's angle
        //this.context.scale(this.radius, this.radius);
        
        // Define the SVG path using Path2D
        let path = new Path2D("M19.151 4.868a6.744 6.744 0 00-5.96-1.69 12.009 12.009 0 00-6.54 3.47 11.988 11.988 0 00-3.48 6.55 6.744 6.744 0 001.69 5.95 6.406 6.406 0 004.63 1.78 11.511 11.511 0 007.87-3.56C21.3 13.428 22.1 7.818 19.151 4.868Z");
    
        // Fill the path
        this.context.fill(path);
         // Define a different path for the outline
        let outlinePath = new Path2D("M19.151,4.868a6.744,6.744,0,0,0-5.96-1.69,12.009,12.009,0,0,0-6.54,3.47,11.988,11.988,0,0,0-3.48,6.55,6.744,6.744,0,0,0,1.69,5.95,6.406,6.406,0,0,0,4.63,1.78,11.511,11.511,0,0,0,7.87-3.56C21.3,13.428,22.1,7.818,19.151,4.868Zm-14.99,8.48a11.041,11.041,0,0,1,3.19-5.99,10.976,10.976,0,0,1,5.99-3.19,8.016,8.016,0,0,1,1.18-.09,5.412,5.412,0,0,1,3.92,1.49.689.689,0,0,1,.11.13,6.542,6.542,0,0,1-2.12,1.23,7.666,7.666,0,0,0-2.96,1.93,7.666,7.666,0,0,0-1.93,2.96,6.589,6.589,0,0,1-1.71,2.63,6.7,6.7,0,0,1-2.63,1.71,7.478,7.478,0,0,0-2.35,1.36A6.18,6.18,0,0,1,4.161,13.348Zm12.49,3.31c-3.55,3.55-8.52,4.35-11.08,1.79a1.538,1.538,0,0,1-.12-.13,6.677,6.677,0,0,1,2.13-1.23,7.862,7.862,0,0,0,2.96-1.93,7.738,7.738,0,0,0,1.93-2.96,6.589,6.589,0,0,1,1.71-2.63,6.589,6.589,0,0,1,2.63-1.71,7.6,7.6,0,0,0,2.34-1.37C20.791,9.2,19.821,13.488,16.651,16.658Z");
        this.context.strokeStyle = this.darkerColor;  // You can change this to whatever color you want for the outline
        this.context.lineWidth = 1;  // Set the width of the outline
        this.context.stroke(outlinePath);
        
        

        this.context.restore(); // Restore the previous state
        }
    

    update(secondsPassed) {
        // Apply gravity
        this.vy += g * secondsPassed;
        
        // Update position
        this.x += this.vx * secondsPassed;
        this.y += this.vy * secondsPassed;
        this.angle += this.angularVelocity * secondsPassed;  // Update the angle based on the angular velocity

    }
}

window.onload = init;

function init() {
    const canvas = document.getElementById('myCanvas');
    const context = canvas.getContext('2d');
    document.getElementById('spawnButton').addEventListener('click', spawnCircle);
    window.requestAnimationFrame(gameLoop);
}


function gameLoop(timeStamp) {
    secondsPassed = (timeStamp - oldTimeStamp) / 1000;
    secondsPassed = Math.min(secondsPassed, 0.1);
    oldTimeStamp = timeStamp;
    
    clearCanvas();
    applyMotionToBeans(); // Update v
    gameObjects.forEach(obj => obj.update(secondsPassed));
    detectCollisions();
    detectEdgeCollisions();
     detectMouseCollisions();
    gameObjects.forEach(obj => obj.draw());
    drawStats();

    window.requestAnimationFrame(gameLoop);
}

//window.addEventListener("load", requestMotionPermission);

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawStats() {
    let totalObjects = gameObjects.length;
    let totalForce = gameObjects.reduce((sum, obj) => sum + obj.totalForce, 0);
    let avgForce = totalObjects > 0 ? totalForce / totalObjects : 0;
    let forceDeviation = Math.sqrt(gameObjects.reduce((sum, obj) => sum + Math.pow(obj.totalForce - avgForce, 2), 0) / totalObjects || 0);

    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Total Objects: ${totalObjects}`, 10, 20);
    ctx.fillText(`Average Force: ${avgForce.toFixed(2)}`, 10, 40);
    ctx.fillText(`Force Deviation: ${forceDeviation.toFixed(2)}`, 10, 60);
    ctx.fillText(`Mouse Position: (${mouseX}, ${mouseY})`, 10, 80);
    ctx.fillText(`Accel X: ${accelX.toFixed(2)}`, 10, 40);
    ctx.fillText(`Accel Y: ${accelY.toFixed(2)}`, 10, 60);
}

function detectMouseCollisions() {
    if (!mouseActive) return;
    gameObjects.forEach(obj => {
        let dx = obj.x - mouseX;
        let dy = obj.y - mouseY;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= obj.radius + mouseRadius) {
            let overlap = obj.radius + mouseRadius - distance;
            obj.x += (overlap / 2) * (dx / distance);
            obj.y += (overlap / 2) * (dy / distance);
            obj.vx = -Math.abs(obj.vx) * restitution;
            obj.vy = -Math.abs(obj.vy) * restitution;
            resolveCollision(obj, { x: mouseX, y: mouseY, vx: mouseVX+1*2, vy: mouseVY+1*2, mass: mouseMass });
        }
    });
}

function detectCollisions() {
    for (let obj of gameObjects) {
        obj.isColliding = false;
    }

    for (let i = 0; i < gameObjects.length; i++) {
        for (let j = i + 1; j < gameObjects.length; j++) {
            let obj1 = gameObjects[i];
            let obj2 = gameObjects[j];
            if (circleIntersect(obj1.x, obj1.y, obj1.radius, obj2.x, obj2.y, obj2.radius)) {
                obj1.isColliding = true;
                obj2.isColliding = true;
                resolveCollision(obj1, obj2);
            }
        }
    }
}

function detectEdgeCollisions() {
    let obj;
    const rightBuffer = 10;  // Adjust this for the right-hand boundary perception
    const floorBuffer = 10; // You can adjust this value as needed

    for (let i = 0; i < gameObjects.length; i++) {
        obj = gameObjects[i];

        // Check for left and right
        if (obj.x < obj.radius) {
            obj.vx = Math.abs(obj.vx) * restitution;
            obj.x = obj.radius;
        } else if (obj.x > canvas.width - obj.radius - rightBuffer) {
            obj.vx = -Math.abs(obj.vx) * restitution;
            obj.x = canvas.width - obj.radius - rightBuffer;
        }
        // Check for bottom and top
        if (obj.y < obj.radius) {
            obj.vy = Math.abs(obj.vy) * restitution;
            obj.y = obj.radius;
        } else if (obj.y > canvas.height - obj.radius - floorBuffer) {
            obj.vy = -Math.abs(obj.vy) * restitution;
            obj.y = canvas.height - obj.radius- floorBuffer;
        }
    }
}

function circleIntersect(x1, y1, r1, x2, y2, r2) {
    let squareDistance = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    return squareDistance <= (r1 + r2) ** 2;
}

function resolveCollision(obj1, obj2) {
    let vCollision = { x: obj2.x - obj1.x, y: obj2.y - obj1.y };
    let distance = Math.sqrt(vCollision.x ** 2 + vCollision.y ** 2);
    if (distance === 0) return;

    let vCollisionNorm = { x: vCollision.x / distance, y: vCollision.y / distance };
    let vRelativeVelocity = { x: obj1.vx - obj2.vx, y: obj1.vy - obj2.vy };
    let speed = vRelativeVelocity.x * vCollisionNorm.x + vRelativeVelocity.y * vCollisionNorm.y;
    if (speed < 0) return;

    let impulse = (2 * speed) / (obj1.mass + obj2.mass);

    // Calculate the force for both objects based on the impulse
    let force1 = impulse * obj2.mass;
    // Add the calculated force to the totalForce property of each circle
    obj1.totalForce += force1;
    // Update the color based on the new totalForce
    obj1.updateColorBasedOnForce();
    obj1.vx -= impulse * obj2.mass * vCollisionNorm.x;
    obj1.vy -= impulse * obj2.mass * vCollisionNorm.y;

    if (obj2.mass == mouseMass) {
     obj1.vx = obj1.vx**2;
    obj1.vy = obj1.vy**2;
    }
    
    if (obj2.mass !== mouseMass) {
        let force2 = impulse * obj1.mass;
        obj2.vx += impulse * obj1.mass * vCollisionNorm.x;
        obj2.vy += impulse * obj1.mass * vCollisionNorm.y;
        obj2.totalForce += force2;
        obj2.updateColorBasedOnForce();
    }
}
// Spawning logic
function spawnCircle() {
    const radius = 10 //Math.random() * 3 + 1; // Random rad    ius between 10 and 40
    const x = Math.random() * (canvas.width - 2 * radius) + radius; // Random X within canvas
    const y = Math.random() * (canvas.height - 2 * radius) + radius; // Random Y within canvas
    const vx = (Math.random() - 0.5) * 200; // Random X velocity
    const vy = (Math.random() - 0.5) * 200; // Random Y velocity
    const mass = radius ** 4; // Mass related to radius
    // Random angle between 0 and 2 * Math.PI
    const angle = Math.random() * 2 * Math.PI;
    // Random angular velocity between -2 and 2 radians per second
    const angularVelocity = (Math.random() - 0.5) * 4; // Angular velocity between -2 and 2
    const newCircle = new Circle(ctx, x, y, vx, vy, radius, mass, angle, angularVelocity); // Pass ctx instead of undefined 'context'
    gameObjects.push(newCircle); // Add to the game objects array
}
