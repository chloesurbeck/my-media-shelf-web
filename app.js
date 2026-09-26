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
    const hasPhys = (item.physical_copy || "").toLowerCase().includes("yes");

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
            ${isFav ? '<span title="Favorite" class="p-1 bg-pink-600/90 text-white rounded-md shadow backdrop-blur-md"><svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>' : ''}
            ${isRec ? '<span title="Recommended" class="p-1 bg-amber-500/90 text-white rounded-md shadow backdrop-blur-md"><svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>' : ''}
            ${hasPhys ? '<span title="Physical Copy" class="p-1 bg-emerald-600/90 text-white rounded-md shadow backdrop-blur-md"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></span>' : ''}
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
// CATEGORY METADATA HELPERS
// ==============================================================================
function getCategoryMetaConfig(catId) {
  if (catId === "movies") {
    return { creatorKey: "director", creatorLabel: "Director", yearKey: "release_year", yearLabel: "Release Year", defaultStatus: "Watched", statuses: ["Watched", "Plan to Watch", "In Progress", "Dropped"] };
  } else if (catId === "television") {
    return { creatorKey: "creator_studio", creatorLabel: "Creator / Studio", yearKey: "release_year", yearLabel: "Release Year", defaultStatus: "Watched", statuses: ["Watched", "In Progress", "Plan to Watch", "Dropped"] };
  } else if (catId === "video_games") {
    return { creatorKey: "developer", creatorLabel: "Developer", yearKey: "release_year", yearLabel: "Release Year", defaultStatus: "Played", statuses: ["Played", "In Progress", "Plan to Play", "Dropped"] };
  } else if (catId === "books") {
    return { creatorKey: "author", creatorLabel: "Author", yearKey: "publication_year", yearLabel: "Publication Year", defaultStatus: "Read", statuses: ["Read", "In Progress", "Plan to Read", "Dropped"] };
  } else if (catId === "comics") {
    return { creatorKey: "author", creatorLabel: "Author / Creator", yearKey: "publication_year", yearLabel: "Publication Year", defaultStatus: "Read", statuses: ["Read", "In Progress", "Plan to Read", "Dropped"] };
  } else {
    return { creatorKey: "artist", creatorLabel: "Artist", yearKey: "release_year", yearLabel: "Release Year", defaultStatus: "Listened", statuses: ["Listened", "Plan to Listen", "In Progress"] };
  }
}

// ==============================================================================
// DETAIL & EDIT MODAL
// ==============================================================================
function openDetailModal(itemId) {
  selectedItem = currentItems.find(i => i.id === itemId);
  if (!selectedItem) return;

  const modal = document.getElementById("detail-modal");
  const cfg = getCategoryMetaConfig(currentCategory);
  const title = selectedItem.title || selectedItem.album || "Untitled";
  const subtitle = selectedItem[cfg.creatorKey] || selectedItem.director || selectedItem.creator_studio || selectedItem.developer || selectedItem.author || selectedItem.artist || "";
  const year = selectedItem.release_year || selectedItem.publication_year || "";
  const genre = selectedItem.genre || "N/A";
  const cover = selectedItem.cover_url || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
  const status = selectedItem.status || cfg.defaultStatus;
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
  document.getElementById("modal-genre-edit").value = genre === "N/A" ? "" : genre;
  document.getElementById("modal-creator-label").innerText = cfg.creatorLabel;
  document.getElementById("modal-creator-edit").value = subtitle;
  document.getElementById("modal-cover-edit").value = selectedItem.cover_url || "";

  // Toggles
  updateModalToggleStyle("modal-fav-toggle", isFav, "Favorite", "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("modal-rec-toggle", isRec, "Recommended", "text-yellow-400 border-yellow-500 bg-yellow-500/10");
  updateModalToggleStyle("modal-phys-toggle", hasPhysical, "Physical Copy", "text-emerald-400 border-emerald-500 bg-emerald-500/10");

  // Admin Mode Controls in Modal
  const editFooter = document.getElementById("modal-edit-footer");
  const statusView = document.getElementById("modal-status-view");
  const statusEdit = document.getElementById("modal-status-edit");
  const yearView = document.getElementById("modal-year-view");
  const yearEdit = document.getElementById("modal-year-edit");
  const genreView = document.getElementById("modal-genre-view");
  const genreEdit = document.getElementById("modal-genre-edit");
  const creatorBox = document.getElementById("modal-creator-box");
  const coverBox = document.getElementById("modal-cover-box");

  if (isAdmin) {
    editFooter.classList.remove("hidden");
    statusView.classList.add("hidden");
    statusEdit.classList.remove("hidden");
    yearView.classList.add("hidden");
    yearEdit.classList.remove("hidden");
    genreView.classList.add("hidden");
    genreEdit.classList.remove("hidden");
    creatorBox.classList.remove("hidden");
    coverBox.classList.remove("hidden");
  } else {
    editFooter.classList.add("hidden");
    statusView.classList.remove("hidden");
    statusEdit.classList.add("hidden");
    yearView.classList.remove("hidden");
    yearEdit.classList.add("hidden");
    genreView.classList.remove("hidden");
    genreEdit.classList.add("hidden");
    creatorBox.classList.add("hidden");
    coverBox.classList.add("hidden");
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
  if (!elem) return;
  if (isActive) {
    elem.className = `flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${activeClasses}`;
  } else {
    elem.className = "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dark-600 text-gray-400 transition hover:border-gray-500 hover:text-white";
  }
}

async function toggleModalProp(prop) {
  if (!isAdmin) {
    alert("Unlock Editor Mode (top right lock icon) to toggle Favorite, Recommend, or Physical Copy.");
    return;
  }
  if (!selectedItem) return;
  const curr = (selectedItem[prop] || "").toLowerCase().includes("yes");
  selectedItem[prop] = curr ? "" : "Yes";

  const isFav = (selectedItem.favorite || "").toLowerCase().includes("yes");
  const isRec = (selectedItem.recommend || "").toLowerCase().includes("yes");
  const hasPhysical = (selectedItem.physical_copy || "").toLowerCase().includes("yes");

  updateModalToggleStyle("modal-fav-toggle", isFav, "Favorite", "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("modal-rec-toggle", isRec, "Recommended", "text-yellow-400 border-yellow-500 bg-yellow-500/10");
  updateModalToggleStyle("modal-phys-toggle", hasPhysical, "Physical Copy", "text-emerald-400 border-emerald-500 bg-emerald-500/10");

  // Immediately persist the toggle to Supabase so you don't even have to press Save Changes
  if (supabase) {
    const catObj = CATEGORIES.find(c => c.id === currentCategory);
    const patchObj = {};
    if (prop !== "favorite" || catObj.table !== "music") {
      patchObj[prop] = selectedItem[prop];
      await supabase.from(catObj.table).update(patchObj).eq("id", selectedItem.id);
      renderGrid(currentItems, true);
    }
  }
}

async function autoLookupForEditModal() {
  if (!selectedItem) return;
  const title = selectedItem.title || selectedItem.album || "";
  if (!title) return;
  const matches = await lookupMediaCandidates(currentCategory, title);
  if (matches.length > 0) {
    const best = matches[0];
    if (best.creator) document.getElementById("modal-creator-edit").value = best.creator;
    if (best.year) document.getElementById("modal-year-edit").value = best.year;
    if (best.genre) document.getElementById("modal-genre-edit").value = best.genre;
    if (best.cover) {
      document.getElementById("modal-cover-edit").value = best.cover;
      document.getElementById("modal-cover").src = best.cover;
      document.getElementById("modal-banner-bg").src = best.cover;
    }
  }
}

async function saveModalChanges() {
  if (!selectedItem || !supabase) return;
  const catObj = CATEGORIES.find(c => c.id === currentCategory);
  const table = catObj.table;
  const cfg = getCategoryMetaConfig(currentCategory);

  const newStatus = document.getElementById("modal-status-edit").value;
  const newYear = document.getElementById("modal-year-edit").value.trim();
  const newGenre = document.getElementById("modal-genre-edit").value.trim();
  const newCreator = document.getElementById("modal-creator-edit").value.trim();
  const newCover = document.getElementById("modal-cover-edit").value.trim();

  const updates = {
    status: newStatus,
    genre: newGenre,
    recommend: selectedItem.recommend || "",
    physical_copy: selectedItem.physical_copy || "",
    cover_url: newCover
  };

  if (table !== "music") {
    updates.favorite = selectedItem.favorite || "";
  }
  updates[cfg.creatorKey] = newCreator;
  updates[cfg.yearKey] = newYear;

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
    const code = prompt("Enter Editor Passcode:");
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

// ==============================================================================
// DYNAMIC ADD TO SHELF & LIVE AUTO-LOOKUP ENGINE
// ==============================================================================
let addModalState = {
  favorite: "",
  recommend: "",
  physical_copy: "",
  lookupTimer: null,
  matches: []
};

function openAddModal() {
  const modal = document.getElementById("add-modal");
  document.getElementById("add-category").value = currentCategory;
  document.getElementById("add-title").value = "";
  document.getElementById("add-creator").value = "";
  document.getElementById("add-year").value = "";
  document.getElementById("add-genre").value = "";
  document.getElementById("add-cover-url").value = "";
  document.getElementById("add-cover-preview").src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80";
  document.getElementById("add-lookup-matches").classList.add("hidden");
  document.getElementById("add-lookup-list").innerHTML = "";

  addModalState = { favorite: "", recommend: "", physical_copy: "", lookupTimer: null, matches: [] };
  refreshAddTagStyles();
  onAddCategoryChange();

  modal.classList.remove("hidden");
  lucide.createIcons();
  setTimeout(() => document.getElementById("add-title").focus(), 60);
}

function closeAddModal() {
  document.getElementById("add-modal").classList.add("hidden");
}

function onAddCategoryChange() {
  const catId = document.getElementById("add-category").value;
  const cfg = getCategoryMetaConfig(catId);
  document.getElementById("add-creator-label").innerText = cfg.creatorLabel;
  document.getElementById("add-year-label").innerText = cfg.yearLabel;
  document.getElementById("add-title-label").innerText = catId === "music" ? "2. Album Title (or Artist - Album)" : "2. Title (Auto-Lookups Cover & Details)";

  const statusSel = document.getElementById("add-status");
  statusSel.innerHTML = cfg.statuses.map(s => `<option value="${s}">${s}</option>`).join("");
  statusSel.value = cfg.defaultStatus;

  const q = document.getElementById("add-title").value.trim();
  if (q.length >= 2) {
    triggerAutoLookup();
  }
}

function toggleAddTag(tag) {
  addModalState[tag] = addModalState[tag] === "Yes" ? "" : "Yes";
  refreshAddTagStyles();
}

function refreshAddTagStyles() {
  updateModalToggleStyle("add-fav-btn", addModalState.favorite === "Yes", "Favorite", "text-pink-400 border-pink-500 bg-pink-500/10");
  updateModalToggleStyle("add-rec-btn", addModalState.recommend === "Yes", "Recommend", "text-yellow-400 border-yellow-500 bg-yellow-500/10");
  updateModalToggleStyle("add-phys-btn", addModalState.physical_copy === "Yes", "Physical Copy", "text-emerald-400 border-emerald-500 bg-emerald-500/10");
}

function onAddTitleInput() {
  if (addModalState.lookupTimer) clearTimeout(addModalState.lookupTimer);
  const q = document.getElementById("add-title").value.trim();
  if (q.length < 3) return;
  addModalState.lookupTimer = setTimeout(() => {
    triggerAutoLookup();
  }, 550);
}

async function triggerAutoLookup() {
  const catId = document.getElementById("add-category").value;
  const q = document.getElementById("add-title").value.trim();
  if (!q) return;

  const btnText = document.getElementById("add-lookup-btn-text");
  btnText.innerText = "Searching...";

  try {
    const matches = await lookupMediaCandidates(catId, q);
    addModalState.matches = matches;

    if (matches.length > 0) {
      applyLookupMatch(0);
      renderLookupMatches(matches);
    }
  } catch (err) {
    console.warn("Lookup error:", err);
  } finally {
    btnText.innerText = "Auto-Fill";
  }
}

function renderLookupMatches(matches) {
  const container = document.getElementById("add-lookup-matches");
  const list = document.getElementById("add-lookup-list");
  if (!matches || matches.length <= 1) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  list.innerHTML = matches.slice(0, 4).map((m, idx) => `
    <button
      type="button"
      onclick="applyLookupMatch(${idx})"
      class="flex items-center gap-2.5 p-2 rounded-xl bg-dark-900/90 hover:bg-dark-700 border border-dark-700 text-left transition"
    >
      <img src="${m.cover || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&q=80'}" class="w-8 h-11 object-cover rounded flex-shrink-0 bg-dark-800">
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escapeHtml(m.title)}</div>
        <div class="text-[10px] text-gray-400 truncate">${escapeHtml(m.creator || 'Unknown')} ${m.year ? '• ' + m.year : ''}</div>
      </div>
    </button>
  `).join("");
}

function applyLookupMatch(index) {
  const m = addModalState.matches[index];
  if (!m) return;
  if (m.title) document.getElementById("add-title").value = m.title;
  if (m.creator) document.getElementById("add-creator").value = m.creator;
  if (m.year) document.getElementById("add-year").value = m.year;
  if (m.genre) document.getElementById("add-genre").value = m.genre;
  if (m.cover) {
    document.getElementById("add-cover-url").value = m.cover;
    document.getElementById("add-cover-preview").src = m.cover;
  }
}

async function lookupMediaCandidates(catId, query) {
  const out = [];

  // 1. Movies -> iTunes Movie API + Wikipedia fallback
  if (catId === "movies") {
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=US&media=movie&entity=movie&limit=4`);
      const d = await r.json();
      for (const item of (d.results || [])) {
        out.push({
          title: item.trackName || query,
          creator: item.artistName || "",
          year: (item.releaseDate || "").slice(0, 4),
          genre: item.primaryGenreName || "Drama",
          cover: (item.artworkUrl100 || "").replace("100x100bb", "600x600bb")
        });
      }
    } catch (_) {}
    if (out.length === 0) {
      const w = await wikiBrowserLookup(query, "film", ["director", "writer"], "Drama");
      if (w) out.push(w);
    }
  }

  // 2. Television -> TVMaze API + Wikipedia fallback
  else if (catId === "television") {
    try {
      const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      for (const entry of (d || []).slice(0, 4)) {
        const show = entry.show || {};
        const net = (show.network || show.webChannel || {}).name || "";
        const img = (show.image || {}).original || (show.image || {}).medium || "";
        out.push({
          title: show.name || query,
          creator: net || "Television Studio",
          year: (show.premiered || "").slice(0, 4),
          genre: (show.genres || []).slice(0, 2).join(", ") || "Drama",
          cover: img ? img.replace("http://", "https://") : ""
        });
      }
    } catch (_) {}
    if (out.length === 0) {
      const w = await wikiBrowserLookup(query, "TV series", ["creator", "developer", "studio", "network"], "Drama");
      if (w) out.push(w);
    }
  }

  // 3. Video Games -> Wikipedia Infobox + PageImage API (CORS origin=*)
  else if (catId === "video_games") {
    const w = await wikiBrowserLookup(query, "video game", ["developer", "developers", "publisher"], "Adventure");
    if (w) out.push(w);
  }

  // 4. Books & Comics -> Google Books API + OpenLibrary + Wikipedia
  else if (catId === "books" || catId === "comics") {
    try {
      const gq = catId === "comics" ? `${query} manga OR comic` : `intitle:${query}`;
      const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gq)}&maxResults=4`);
      const d = await r.json();
      for (const item of (d.items || [])) {
        const info = item.volumeInfo || {};
        const thumb = ((info.imageLinks || {}).thumbnail || (info.imageLinks || {}).smallThumbnail || "")
          .replace("http://", "https://")
          .replace("&edge=curl", "");
        out.push({
          title: info.title || query,
          creator: (info.authors || []).slice(0, 2).join(", "),
          year: (info.publishedDate || "").slice(0, 4),
          genre: (info.categories || []).slice(0, 2).join(", ") || (catId === "comics" ? "Comics / Manga" : "Fiction"),
          cover: thumb
        });
      }
    } catch (_) {}
    if (out.length === 0) {
      const w = await wikiBrowserLookup(query, catId === "comics" ? "manga comic" : "book novel", ["author", "writer", "creator"], catId === "comics" ? "Comics / Manga" : "Fiction");
      if (w) out.push(w);
    }
  }

  // 5. Music -> iTunes Album Search API
  else if (catId === "music") {
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=US&media=music&entity=album&limit=4`);
      const d = await r.json();
      for (const item of (d.results || [])) {
        out.push({
          title: item.collectionName || query,
          creator: item.artistName || "",
          year: (item.releaseDate || "").slice(0, 4),
          genre: item.primaryGenreName || "Pop / Rock",
          cover: (item.artworkUrl100 || "").replace("100x100bb", "600x600bb")
        });
      }
    } catch (_) {}
  }

  return out;
}

async function wikiBrowserLookup(query, hint, creatorKeys, defaultGenre) {
  try {
    const srUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encodeURIComponent(query + " " + hint)}&srlimit=1&format=json`;
    const srRes = await fetch(srUrl);
    const srData = await srRes.json();
    const first = ((srData.query || {}).search || [])[0];
    if (!first) return null;

    const pageId = first.pageid;
    const detailUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&pageids=${pageId}&prop=pageimages|revisions&piprop=original|thumbnail&pithumbsize=600&rvprop=content&rvsection=0&format=json`;
    const detRes = await fetch(detailUrl);
    const detData = await detRes.json();
    const page = ((detData.query || {}).pages || {})[String(pageId)] || {};
    const cover = ((page.original || {}).source) || ((page.thumbnail || {}).source) || "";
    const txt = (((page.revisions || [])[0]) || {})["*"] || "";

    const cleanWiki = (raw) => {
      if (!raw) return "";
      let s = raw.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<ref[^/>]*\/?>/gi, "");
      s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
      s = s.replace(/\{\{(?:plainlist|flatlist|unbulleted list|ubl|hlist)\s*\|([^{}]*)\}\}/gi, "$1");
      s = s.replace(/\{\{[^{}]*\}\}/g, " ").replace(/<[^>]+>/g, " ").replace(/'''|''/g, "");
      const parts = s.split(/[\n*•|,]/).map(p => p.replace(/\([^)]*\)/g, "").trim()).filter(p => p.length > 1 && !/^(WW|NA|EU|JP|UK|US|Windows|macOS|Switch|PlayStation|Xbox)/i.test(p));
      return [...new Set(parts)].slice(0, 2).join(", ");
    };

    let creator = "";
    for (const k of creatorKeys) {
      const m = txt.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([\\s\\S]+?)(?=\\n\\s*\\|\\s*[\\w_]+\\s*=|\\n\\s*\\}\\})`, "i"));
      if (m) {
        creator = cleanWiki(m[1]);
        if (creator) break;
      }
    }

    let genre = "";
    const gm = txt.match(/\|\s*genres?\s*=\s*([\s\S]+?)(?=\n\s*\|\s*[\w_]+\s*=|\n\s*\}\})/i);
    if (gm) genre = cleanWiki(gm[1]);

    const ym = txt.match(/\b(19[2-9]\d|20[0-2]\d)\b/);
    const year = ym ? ym[1] : "";

    return {
      title: first.title.replace(/\s*\([^)]*\)\s*$/, ""),
      creator: creator || "",
      year: year,
      genre: genre || defaultGenre,
      cover: cover
    };
  } catch (_) {
    return null;
  }
}

async function submitAddModal() {
  if (!supabase) return;
  const catId = document.getElementById("add-category").value;
  const catObj = CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
  const cfg = getCategoryMetaConfig(catId);
  const table = catObj.table;

  const title = document.getElementById("add-title").value.trim();
  if (!title) {
    alert("Please enter a title first.");
    return;
  }

  const creator = document.getElementById("add-creator").value.trim();
  const year = document.getElementById("add-year").value.trim();
  const genre = document.getElementById("add-genre").value.trim();
  const status = document.getElementById("add-status").value;
  const cover = document.getElementById("add-cover-url").value.trim();

  // Strictly only save the clean columns (no url, notion_id, created_at, or last_edited_at)
  const payload = {
    genre: genre || "General",
    status: status,
    recommend: addModalState.recommend,
    physical_copy: addModalState.physical_copy,
    cover_url: cover
  };

  if (table === "music") {
    payload.album = title;
  } else {
    payload.title = title;
    payload.favorite = addModalState.favorite;
  }

  payload[cfg.creatorKey] = creator || "Unknown";
  payload[cfg.yearKey] = year || "";

  const btn = document.getElementById("btn-submit-add");
  btn.disabled = true;

  const { data, error } = await supabase.from(table).insert([payload]).select();
  btn.disabled = false;

  if (error) {
    alert("Error adding title: " + error.message);
  } else {
    closeAddModal();
    if (currentCategory !== catId) {
      selectCategory(catId);
    } else {
      await fetchMedia(true);
    }
    // Automatically open the newly added item's detail modal so you can view/adjust Recommend, Favorite, or Physical Copy anytime!
    if (data && data.length > 0) {
      const inserted = data[0];
      if (!currentItems.find(i => i.id === inserted.id)) {
        currentItems.unshift(inserted);
      }
      openDetailModal(inserted.id);
    }
  }
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
