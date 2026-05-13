let scene, camera, renderer, player, ballInHand, is3rd = false;
let score = 0, gameActive = false, footballs = [], enemies = [], teammates = [], keys = {};
const playerPos = new THREE.Vector3(0, 0, 150);

let targetYaw = 0, targetPitch = 0;
let currentYaw = 0, currentPitch = 0;
let shake = 0, walkCycle = 0;
let isKicking = false, kickProgress = 0;

let leftLeg, rightLeg, leftArm, rightArm, torsoGroup;

// --- BOT CLASS (For both Teams) ---
class Bot {
    constructor(x, z, color, isTeammate) {
        const char = createFullCharacter(color, 0x002244);
        this.group = char.group;
        this.lLeg = char.lLeg;
        this.rLeg = char.rLeg;
        this.pos = new THREE.Vector3(x, 0, z);
        this.isTeammate = isTeammate;
        this.baseSpeed = isTeammate ? 0.75 : 0.35 + Math.random() * 0.1;
        this.currentSpeed = this.baseSpeed;
        this.botCycle = Math.random() * Math.PI;
        scene.add(this.group);
    }
    update(target) {
        let moveDir = new THREE.Vector3();
        if (this.isTeammate) {
            const blockPos = target.clone().add(new THREE.Vector3(Math.sin(this.pos.x) * 5, 0, -18));
            moveDir.subVectors(blockPos, this.pos).normalize();
        } else {
            moveDir.subVectors(target, this.pos).normalize();
            this.currentSpeed = this.baseSpeed;
            teammates.forEach(tm => {
                if (this.pos.distanceTo(tm.pos) < 7) this.currentSpeed = 0.05;
            });
        }

        this.pos.addScaledVector(moveDir, this.currentSpeed);
        this.group.position.copy(this.pos);
        this.group.lookAt(target.x, 0, target.z);

        this.botCycle += 0.2;
        const swing = Math.sin(this.botCycle) * 0.5;
        this.lLeg.rotation.x = swing;
        this.rLeg.rotation.x = -swing;

        if (!this.isTeammate && this.pos.distanceTo(target) < 4.8) resetPlay("TACKLED!");
    }
}

function resetPlay(text) {
    if (text) {
        const el = document.getElementById('msg');
        el.innerText = text; el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 1200);
    }
    shake = 0.6;
    playerPos.set(0, 0, 150);
    enemies.forEach((n, i) => n.pos.set((Math.random() - 0.5) * 160, 0, -100 - (i * 70)));
    teammates.forEach((t, i) => t.pos.set((i - 2) * 20, 0, 130));
}

// --- MODELS ---
function createFullCharacter(jerseyCol, pantsCol) {
    const group = new THREE.Group();
    const charGroup = new THREE.Group();
    
    // PBR Materials (Physically Based Rendering)
    const jerseyMat = new THREE.MeshStandardMaterial({ 
        color: jerseyCol, roughness: 0.3, metalness: 0.1, 
        flatShading: false // Smooths out the "blocky" look
    });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.9 }); // Athletic skin tone
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 });
    const visorMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x000000, metalness: 1, roughness: 0, transparent: true, opacity: 0.85, transmission: 0.5 
    });

    // --- THE TORSO (V-Taper Anatomy) ---
    // Upper Chest/Jersey
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.2, 2.8, 24), jerseyMat);
    chest.position.y = 1.4;
    chest.scale.set(1.15, 1, 0.75); 
    charGroup.add(chest);

    // Heavy Shoulder Pads (Slanted for aggressive posture)
    const padGeom = new THREE.SphereGeometry(1, 24, 24);
    const lPad = new THREE.Mesh(padGeom, jerseyMat);
    lPad.position.set(1.5, 2.5, 0);
    lPad.scale.set(1.3, 0.65, 1.2);
    lPad.rotation.z = -0.4;
    const rPad = lPad.clone(); rPad.position.x = -1.5; rPad.rotation.z = 0.4;
    charGroup.add(lPad, rPad);

    // --- ARMS (Biceps + Forearms + Tape) ---
    const createArm = (side) => {
        const armGroup = new THREE.Group();
        const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.3, 16), jerseyMat);
        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 1.4, 16), skinMat);
        const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.29, 0.6, 16), new THREE.MeshStandardMaterial({color: 0xffffff}));
        
        bicep.position.y = -0.6;
        forearm.position.y = -1.8;
        tape.position.y = -2.2; // Athlete wrist tape
        
        armGroup.add(bicep, forearm, tape);
        armGroup.position.set(side * 1.65, 2.2, 0);
        return armGroup;
    };
    
    // Set globals for player animation
    if (jerseyCol === 0xffffff) {
        leftArm = createArm(1); rightArm = createArm(-1);
        charGroup.add(leftArm, rightArm);
    } else {
        charGroup.add(createArm(1), createArm(-1));
    }

    // --- HELMET (Professional Speed-Flex Style) ---
    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 32), jerseyMat);
    helm.position.y = 3.5;
    helm.scale.set(0.9, 1, 1.15);
    
    // Tinted Chrome Visor
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.28, 16, 32, Math.PI), visorMat);
    visor.position.set(0, 3.4, -0.6);
    visor.scale.set(1.2, 0.65, 1);
    
    // Realistic Chrome Face Grill
    const grill = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.06, 8, 32, Math.PI), chromeMat);
    grill.position.set(0, 3.1, -0.5);
    grill.rotation.x = 0.3;
    charGroup.add(helm, visor, grill);

    // --- LEGS (Thighs + Calves + Cleats) ---
    const createLeg = (side) => {
        const legPivot = new THREE.Group();
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 2, 16), pantsMat);
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.35, 1.8, 16), pantsMat);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.8), new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.2}));
        
        thigh.position.y = -1.0;
        calf.position.y = -2.8;
        shoe.position.set(0, -3.7, -0.4); // Protruding toe
        
        legPivot.add(thigh, calf, shoe);
        legPivot.position.set(side * 0.8, 2.4, 0);
        return legPivot;
    };
    
    const lLeg = createLeg(1);
    const rLeg = createLeg(-1);
    charGroup.position.y = 2.7;
    group.add(lLeg, rLeg, charGroup);
    
    return { group, lLeg, rLeg };
}

function createEliteBall() {
    const ball = new THREE.Group();
    const leather = new THREE.MeshStandardMaterial({ color: 0x4d2613, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), leather);
    body.scale.set(1, 0.8, 1.8);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 32), ringMat);
    r1.position.z = 0.6;
    const r2 = r1.clone(); r2.position.z = -0.6;
    const laces = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), ringMat);
    laces.position.set(0, 0.45, 0);
    ball.add(body, r1, r2, laces);
    return ball;
}

function createGrassTexture(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = c1; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 15000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? c2 : 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x60a3bc);
    scene.fog = new THREE.FogExp2(0x60a3bc, 0.001);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 3000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio); // Force high-res rendering
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Smoother shadows
    document.body.appendChild(renderer.domElement);

    // --- 4K LIGHTING ENGINE ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.2)); // Low ambient for depth
    
    // Hemisphere light simulates sky bounce (Blue sky / Green grass)
    const hemiLight = new THREE.HemisphereLight(0x60a3bc, 0x2d5a27, 0.8);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(50, 200, 50);
    sun.castShadow = true;
    
    // Extreme Shadow Resolution
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    scene.add(sun);

    // --- FIELD GENERATION ---
    const grassL = createGrassTexture('#2d5a27', '#3a6e33');
    const grassD = createGrassTexture('#244a1f', '#2d5a27');
    for (let i = -1500; i < 600; i += 20) {
        const mat = new THREE.MeshStandardMaterial({ map: (i / 20) % 2 === 0 ? grassL : grassD });
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(260, 20), mat);
        strip.rotation.x = -Math.PI / 2; strip.position.z = i + 10;
        strip.receiveShadow = true;
        scene.add(strip);
    }

    // --- 4K PLAYER SETUP ---
    // Using the upgraded anatomical character function
    const playerModel = createFullCharacter(0xffffff, 0xffffff); // White pro jersey/pants
    player = playerModel.group;
    leftLeg = playerModel.lLeg;
    rightLeg = playerModel.rLeg;
    
    // Reference the torso group (the 3rd child in group) for walk-cycle bobbing
    torsoGroup = player.children[2]; 

    player.visible = false;
    scene.add(player);

    // --- GOAL SETUP ---
    const matGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
    const goal = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 15, 16), matGold); p1.position.y = 7.5;
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 18, 16), matGold); p2.rotation.z = Math.PI / 2; p2.position.y = 15;
    const p3 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20, 16), matGold); p3.position.set(-9, 25, 0);
    const p4 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20, 16), matGold); p4.position.set(9, 25, 0);
    goal.traverse(m => { if(m.isMesh) m.castShadow = true; });
    goal.add(p1, p2, p3, p4); goal.position.z = -480;
    scene.add(goal);

    // --- BOTS ---
    for (let i = 0; i < 5; i++) teammates.push(new Bot((i - 2) * 20, 130, 0xffffff, true));
    for (let i = 0; i < 12; i++) enemies.push(new Bot((Math.random() - 0.5) * 150, -100 - i * 60, 0xbb0000, false));

    // --- BALL HANDLING ---
    ballInHand = createEliteBall();
    ballInHand.position.set(1.2, -0.9, -2);
    camera.add(ballInHand);
    scene.add(camera);

    // --- INPUTS & EVENTS ---
    document.getElementById('start-btn').onclick = () => {
        gameActive = true; 
        document.getElementById('menu').style.display = 'none'; 
        document.body.requestPointerLock();
    };

    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase(); 
        keys[k] = true;
        if (k === 'u') { is3rd = !is3rd; player.visible = is3rd; ballInHand.visible = !is3rd; }
        if (gameActive && k === 'y') kickBall(); // Unlimited kicking enabled
    });

    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    window.addEventListener('mousemove', (e) => {
        if (gameActive) {
            targetYaw -= e.movementX * 0.0015; 
            targetPitch -= e.movementY * 0.0015;
            targetPitch = Math.max(-1.4, Math.min(1.4, targetPitch));
        }
    });

    window.addEventListener('mousedown', () => { if (gameActive) throwBall(); });

    animate();
}

// Ensure your createFullCharacter function includes the anatomical details:
function createFullCharacter(jerseyCol, pantsCol) {
    const group = new THREE.Group();
    const charGroup = new THREE.Group();
    const jerseyMat = new THREE.MeshStandardMaterial({ color: jerseyCol, roughness: 0.4, metalness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.9 });
    const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 1, roughness: 0, transparent: true, opacity: 0.85 });

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.2, 2.8, 24), jerseyMat);
    chest.position.y = 1.4; chest.scale.set(1.15, 1, 0.75); 
    charGroup.add(chest);

    const padGeom = new THREE.SphereGeometry(1, 24, 24);
    const lPad = new THREE.Mesh(padGeom, jerseyMat);
    lPad.position.set(1.5, 2.5, 0); lPad.scale.set(1.3, 0.65, 1.2); lPad.rotation.z = -0.4;
    const rPad = lPad.clone(); rPad.position.x = -1.5; rPad.rotation.z = 0.4;
    charGroup.add(lPad, rPad);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 32), jerseyMat);
    helm.position.y = 3.5;
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.28, 16, 32, Math.PI), visorMat);
    visor.position.set(0, 3.4, -0.6); visor.scale.set(1.2, 0.65, 1);
    charGroup.add(helm, visor);

    const createLeg = (side) => {
        const legPivot = new THREE.Group();
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 2, 16), pantsMat);
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.35, 1.8, 16), pantsMat);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.8), new THREE.MeshStandardMaterial({color: 0x111111}));
        thigh.position.y = -1.0; calf.position.y = -2.8; shoe.position.set(0, -3.7, -0.4);
        legPivot.add(thigh, calf, shoe);
        legPivot.position.set(side * 0.8, 2.4, 0);
        return legPivot;
    };
    
    const lLeg = createLeg(1); const rLeg = createLeg(-1);
    charGroup.position.y = 2.7;
    group.add(lLeg, rLeg, charGroup);
    return { group, lLeg, rLeg };
}
function throwBall() {
    const b = createEliteBall();
    const p = new THREE.Vector3();
    if (!is3rd) ballInHand.getWorldPosition(p); else p.copy(playerPos).add(new THREE.Vector3(0, 5, 0));
    b.position.copy(p);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    footballs.push({ mesh: b, vel: dir.multiplyScalar(4.5), grav: -0.05, rotSpeed: 0.5, scored: false });
    scene.add(b);
}

function kickBall() {
    const b = createEliteBall();
    b.position.copy(playerPos).add(new THREE.Vector3(0, 1, -2));
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    dir.y += 0.45;
    footballs.push({ mesh: b, vel: dir.multiplyScalar(5.2), grav: -0.04, rotSpeed: 0.2, scored: false });
    scene.add(b);
}

function animate() {
    requestAnimationFrame(animate);
    if (gameActive) {
        currentYaw += (targetYaw - currentYaw) * 0.15;
        currentPitch += (targetPitch - currentPitch) * 0.15;

        const moving = keys['w'] || keys['s'] || keys['a'] || keys['d'];
        const speed = keys['shift'] ? 1.4 : 0.85;
        const f = new THREE.Vector3(Math.sin(currentYaw), 0, Math.cos(currentYaw)).negate();
        const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();

        if (keys['w']) playerPos.addScaledVector(f, speed);
        if (keys['s']) playerPos.addScaledVector(f, -speed);
        if (keys['a']) playerPos.addScaledVector(r, -speed);
        if (keys['d']) playerPos.addScaledVector(r, speed);

        if (moving && !isKicking) {
            walkCycle += keys['shift'] ? 0.3 : 0.15;
            const swing = Math.sin(walkCycle) * 0.6;
            leftLeg.rotation.x = swing; rightLeg.rotation.x = -swing;
            leftArm.rotation.x = -swing; rightArm.rotation.x = swing;
            torsoGroup.position.y = 2.7 + Math.abs(Math.cos(walkCycle)) * 0.15;
        }

        player.position.copy(playerPos);
        player.rotation.y = currentYaw;
        camera.rotation.set(currentPitch, currentYaw, 0, 'YXZ');

        if (!is3rd) camera.position.copy(playerPos).add(new THREE.Vector3(0, 5.5, 0.1));
        else {
            const offset = new THREE.Vector3(0, 10, 20).applyQuaternion(camera.quaternion);
            camera.position.lerp(playerPos.clone().add(offset), 0.1);
        }

        enemies.forEach(e => e.update(playerPos));
        teammates.forEach(t => t.update(playerPos));

        for (let i = footballs.length - 1; i >= 0; i--) {
            let fb = footballs[i];
            fb.vel.y += fb.grav; fb.mesh.position.add(fb.vel);
            if (!fb.scored && fb.mesh.position.z < -480) {
                if (fb.mesh.position.y > 15 && Math.abs(fb.mesh.position.x) < 9) {
                    fb.scored = true; score += 3; document.getElementById('score').innerText = score;
                    resetPlay("FIELD GOAL!");
                }
            }
            if (fb.mesh.position.y < 0) { scene.remove(fb.mesh); footballs.splice(i, 1); }
        }

        if (playerPos.z < -450) { score += 7; document.getElementById('score').innerText = score; resetPlay("TOUCHDOWN!"); }
    }
    renderer.render(scene, camera);
}
init();
