// ==============================================================================
// MEDIA SHELF - APP LOGIC & SUPABASE INTEGRATION
// ==============================================================================

let supabase = null;
let currentCategory = "movies";
let currentFilter = "all";
let searchQuery = "";
let page = 0;
const PAGE_SIZE = 36;
let currentItems = [];
let totalCount = 0;
let isAdmin = localStorage.getItem("shelf_admin") === "true";
let selectedItem = null;

const CATEGORIES = [
  { id: "movies", label: "Movies", icon: "film", table: "movies" },
  { id: "television", label: "Television", icon: "tv", table: "television" },
  { id: "video_games", label: "Video Games", icon: "gamepad-2", table: "video_games" },
  { id: "books", label: "Books", icon: "book-open", table: "books" },
  { id: "comics", label: "Comics", icon: "book", table: "comics" },
  { id: "music", label: "Music", icon: "music", table: "music" }
];

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Finished" },
  { id: "plan", label: "Plan to" },
  { id: "favorites", label: "Favorites" },
  { id: "recommend", label: "Recommended" }
];

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  renderCategoryTabs();
  renderStatusFilters();
  updateAdminUI();
  fetchMedia(true);
});

function initSupabase() {
  if (window.SUPABASE_CONFIG && 
      SUPABASE_CONFIG.url !== "YOUR_SUPABASE_PROJECT_URL" && 
      SUPABASE_CONFIG.anonKey !== "YOUR_SUPABASE_ANON_KEY") {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
}

// ==============================================================================
// RENDER NAVIGATION & FILTERS
// ==============================================================================
function renderCategoryTabs() {
  const container = document.getElementById("category-tabs");
  container.innerHTML = CATEGORIES.map(cat => {
    const isActive = cat.id === currentCategory;
    return `
      <button 
        onclick="selectCategory('${cat.id}')" 
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
          isActive 
            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' 
            : 'bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700 border border-dark-700'
        }"
      >
        <i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i>
        <span>${cat.label}</span>
      </button>
    `;
  }).join("");
  lucide.createIcons();
}

function renderStatusFilters() {
  const container = document.getElementById("status-filters");
  container.innerHTML = STATUS_FILTERS.map(f => {
    const isActive = f.id === currentFilter;
    return `
      <button 
        onclick="selectFilter('${f.id}')" 
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
          isActive 
            ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' 
            : 'text-gray-400 hover:text-white bg-dark-800/40 border border-dark-700/50'
        }"
      >
        ${f.label}
      </button>
    `;
  }).join("");
}

function selectCategory(catId) {
  currentCategory = catId;
  page = 0;
  renderCategoryTabs();
  fetchMedia(true);
}

function selectFilter(filterId) {
  currentFilter = filterId;
  page = 0;
  renderStatusFilters();
  fetchMedia(true);
}

function handleSearch(val) {
  searchQuery = val.trim();
  const clearBtn = document.getElementById("clear-search");
  if (searchQuery.length > 0) {
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }
  page = 0;
  fetchMedia(true);
}

function clearSearch() {
  const input = document.getElementById("search-input");
  input.value = "";
  handleSearch("");
}

// ==============================================================================
// DATA FETCHING (SUPABASE REST / POSTGREST)
// ==============================================================================
async function fetchMedia(reset = false) {
  if (reset) {
    page = 0;
    currentItems = [];
    document.getElementById("media-grid").innerHTML = "";
  }

  const stats = document.getElementById("stats-counter");
  const emptyState = document.getElementById("empty-state");
  const loadMoreBtn = document.getElementById("btn-load-more");

  if (!supabase) {
    stats.innerHTML = `<span class="text-amber-400">⚠️ Setup required: Paste Supabase URL in config.js</span>`;
    return;
  }

  stats.innerText = "Loading collection...";

  const catObj = CATEGORIES.find(c => c.id === currentCategory) || CATEGORIES[0];
  const table = catObj.table;

  let query = supabase.from(table).select("*", { count: "exact" });

  // Status Filters
  if (currentFilter === "completed") {
    query = query.ilike("status", "%watched%").or("status.ilike.%read%,status.ilike.%played%,status.ilike.%listened%,status.ilike.%completed%");
  } else if (currentFilter === "plan") {
    query = query.ilike("status", "%plan%");
  } else if (currentFilter === "favorites") {
    query = query.or("favorite.ilike.%yes%,favorite.eq.true");
  } else if (currentFilter === "recommend") {
    query = query.or("recommend.ilike.%yes%,recommend.eq.true");
  }

  // Search Filter
  if (searchQuery) {
    if (table === "music") {
      query = query.or(`album.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`);
    } else {
      query = query.or(`title.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`);
    }
  }

  // Sorting
  if (table === "music") {
    query = query.order("artist", { ascending: true }).order("release_year", { ascending: false });
  } else {
    query = query.order("title", { ascending: true });
  }

  // Pagination Range
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;
  query = query.range(start, end);

  const { data, count, error } = await query;

  if (error) {
    console.error("Supabase Error:", error);
    stats.innerText = `Error loading: ${error.message}`;
    return;
  }

  totalCount = count || 0;
  stats.innerText = `${totalCount.toLocaleString()} ${catObj.label.toLowerCase()}`;

  if (reset) {
    currentItems = data || [];
  } else {
    currentItems = [...currentItems, ...(data || [])];
  }

  renderGrid(data || [], reset);

  if (currentItems.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  if (currentItems.length < totalCount) {
    loadMoreBtn.classList.remove("hidden");
  } else {
    loadMoreBtn.classList.add("hidden");
  }
}

function loadMoreItems() {
  page++;
  fetchMedia(false);
}

// ==============================================================================
// RENDER GRID & MEDIA CARDS
// ==============================================================================
function renderGrid(items, reset) {
  const grid = document.getElementById("media-grid");
  
  const cardsHtml = items.map(item => {
    const title = item.title || item.album || "Untitled";
    const subtitle = item.director || item.creator_studio || item.developer || item.author || item.artist || "";
    const year = item.release_year || item.publication_year || "";
    const cover = item.cover_url || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
    const status = item.status || "";
    const isFav = (item.favorite || "").toLowerCase().includes("yes");
    const isRec = (item.recommend || "").toLowerCase().includes("yes");

    return `
      <div 
        onclick="openDetailModal(${item.id})"
        class="card-hover group relative bg-dark-800 border border-dark-700/80 rounded-xl overflow-hidden cursor-pointer flex flex-col shadow-sm"
      >
        <!-- Poster / Cover Image -->
        <div class="relative aspect-[2/3] w-full bg-dark-900 overflow-hidden">
          <img 
            src="${cover}" 
            alt="${escapeHtml(title)}" 
            loading="lazy"
            onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80'"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          >
          
          <!-- Badges overlay -->
          <div class="absolute top-2 right-2 flex flex-col gap-1 items-end">
            ${isFav ? '<span class="p-1 bg-pink-600/90 text-white rounded-md shadow backdrop-blur-md"><svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>' : ''}
            ${isRec ? '<span class="p-1 bg-amber-500/90 text-white rounded-md shadow backdrop-blur-md"><svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>' : ''}
          </div>

          ${year ? `<span class="absolute bottom-2 left-2 text-[10px] font-bold bg-black/70 text-gray-200 px-1.5 py-0.5 rounded backdrop-blur-md">${year}</span>` : ''}
        </div>

        <!-- Info -->
        <div class="p-2.5 flex flex-col flex-1 justify-between bg-dark-800">
          <div>
            <h4 class="text-xs font-bold text-gray-100 line-clamp-1 group-hover:text-brand-400 transition" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
            ${subtitle ? `<p class="text-[11px] text-gray-400 line-clamp-1 mt-0.5" title="${escapeHtml(subtitle)}">${escapeHtml(subtitle)}</p>` : ''}
          </div>

          ${status ? `
            <div class="mt-2 pt-1 border-t border-dark-700/50 flex items-center justify-between">
              <span class="text-[9px] uppercase font-bold text-gray-400 truncate">${status}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  if (reset) {
    grid.innerHTML = cardsHtml;
  } else {
    grid.insertAdjacentHTML("beforeend", cardsHtml);
  }
}

// ==============================================================================
// DETAIL & EDIT MODAL
// ==============================================================================
function openDetailModal(itemId) {
  selectedItem = currentItems.find(i => i.id === itemId);
  if (!selectedItem) return;

  const modal = document.getElementById("detail-modal");
  const title = selectedItem.title || selectedItem.album || "Untitled";
  const subtitle = selectedItem.director || selectedItem.creator_studio || selectedItem.developer || selectedItem.author || selectedItem.artist || "";
  const year = selectedItem.release_year || selectedItem.publication_year || "";
  const genre = selectedItem.genre || "N/A";
  const cover = selectedItem.cover_url || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
  const status = selectedItem.status || "Plan to Watch";
  const isFav = (selectedItem.favorite || "").toLowerCase().includes("yes");
  const isRec = (selectedItem.recommend || "").toLowerCase().includes("yes");
  const hasPhysical = (selectedItem.physical_copy || "").toLowerCase().includes("yes");

  document.getElementById("modal-cover").src = cover;
  document.getElementById("modal-banner-bg").src = cover;
  document.getElementById("modal-title").innerText = title;
  document.getElementById("modal-subtitle").innerText = subtitle;
  document.getElementById("modal-category-badge").innerText = currentCategory.replace("_", " ");

  // Views vs Edits
  document.getElementById("modal-status-view").innerText = status;
  document.getElementById("modal-status-edit").value = status;
  document.getElementById("modal-year-view").innerText = year || "—";
  document.getElementById("modal-year-edit").value = year;
  document.getElementById("modal-genre-view").innerText = genre;
  document.getElementById("modal-genre-edit").value = genre;

  // Toggles
  updateModalToggleStyle("modal-fav-toggle", isFav, "Favorite", "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("modal-rec-toggle", isRec, "Recommended", "text-yellow-400 border-yellow-500 bg-yellow-500/10");

  const physicalBadge = document.getElementById("modal-physical-badge");
  if (hasPhysical) physicalBadge.classList.remove("hidden");
  else physicalBadge.classList.add("hidden");

  // External link
  const linkContainer = document.getElementById("modal-link-container");
  const extLink = document.getElementById("modal-external-link");
  if (selectedItem.url) {
    extLink.href = selectedItem.url;
    linkContainer.classList.remove("hidden");
  } else {
    linkContainer.classList.add("hidden");
  }

  // Admin Mode Controls in Modal
  const editFooter = document.getElementById("modal-edit-footer");
  const statusView = document.getElementById("modal-status-view");
  const statusEdit = document.getElementById("modal-status-edit");
  const yearView = document.getElementById("modal-year-view");
  const yearEdit = document.getElementById("modal-year-edit");
  const genreView = document.getElementById("modal-genre-view");
  const genreEdit = document.getElementById("modal-genre-edit");

  if (isAdmin) {
    editFooter.classList.remove("hidden");
    statusView.classList.add("hidden");
    statusEdit.classList.remove("hidden");
    yearView.classList.add("hidden");
    yearEdit.classList.remove("hidden");
    genreView.classList.add("hidden");
    genreEdit.classList.remove("hidden");
  } else {
    editFooter.classList.add("hidden");
    statusView.classList.remove("hidden");
    statusEdit.classList.add("hidden");
    yearView.classList.remove("hidden");
    yearEdit.classList.add("hidden");
    genreView.classList.remove("hidden");
    genreEdit.classList.add("hidden");
  }

  modal.classList.remove("hidden");
  lucide.createIcons();
}

function closeModal() {
  document.getElementById("detail-modal").classList.add("hidden");
  selectedItem = null;
}

function updateModalToggleStyle(elemId, isActive, label, activeClasses) {
  const elem = document.getElementById(elemId);
  if (isActive) {
    elem.className = `flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium ${activeClasses}`;
  } else {
    elem.className = "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dark-600 text-gray-400 hover:border-gray-500 hover:text-white";
  }
}

function toggleModalProp(prop) {
  if (!isAdmin) {
    alert("Unlock Editor Mode to edit this item on your phone.");
    return;
  }
  if (!selectedItem) return;
  const curr = (selectedItem[prop] || "").toLowerCase().includes("yes");
  selectedItem[prop] = curr ? "" : "Yes";
  const isFav = (selectedItem.favorite || "").toLowerCase().includes("yes");
  const isRec = (selectedItem.recommend || "").toLowerCase().includes("yes");
  updateModalToggleStyle("modal-fav-toggle", isFav, "Favorite", "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("modal-rec-toggle", isRec, "Recommended", "text-yellow-400 border-yellow-500 bg-yellow-500/10");
}

async function saveModalChanges() {
  if (!selectedItem || !supabase) return;
  const catObj = CATEGORIES.find(c => c.id === currentCategory);
  const table = catObj.table;

  const newStatus = document.getElementById("modal-status-edit").value;
  const newYear = document.getElementById("modal-year-edit").value;
  const newGenre = document.getElementById("modal-genre-edit").value;

  const updates = {
    status: newStatus,
    genre: newGenre,
    favorite: selectedItem.favorite || "",
    recommend: selectedItem.recommend || "",
    last_edited_at: new Date().toISOString()
  };

  if (table === "books" || table === "comics") {
    updates.publication_year = newYear;
  } else {
    updates.release_year = newYear;
  }

  const { error } = await supabase.from(table).update(updates).eq("id", selectedItem.id);

  if (error) {
    alert("Error saving: " + error.message);
  } else {
    closeModal();
    fetchMedia(true);
  }
}

async function deleteCurrentItem() {
  if (!selectedItem || !supabase) return;
  if (!confirm(`Are you sure you want to delete "${selectedItem.title || selectedItem.album}"?`)) return;

  const catObj = CATEGORIES.find(c => c.id === currentCategory);
  const table = catObj.table;

  const { error } = await supabase.from(table).delete().eq("id", selectedItem.id);
  if (error) {
    alert("Error deleting: " + error.message);
  } else {
    closeModal();
    fetchMedia(true);
  }
}

// ==============================================================================
// ADMIN / PHONE EDITING MODE
// ==============================================================================
function toggleAdminPrompt() {
  if (isAdmin) {
    if (confirm("Exit Editor Mode?")) {
      isAdmin = false;
      localStorage.setItem("shelf_admin", "false");
      updateAdminUI();
      fetchMedia(true);
    }
  } else {
    const code = prompt("Enter Editor Passcode (default is 1234):");
    const validCode = (window.SUPABASE_CONFIG && SUPABASE_CONFIG.adminPasscode) ? SUPABASE_CONFIG.adminPasscode : "1234";
    if (code === validCode) {
      isAdmin = true;
      localStorage.setItem("shelf_admin", "true");
      updateAdminUI();
      fetchMedia(true);
    } else if (code !== null) {
      alert("Incorrect passcode.");
    }
  }
}

function updateAdminUI() {
  const badge = document.getElementById("admin-badge");
  const lockIcon = document.getElementById("admin-lock-icon");
  const addBtn = document.getElementById("btn-add-item");
  const mobileAddBtn = document.getElementById("btn-mobile-add");

  if (isAdmin) {
    badge.classList.remove("hidden");
    lockIcon.setAttribute("data-lucide", "unlock");
    lockIcon.classList.add("text-brand-400");
    addBtn.classList.remove("hidden");
    mobileAddBtn.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
    lockIcon.setAttribute("data-lucide", "lock");
    lockIcon.classList.remove("text-brand-400");
    addBtn.classList.add("hidden");
    mobileAddBtn.classList.add("hidden");
  }
  lucide.createIcons();
}

function openAddModal() {
  const catObj = CATEGORIES.find(c => c.id === currentCategory);
  const title = prompt(`Enter ${catObj.label.slice(0, -1)} Title:`);
  if (!title) return;
  const creator = prompt("Enter Creator / Director / Artist / Author (optional):") || "";
  const year = prompt("Enter Release Year (optional):") || "";
  const cover = prompt("Enter Cover Image URL (optional):") || "";

  if (!supabase) return;

  const table = catObj.table;
  const payload = {
    cover_url: cover,
    genre: "",
    status: "Plan to Watch",
    created_at: new Date().toISOString(),
    last_edited_at: new Date().toISOString()
  };

  if (table === "music") {
    payload.album = title;
    payload.artist = creator;
    payload.release_year = year;
    payload.status = "Listened";
  } else if (table === "books" || table === "comics") {
    payload.title = title;
    payload.author = creator;
    payload.publication_year = year;
    payload.status = "Plan to Read";
  } else if (table === "television") {
    payload.title = title;
    payload.creator_studio = creator;
    payload.release_year = year;
  } else if (table === "video_games") {
    payload.title = title;
    payload.developer = creator;
    payload.release_year = year;
    payload.status = "Plan to Play";
  } else {
    payload.title = title;
    payload.director = creator;
    payload.release_year = year;
  }

  supabase.from(table).insert([payload]).then(({ error }) => {
    if (error) alert("Error adding: " + error.message);
    else fetchMedia(true);
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
