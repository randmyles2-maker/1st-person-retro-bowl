import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Field & Environment
const field = new THREE.Mesh(new THREE.PlaneGeometry(100, 1000), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
field.rotation.x = -Math.PI / 2;
field.receiveShadow = true;
scene.add(field);

// Light
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 50, 10);
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.5));

// Football Physics
const footballs = [];
const ballGeo = new THREE.SphereGeometry(0.3, 12, 8);
ballGeo.scale(1, 0.7, 0.7);
const ballMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

let isCharging = false;
let throwPower = 0;
const powerMeter = document.getElementById('power-meter');
const powerFill = document.getElementById('power-fill');

function throwBall() {
    const ball = new THREE.Mesh(ballGeo, ballMat);
    camera.getWorldPosition(ball.position);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y += 0.25;
    dir.normalize();
    footballs.push({ 
        mesh: ball, 
        vel: dir.multiplyScalar(20 + throwPower * 40), 
        grav: -18,
        rot: Math.random() * 10 
    });
    scene.add(ball);
}

// Controls
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
        throwBall();
        isCharging = false; throwPower = 0;
        powerMeter.style.display = 'none';
    }
};

let lastTime = performance.now();
let bob = 0;

function animate() {
    requestAnimationFrame(animate);
    const dt = (performance.now() - lastTime) / 1000;
    lastTime = performance.now();

    if (controls.isLocked) {
        if(isCharging) {
            throwPower = Math.min(throwPower + dt, 1);
            powerFill.style.width = (throwPower * 100) + "%";
        }
        const s = move.shift ? 18 : 11;
        if(move.w) controls.moveForward(s * dt);
        if(move.s) controls.moveForward(-s * dt);
        if(move.a) controls.moveRight(-s * dt);
        if(move.d) controls.moveRight(s * dt);

        if(move.w || move.s || move.a || move.d) {
            bob += dt * (move.shift ? 18 : 12);
            camera.position.y = 3.5 + Math.sin(bob) * 0.15;
        }

        footballs.forEach((b, i) => {
            b.vel.y += b.grav * dt;
            b.mesh.position.addScaledVector(b.vel, dt);
            b.mesh.rotation.x += 10 * dt;
            if(b.mesh.position.y < 0.2) { b.mesh.position.y = 0.2; b.vel.set(0,0,0); }
        });
    }
    renderer.render(scene, camera);
}
animate();
