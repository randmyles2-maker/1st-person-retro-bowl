let scene, camera, renderer, player, ballInHand, is3rd = false;
let score = 0, gameActive = false, footballs = [], enemies = [], teammates = [], keys = {};
const playerPos = new THREE.Vector3(0, 0, 150);

let targetYaw = 0, targetPitch = 0;
let currentYaw = 0, currentPitch = 0;
let shake = 0, walkCycle = 0;
let isKicking = false, kickProgress = 0;

let leftLeg, rightLeg, leftArm, rightArm, torsoGroup;

// --- BOT CLASS ---
class Bot {
    constructor(x, z, color, isTeammate) {
        // Optimization: Bots use 12 segments (standard for 2K) instead of 32
        const char = createFullCharacter(color, 0x002244, false);
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

// --- OPTIMIZED MODELS ---
function createFullCharacter(jerseyCol, pantsCol, isPlayer = false) {
    const group = new THREE.Group();
    const charGroup = new THREE.Group();
    
    // Performance: Higher segments for player (24), lower for bots (12)
    const segments = isPlayer ? 24 : 12;
    
    // Performance: Standard materials are much faster than Physical materials
    const jerseyMat = new THREE.MeshStandardMaterial({ color: jerseyCol, roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.8 });
    
    // Visor: Use Physical (glass-like) only for the player
    const visorMat = isPlayer ? 
        new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 1, roughness: 0, transparent: true, opacity: 0.8 }) :
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.2, 2.8, segments), jerseyMat);
    chest.position.y = 1.4; chest.scale.set(1.15, 1, 0.75); 
    charGroup.add(chest);

    const padGeom = new THREE.SphereGeometry(1, segments, segments);
    const lPad = new THREE.Mesh(padGeom, jerseyMat);
    lPad.position.set(1.5, 2.5, 0); lPad.scale.set(1.3, 0.65, 1.2); lPad.rotation.z = -0.4;
    const rPad = lPad.clone(); rPad.position.x = -1.5; rPad.rotation.z = 0.4;
    charGroup.add(lPad, rPad);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.1, segments, segments), jerseyMat);
    helm.position.y = 3.5;
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.28, 16, segments, Math.PI), visorMat);
    visor.position.set(0, 3.4, -0.6); visor.scale.set(1.2, 0.65, 1);
    charGroup.add(helm, visor);

    const createLeg = (side) => {
        const legPivot = new THREE.Group();
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 2, segments), pantsMat);
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.35, 1.8, segments), pantsMat);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.8), new THREE.MeshStandardMaterial({color: 0x111111}));
        thigh.position.y = -1.0; calf.position.y = -2.8; shoe.position.set(0, -3.7, -0.4);
        legPivot.add(thigh, calf, shoe);
        legPivot.position.set(side * 0.8, 2.4, 0);
        return legPivot;
    };
    
    const lLeg = createLeg(1); const rLeg = createLeg(-1);
    charGroup.position.y = 2.7;
    group.add(lLeg, rLeg, charGroup);

    // Optimization: Only player casts shadows
    group.traverse(child => { if (child.isMesh) child.castShadow = isPlayer; });

    return { group, lLeg, rLeg };
}

function createEliteBall() {
    const ball = new THREE.Group();
    const leather = new THREE.MeshStandardMaterial({ color: 0x4d2613, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), leather);
    body.scale.set(1, 0.8, 1.8);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 16), ringMat);
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
    for (let i = 0; i < 10000; i++) {
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
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    
    // Performance: Cap resolution to 2K (1.5 pixel ratio)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const hemiLight = new THREE.HemisphereLight(0x60a3bc, 0x2d5a27, 0.7);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(50, 200, 50);
    sun.castShadow = true;
    
    // 2K Optimization: 1024 is plenty for sharp shadows at 2K resolution
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    scene.add(sun);

    const grassL = createGrassTexture('#2d5a27', '#3a6e33');
    const grassD = createGrassTexture('#244a1f', '#2d5a27');
    for (let i = -1500; i < 600; i += 20) {
        const mat = new THREE.MeshStandardMaterial({ map: (i / 20) % 2 === 0 ? grassL : grassD });
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(260, 20), mat);
        strip.rotation.x = -Math.PI / 2; strip.position.z = i + 10;
        strip.receiveShadow = true;
        scene.add(strip);
    }

    // PLAYER SETUP
    const playerModel = createFullCharacter(0xffffff, 0xffffff, true);
    player = playerModel.group;
    leftLeg = playerModel.lLeg;
    rightLeg = playerModel.rLeg;
    
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const createArm = (side) => {
        const p = new THREE.Group();
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.2, 12), matWhite);
        u.position.y = -0.6; p.add(u);
        p.position.set(side * 1.3, 1.8, 0); return p;
    };
    leftArm = createArm(1); rightArm = createArm(-1);
    torsoGroup = player.children[2];
    torsoGroup.add(leftArm, rightArm);
    
    player.visible = false;
    scene.add(player);

    // GOAL
    const matGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
    const goal = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 15, 12), matGold); p1.position.y = 7.5;
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 18, 12), matGold); p2.rotation.z = Math.PI / 2; p2.position.y = 15;
    const p3 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20, 12), matGold); p3.position.set(-9, 25, 0);
    const p4 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20, 12), matGold); p4.position.set(9, 25, 0);
    goal.traverse(m => { if(m.isMesh) m.castShadow = true; });
    goal.add(p1, p2, p3, p4); goal.position.z = -480;
    scene.add(goal);

    for (let i = 0; i < 5; i++) teammates.push(new Bot((i - 2) * 20, 130, 0xffffff, true));
    for (let i = 0; i < 12; i++) enemies.push(new Bot((Math.random() - 0.5) * 150, -100 - i * 60, 0xbb0000, false));

    ballInHand = createEliteBall();
    ballInHand.position.set(1.2, -0.9, -2);
    camera.add(ballInHand);
    scene.add(camera);

    document.getElementById('start-btn').onclick = () => {
        gameActive = true; document.getElementById('menu').style.display = 'none'; document.body.requestPointerLock();
    };

    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase(); keys[k] = true;
        if (k === 'u') { is3rd = !is3rd; player.visible = is3rd; ballInHand.visible = !is3rd; }
        if (gameActive && k === 'y' && !isKicking) { isKicking = true; kickProgress = 0; kickBall(); }
    });
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('mousemove', (e) => {
        if (gameActive) {
            targetYaw -= e.movementX * 0.0015; targetPitch -= e.movementY * 0.0015;
            targetPitch = Math.max(-1.4, Math.min(1.4, targetPitch));
        }
    });
    window.addEventListener('mousedown', () => { if (gameActive) throwBall(); });

    animate();
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
