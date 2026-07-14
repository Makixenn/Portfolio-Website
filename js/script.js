// 1. Matter.js Module Aliases
const { Engine, Render, Runner, Bodies, Composite, Constraint, Mouse, MouseConstraint } = Matter;

// 2. Create the Physics Engine & World
const engine = Engine.create();
const { world } = engine;

// 3. Setup the Canvas Dimensions to fit the window exactly
const width = window.innerWidth;
const height = window.innerHeight;

const render = Render.create({
    element: document.getElementById('physics-container'),
    engine: engine,
    options: {
        width: width,
        height: height,
        wireframes: false, // Allows custom colors instead of blue lines
        background: 'transparent' // Keeps our background controlled by CSS
    }
});

Render.run(render);

// Create runner to handle the physics loop animation
const runner = Runner.create();
Runner.run(runner, engine);

// 4. Create the Dangling Cord (Physics Chain)
const cordSegments = 12;
const segmentHeight = 16;
const startX = width / 2;
const startY = segmentHeight / 2;

let prevBody = null;
const cordComposite = Composite.create();

for (let i = 0; i < cordSegments; i++) {
    // Make the very bottom segment a larger circle handle, otherwise create a small rectangle link
    const isLast = (i === cordSegments - 1);

    let segment;
    if (isLast) {
        // The pull-switch handle (hidden, custom Omori drawing instead)
        segment = Bodies.circle(startX, startY + (i * segmentHeight), 16, {
            collisionFilter: { group: -1 },
            frictionAir: 0.05,
            density: 0.01,
            render: { visible: false }
        });
    } else {
        // The thin cord link
        segment = Bodies.rectangle(startX, startY + (i * segmentHeight), 4, segmentHeight, {
            collisionFilter: { group: -1 }, // Prevents string pieces from colliding with themselves
            frictionAir: 0.02,
            density: 0.05,
            render: { visible: false } // Hide the blocky rectangles!
        });
    }

    Composite.add(cordComposite, segment);

    // Connect segments together using constraints (spring hooks)
    if (i === 0) {
        // Anchor the very first piece to the ceiling (top center of the screen)
        const ceilingAnchor = Constraint.create({
            pointA: { x: startX, y: 0 },
            bodyB: segment,
            pointB: { x: 0, y: -segmentHeight / 2 },
            stiffness: 1,
            render: { visible: false }
        });
        Composite.add(cordComposite, ceilingAnchor);
    } else {
        // Anchor the current piece to the previous piece
        const chainLink = Constraint.create({
            bodyA: prevBody,
            pointA: { x: 0, y: segmentHeight / 2 },
            bodyB: segment,
            pointB: { x: 0, y: -segmentHeight / 2 },
            stiffness: 1,
            damping: 0.05,
            length: 0,
            render: { visible: false }
        });
        Composite.add(cordComposite, chainLink);
    }

    prevBody = segment;
}

Composite.add(world, cordComposite);

// 5. Add Mouse Interaction (Grabbing the Cord)
const mouse = Mouse.create(render.canvas);

// VERY IMPORTANT: Prevent Matter.js from eating scroll events so the user can scroll the page!
mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
mouse.element.removeEventListener('wheel', mouse.mousewheel);

const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: { visible: false }
    }
});

Composite.add(world, mouseConstraint);
render.mouse = mouse;

// 6. Monitor the Pull Distance to Turn on Lights
const handle = prevBody; // The final circular body we created
const initialHandleY = startY + ((cordSegments - 1) * segmentHeight);
const pullThreshold = 70; // How many pixels down they need to pull it
let lightsOn = false;
let isPulled = false;
const pullSound1 = new Audio('assets/sounds/pull_bulb.mp3');
const pullSound2 = new Audio('assets/sounds/pull_bulb2.mp3');
const trollSound = new Audio('assets/sounds/troll_pull.ogg');

Matter.Events.on(engine, 'afterUpdate', () => {
    const currentlyPulled = handle.position.y > initialHandleY + pullThreshold;

    if (currentlyPulled && !isPulled) {
        isPulled = true;
        lightsOn = !lightsOn;

        // Randomize the sound to prevent annoyance, with an easter egg!
        const rand = Math.random();
        let soundToPlay;
        
        if (rand < 0.05) {
            soundToPlay = trollSound; // 5% chance for the troll easter egg!
        } else if (rand < 0.525) {
            soundToPlay = pullSound1;
        } else {
            soundToPlay = pullSound2;
        }

        soundToPlay.currentTime = 0; // Rewind in case it's pulled rapidly
        soundToPlay.play();

        if (lightsOn) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            handle.render.fillStyle = '#ffdf00';
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            handle.render.fillStyle = '#555555';
        }
    } else if (!currentlyPulled && isPulled) {
        // Reset the pull state when the cord returns up
        isPulled = false;
    }
});

// 7. Handle Window Resize dynamically
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
});

// 8. Custom Render for Omori Style Cord
Matter.Events.on(render, 'afterRender', () => {
    const context = render.context;

    // Set dynamic shadow based on room lighting
    context.shadowColor = lightsOn ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)';
    context.shadowBlur = lightsOn ? 15 : 10;
    context.shadowOffsetX = lightsOn ? 12 : 0;
    context.shadowOffsetY = lightsOn ? 15 : 0;

    context.beginPath();
    context.moveTo(startX, 0);

    // Draw the sketchy cord
    for (let i = 0; i < cordComposite.bodies.length; i++) {
        const body = cordComposite.bodies[i];
        context.lineTo(body.position.x, body.position.y);
    }

    context.lineWidth = 2; // thin sketch line
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = lightsOn ? '#000000' : '#ffffff';
    context.stroke();

    // Draw the Omori Lightbulb at the handle position
    const handleBody = cordComposite.bodies[cordComposite.bodies.length - 1];
    const hx = handleBody.position.x;
    const hy = handleBody.position.y;

    context.translate(hx, hy);
    context.rotate(handleBody.angle);

    context.beginPath();
    // Screw base and glass outline
    context.moveTo(-6, -10);
    context.lineTo(-6, -20);
    context.lineTo(6, -20);
    context.lineTo(6, -10);
    context.arc(0, 0, 14, Math.PI * 1.8, Math.PI * 1.2, false);
    context.closePath();

    context.lineWidth = 2;
    context.strokeStyle = lightsOn ? '#000000' : '#ffffff';
    context.fillStyle = lightsOn ? '#ffffff' : '#000000';
    context.fill();
    context.stroke();

    // Squiggly filament inside
    context.beginPath();
    context.moveTo(-4, -10);
    context.lineTo(-2, -3);
    context.lineTo(0, -6);
    context.lineTo(2, -2);
    context.lineTo(4, -10);
    context.stroke();

    // Turn off drop shadow for the actual light beams
    context.shadowColor = 'transparent';

    // Shine lines if on
    if (lightsOn) {
        for (let i = 0; i < 8; i++) {
            if (i === 6) continue; // Skip the line going straight up into the cord
            const angle = (Math.PI / 4) * i;
            context.beginPath();
            context.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
            context.lineTo(Math.cos(angle) * 26, Math.sin(angle) * 26);
            context.stroke();
        }
    }

    context.rotate(-handleBody.angle);
    context.translate(-hx, -hy);
});

// 9. Tabletop Photo Dragging & Focus Logic
const photos = document.querySelectorAll('.photo');
const focusOverlay = document.getElementById('focus-overlay');
let activePhoto = null;
let currentlyFocusedPhoto = null;
let zIndexCounter = 10;
let initialX = 0, initialY = 0;
let startMouseX = 0, startMouseY = 0;
let isDragging = false;

// Remove focus when clicking overlay
focusOverlay.addEventListener('click', () => {
    if (currentlyFocusedPhoto) {
        currentlyFocusedPhoto.classList.remove('focused');
        
        // Remove the inline !important transform set by parallax
        currentlyFocusedPhoto.style.removeProperty('transform');
        
        // Restore table perspective
        const rotation = currentlyFocusedPhoto.getAttribute('data-rotation') || 0;
        currentlyFocusedPhoto.style.transform = `perspective(1000px) rotateX(15deg) rotateZ(${rotation}deg)`;
        
        currentlyFocusedPhoto = null;
        focusOverlay.classList.remove('active');
    }
});

photos.forEach(photo => {
    // Set initial 3D rotation to match the table, plus custom Z-rotation
    const rotation = photo.getAttribute('data-rotation') || 0;
    photo.style.transform = `perspective(1000px) rotateX(15deg) rotateZ(${rotation}deg)`;

    photo.addEventListener('mousedown', (e) => {
        if (photo.classList.contains('focused')) return; // Don't drag while focused

        activePhoto = photo;
        isDragging = false;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        
        // Pop to front
        zIndexCounter++;
        photo.style.zIndex = zIndexCounter;
        photo.classList.add('dragging');

        // Calculate offset directly from the CSS position, completely ignoring 3D transform visual bounds!
        initialX = e.pageX - photo.offsetLeft;
        initialY = e.pageY - photo.offsetTop;
    });

    // 3D Hover Tilt Logic (Only applies when focused)
    photo.addEventListener('mousemove', (e) => {
        if (photo.classList.contains('focused')) {
            const rect = photo.getBoundingClientRect();
            // Get mouse position relative to center of photo
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const mouseX = e.clientX - centerX;
            const mouseY = e.clientY - centerY;

            // Calculate tilt (max 15deg tilt)
            const rotateX = -(mouseY / rect.height) * 30; 
            const rotateY = (mouseX / rect.width) * 30;
            
            photo.style.setProperty('transform', `translate(-50%, -50%) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(3.5)`, 'important');
        }
    });

    photo.addEventListener('mouseleave', () => {
        if (photo.classList.contains('focused')) {
            // Snap back to perfectly flat when mouse leaves the photo bounds
            photo.style.setProperty('transform', `translate(-50%, -50%) perspective(1000px) rotateX(0deg) rotateY(0deg) scale(3.5)`, 'important');
        }
    });
});

document.addEventListener('mousemove', (e) => {
    if (!activePhoto) return;

    // Check if moved enough to be considered a drag
    const dist = Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY);
    if (dist > 5) {
        isDragging = true;
    }

    if (isDragging) {
        let newLeft = e.pageX - initialX;
        let newTop = e.pageY - initialY;
        
        activePhoto.style.left = `${newLeft}px`;
        activePhoto.style.top = `${newTop}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (activePhoto) {
        activePhoto.classList.remove('dragging');
        
        // If it wasn't a drag, it was a click!
        if (!isDragging) {
            currentlyFocusedPhoto = activePhoto;
            currentlyFocusedPhoto.classList.add('focused');
            currentlyFocusedPhoto.style.removeProperty('transform'); // Clear any inline non-important transform
            focusOverlay.classList.add('active');
        }
        
        activePhoto = null;
    }
});