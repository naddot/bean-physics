let secondsPassed = 0;
let oldTimeStamp = 0;
let gameObjects = [];
const g = 9.81*10; // Gravitational acceleration

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

// Run on load and resize
window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);


// Resize the canvas when the window resizes
window.addEventListener('resize', () => {
    resizeCanvas();
    // Optionally, reinitialize or reposition objects if needed
});

class GameObject {
    constructor(context, x, y, vx, vy, mass) {
        this.context = context;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
        this.isColliding = false;
    }
}

class Circle extends GameObject {
    constructor(context, x, y, vx, vy, radius, mass) {
        super(context, x, y, vx, vy, mass);
        this.radius = radius;
        this.totalForce = 0; // Initialize total force property
        this.colorIndex = 0; // Initialize color index to start with the first color of updated color palette
        this.colors = ['#fcfc8d', '#ffff61', '#ebcc34', '#ebb134', '#d19b26', '#d19b26', '#d68418', '#d9800d', '#ad6103', '#8c4e03', '#995829', '#804f2d', '#6b462b', '#5c3e29', '#453021', '#36271c', '#1f1611', '#0d0a07']; // Updated color palette
        this.startingColors = ['#5cff82', '#67e083', '#5cbd73', '#73bd5c', '#98ed7e', '#b2ed7e', '#c3fa93', '#c7e87b', '#e6fc8d', '#8dfcb0']; // Initial color palette
        
        // Pick a random color from the starting colors
        this.color = this.startingColors[Math.floor(Math.random() * this.startingColors.length)];
    }

    // Update color based on the total force and defined thresholds
    updateColorBasedOnForce() {
        const forceThresholds = [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000]; // Example force thresholds

        // Find the next color index based on the force threshold
        for (let i = 0; i < forceThresholds.length; i++) {
            if (this.totalForce >= forceThresholds[i] && this.colorIndex <= i) {
                this.colorIndex = i + 1; // Move to the next color
            }
        }

        // Update the color based on the color index
        this.color = this.colors[this.colorIndex];
    }

    draw() {
        this.context.fillStyle = this.color;
        this.context.beginPath();
        this.context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        this.context.fill();
        this.context.closePath();
    }

    update(secondsPassed) {
        // Apply gravity
        this.vy += g * secondsPassed;
        
        // Update position
        this.x += this.vx * secondsPassed;
        this.y += this.vy * secondsPassed;
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

    for (let obj of gameObjects) {
        obj.update(secondsPassed);
    }

    detectCollisions();
    detectEdgeCollisions();  // Add this line to check for edge collisions
    clearCanvas();

    for (let obj of gameObjects) {
        obj.draw();
    }

    window.requestAnimationFrame(gameLoop);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    for (let i = 0; i < gameObjects.length; i++) {
        obj = gameObjects[i];

        // Check for left and right
        if (obj.x < obj.radius) {
            obj.vx = Math.abs(obj.vx) * restitution;
            obj.x = obj.radius;
        } else if (obj.x > canvas.width - obj.radius) {
            obj.vx = -Math.abs(obj.vx) * restitution;
            obj.x = canvas.width - obj.radius;
        }

        // Check for bottom and top
        if (obj.y < obj.radius) {
            obj.vy = Math.abs(obj.vy) * restitution;
            obj.y = obj.radius;
        } else if (obj.y > canvas.height - obj.radius) {
            obj.vy = -Math.abs(obj.vy) * restitution;
            obj.y = canvas.height - obj.radius;
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
    let force2 = impulse * obj1.mass;
    // Add the calculated force to the totalForce property of each circle
    obj1.totalForce += force1;
    obj2.totalForce += force2;

    // Update the color based on the new totalForce
    obj1.updateColorBasedOnForce();
    obj2.updateColorBasedOnForce();

    obj1.vx -= impulse * obj2.mass * vCollisionNorm.x;
    obj1.vy -= impulse * obj2.mass * vCollisionNorm.y;
    obj2.vx += impulse * obj1.mass * vCollisionNorm.x;
    obj2.vy += impulse * obj1.mass * vCollisionNorm.y;
}
// Spawning logic
function spawnCircle() {
    const radius = Math.random() * 30 + 10; // Random radius between 10 and 40
    const x = Math.random() * (canvas.width - 2 * radius) + radius; // Random X within canvas
    const y = Math.random() * (canvas.height - 2 * radius) + radius; // Random Y within canvas
    const vx = (Math.random() - 0.5) * 200; // Random X velocity
    const vy = (Math.random() - 0.5) * 200; // Random Y velocity
    const mass = radius ** 4; // Mass related to radius

    const newCircle = new Circle(ctx, x, y, vx, vy, radius, mass); // Pass ctx instead of undefined 'context'
    gameObjects.push(newCircle); // Add to the game objects array
}
