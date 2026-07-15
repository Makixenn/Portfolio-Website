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

// Enforce pulling limit on all cord segments
Matter.Events.on(engine, 'beforeUpdate', () => {
    for (let i = 0; i < cordComposite.bodies.length; i++) {
        const body = cordComposite.bodies[i];
        const initialBodyY = startY + (i * segmentHeight);
        const limitY = initialBodyY + 120;
        
        if (body.position.y > limitY) {
            Matter.Body.setPosition(body, { x: body.position.x, y: limitY });
            if (body.velocity.y > 0) {
                Matter.Body.setVelocity(body, { x: body.velocity.x, y: 0 });
            }
        }
    }
});

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
    if (activePhoto) {
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
    }

    if (activeCD) {
        let newLeft = e.pageX - initialX;
        let newTop = e.pageY - initialY;
        
        activeCD.style.left = `${newLeft}px`;
        activeCD.style.top = `${newTop}px`;
    }
});

document.addEventListener('mouseup', (e) => {
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

    if (activeCD) {
        activeCD.classList.remove('dragging');
        
        // Check if dropped on vinyl player
        const playerRect = vinylPlayer.getBoundingClientRect();
        if (e.clientX > playerRect.left && e.clientX < playerRect.right && 
            e.clientY > playerRect.top && e.clientY < playerRect.bottom) {
            
            // Snap to player relative to tabletop container
            const tableRect = document.getElementById('tabletop').getBoundingClientRect();
            const targetLeft = playerRect.left - tableRect.left + (playerRect.width / 2) - (activeCD.offsetWidth / 2);
            const targetTop = playerRect.top - tableRect.top + (playerRect.height / 2) - (activeCD.offsetHeight / 2);
            
            activeCD.style.left = `${targetLeft}px`;
            activeCD.style.top = `${targetTop}px`;
            activeCD.style.transform = ''; // Clear inline transform for playing animation
            
            // Play song
            const songSrc = activeCD.getAttribute('data-song');
            
            // Update laptop dashboard if it exists
            if (typeof updateNowPlaying === 'function') {
                updateNowPlaying(songSrc);
            }

            if (currentAudio) {
                currentAudio.pause();
            }
            currentAudio = new Audio(songSrc);
            currentAudio.loop = true;
            const volSlider = document.getElementById('volume-slider');
            if (volSlider) {
                currentAudio.volume = volSlider.value;
            }
            currentAudio.play().catch(err => console.log('Audio auto-play blocked or missing file:', err));
            
            playingCD = activeCD;
            activeCD.classList.add('playing');
            vinylTonearm.classList.add('playing');
        } else {
            // Drop anywhere else -> check if dropped back on its sleeve
            const sleeveId = activeCD.getAttribute('data-sleeve');
            const sleeves = document.querySelectorAll('.album-sleeve');
            const sleeve = sleeves[parseInt(sleeveId)];
            
            if (sleeve) {
                const sleeveRect = sleeve.getBoundingClientRect();
                if (e.clientX > sleeveRect.left && e.clientX < sleeveRect.right && 
                    e.clientY > sleeveRect.top && e.clientY < sleeveRect.bottom) {
                    // Dropped on sleeve -> return to sleeve
                    sleeve.appendChild(activeCD);
                    activeCD.style.left = '0.25vw';
                    activeCD.style.top = '0.25vw';
                    activeCD.style.transform = ''; 
                } else {
                    // Left on the table
                    // Add the table 3D transform so it lays flat
                    activeCD.style.transform = 'perspective(1000px) rotateX(15deg) rotateZ(0deg)';
                }
            }
        }
        
        activeCD = null;
    }
});

// 10. Vinyl Player & CD Logic
const cds = document.querySelectorAll('.cd');
const vinylPlayer = document.getElementById('vinyl-player');
const vinylTonearm = document.querySelector('.vinyl-tonearm');
const volumeSlider = document.getElementById('volume-slider');
let activeCD = null;
let currentAudio = null;
let playingCD = null;

if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        if (currentAudio) {
            currentAudio.volume = e.target.value;
        }
    });
}

cds.forEach(cd => {
    // Initial rotation for scattered CDs
    const rotation = cd.getAttribute('data-rotation') || 0;
    cd.style.setProperty('--rot', `${rotation}deg`);

    cd.addEventListener('mousedown', (e) => {
        activeCD = cd;
        // If nested in sleeve, reparent to tabletop for dragging
        if (cd.parentElement.classList.contains('album-sleeve')) {
            const rect = cd.getBoundingClientRect();
            const tabletop = document.getElementById('tabletop');
            const tableRect = tabletop.getBoundingClientRect();
            
            tabletop.appendChild(cd);
            cd.style.left = `${rect.left - tableRect.left}px`;
            cd.style.top = `${rect.top - tableRect.top}px`;
        }

        activeCD.classList.add('dragging');
        zIndexCounter++;
        cd.style.zIndex = zIndexCounter;

        // Remove playing state if we pick it up
        if (cd === playingCD) {
            cd.classList.remove('playing');
            vinylTonearm.classList.remove('playing');
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            playingCD = null;
            if (typeof updateNowPlaying === 'function') {
                updateNowPlaying(null);
            }
        }

        initialX = e.pageX - cd.offsetLeft;
        initialY = e.pageY - cd.offsetTop;
    });
});

// 11. Comic Bubble Typewriter Effect
const comicBubble = document.getElementById('comic-bubble');
let typeWriterTimeout = null;
let currentBubbleStr = "";
let currentBubbleIdx = 0;

function typeWriter() {
    if (currentBubbleIdx < currentBubbleStr.length) {
        comicBubble.innerHTML += currentBubbleStr.charAt(currentBubbleIdx);
        currentBubbleIdx++;
        typeWriterTimeout = setTimeout(typeWriter, 50); // Medium typing speed
    }
}

document.querySelectorAll('[data-message]').forEach(el => {
    el.addEventListener('mouseenter', (e) => {
        const msg = el.getAttribute('data-message');
        if (!msg) return;
        
        comicBubble.innerHTML = "";
        comicBubble.classList.add('show');
        
        // Position bubble initially at cursor
        comicBubble.style.left = `${e.clientX}px`;
        comicBubble.style.top = `${e.clientY}px`; 

        currentBubbleStr = msg;
        currentBubbleIdx = 0;
        clearTimeout(typeWriterTimeout);
        typeWriter();
    });
    
    el.addEventListener('mousemove', (e) => {
        if (comicBubble.classList.contains('show')) {
            comicBubble.style.left = `${e.clientX}px`;
            comicBubble.style.top = `${e.clientY}px`; 
        }
    });
    
    el.addEventListener('mouseleave', () => {
        comicBubble.classList.remove('show');
        clearTimeout(typeWriterTimeout);
    });
});

// 12. Laptop Dashboard Logic
const clockWidget = document.getElementById('clock-widget');
const nowPlayingWidget = document.getElementById('now-playing-widget');

if (clockWidget) {
    setInterval(() => {
        const now = new Date();
        clockWidget.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);
    // Initialize immediately
    clockWidget.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateNowPlaying(songName) {
    if (nowPlayingWidget) {
        if (songName) {
            // Extract just the filename without extension for display
            let cleanName = songName.split('/').pop().replace('.mp3', '');
            nowPlayingWidget.innerText = `Playing: ${cleanName}`;
        } else {
            nowPlayingWidget.innerText = 'Waiting for music...';
        }
    }
}

// 13. Terminal Logic
const terminalScreen = document.querySelector('.laptop-screen');
const terminalInterface = document.getElementById('terminal-interface');
const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');
const osModal = document.getElementById('os-modal');
const osCloseBtn = document.getElementById('os-close-btn');
// focusOverlay is already declared globally earlier in the file

let currentInput = "";

if (terminalInterface && terminalInput && terminalOutput) {
    terminalInterface.addEventListener('keydown', (e) => {
        // Prevent default scrolling for spacebar etc when in terminal
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }

        if (e.key === "Enter") {
            e.preventDefault();
            processCommand(currentInput.trim());
            currentInput = "";
            terminalInput.innerText = currentInput;
        } else if (e.key === "Backspace") {
            e.preventDefault();
            currentInput = currentInput.slice(0, -1);
            terminalInput.innerText = currentInput;
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            currentInput += e.key;
            terminalInput.innerText = currentInput;
        }
    });

    // Ensure terminal stays focused when clicking inside it
    terminalInterface.addEventListener('click', () => {
        terminalInterface.focus();
    });
}

// Click laptop to open OS modal
if (terminalScreen && osModal && focusOverlay) {
    terminalScreen.addEventListener('click', (e) => {
        e.stopPropagation();
        osModal.classList.remove('hidden');
        focusOverlay.classList.add('active');
        if (terminalInterface) terminalInterface.focus();
    });
}

// Close Modal logic
if (osCloseBtn && osModal && focusOverlay) {
    osCloseBtn.addEventListener('click', () => {
        osModal.classList.add('hidden');
        focusOverlay.classList.remove('active');
    });
}

if (focusOverlay) {
    focusOverlay.addEventListener('click', () => {
        if (osModal && !osModal.classList.contains('hidden')) {
            osModal.classList.add('hidden');
            focusOverlay.classList.remove('active');
        }
        // If photos are focused, they have their own logic
    });
}

function printToTerminal(htmlString) {
    if (!terminalOutput) return;
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    terminalOutput.appendChild(div);
    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

async function simulateBootSequence() {
    const inputLine = document.getElementById('terminal-input-line');
    if (inputLine) inputLine.style.display = 'none';
    
    terminalOutput.innerHTML = ''; // Clear terminal

    const bootLines = [
        "BIOS Date 07/15/26 14:15:00 Ver 1.0.0",
        "CPU: XennCore Processor @ 4.20GHz",
        "Memory: 64GB RAM System Check OK",
        "<br>",
        "Loading bootloader...",
        "Booting XennOS kernel...",
        "<span style='color:#0f0'>[ OK ]</span> Starting core modules...",
        "<span style='color:#0f0'>[ OK ]</span> Mounting root filesystem...",
        "<span style='color:#0f0'>[ OK ]</span> Initializing network interfaces...",
        "<span style='color:#0f0'>[ OK ]</span> Starting UI compositor...",
        "<br>",
        "Welcome to XennOS v1.0.0!"
    ];

    for (let i = 0; i < bootLines.length; i++) {
        // Random delay between 100ms and 500ms for realism
        await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));
        printToTerminal(`<span style="color:#aaa">${bootLines[i]}</span>`);
    }

    // Wait a brief moment, then switch to the GUI
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const guiInterface = document.getElementById('gui-interface');
    if (guiInterface && terminalInterface) {
        terminalInterface.style.display = 'none';
        guiInterface.classList.remove('hidden');
    }

    if (inputLine) inputLine.style.display = 'flex';
    // Add an extra blank line before prompt returns (in case they go back)
    printToTerminal('<br>'); 
}

function processCommand(cmd) {
    // Print the command the user just typed
    printToTerminal(`<span style="color:#fff">guest@xenn:~$</span> ${cmd}`);
    
    const lowerCmd = cmd.toLowerCase();
    
    switch (lowerCmd) {
        case '':
            break;
        case 'help':
            printToTerminal(`Available commands:<br>
- <b>about</b>: Learn about me<br>
- <b>projects</b>: View my work<br>
- <b>contact</b>: Get in touch<br>
- <b>boot</b>: Simulate a PC boot sequence<br>
- <b>clear</b>: Clear the terminal`);
            break;
        case 'about':
            printToTerminal(`Hello! I'm Xenn.<br>I'm a creative developer who builds interactive digital spaces.`);
            break;
        case 'projects':
            printToTerminal(`My Projects:<br>
1. EIMS Presentation Deck<br>
2. Interactive 3D Room Portfolio<br>
3. Vinyl Record Simulator`);
            break;
        case 'contact':
            printToTerminal(`Email: <a style="color:#0f0" href="mailto:triscopex4@gmail.com">triscopex4@gmail.com</a><br>Github: github.com/Makixenn`);
            break;
        case 'boot':
        case 'booth':
            simulateBootSequence();
            break;
        case 'clear':
            terminalOutput.innerHTML = '';
            break;
        default:
            printToTerminal(`Command not found: ${cmd}. Type 'help' for available commands.`);
    }
}

// 14. Windows GUI Logic
const startBtn = document.getElementById('start-btn');
const startMenu = document.getElementById('start-menu');
const winClock = document.getElementById('win-clock');
const guiInterface = document.getElementById('gui-interface');

if (startBtn && startMenu) {
    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
    });
    
    if (guiInterface) {
        guiInterface.addEventListener('click', () => {
            if (!startMenu.classList.contains('hidden')) {
                startMenu.classList.add('hidden');
            }
        });
    }
}

if (winClock) {
    setInterval(() => {
        winClock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);
    winClock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Omori Theme Toggle Logic
const omoriDoor = document.getElementById('omori-door');
if (omoriDoor && guiInterface) {
    omoriDoor.addEventListener('click', (e) => {
        e.stopPropagation();
        if (guiInterface.classList.contains('white-space')) {
            guiInterface.classList.remove('white-space');
            guiInterface.classList.add('headspace');
            alert('Welcome to Headspace!');
        } else {
            guiInterface.classList.remove('headspace');
            guiInterface.classList.add('white-space');
            alert('Welcome to White Space. You have been living here for as long as you can remember.');
        }
    });
}