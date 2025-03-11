document.getElementById('createBeanBtn').addEventListener('click', createCoffeeBean);

// Array to keep track of all beans
let beans = [];

function createCoffeeBean() {
    // Create a new div element for the coffee bean
    const bean = document.createElement('div');
    bean.classList.add('coffee-bean');
    console.log("Coffee bean created");

    // Get the height and width of the coffee bean
    const beanHeight = 30; // Static height of the coffee bean
    const beanWidth = 30; // Static width of the coffee bean

    // Set a random horizontal position for the coffee bean
    const randomX = Math.random() * window.innerWidth;
    bean.style.left = `${randomX}px`;

    // Set a random starting vertical position for the coffee bean
    const randomY = Math.random() * (window.innerHeight - beanHeight); // Avoid starting too low
    bean.style.top = `${randomY}px`;

    // Append the coffee bean to the body
    document.body.appendChild(bean);
    console.log("Coffee bean added to DOM");

    // Constants for the gravity simulation
    const gravity = 200; // Adjusted gravity (increased to make the bean fall faster)
    const initialVelocityX = (Math.random() - 0.5) * 50; // Random horizontal velocity between -25 and 25
    const initialVelocityY = 0; // Starting with no vertical velocity
    const stopPosition = window.innerHeight - beanHeight; // Stop at the bottom of the screen

    // Define bean properties
    const mass = Math.random() * 10 + 5; // Random mass between 5 and 15
    let time = 0; // Initial time
    let currentY = randomY; // Starting Y position of the bean
    let currentX = randomX; // Starting X position of the bean
    let velocityX = initialVelocityX; // Initial horizontal velocity
    let velocityY = initialVelocityY; // Initial vertical velocity
    let isMoving = true; // Bean is initially moving
    const minVelocity = 0.2; // Minimum velocity to keep beans moving
    let energy = 0; // Track the energy of the bean (based on velocity)

    // Set initial color as #74f26b (hex for the starting color)
    let color = '#74f26b';
    bean.style.backgroundColor = color;

    // Add the new bean to the array of beans
    beans.push({ bean, mass, velocityX, velocityY, currentX, currentY, isMoving, energy, color });

    // Function to update the position of the coffee bean with gravity and collision
    function fall() {
        // If the bean is moving, apply the forces
        if (isMoving) {
            // Apply gravity to vertical velocity (v = u + at)
            velocityY += gravity * 0.016; // Approx 60 FPS (0.016s per frame)

            // Update positions based on velocities
            currentY += velocityY * 0.016 + 0.5 * gravity * 0.016 * 0.016;
            currentX += velocityX * 0.016;

            // Update energy based on velocity (higher velocity = more energy)
            energy = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

            // Check for collisions with other beans
            for (let otherBean of beans) {
                if (otherBean.bean !== bean && otherBean.isMoving) {
                    // Simple collision detection: check for overlap
                    const beanRect = bean.getBoundingClientRect();
                    const otherBeanRect = otherBean.bean.getBoundingClientRect();
                    
                    if (isColliding(beanRect, otherBeanRect)) {
                        // Handle collision in both X and Y directions

                        // Calculate the new velocities (Elastic collision, simplified)
                        const tempVelocityX = velocityX;
                        const tempVelocityY = velocityY;

                        // Exchange velocities based on mass (momentum conservation)
                        velocityX = (velocityX * (mass - otherBean.mass) + (2 * otherBean.mass * otherBean.velocityX)) / (mass + otherBean.mass);
                        velocityY = (velocityY * (mass - otherBean.mass) + (2 * otherBean.mass * otherBean.velocityY)) / (mass + otherBean.mass);

                        otherBean.velocityX = (otherBean.velocityX * (otherBean.mass - mass) + (2 * mass * tempVelocityX)) / (mass + otherBean.mass);
                        otherBean.velocityY = (otherBean.velocityY * (otherBean.mass - mass) + (2 * mass * tempVelocityY)) / (mass + otherBean.mass);

                        // Stack the bean on top of the other bean if they collide vertically
                        if (velocityY > 0) {
                            currentY = otherBeanRect.top - beanHeight; // Stack above the other bean
                        }

                        // Apply energy loss from the collision (simulating heat)
                        const energyLoss = 0.2; // Energy loss factor
                        velocityX *= (1 - energyLoss);
                        velocityY *= (1 - energyLoss);

                        // Wake up the bean if it's stopped
                        otherBean.isMoving = true;

                        // Ensure that beans that are moving slowly start to "wake up" with a slight push
                        if (Math.abs(velocityX) < minVelocity && Math.abs(velocityY) < minVelocity) {
                            velocityX += (Math.random() - 0.5) * 10; // Apply a small "bump" to reawaken the bean
                            velocityY += (Math.random() - 0.5) * 10; // Apply a small "bump" to reawaken the bean
                        }

                        // Change the color of both beans after collision
                        color = '#b78b6f'; // Example: Dark brown color after collision
                        otherBean.color = color;
                        otherBean.bean.style.backgroundColor = color;
                        bean.style.backgroundColor = color;

                        break; // Stop checking other beans once the collision is resolved
                    }
                }
            }

            // Apply friction to slow down the bean when it has very low velocity
            if (Math.abs(velocityX) < minVelocity) velocityX = velocityX * 0.98; // Apply some drag/friction
            if (Math.abs(velocityY) < minVelocity) velocityY = velocityY * 0.98; // Apply some drag/friction

            // Ensure the bean always moves by giving it a minimum velocity when near zero
            if (Math.abs(velocityX) < minVelocity && Math.abs(velocityY) < minVelocity) {
                velocityX = (Math.random() - 0.5) * 5; // Small random bump to make it move
                velocityY = (Math.random() - 0.5) * 5; // Small random bump to make it move
            }

            // If the bean reaches the floor, absorb the energy and stop bouncing
            if (currentY >= stopPosition) {
                currentY = stopPosition;
                if (Math.abs(velocityX) > 0.1) {
                    // Simulate a rolling effect by continuing horizontal movement
                    velocityY = 0; // Stop the vertical movement
                    velocityX *= 0.98; // Apply horizontal friction (reduce speed over time)
                } else {
                    // Fully stop the bean if it's nearly stationary
                    isMoving = false;
                }
            }
        }

        // Update the bean's position on the screen
        bean.style.top = `${currentY}px`;
        bean.style.left = `${currentX}px`;

        // Continue the animation if the bean is still moving
        if (isMoving) {
            fallAnimation = requestAnimationFrame(fall);
        }
    }

    // Start the animation
    let fallAnimation = requestAnimationFrame(fall);
}

// Collision detection function to check if two beans are overlapping
function isColliding(beanRect, otherBeanRect) {
    return beanRect.top + beanRect.height > otherBeanRect.top &&
           beanRect.top < otherBeanRect.top + otherBeanRect.height &&
           beanRect.left + beanRect.width > otherBeanRect.left &&
           beanRect.left < otherBeanRect.left + otherBeanRect.width;
}
