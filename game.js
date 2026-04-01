import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// --- SCENE & RENDERER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- FIELD SETUP ---
const grassMat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
const field = new THREE.Mesh(new THREE.PlaneGeometry(80, 1000), grassMat);
field.rotation.x = -Math.PI / 2;
field.receiveShadow = true;
scene.add(field);

// Yard Lines (Every 10 yards)
for (let i = -500; i < 500; i += 10) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, i);
    scene.add(line);
}

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(20, 50, 20);
light.castShadow = true;
scene.add(light, new THREE.AmbientLight(0xffffff, 0.6));

// --- FOOTBALL LOGIC ---
const footballs = [];
const ballGeo = new THREE.SphereGeometry(0.35, 12, 8);
ballGeo.scale(1, 0.65, 0.65); // Prolate spheroid shape
const ballMat = new THREE.MeshStandardMaterial({ color: 0x6e3614, roughness: 0.7 });

let isCharging = false;
let throwPower = 0;
const powerMeter = document.getElementById('power-meter');
const powerFill = document.getElementById('power-fill');

function throwFootball() {
    const ball = new THREE.Mesh(ballGeo, ballMat);
    camera.getWorldPosition(ball.position);
    
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y += 0.3; // Natural QB arc
    dir.normalize();

    const force = 15 + (throwPower * 45);
    footballs.push({ 
        mesh: ball, 
        vel: dir.multiplyScalar(force), 
        grav: -18,
        rot: new THREE.Vector3(Math.random(), 5, Math.random()) 
    });
    scene.add(ball);
}

// --- DEFENDER AI ---
class Defender {
    constructor(z) {
        this.group = new THREE.Group();
        const jersey = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x2980b9 }));
        jersey.position.y = 1.7;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
        head.position.y = 2.8;
        this.group.add(jersey, head);
        this.group.position.set((Math.random()-0.5)*40, 0, z);
        scene.add(this.group);
        this.speed = 7 + Math.random() * 5;
    }
    update(delta, pPos) {
        const d = new THREE.Vector3().subVectors(pPos, this.group.position);
        d.y = 0; d.normalize();
        this.group.position.addScaledVector(d, this.speed * delta);
        this.group.lookAt(pPos.x, 0, pPos.z);
        if(this.group.position.distanceTo(pPos) < 1.8) { location.reload(); } // Tackle
    }
}
const defenders = [];
for(let i=0; i<12; i++) defenders.push(new Defender(-40 - (i * 25)));

// --- CONTROLS ---
const controls = new PointerLockControls(camera, document.body);
document.getElementById('start-btn').onclick = () => controls.lock();
controls.addEventListener('lock', () => document.getElementById('menu-container').style.display = 'none');
controls.addEventListener('unlock', () => document.getElementById('menu-container').style.display = 'flex');

let move = { w: false, s: false, a: false, d: false, shift: false };
document.addEventListener('keydown', (e) => { 
    if(e.code === 'ShiftLeft') move.shift = true;
    const k = e.key.toLowerCase(); if(move.hasOwnProperty(k)) move[k] = true;
});
document.addEventListener('keyup', (e) => { 
    if(e.code === 'ShiftLeft') move.shift = false;
    const k = e.key.toLowerCase(); if(move.hasOwnProperty(k)) move[k] = false;
});

window.onmousedown = () => { if(controls.isLocked) { isCharging = true; powerMeter.style.display = 'block'; }};
window.onmouseup = () => { 
    if(isCharging) {
        throwFootball();
        isCharging = false; throwPower = 0;
        powerMeter.style.display = 'none';
        camera.fov = 75; camera.updateProjectionMatrix();
    }
};

// --- LOOP ---
let lastTime = performance.now();
let bob = 0;

function animate() {
    requestAnimationFrame(animate);
    const dt = (performance.now() - lastTime) / 1000;
    lastTime = performance.now();

    if (controls.isLocked) {
        if(isCharging) {
            throwPower = Math.min(throwPower + dt * 1.2, 1);
            powerFill.style.width = (throwPower * 100) + "%";
            camera.fov = 75 - (throwPower * 15);
            camera.updateProjectionMatrix();
        }

        const s = move.shift ? 18 : 11;
        if(move.w) controls.moveForward(s * dt);
        if(move.s) controls.moveForward(-s * dt);
        if(move.a) controls.moveRight(-s * dt);
        if(move.d) controls.moveRight(s * dt);

        if(move.w || move.s || move.a || move.d) {
            bob += dt * (move.shift ? 18 : 12);
            camera.position.y = 3.2 + Math.sin(bob) * 0.2;
        } else {
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, 3.2, 0.1);
        }

        defenders.forEach(def => def.update(dt, camera.position));

        for(let i = footballs.length-1; i>=0; i--) {
            const b = footballs[i];
            b.vel.y += b.grav * dt;
            b.mesh.position.addScaledVector(b.vel, dt);
            b.mesh.rotation.x += b.rot.y * dt;
            if(b.mesh.position.y < 0.2) { b.mesh.position.y = 0.2; b.vel.set(0,0,0); }
        }
    }
    renderer.render(scene, camera);
}
animate();
