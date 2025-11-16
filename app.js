// ====== CONFIG: paste your firebaseConfig below ======
const firebaseConfig = {
  apiKey: "AIzaSyCMMEBa1FU-ZfA7aIr043gPFDB4QgUy4-o",
  authDomain: "rancho-bathroom-app.firebaseapp.com",
  projectId: "rancho-bathroom-app",
  storageBucket: "rancho-bathroom-app.firebasestorage.app",
  messagingSenderId: "614863075730",
  appId: "1:614863075730:web:ebca60bdc7e0c6442ee94b",
  measurementId: "G-5V41FQ9DHR"
};
// =====================================================

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const markersContainer = document.getElementById('markers');
const refreshBtn = document.getElementById('refreshBtn');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modal-title');
const modalStatus = document.getElementById('modal-status');
const modalQueueCount = document.getElementById('modal-queue-count');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const adminArea = document.getElementById('admin-area');
const adminStatus = document.getElementById('adminStatus');
const saveAdmin = document.getElementById('saveAdmin');

let bathrooms = {}; // local cache
let currentBathId = null;
let username = localStorage.getItem('username') || prompt("Enter a display name for queues") || 'anon';
localStorage.setItem('username', username);

// Utility to create markers on map from DB data
function renderMarkers(){
  markersContainer.innerHTML = '';
  Object.keys(bathrooms).forEach(id => {
    const b = bathrooms[id];
    const el = document.createElement('div');
    el.className = 'marker ' + (b.status === 'open' ? 'open' : (b.queue && b.queue.length ? 'queue' : 'closed'));
    el.style.left = (b.xPercent || 50) + '%';
    el.style.top = (b.yPercent || 50) + '%';
    el.dataset.id = id;
    el.title = `${b.name} — ${b.status}`;
    el.innerText = b.queue ? String(b.queue.length) : '0';
    el.addEventListener('click', () => openModal(id));
    markersContainer.appendChild(el);
  });
}

// Load from Firebase once, and subscribe to updates
function subscribeToBathrooms(){
  const ref = db.ref('bathrooms');
  ref.on('value', snapshot => {
    const val = snapshot.val() || {};
    bathrooms = val;
    renderMarkers();
    // if modal open for current, update modal
    if(currentBathId) populateModal(currentBathId);
  });
}

function openModal(id){
  currentBathId = id;
  populateModal(id);
  modal.classList.remove('hidden');
  modal.style.position = 'fixed';
  modal.style.inset = 0;
  modal.querySelector('#modal-card').scrollIntoView();
}

function populateModal(id){
  const b = bathrooms[id];
  if(!b) return;
  modalTitle.innerText = b.name;
  modalStatus.innerText = `Status: ${b.status || 'unknown'}`;
  modalQueueCount.innerText = `Queue: ${b.queue ? b.queue.length : 0}`;
  // show/hide join/leave
  const inQueue = (b.queue || []).includes(username);
  joinBtn.disabled = (b.status !== 'open');
  joinBtn.classList.toggle('hidden', inQueue);
  leaveBtn.classList.toggle('hidden', !inQueue);
  // admin area
  adminStatus.value = b.status || 'open';
}

// Join queue
joinBtn.addEventListener('click', async () => {
  if(!currentBathId) return;
  const ref = db.ref(`bathrooms/${currentBathId}/queue`);
  const snap = await ref.once('value');
  let q = snap.val() || [];
  if(q.includes(username)) return;
  q.push(username);
  await ref.set(q);
});

// Leave queue
leaveBtn.addEventListener('click', async () => {
  if(!currentBathId) return;
  const ref = db.ref(`bathrooms/${currentBathId}/queue`);
  const snap = await ref.once('value');
  let q = snap.val() || [];
  q = q.filter(u => u !== username);
  await ref.set(q);
});

// Admin save
saveAdmin.addEventListener('click', async () => {
  if(!currentBathId) return;
  const newStatus = adminStatus.value;
  await db.ref(`bathrooms/${currentBathId}/status`).set(newStatus);
  // optionally clear queue when closed
  if(newStatus !== 'open'){
    await db.ref(`bathrooms/${currentBathId}/queue`).set([]);
  }
});

// close modal
closeModal.addEventListener('click', () => {
  modal.classList.add('hidden');
  currentBathId = null;
});

// refresh
refreshBtn.addEventListener('click', () => subscribeToBathrooms());

// initial
subscribeToBathrooms();

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
