import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// --- CONFIG ---
const SCORING_Z = -200;
let score = 0;

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- WORLD BUILDING ---
const grassTex = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.8 });
const field = new THREE.Mesh(new THREE.PlaneGeometry(80, 1000), grassTex);
field.rotation.x = -Math.PI / 2;
field.receiveShadow = true;
scene.add(field);

// Endzone Detail
const endzone = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
endzone.rotation.x = -Math.PI / 2;
endzone.position.set(0, 0.05, SCORING_Z - 20);
scene.add(endzone);

// Stadium Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(50, 100, 50);
sun.castShadow = true;
scene.add(sun);

// --- FOOTBALLS ---
const footballs = [];
const ballGeo = new THREE.SphereGeometry(0.35, 16, 12);
ballGeo.scale(1, 0.6, 0.6);
const ballMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.5 });

function shootBall(power) {
    const ball = new THREE.Mesh(ballGeo, ballMat);
    camera.getWorldPosition(ball.position);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y += 0.3;
    dir.normalize();
    footballs.push({ mesh: ball, vel: dir.multiplyScalar(20 + power * 50), grav: -22 });
    scene.add(ball);
}

// --- UPGRADED AI DEFENDERS ---
class Defender {
    constructor(z, isElite = false) {
        this.group = new THREE.Group();
        const color = isElite ? 0xff3333 : 0x3366ff;
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.6), new THREE.MeshStandardMaterial({ color }));
        body.position.y = 0.9;
        this.group.add(body);
        this.group.position.set((Math.random() - 0.5) * 60, 0, z);
        this.speed = isElite ? 15 : 10;
        scene.add(this.group);
    }
    update(dt, pPos) {
        const dir = new THREE.Vector3().subVectors(pPos, this.group.position);
        dir.y = 0; dir.normalize();
        this.group.position.addScaledVector(dir, this.speed * dt);
        this.group.lookAt(pPos.x, 0, pPos.z);
        if (this.group.position.distanceTo(pPos) < 2) handleTackle();
    }
}

let defenders = [];
function spawnDefenders() {
    defenders.forEach(d => scene.remove(d.group));
    defenders = [];
    for(let i=0; i<15; i++) defenders.push(new Defender(-40 - (i * 25), Math.random() > 0.8));
}
spawnDefenders();

// --- GAME LOGIC ---
const controls = new PointerLockControls(camera, document.body);
document.getElementById('start-btn').onclick = () => controls.lock();
controls.addEventListener('lock', () => document.getElementById('menu-container').style.display = 'none');
controls.addEventListener('unlock', () => document.getElementById('menu-container').style.display = 'flex');

function handleTackle() {
    alert("CRUNCHED! Play over.");
    camera.position.set(0, 3.5, 20);
    spawnDefenders();
}

function handleTouchdown() {
    score += 7;
    document.getElementById('score-val').innerText = score;
    const overlay = document.getElementById('td-overlay');
    overlay.style.display = 'flex';
    setTimeout(() => { 
        overlay.style.display = 'none';
        camera.position.set(0, 3.5, 20);
        spawnDefenders();
    }, 2000);
}

let isCharging = false;
let charge = 0;
const pMeter = document.getElementById('power-meter');
const pFill = document.getElementById('power-fill');

window.onmousedown = () => { if(controls.isLocked) { isCharging = true; pMeter.style.display = 'block'; }};
window.onmouseup = () => { 
    if(isCharging) {
        shootBall(charge);
        isCharging = false; charge = 0; pMeter.style.display = 'none';
        camera.fov = 75; camera.updateProjectionMatrix();
    }
};

// --- INPUTS ---
let keys = { w: false, s: false, a: false, d: false, shift: false };
document.addEventListener('keydown', (e) => { 
    if(e.code === 'ShiftLeft') keys.shift = true;
    const k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = true;
});
document.addEventListener('keyup', (e) => { 
    if(e.code === 'ShiftLeft') keys.shift = false;
    const k = e.key.toLowerCase(); if(keys.hasOwnProperty(k)) keys[k] = false;
});

// --- ANIMATION LOOP ---
let lastTime = performance.now();
let bob = 0;

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (controls.isLocked) {
        if(isCharging) {
            charge = Math.min(charge + dt * 1.5, 1);
            pFill.style.width = (charge * 100) + "%";
            camera.fov = 75 - (charge * 10);
            camera.updateProjectionMatrix();
        }

        const moveSpeed = keys.shift ? 22 : 12;
        if (keys.w) controls.moveForward(moveSpeed * dt);
        if (keys.s) controls.moveForward(-moveSpeed * dt);
        if (keys.a) controls.moveRight(-moveSpeed * dt);
        if (keys.d) controls.moveRight(moveSpeed * dt);

        if (keys.w || keys.s || keys.a || keys.d) {
            bob += dt * (keys.shift ? 18 : 12);
            camera.position.y = 3.5 + Math.sin(bob) * 0.2;
            camera.rotation.z = Math.sin(bob * 0.5) * 0.03;
        }

        // Defenders & Footballs
        defenders.forEach(d => d.update(dt, camera.position));
        footballs.forEach((b, i) => {
            b.vel.y += b.grav * dt;
            b.mesh.position.addScaledVector(b.vel, dt);
            b.mesh.rotation.x += 10 * dt;
            if(b.mesh.position.y < 0.2) { b.mesh.position.y = 0.2; b.vel.set(0,0,0); }
        });

        // Scoring Check
        if (camera.position.z < SCORING_Z) handleTouchdown();
    }

    renderer.render(scene, camera);
}
animate();
