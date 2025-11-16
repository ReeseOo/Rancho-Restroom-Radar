// ====== CONFIG: paste your firebaseConfig below ======
const firebaseConfig = {
  apiKey: "AIzaSyCMMEBa1FU-ZfA7aIr043gPFDB4QgUy4-o",
  authDomain: "rancho-bathroom-app.firebaseapp.com",
  databaseURL: "https://rancho-bathroom-app-default-rtdb.firebaseio.com",
  projectId: "rancho-bathroom-app",
  storageBucket: "rancho-bathroom-app.firebasestorage.app",
  messagingSenderId: "614863075730",
  appId: "1:614863075730:web:ebca60bdc7e0c6442ee94b",
  measurementId: "G-5V41FQ9DHR"
};
// =====================================================

// 1. Initialize Firebase
firebase.initializeApp(firebaseConfig);

// 2. Get a reference to the Authentication service
const auth = firebase.auth(); // Now 'auth' is your control panel for Authentication

// 3. Get a reference to the Realtime Database service
const db = firebase.database();

// 4. NOW, you use methods on the 'auth' object to sign in a user.
//    For example, to sign in anonymously (creates a temporary user):
auth.signInAnonymously()
  .then(() => {
    // User is signed in!
    console.log("User signed in anonymously!");
    // At this point, if you try to access the database,
    // the Security Rules will see 'auth != null' as true.
  })
  .catch((error) => {
    console.error("Error signing in anonymously:", error);
  });

// Or, for email/password:
// auth.signInWithEmailAndPassword("user@example.com", "password123")
//   .then((userCredential) => {
//     console.log("User signed in:", userCredential.user.uid);
//   })
//   .catch((error) => {
//     console.error("Error signing in:", error);
//   });


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
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

let bathrooms = {}; // local cache
let currentBathId = null;
let username = localStorage.getItem('username') || prompt("Enter a display name for queues") || 'anon';
localStorage.setItem('username', username);

let isAdmin = false; // Track admin status

// Function to enable admin privileges
function enableAdminPrivileges() {
  isAdmin = true;
  adminArea.style.display = 'block'; // Show admin area
  adminLoginBtn.classList.add('hidden'); // Hide login button
  adminLogoutBtn.classList.remove('hidden'); // Show logout button
}

// Function to disable admin privileges
function disableAdminPrivileges() {
  isAdmin = false;
  adminArea.style.display = 'none'; // Hide admin area
  adminLoginBtn.classList.remove('hidden'); // Show login button
  adminLogoutBtn.classList.add('hidden'); // Hide logout button
}

// Admin login button click event
adminLoginBtn.addEventListener('click', () => {
  const password = prompt('Enter the 6-digit admin password:');
  if (password === '271846') {
    alert('Admin privileges granted.');
    enableAdminPrivileges();
  } else {
    alert('Incorrect password. Access denied.');
  }
});

// Admin logout button click event
adminLogoutBtn.addEventListener('click', () => {
  alert('Admin privileges revoked.');
  disableAdminPrivileges();
});

// Disable admin privileges by default on page load
disableAdminPrivileges();

// Utility to create markers on map from DB data
function renderMarkers() {
  markersContainer.innerHTML = '';
  Object.keys(bathrooms).forEach(id => {
    const b = bathrooms[id];
    const el = document.createElement('div');
    el.className = 'marker ' + (b.status === 'open' ? 'open' : (b.queue && b.queue.length ? 'queue' : 'closed'));
    el.style.left = (typeof b.xPercent === 'number' && !isNaN(b.xPercent) ? b.xPercent : 50) + '%';
    el.style.top = (typeof b.yPercent === 'number' && !isNaN(b.yPercent) ? b.yPercent : 50) + '%';
    el.dataset.id = id;
    el.title = `${b.name} — ${b.status}`;
    el.innerText = b.queue ? String(b.queue.length) : '0';

    // Add click event to expand the corresponding bathroom item
    el.addEventListener('click', () => {
      const listItem = document.querySelector(`.bathroom-item[data-id="${id}"]`);
      if (listItem) {
        // Simulate a click on the corresponding bathroom item
        listItem.click();
        listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    markersContainer.appendChild(el);
  });
}

// Utility to check if a user is already in a queue
async function isUserInQueue() {
  const snapshot = await db.ref('bathrooms').once('value');
  const bathroomsData = snapshot.val() || {};
  for (const id in bathroomsData) {
    const queue = bathroomsData[id].queue || [];
    if (queue.some(user => user.name === username)) {
      return id; // Return the bathroom ID where the user is in the queue
    }
  }
  return null;
}

// Utility to update the user's queue status display
function updateUserQueueStatus(bathroomId, position) {
  const queueStatus = document.getElementById('user-queue-status');
  const bathroomName = document.getElementById('queue-bathroom-name');
  const queuePosition = document.getElementById('queue-position');

  if (bathroomId != null && position != null) {
    queueStatus.classList.remove('hidden');
    bathroomName.innerText = bathrooms[bathroomId].name;
    queuePosition.innerText = position + 1; // Convert zero-based index to 1-based
  } else {
    queueStatus.classList.add('hidden');
  }

}

// Utility to remove users from the queue after 8 minutes
function enforceQueueTimeout() {
  const now = Date.now();
  Object.keys(bathrooms).forEach(async id => {
    const queue = bathrooms[id].queue || [];
    const updatedQueue = queue.filter(user => now - user.timestamp < 8 * 60 * 1000); // 8 minutes
    if (queue.length !== updatedQueue.length) {
      await db.ref(`bathrooms/${id}/queue`).set(updatedQueue);

      // If the current user was removed, clear their queue status
      if (queue.some(user => user.name === username) && !updatedQueue.some(user => user.name === username)) {
        updateUserQueueStatus(null, null);
      }
    }
  });
}

// Periodically enforce the queue timeout
setInterval(enforceQueueTimeout, 60 * 1000); // Check every minute

// Utility to create a list of bathrooms
function renderBathroomList() {
  const listContainer = document.getElementById('bathroom-list');
  listContainer.innerHTML = ''; // Clear the list

  // Sort bathrooms: open first, then closed
  const sortedBathrooms = Object.keys(bathrooms).sort((a, b) => {
    const statusOrder = { open: 1, queue: 2, closed: 3 };
    return statusOrder[bathrooms[a].status] - statusOrder[bathrooms[b].status];
  });

  // Create list items
  sortedBathrooms.forEach(id => {
    const b = bathrooms[id];
    const item = document.createElement('div');
    item.className = `bathroom-item ${b.status}`;
    item.setAttribute('data-id', id); // Add data-id attribute
    item.innerText = `${b.name} — ${b.status}`;

    // Add click event to toggle expanded state
    item.addEventListener('click', () => {
      const isExpanded = item.classList.contains('expanded');
      // Collapse all other items
      document.querySelectorAll('.bathroom-item.expanded').forEach(el => {
        el.classList.remove('expanded');
        el.querySelector('.bathroom-details').remove();
      });

      if (!isExpanded) {
        item.classList.add('expanded');
        const details = document.createElement('div');
        details.className = 'bathroom-details';
        details.innerHTML = `
          <p>Status: ${b.status || 'unknown'}</p>
          <p>Queue: ${b.queue ? b.queue.length : 0}</p>
          <div class="queue-actions">
            <button class="join-btn" ${b.status !== 'open' ? 'disabled' : ''}>Join Queue</button>
            <button class="leave-btn ${!(b.queue || []).some(user => user.name === username) ? 'hidden' : ''}">Leave Queue</button>
          </div>
          ${
            isAdmin
              ? `<div class="admin-actions">
                  <label>Status:
                    <select class="admin-status">
                      <option value="open" ${b.status === 'open' ? 'selected' : ''}>Open</option>
                      <option value="closed" ${b.status === 'closed' ? 'selected' : ''}>Closed</option>
                      <option value="queue" ${b.status === 'queue' ? 'selected' : ''}>Queue</option>
                    </select>
                  </label>
                  <button class="save-status-btn">Save</button>
                </div>`
              : ''
          }
        `;

        // Add event listeners for join/leave buttons
        details.querySelector('.join-btn').addEventListener('click', async () => {
          const ref = db.ref(`bathrooms/${id}/queue`);
          const snap = await ref.once('value');
          let q = snap.val() || [];
          if (!q.some(user => user.name === username)) {
            q.push({ name: username, timestamp: Date.now() });
            await ref.set(q);
          }
        });

        details.querySelector('.leave-btn').addEventListener('click', async () => {
          const ref = db.ref(`bathrooms/${id}/queue`);
          const snap = await ref.once('value');
          let q = snap.val() || [];
          q = q.filter(user => user.name !== username);
          await ref.set(q);
        });

        // Add event listener for admin save button
        if (isAdmin) {
          details.querySelector('.save-status-btn').addEventListener('click', async () => {
            const newStatus = details.querySelector('.admin-status').value;
            await db.ref(`bathrooms/${id}/status`).set(newStatus);
            if (newStatus !== 'open') {
              await db.ref(`bathrooms/${id}/queue`).set([]); // Clear queue if status is not open
            }
            alert('Status updated successfully.');
          });
        }

        item.appendChild(details);
      } else {
        item.classList.remove('expanded');
        item.querySelector('.bathroom-details').remove();
      }
    });

    listContainer.appendChild(item);
  });
}

// Load from Firebase once, and subscribe to updates
function subscribeToBathrooms(){
  const ref = db.ref('bathrooms');
  ref.on('value', snapshot => {
    const val = snapshot.val() || {};
    bathrooms = val;
    renderMarkers();
    renderBathroomList();
    // if modal open for current, update modal
    if(currentBathId) populateModal(currentBathId);
  });
}

function openModal(id){
  currentBathId = id;
  populateModal(id);
  // modal.classList.remove('hidden');
  // modal.style.position = 'fixed';
  // modal.style.inset = 0;
  // modal.querySelector('#modal-card').scrollIntoView();
}

function populateModal(id){
  const b = bathrooms[id];
  if(!b) return;
  modalTitle.innerText = b.name;
  modalStatus.innerText = `Status: ${b.status || 'unknown'}`;
  modalQueueCount.innerText = `Queue: ${b.queue ? b.queue.length : 0}`;
  // show/hide join/leave
  const inQueue = (b.queue || []).some(user => user.name === username);
  joinBtn.disabled = (b.status !== 'open');
  joinBtn.classList.toggle('hidden', inQueue);
  leaveBtn.classList.toggle('hidden', !inQueue);
  // admin area
  adminStatus.value = b.status || 'open';
}

// Join queue
joinBtn.addEventListener('click', async () => {
  if (!currentBathId) return;

  // Check if the user is already in another queue
  const existingQueueId = await isUserInQueue();
  if (existingQueueId) {
    alert(`You are already in the queue for ${bathrooms[existingQueueId].name}. Please leave that queue first.`);
    return;
  }

  const ref = db.ref(`bathrooms/${currentBathId}/queue`);
  const snap = await ref.once('value');
  let q = snap.val() || [];
  if (q.some(user => user.name === username)) return;

  q.push({ name: username, timestamp: Date.now() });
  await ref.set(q);

  // Update the user's queue status
  updateUserQueueStatus(currentBathId, q.length - 1);
});

// Leave queue
leaveBtn.addEventListener('click', async () => {
  if (!currentBathId) return;

  const ref = db.ref(`bathrooms/${currentBathId}/queue`);
  const snap = await ref.once('value');
  let q = snap.val() || [];
  if (!Array.isArray(q)) {
    q = Object.values(q);
  }
  
  q = q.filter(user => user.name !== username);
  await ref.set(q);

  // Clear the user's queue status
  updateUserQueueStatus(null, null);
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
refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('loading');
  subscribeToBathrooms();
  setTimeout(() => refreshBtn.classList.remove('loading'), 1000); // Remove loading after 1 second
});

// initial
subscribeToBathrooms();

document.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("map-img");

  if (img) {
    img.addEventListener("click", (e) => {
      const rect = img.getBoundingClientRect();

      // Calculate click position as a percentage of the rendered dimensions
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      console.log("X:", xPercent.toFixed(2) + "%", "Y:", yPercent.toFixed(2) + "%");

      // Debugging: Log natural dimensions
      console.log("Rendered dimensions:", rect.width, rect.height);
      console.log("Natural dimensions:", img.naturalWidth, img.naturalHeight);
    });
  } else {
    console.error("Map image element with id 'map-img' not found.");
  }
});