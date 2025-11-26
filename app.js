"use strict";

/**********************
 * Listes de base
 **********************/
const BASE_MATERIAL_NAMES = [
  "Ciment",
  "Sable",
  "Gravier",
  "Eau",
  "Fer à béton",
  "Parpaing",
  "Brique",
  "Bois",
  "Tôle / Zinc",
  "Fil électrique",
  "Tuyaux PVC",
  "Peinture",
  "Enduit",
  "Carrelage",
  "Colle carrelage",
  "Chevrons",
  "Plâtre",
  "Clous / Vis",
  "Treillis soudé",
  "Tasseaux",
  "Béton prêt à l'emploi",
  "Agrégats",
  "Gravillons",
  "Bâches"
];

const BASE_MATERIAL_CATEGORIES = [
  "Maçonnerie",
  "Électricité",
  "Électricité / Plomberie",
  "Plomberie",
  "Menuiserie",
  "Ferraillage",
  "Badigeonnage",
  "Carrelage",
  "Terrassement",
  "Fondations",
  "Finitions"
];

const BASE_METIERS = [
  "Maçon",
  "Électricien",
  "Plombier",
  "Électricien / Plombier",
  "Peintre",
  "Carreleur",
  "Menuisier",
  "Ferrailleur",
  "Ouvrier",
  "Terrassier",
  "Chef de chantier"
];

/**********************
 * Autocorrection simple
 **********************/
const CORRECTIONS_MATERIAUX = {
  "sand": "Sable",
  "sable ": "Sable",
  "gravir": "Gravier",
  "gravier ": "Gravier",
  "gravillon": "Gravillons",
  "ciment ": "Ciment",
  "eua": "Eau",
  "fer a beton": "Fer à béton",
  "fer a béton": "Fer à béton",
  "tole": "Tôle / Zinc",
  "tôle": "Tôle / Zinc",
  "zinc": "Tôle / Zinc"
};

const CORRECTIONS_CATEGORIES = {
  "maconnerie": "Maçonnerie",
  "maçonerie": "Maçonnerie",
  "electricite": "Électricité",
  "électricité/plomberie": "Électricité / Plomberie",
  "plomberie ": "Plomberie",
  "menuiserie ": "Menuiserie",
  "ferraillage ": "Ferraillage",
  "badigeonage": "Badigeonnage",
  "carelage": "Carrelage"
};

const CORRECTIONS_METIERS = {
  "macon": "Maçon",
  "mason": "Maçon",
  "electricien": "Électricien",
  "elecricien": "Électricien",
  "plombier ": "Plombier",
  "electricien/plombier": "Électricien / Plombier",
  "peinte": "Peintre",
  "carreleur ": "Carreleur",
  "menuiser": "Menuisier",
  "ferraileur": "Ferrailleur",
  "ferralieur": "Ferrailleur",
  "ouvriers": "Ouvrier"
};

function autoCorrectInput(input, map){
  if(!input) return;
  input.addEventListener("blur", ()=>{
    const raw = input.value.trim();
    if(!raw) return;
    const key = raw.toLowerCase();
    if(map[key]){
      input.value = map[key];
    }
  });
}

/**********************
 * Utilitaires
 **********************/
function formatAmount(v){
  if(!Number.isFinite(v)) return "0 FCFA";
  return v.toLocaleString("fr-FR",{maximumFractionDigits:0}) + " FCFA";
}
function normalizeListInput(value){
  if(!value) return [];
  return Array.from(new Set(
    value
      .split(/[,\n;]/)
      .map(v=>v.trim())
      .filter(Boolean)
  ));
}
function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function generateId(){
  return "id-" + Math.random().toString(36).slice(2,9) + "-" + Date.now().toString(36);
}
function getSarRate(){
  if(!currentUserData) return null;
  const rate = currentUserData.sarRate;
  if(!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}
function formatSarAmountFromXof(xofAmount){
  const rate = getSarRate();
  if(!rate) return "Taux SAR à définir";
  const sarValue = (xofAmount || 0) / rate;
  return `${sarValue.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} SAR`;
}
function formatSarRateDescription(){
  const rate = getSarRate();
  if(!rate) return "Taux SAR non défini";
  return `1 SAR = ${rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} FCFA`;
}
function isValidPastOrToday(dateStr){
  if(!dateStr) return false;
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  if(year < 1900) return false;
  const today = new Date();
  d.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return d <= today;
}
async function hashPassword(password){
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function verifyPassword(userRecord, candidate){
  if(!userRecord) return false;
  if(userRecord.passwordHash){
    const candidateHash = await hashPassword(candidate);
    return candidateHash === userRecord.passwordHash;
  }
  return userRecord.password === candidate;
}
function validatePasswordComplexity(pwd){
  if(!pwd || pwd.length < 8) return false;
  const hasLetter = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  return hasLetter && hasNumber;
}

/**********************
 * Stockage local
 **********************/
const LS_USERS_KEY = "chantierApp_users";
const LS_CURRENT_USER_KEY = "chantierApp_currentUser";
const LS_DATA_PREFIX = "chantierApp_data_";
const LS_REGISTER_GUARD_KEY = "chantierApp_registerGuard";
const ROLE_ADMIN = "admin";
const ROLE_VISITOR = "visitor";

function ensureCustomLists(target){
  if(!target.customLists) target.customLists = { materiaux:[], metiers:[], categories:[] };
  ["materiaux","metiers","categories"].forEach(key=>{
    if(!Array.isArray(target.customLists[key])) target.customLists[key] = [];
    target.customLists[key] = target.customLists[key]
      .map(v => typeof v === "string" ? v.trim() : "")
      .filter(Boolean);
  });
}
function getCustomList(key){
  if(!currentUserData || !currentUserData.customLists) return [];
  const arr = currentUserData.customLists[key];
  return Array.isArray(arr) ? arr : [];
}

function loadUsers(){
  try{
    const raw = localStorage.getItem(LS_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error("Erreur lecture utilisateurs:", e);
    return [];
  }
}
function saveUsers(list){
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(list));
}
function hasAdminAccount(users){
  const list = Array.isArray(users) ? users : loadUsers();
  return list.some(u => (u.role || ROLE_ADMIN) === ROLE_ADMIN);
}
function loadRegisterGuardHash(){
  try{
    return localStorage.getItem(LS_REGISTER_GUARD_KEY);
  }catch(e){
    console.error("Erreur lecture mot de passe de création", e);
    return null;
  }
}
function saveRegisterGuardHash(hash){
  localStorage.setItem(LS_REGISTER_GUARD_KEY, hash);
}
function clearRegisterGuardHash(){
  localStorage.removeItem(LS_REGISTER_GUARD_KEY);
}
function getCurrentUsername(){
  return localStorage.getItem(LS_CURRENT_USER_KEY);
}
function setCurrentUsername(name){
  if(name) localStorage.setItem(LS_CURRENT_USER_KEY, name);
  else localStorage.removeItem(LS_CURRENT_USER_KEY);
}

function loadUserData(username){
  const key = LS_DATA_PREFIX + username;
  try{
    const raw = localStorage.getItem(key);
    if(!raw){
      return { chantiers:{}, chantierActif:null, theme:"dark", logs:[], customLists:{ materiaux:[], metiers:[], categories:[] }, sarRate:null, sarRateUpdatedAt:null };
    }
    const parsed = JSON.parse(raw);

    ensureCustomLists(parsed);

    // Migration ancien format éventuel
    if(parsed && !parsed.chantiers){
      const id = generateId();
      const chantier = Object.assign(
        {
          id,
          nom: "Chantier 1",
          budgetInitial: 0,
          budgetNote: "",
          budgetInitialLocked: false,
          materiaux: [],
          ouvriers: [],
          transactions: [],
          archive:false,
          verrouille:false,
          defaut:true
        },
        parsed
      );
      (chantier.materiaux || []).forEach(m=>{
        if(typeof m.quantite === "undefined") m.quantite = 1;
        if(typeof m.categorie === "undefined") m.categorie = "";
      });
      return {
        chantiers: { [id]: chantier },
        chantierActif: id,
        theme: parsed.theme || "dark",
        logs: parsed.logs || [],
        customLists: parsed.customLists || { materiaux:[], metiers:[], categories:[] },
        sarRate: typeof parsed.sarRate === "number" ? parsed.sarRate : null,
        sarRateUpdatedAt: parsed.sarRateUpdatedAt || null
      };
    }

    if(!parsed.chantiers) parsed.chantiers = {};
    if(typeof parsed.chantierActif === "undefined") parsed.chantierActif = null;
    if(!parsed.theme) parsed.theme = "dark";
    if(!Array.isArray(parsed.logs)) parsed.logs = [];
    if(typeof parsed.sarRate !== "number") parsed.sarRate = null;
    if(!parsed.sarRateUpdatedAt) parsed.sarRateUpdatedAt = null;
    ensureCustomLists(parsed);

    Object.values(parsed.chantiers).forEach(c=>{
      if(typeof c.archive === "undefined") c.archive = false;
      if(typeof c.verrouille === "undefined") c.verrouille = false;
      if(typeof c.defaut === "undefined") c.defaut = false;
      if(typeof c.budgetInitialLocked === "undefined"){
        c.budgetInitialLocked = Number.isFinite(c.budgetInitial) && c.budgetInitial > 0;
      }
      (c.materiaux || []).forEach(m=>{
        if(typeof m.quantite === "undefined") m.quantite = 1;
        if(typeof m.categorie === "undefined") m.categorie = "";
      });
    });
    return parsed;
  }catch(e){
    console.error("Erreur lecture données:", e);
    return { chantiers:{}, chantierActif:null, theme:"dark", logs:[], customLists:{ materiaux:[], metiers:[], categories:[] }, sarRate:null, sarRateUpdatedAt:null };
  }
}
function saveUserData(username,data){
  const key = LS_DATA_PREFIX + username;
  localStorage.setItem(key, JSON.stringify(data));
}

/**********************
 * Journal interne
 **********************/
let currentUser = null;
let currentUserData = null;
let currentData = null;
let currentMainView = "dashboard";
let currentUserRole = ROLE_ADMIN;

function addLog(message){
  if(!currentUserData) return;
  currentUserData.logs = currentUserData.logs || [];
  currentUserData.logs.unshift({
    id: generateId(),
    date: new Date().toISOString(),
    message
  });
  if(currentUserData.logs.length > 200){
    currentUserData.logs.length = 200;
  }
  saveUserData(currentUser,currentUserData);
  renderLogs();
}

/**********************
 * Références DOM
 **********************/
const authView = document.getElementById("auth-view");
const appView  = document.getElementById("app-view");

const authForm = document.getElementById("auth-form");
const authUsernameInput = document.getElementById("auth-username");
const authPasswordInput = document.getElementById("auth-password");
const authPasswordConfirmInput = document.getElementById("auth-password-confirm");
const authPasswordConfirmField = document.getElementById("auth-password-confirm-field");
const authRoleSelect = document.getElementById("auth-role");
const authRoleField = document.getElementById("auth-role-field");
const authRegisterGuardField = document.getElementById("auth-register-guard-field");
const authRegisterGuardInput = document.getElementById("auth-register-guard");
const authRegisterGuardHint = document.getElementById("auth-register-guard-hint");
const togglePasswordBtn = document.getElementById("toggle-password-visibility");
const togglePasswordConfirmBtn = document.getElementById("toggle-password-confirm-visibility");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");

const currentUsernameSpan = document.getElementById("current-username");
const currentRoleSpan = document.getElementById("current-role");
const logoutBtn = document.getElementById("logout-btn");

const chantierSelect = document.getElementById("chantier-select");
const btnNewChantier = document.getElementById("btn-new-chantier");
const btnDeleteChantier = document.getElementById("btn-delete-chantier");
const chantierLockChip = document.getElementById("chantier-lock-chip");

const dashboardView = document.getElementById("dashboard-view");
const settingsView = document.getElementById("settings-view");
const inventoryView = document.getElementById("inventory-view");
const btnSettings = document.getElementById("btn-settings");
const btnInventory = document.getElementById("btn-inventory");

const budgetForm = document.getElementById("budget-form");
const budgetInitialInput = document.getElementById("budget-initial");
const budgetNoteInput = document.getElementById("budget-note");
const budgetPasswordField = document.getElementById("budget-password-field");
const budgetPasswordInput = document.getElementById("budget-password");
const budgetPasswordHint = document.getElementById("budget-password-hint");
const budgetPasswordNote = document.getElementById("budget-password-note");
const statBudgetInitial = document.getElementById("stat-budget-initial");
const statDepenses = document.getElementById("stat-depenses");
const statSolde = document.getElementById("stat-solde");
const statDettes = document.getElementById("stat-dettes");
const statBudgetInitialSar = document.getElementById("stat-budget-initial-sar");
const statSarRateNote = document.getElementById("stat-sar-rate-note");
const kpiBudgetInitial = document.getElementById("kpi-budget-initial");
const kpiBudgetInitialSar = document.getElementById("kpi-budget-initial-sar");
const sarRateChip = document.getElementById("sar-rate-chip");
const kpiDepenses = document.getElementById("kpi-depenses");
const kpiSolde = document.getElementById("kpi-solde");
const kpiDettes = document.getElementById("kpi-dettes");

const tabButtons = document.querySelectorAll(".tab");
const tabMateriauxPanel = document.getElementById("tab-materiaux");
const tabOuvriersPanel = document.getElementById("tab-ouvriers");

const materiauForm = document.getElementById("materiau-form");
const materiauNomInput = document.getElementById("materiau-nom");
const materiauMontantInput = document.getElementById("materiau-montant");
const materiauCreditSelect = document.getElementById("materiau-credit");
const materiauDateInput = document.getElementById("materiau-date");
const materiauQuantiteInput = document.getElementById("materiau-quantite");
const materiauCategorieInput = document.getElementById("materiau-categorie");
const materiauNomDatalist = document.getElementById("materiau-nom-options");
const materiauCategorieDatalist = document.getElementById("materiau-categorie-options");
const materiauxList = document.getElementById("materiaux-list");

const ouvrierForm = document.getElementById("ouvrier-form");
const ouvrierNomInput = document.getElementById("ouvrier-nom");
const ouvrierMetierInput = document.getElementById("ouvrier-metier");
const ouvrierMetierDatalist = document.getElementById("ouvrier-metier-options");
const ouvrierMontantInput = document.getElementById("ouvrier-montant");
const ouvrierDateInput = document.getElementById("ouvrier-date");
const ouvriersList = document.getElementById("ouvriers-list");
const filterMetierSelect = document.getElementById("filter-metier");

const transactionForm = document.getElementById("transaction-form");
const transactionTypeSelect = document.getElementById("transaction-type");
const transactionMontantInput = document.getElementById("transaction-montant");
const transactionDateInput = document.getElementById("transaction-date");
const transactionNoteInput = document.getElementById("transaction-note");
const transactionOuvrierField = document.getElementById("transaction-ouvrier-field");
const transactionMateriauField = document.getElementById("transaction-materiau-field");
const transactionOuvrierSelect = document.getElementById("transaction-ouvrier");
const transactionMateriauSelect = document.getElementById("transaction-materiau");

const transactionsTbody = document.getElementById("transactions-tbody");
const transactionsCountChip = document.getElementById("transactions-count-chip");

const filterTypeSelect = document.getElementById("filter-type");
const filterOuvrierSelect = document.getElementById("filter-ouvrier");
const filterMateriauTransacSelect = document.getElementById("filter-materiau-transac");
const filterDateMinInput = document.getElementById("filter-date-min");
const filterDateMaxInput = document.getElementById("filter-date-max");
const btnClearFilters = document.getElementById("btn-clear-filters");

const btnExportPDF = document.getElementById("btn-export-pdf");
const btnExportExcel = document.getElementById("btn-export-excel");

const settingsUsernameDisplay = document.getElementById("settings-username-display");
const avatarInput = document.getElementById("avatar-input");
const avatarPreview = document.getElementById("avatar-preview");
const formChangeUsername = document.getElementById("form-change-username");
const newUsernameInput = document.getElementById("new-username");
const passwordForUsernameInput = document.getElementById("password-for-username");
const formChangePassword = document.getElementById("form-change-password");
const oldPasswordInput = document.getElementById("old-password");
const newPasswordInput = document.getElementById("new-password");
const newPasswordConfirmInput = document.getElementById("new-password-confirm");
const registerGuardSection = document.getElementById("register-guard-section");
const formRegisterGuard = document.getElementById("form-register-guard");
const registerGuardPasswordInput = document.getElementById("register-guard-password");
const registerGuardPasswordConfirmInput = document.getElementById("register-guard-password-confirm");
const registerGuardStatus = document.getElementById("register-guard-status");
const btnClearRegisterGuard = document.getElementById("btn-clear-register-guard");
const sarRateForm = document.getElementById("sar-rate-form");
const sarRateInput = document.getElementById("sar-rate");
const sarRatePasswordInput = document.getElementById("sar-rate-password");
const sarRateHint = document.getElementById("sar-rate-hint");
const btnThemeDark = document.getElementById("btn-theme-dark");
const btnThemeLight = document.getElementById("btn-theme-light");

const settingsChantiersList = document.getElementById("settings-chantiers-list");

const btnExportAllPDF = document.getElementById("btn-export-all-pdf");
const btnExportAllZIP = document.getElementById("btn-export-all-zip");
const logsList = document.getElementById("logs-list");
const customListsForm = document.getElementById("custom-lists-form");
const customMaterialsTextarea = document.getElementById("custom-materials");
const customMetiersTextarea = document.getElementById("custom-metiers");
const customCategoriesTextarea = document.getElementById("custom-categories");

const invTotalMatSpan = document.getElementById("inv-total-mat");
const invTotalOuvSpan = document.getElementById("inv-total-ouv");
const invTotalGlobalSpan = document.getElementById("inv-total-global");
const invMatTbody = document.getElementById("inv-mat-tbody");
const invOuvTbody = document.getElementById("inv-ouv-tbody");
const btnExportInventoryPDF = document.getElementById("btn-export-inventory-pdf");
const btnExportInventoryExcel = document.getElementById("btn-export-inventory-excel");

let invMatChart = null;
let invOuvChart = null;

let authMode = "login";

function getCurrentPermissions(){
  return currentUserRole === ROLE_VISITOR
    ? { canEdit:false, canManageChantier:false }
    : { canEdit:true, canManageChantier:true };
}
function requireAdmin(actionLabel){
  if(currentUserRole !== ROLE_ADMIN){
    const message = actionLabel ? `${actionLabel} est réservée à un administrateur.` : "Action réservée à un administrateur.";
    alert(message);
    return false;
  }
  return true;
}
function applyRoleContext(){
  const roleLabel = currentUserRole === ROLE_VISITOR ? "Visiteur" : "Administrateur";
  if(currentRoleSpan){
    currentRoleSpan.textContent = roleLabel;
  }
  document.body.classList.toggle("role-visitor", currentUserRole === ROLE_VISITOR);
  if(registerGuardSection){
    registerGuardSection.classList.toggle("hidden", currentUserRole !== ROLE_ADMIN);
  }
  applyPermissionLocks();
}
function applyPermissionLocks(){
  const perms = getCurrentPermissions();
  document.querySelectorAll("[data-requires-admin]").forEach(el=>{
    el.disabled = !perms.canEdit;
  });
}

/**********************
 * Multi-chantiers
 **********************/
function ensureAtLeastOneChantier(){
  if(!currentUserData.chantiers) currentUserData.chantiers = {};
  if(typeof currentUserData.sarRate !== "number") currentUserData.sarRate = null;
  if(!currentUserData.sarRateUpdatedAt) currentUserData.sarRateUpdatedAt = null;
  const ids = Object.keys(currentUserData.chantiers);
  const actives = ids.filter(id => !currentUserData.chantiers[id].archive);

  if(actives.length === 0 && ids.length === 0){
    const name = prompt("Nom du premier chantier :", "Mon premier chantier") || "Mon premier chantier";
    const id = generateId();
    currentUserData.chantiers[id] = {
      id,
      nom: name.trim(),
      budgetInitial: 0,
      budgetNote: "",
      budgetInitialLocked: false,
      materiaux: [],
      ouvriers: [],
      transactions: [],
      archive:false,
      verrouille:false,
      defaut:true
    };
    currentUserData.chantierActif = id;
    addLog(`Création du premier chantier « ${name.trim()} ».`);
  }else if(actives.length === 0 && ids.length > 0){
    const name = prompt("Tous les chantiers sont archivés. Nom du nouveau chantier :", "Nouveau chantier") || "Nouveau chantier";
    const id = generateId();
    currentUserData.chantiers[id] = {
      id,
      nom: name.trim(),
      budgetInitial: 0,
      budgetNote: "",
      budgetInitialLocked: false,
      materiaux: [],
      ouvriers: [],
      transactions: [],
      archive:false,
      verrouille:false,
      defaut:true
    };
    currentUserData.chantierActif = id;
    addLog(`Création d’un chantier actif « ${name.trim()} » alors que tous les autres étaient archivés.`);
  }else{
    const activeId = currentUserData.chantierActif;
    if(!activeId || !currentUserData.chantiers[activeId] || currentUserData.chantiers[activeId].archive){
      currentUserData.chantierActif = actives[0];
    }
  }
}

function renderChantiersUI(){
  if(!currentUserData || !currentUserData.chantiers) return;
  chantierSelect.innerHTML = "";
  Object.keys(currentUserData.chantiers)
    .filter(id => !currentUserData.chantiers[id].archive)
    .forEach(id=>{
      const c = currentUserData.chantiers[id];
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = c.nom || "Chantier sans nom";
      if(id === currentUserData.chantierActif) opt.selected = true;
      chantierSelect.appendChild(opt);
    });

  if(currentData && currentData.verrouille){
    chantierLockChip.classList.remove("hidden");
  }else{
    chantierLockChip.classList.add("hidden");
  }
}

function setActiveChantier(id){
  if(!currentUserData || !currentUserData.chantiers[id]) return;
  currentUserData.chantierActif = id;
  currentData = currentUserData.chantiers[id];
  saveUserData(currentUser,currentUserData);
  renderChantiersUI();
  renderAll();
  addLog(`Changement de chantier actif : « ${currentData.nom || "Sans nom"} ».`);
}

/**********************
 * Authentification
 **********************/
function updateRegisterGuardFieldState(){
  if(!authRegisterGuardField) return;
  const users = loadUsers();
  const guardHash = loadRegisterGuardHash();
  const adminExists = hasAdminAccount(users);
  const shouldShow = authMode === "register";

  if(shouldShow){
    authRegisterGuardField.classList.remove("hidden");
    const requiresGuard = adminExists && !!guardHash;
    authRegisterGuardInput.required = requiresGuard;
    authRegisterGuardInput.disabled = adminExists && !guardHash;

    if(adminExists && !guardHash){
      authRegisterGuardHint.textContent =
        "Un administrateur doit définir le mot de passe d’activation dans les paramètres avant toute nouvelle création.";
    }else if(adminExists && guardHash){
      authRegisterGuardHint.textContent =
        "Saisissez le mot de passe d’activation fourni par un administrateur pour valider la création.";
    }else{
      authRegisterGuardHint.textContent =
        "Création initiale : définissez d’abord un compte administrateur avant de sécuriser l’activation.";
    }
  }else{
    authRegisterGuardField.classList.add("hidden");
    authRegisterGuardInput.required = false;
    authRegisterGuardInput.disabled = false;
  }
}
function setAuthMode(mode){
  authMode = mode;
  if(mode === "login"){
    authTitle.textContent = "Connexion à l’espace chantier";
    authSubtitle.textContent = "Saisissez vos identifiants pour accéder à votre tableau de bord.";
    authSubmitBtn.textContent = "Se connecter";
    authToggleText.innerHTML = 'Pas encore de compte ? <button type="button" id="toggle-auth-mode">Créer un compte</button>';
    authPasswordConfirmField.classList.add("hidden");
    authRoleField.classList.add("hidden");
  }else{
    authTitle.textContent = "Création d’un compte chantier";
    authSubtitle.textContent = "Définissez un identifiant et un mot de passe pour cet espace.";
    authSubmitBtn.textContent = "Créer le compte";
    authToggleText.innerHTML = 'Déjà un compte ? <button type="button" id="toggle-auth-mode">Se connecter</button>';
    authPasswordConfirmField.classList.remove("hidden");
    authRoleField.classList.remove("hidden");
  }
  updateRegisterGuardFieldState();
  const toggleBtn = document.getElementById("toggle-auth-mode");
  toggleBtn.addEventListener("click", ()=> setAuthMode(authMode==="login" ? "register" : "login"));
}

function showAuth(){
  appView.classList.remove("active");
  authView.classList.add("active");
}
function showApp(){
  authView.classList.remove("active");
  appView.classList.add("active");
  currentUsernameSpan.textContent = currentUser || "";
  applyRoleContext();
  applyTheme();
  renderChantiersUI();
  renderSettingsView();
  renderAll();
  updateMainView();
}

function setupPasswordToggle(input, btn){
  if(!input || !btn) return;
  btn.addEventListener("click", ()=>{
    const currentlyHidden = input.type === "password";
    input.type = currentlyHidden ? "text" : "password";
    btn.textContent = currentlyHidden ? "Masquer" : "Afficher";
    if(currentlyHidden){
      setTimeout(()=>{
        input.type = "password";
        btn.textContent = "Afficher";
      }, 5000);
    }
  });
}

authForm.addEventListener("submit",async (e)=>{
  e.preventDefault();
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;
  if(!username || !password){
    alert("Veuillez renseigner l’identifiant et le mot de passe.");
    return;
  }
  let users = loadUsers();

  if(authMode === "register"){
    const confirm = authPasswordConfirmInput.value;
    if(password !== confirm){
      alert("La confirmation du mot de passe ne correspond pas.");
      return;
    }
    if(!validatePasswordComplexity(password)){
      alert("Mot de passe trop simple. Merci d’utiliser au moins 8 caractères incluant lettres et chiffres.");
      return;
    }
    if(users.some(u=>u.username === username)){
      alert("Cet identifiant est déjà utilisé.");
      return;
    }
    const adminExists = hasAdminAccount(users);
    const guardHash = loadRegisterGuardHash();
    if(adminExists){
      if(!guardHash){
        alert("La création de nouveaux comptes est désactivée tant qu’un administrateur n’a pas défini le mot de passe d’activation dans les paramètres.");
        return;
      }
      const activationPassword = authRegisterGuardInput ? authRegisterGuardInput.value : "";
      if(!activationPassword){
        alert("Veuillez saisir le mot de passe d’activation défini par un administrateur.");
        return;
      }
      const activationHash = await hashPassword(activationPassword);
      if(activationHash !== guardHash){
        alert("Mot de passe d’activation incorrect.");
        return;
      }
    }
    const passwordHash = await hashPassword(password);
    const role = (authRoleSelect && authRoleSelect.value === ROLE_VISITOR) ? ROLE_VISITOR : ROLE_ADMIN;
    users.push({username,passwordHash,role,avatarDataUrl:null});
    saveUsers(users);
    setCurrentUsername(username);
    currentUser = username;
    currentUserRole = role;
    currentUserData = loadUserData(username);
    currentUserData.role = role;
    ensureAtLeastOneChantier();
    currentData = currentUserData.chantiers[currentUserData.chantierActif];
    saveUserData(currentUser,currentUserData);
    addLog("Création du compte chantier.");
    applyRoleContext();
    showApp();
  }else{
    const found = users.find(u=>u.username===username);
    if(!found || !(await verifyPassword(found,password))){
      alert("Identifiant ou mot de passe incorrect.");
      return;
    }
    setCurrentUsername(username);
    currentUser = username;
    currentUserRole = found.role || ROLE_ADMIN;
    currentUserData = loadUserData(username);
    currentUserData.role = currentUserRole;
    ensureAtLeastOneChantier();
    currentData = currentUserData.chantiers[currentUserData.chantierActif];
    saveUserData(currentUser,currentUserData);
    addLog("Connexion au compte chantier.");
    applyRoleContext();
    showApp();
  }
  authPasswordInput.value = "";
  if(authPasswordConfirmInput) authPasswordConfirmInput.value = "";
  if(authRegisterGuardInput) authRegisterGuardInput.value = "";
});

logoutBtn.addEventListener("click", ()=>{
  if(confirm("Voulez-vous vraiment vous déconnecter ?")){
    addLog("Déconnexion de la session.");
    setCurrentUsername(null);
    currentUser = null;
    currentUserData = null;
    currentData = null;
    showAuth();
  }
});

/**********************
 * Thème
 **********************/
function applyTheme(){
  if(!currentUserData){
    document.body.classList.remove("theme-light");
    return;
  }
  const theme = currentUserData.theme || "dark";
  if(theme === "light"){
    document.body.classList.add("theme-light");
  }else{
    document.body.classList.remove("theme-light");
  }
}
btnThemeDark.addEventListener("click", ()=>{
  if(!currentUserData) return;
  currentUserData.theme = "dark";
  saveUserData(currentUser,currentUserData);
  applyTheme();
  addLog("Passage au thème sombre.");
});
btnThemeLight.addEventListener("click", ()=>{
  if(!currentUserData) return;
  currentUserData.theme = "light";
  saveUserData(currentUser,currentUserData);
  applyTheme();
  addLog("Passage au thème clair.");
});

/**********************
 * Navigation principale
 **********************/
function updateMainView(){
  dashboardView.classList.add("hidden");
  settingsView.classList.add("hidden");
  inventoryView.classList.add("hidden");

  if(currentMainView === "dashboard"){
    dashboardView.classList.remove("hidden");
  }else if(currentMainView === "settings"){
    settingsView.classList.remove("hidden");
  }else{
    inventoryView.classList.remove("hidden");
  }

  btnSettings.textContent = currentMainView === "settings" ? "⬅ Tableau de bord" : "⚙ Paramètres";
  btnInventory.textContent = currentMainView === "inventory" ? "⬅ Tableau de bord" : "Inventaire";
}
btnSettings.addEventListener("click", ()=>{
  currentMainView = currentMainView === "settings" ? "dashboard" : "settings";
  updateMainView();
});
btnInventory.addEventListener("click", ()=>{
  currentMainView = currentMainView === "inventory" ? "dashboard" : "inventory";
  if(currentMainView === "inventory") renderInventory();
  updateMainView();
});

/**********************
 * Budget
 **********************/
function computeTotals(){
  if(!currentData) return {depenses:0,dettes:0,solde:0};
  let depenses = 0;
  let dettes = 0;

  (currentData.transactions||[]).forEach(t=>{
    if(t.impactBudget && t.montant>0){
      depenses += t.montant;
    }
  });

  (currentData.materiaux||[]).forEach(m=>{
    if(m.payeACredit){
      const restant = Math.max(0,(m.montantTotal||0)-(m.montantPaye||0));
      dettes += restant;
    }
  });

  const solde = Math.max(0,(currentData.budgetInitial||0)-depenses);
  return {depenses,dettes,solde};
}
function renderBudgetPasswordGuard(){
  if(!budgetPasswordField || !budgetPasswordInput || !budgetPasswordHint || !budgetPasswordNote) return;
  const requiresPassword = currentData && currentData.budgetInitialLocked;

  budgetPasswordField.classList.toggle("hidden", !requiresPassword);
  if(!requiresPassword){
    budgetPasswordInput.value = "";
  }
  budgetPasswordInput.placeholder = requiresPassword
    ? "Mot de passe administrateur requis"
    : "Non requis tant que le budget initial n’est pas enregistré";

  budgetPasswordHint.textContent = requiresPassword
    ? "Saisissez le mot de passe d’autorisation pour modifier le budget initial."
    : "Vous pourrez définir le budget initial sans mot de passe, puis toute modification exigera une autorisation.";

  budgetPasswordNote.textContent = requiresPassword
    ? "La modification du budget initial est protégée : confirmation par mot de passe obligatoire."
    : "Après l’enregistrement du budget initial, toute modification sera protégée par un mot de passe.";
}
function renderBudgetStats(){
  if(!currentData) return;
  const totals = computeTotals();
  const budgetInitialFormatted = formatAmount(currentData.budgetInitial || 0);
  const depensesFormatted = formatAmount(totals.depenses);
  const soldeFormatted = formatAmount(totals.solde);
  const dettesFormatted = formatAmount(totals.dettes);
  const sarRate = getSarRate();

  statBudgetInitial.textContent = budgetInitialFormatted;
  statDepenses.textContent = depensesFormatted;
  statSolde.textContent = soldeFormatted;
  statDettes.textContent = dettesFormatted;
  if(statBudgetInitialSar){
    statBudgetInitialSar.textContent = sarRate
      ? formatSarAmountFromXof(currentData.budgetInitial || 0)
      : "Définir un taux SAR";
  }
  if(statSarRateNote){
    const updatedDate = currentUserData && currentUserData.sarRateUpdatedAt ? new Date(currentUserData.sarRateUpdatedAt) : null;
    const dateText = updatedDate && !isNaN(updatedDate.getTime()) ? updatedDate.toLocaleDateString("fr-FR") : null;
    statSarRateNote.textContent = dateText
      ? `${formatSarRateDescription()} · Mis à jour le ${dateText}`
      : formatSarRateDescription();
  }

  if(kpiBudgetInitial) kpiBudgetInitial.textContent = budgetInitialFormatted;
  if(kpiBudgetInitialSar) kpiBudgetInitialSar.textContent = sarRate
    ? formatSarAmountFromXof(currentData.budgetInitial || 0)
    : "Taux SAR à définir";
  if(sarRateChip){
    sarRateChip.textContent = formatSarRateDescription();
    sarRateChip.classList.toggle("pill-warning", !sarRate);
  }
  if(kpiDepenses) kpiDepenses.textContent = depensesFormatted;
  if(kpiSolde) kpiSolde.textContent = soldeFormatted;
  if(kpiDettes) kpiDettes.textContent = dettesFormatted;
  budgetInitialInput.value = currentData.budgetInitial || "";
  budgetNoteInput.value = currentData.budgetNote || "";
  renderBudgetPasswordGuard();
}
budgetForm.addEventListener("submit",async (e)=>{
  e.preventDefault();
  if(!currentUser || !currentUserData || !currentData) return;
  if(!requireAdmin("La mise à jour du budget")) return;
  if(currentData.verrouille){
    alert("Ce chantier est verrouillé. Veuillez le déverrouiller dans les paramètres pour le modifier.");
    return;
  }
  const requiresPassword = currentData.budgetInitialLocked;
  const val = parseFloat(budgetInitialInput.value);
  if(!Number.isFinite(val) || val<0){
    alert("Veuillez saisir un budget initial valide (montant positif).");
    return;
  }
  if(requiresPassword){
    const password = budgetPasswordInput.value;
    if(!password){
      alert("Veuillez saisir le mot de passe d’autorisation pour modifier le budget initial.");
      return;
    }
    const record = getCurrentUserRecord();
    const passwordOk = record ? await verifyPassword(record, password) : false;
    if(!passwordOk){
      alert("Mot de passe d’autorisation incorrect.");
      return;
    }
  }
  currentData.budgetInitial = val;
  currentData.budgetNote = budgetNoteInput.value.trim();
  currentData.budgetInitialLocked = true;
  saveUserData(currentUser,currentUserData);
  if(budgetPasswordInput) budgetPasswordInput.value = "";
  renderBudgetStats();
  renderInventory();
  addLog(`Mise à jour du budget du chantier « ${currentData.nom || "Sans nom"} ».`);
  alert("Budget mis à jour pour ce chantier.");
});

/**********************
 * Matériaux
 **********************/
function supprimerMateriau(id){
  if(!currentUser || !currentUserData || !currentData) return;
  if(!requireAdmin("La suppression de matériau")) return;
  if(currentData.verrouille){
    alert("Ce chantier est verrouillé. Impossible de modifier les matériaux.");
    return;
  }
  const idx = currentData.materiaux.findIndex(m=>m.id===id);
  if(idx===-1) return;
  const mat = currentData.materiaux[idx];
  if(!confirm(`Supprimer le matériau « ${mat.nom} » ?\nLes transactions déjà enregistrées ne seront pas supprimées.`)){
    return;
  }
  currentData.materiaux.splice(idx,1);
  saveUserData(currentUser,currentUserData);
  renderMateriaux();
  renderTransactions();
  renderBudgetStats();
  renderInventory();
  addLog(`Suppression du matériau « ${mat.nom} ».`);
}

function renderMateriaux(){
  materiauxList.innerHTML = "";
  if(materiauCategorieDatalist) materiauCategorieDatalist.innerHTML = "";
  if(materiauNomDatalist) materiauNomDatalist.innerHTML = "";

  const categoriesSet = new Set([...(BASE_MATERIAL_CATEGORIES || []), ...getCustomList("categories")]);
  const nomsSet = new Set([...(BASE_MATERIAL_NAMES || []), ...getCustomList("materiaux")]);

  if(!currentData || !currentData.materiaux.length){
    materiauxList.innerHTML = '<div class="hint">Aucun matériau enregistré pour le moment.</div>';
  }else{
    currentData.materiaux.forEach(m=>{
      if(m.categorie && m.categorie.trim()) categoriesSet.add(m.categorie.trim());
      if(m.nom && m.nom.trim()) nomsSet.add(m.nom.trim());

      const restant = m.payeACredit ? Math.max(0,(m.montantTotal||0)-(m.montantPaye||0)) : 0;
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${m.nom}</div>
          <div class="item-meta">
            Montant total : ${formatAmount(m.montantTotal||0)}
            ${
              m.payeACredit
                ? ` · <span class="chip chip-danger">À crédit – reste ${formatAmount(restant)}</span>`
                : ` · <span class="chip chip-accent">Payé comptant</span>`
            }
            <br>Quantité : ${m.quantite != null ? m.quantite : 1}
            · Catégorie / métier : ${m.categorie && m.categorie.trim() ? m.categorie.trim() : "Non renseigné"}
            <br>Date d’enregistrement : ${m.date || "—"}
          </div>
        </div>
        <div class="item-actions">
          ${m.payeACredit ? `<div class="chip chip-danger">Déjà payé : ${formatAmount(m.montantPaye||0)}</div>` : ""}
          <button type="button" class="btn btn-danger" data-id="${m.id}">Supprimer</button>
        </div>
      `;
      materiauxList.appendChild(row);
    });
  }

  if(materiauNomDatalist){
    const fragmentNames = document.createDocumentFragment();
    nomsSet.forEach(n=>{
      const opt = document.createElement("option");
      opt.value = n;
      fragmentNames.appendChild(opt);
    });
    materiauNomDatalist.appendChild(fragmentNames);
  }
  if(materiauCategorieDatalist){
    const fragmentCats = document.createDocumentFragment();
    categoriesSet.forEach(cat=>{
      const opt = document.createElement("option");
      opt.value = cat;
      fragmentCats.appendChild(opt);
    });
    materiauCategorieDatalist.appendChild(fragmentCats);
  }

  transactionMateriauSelect.innerHTML = '<option value="">Sélectionner un matériau à crédit…</option>';
  if(currentData){
    currentData.materiaux
      .filter(m=>m.payeACredit && Math.max(0,(m.montantTotal||0)-(m.montantPaye||0))>0)
      .forEach(m=>{
        const restant = Math.max(0,(m.montantTotal||0)-(m.montantPaye||0));
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.nom} – reste ${formatAmount(restant)}`;
        transactionMateriauSelect.appendChild(opt);
      });

    filterMateriauTransacSelect.innerHTML = '<option value="">Tous</option>';
    currentData.materiaux.forEach(m=>{
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.nom;
      filterMateriauTransacSelect.appendChild(opt);
    });
  }

  const delBtns = materiauxList.querySelectorAll(".btn-danger");
  delBtns.forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      supprimerMateriau(id);
    });
  });
}

materiauForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  if(!currentUser || !currentUserData || !currentData) return;
  if(!requireAdmin("La création de matériaux")) return;
  if(currentData.verrouille){
    alert("Ce chantier est verrouillé. Impossible d’ajouter ou de modifier les matériaux.");
    return;
  }

  const nom = materiauNomInput.value.trim();
  const montant = parseFloat(materiauMontantInput.value);
  const mode = materiauCreditSelect.value;
  const date = materiauDateInput.value;
  let quantite = parseFloat(materiauQuantiteInput.value);
  const categorie = (materiauCategorieInput.value || "").trim();

  if(!nom || !Number.isFinite(montant) || montant<=0 || !mode || !date || !categorie){
    alert("Tous les champs du formulaire « Matériaux » sont obligatoires. Veuillez les renseigner.");
    return;
  }
  if(!Number.isFinite(quantite) || quantite<=0){
    alert("Veuillez saisir une quantité strictement positive.");
    return;
  }
  if(!isValidPastOrToday(date)){
    alert("La date de l’opération doit être valide et ne peut pas être dans le futur.");
    return;
  }

  const id = generateId();
  const payeACredit = (mode === "credit");
  const mat = {
    id,
    nom,
    montantTotal: montant,
    payeACredit,
    montantPaye: payeACredit ? 0 : montant,
    date,
    quantite,
    categorie
  };
  currentData.materiaux.push(mat);

  if(!payeACredit){
    currentData.transactions.push({
      id: generateId(),
      type: "paiement_materiau_comptant",
      cibleType: "materiau",
      cibleId: id,
      date,
      description: `Paiement comptant : ${nom}`,
      montant,
      impactBudget: true
    });
  }

  saveUserData(currentUser,currentUserData);
  materiauForm.reset();
  materiauDateInput.value = "";
  renderMateriaux();
  renderTransactions();
  renderBudgetStats();
  renderInventory();
  addLog(`Enregistrement du matériau « ${nom} ».`);
  alert("Matériau enregistré avec succès.");
});

/**********************
 * Ouvriers
 **********************/
function supprimerOuvrier(id){
  if(!currentUser || !currentUserData || !currentData) return;
  if(!requireAdmin("La suppression d’un ouvrier")) return;
  if(currentData.verrouille){
    alert("Ce chantier est verrouillé. Impossible de modifier les ouvriers.");
    return;
  }
  const idx = currentData.ouvriers.findIndex(o=>o.id===id);
  if(idx===-1) return;
  const o = currentData.ouvriers[idx];
  if(!confirm(`Supprimer l’ouvrier « ${o.nom} » ?\nLes transactions déjà enregistrées ne seront pas supprimées.`)){
    return;
  }
  currentData.ouvriers.splice(idx,1);
  saveUserData(currentUser,currentUserData);
  renderOuvriers();
  renderTransactions();
  renderBudgetStats();
  renderInventory();
  addLog(`Suppression de l’ouvrier « ${o.nom} ».`);
}

function renderOuvriers(){
  ouvriersList.innerHTML = "";
  filterMetierSelect.innerHTML = '<option value="">Tous les métiers</option>';
  if(ouvrierMetierDatalist) ouvrierMetierDatalist.innerHTML = "";

  const metiersSet = new Set([...(BASE_METIERS || []), ...getCustomList("metiers")]);

  if(!currentData){
    ouvriersList.innerHTML = '<div class="hint">Aucun ouvrier enregistré pour le moment.</div>';
  }else if(!currentData.ouvriers.length){
    ouvriersList.innerHTML = '<div class="hint">Aucun ouvrier enregistré pour le moment.</div>';
  }else{
    const filtreMetier = filterMetierSelect.value || "";
    currentData.ouvriers.forEach(o=>{
      if(o.metier && o.metier.trim()) metiersSet.add(o.metier.trim());
    });

    metiersSet.forEach(m=>{
      if(!m) return;
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      filterMetierSelect.appendChild(opt);
    });

    currentData.ouvriers
      .filter(o=>!filtreMetier || o.metier===filtreMetier)
      .forEach(o=>{
        const restant = Math.max(0,(o.montantConvenu||0)-(o.montantVerse||0));
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${o.nom}${o.metier ? " – "+o.metier : ""}</div>
            <div class="item-meta">
              Montant convenu : ${formatAmount(o.montantConvenu||0)}
              · Versé : ${formatAmount(o.montantVerse||0)}
              · Reste : ${formatAmount(restant)}
              <br>Date de début : ${o.dateDebut || "—"}
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="btn btn-danger" data-id="${o.id}">Supprimer</button>
          </div>
        `;
        ouvriersList.appendChild(row);
      });
  }

  if(ouvrierMetierDatalist){
    const fragment = document.createDocumentFragment();
    metiersSet.forEach(m=>{
      const opt = document.createElement("option");
      opt.value = m;
      fragment.appendChild(opt);
    });
    ouvrierMetierDatalist.appendChild(fragment);
  }

  transactionOuvrierSelect.innerHTML = '<option value="">Sélectionner un ouvrier…</option>';
  currentData.ouvriers.forEach(o=>{
    const restant = Math.max(0,(o.montantConvenu||0)-(o.montantVerse||0));
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.nom}${o.metier?" – "+o.metier:""} (reste ${formatAmount(restant)})`;
    transactionOuvrierSelect.appendChild(opt);
  });

  filterOuvrierSelect.innerHTML = '<option value="">Tous</option>';
  currentData.ouvriers.forEach(o=>{
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.nom}${o.metier?" – "+o.metier:""}`;
    filterOuvrierSelect.appendChild(opt);
  });

  const delBtns = ouvriersList.querySelectorAll(".btn-danger");
  delBtns.forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      supprimerOuvrier(id);
    });
  });
}

ouvrierForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  if(!currentUser || !currentUserData || !currentData) return;
  if(!requireAdmin("L’enregistrement d’un ouvrier")) return;
  if(currentData.verrouille){
    alert("Ce chantier est verrouillé. Impossible d’ajouter ou de modifier les ouvriers.");
    return;
  }

  const nom = ouvrierNomInput.value.trim();
  const metier = ouvrierMetierInput.value.trim();
  const montant = parseFloat(ouvrierMontantInput.value);
  const date = ouvrierDateInput.value;

  if(!nom || !metier || !Number.isFinite(montant) || montant<=0 || !date){
    alert("Tous les champs du formulaire « Ouvriers / manœuvres » sont obligatoires. Veuillez les renseigner.");
    return;
  }
  if(!isValidPastOrToday(date)){
    alert("La date de début doit être valide et ne peut pas être dans le futur.");
    return;
  }

  const id = generateId();
  const o = {
    id,
    nom,
    metier,
    montantConvenu: montant,
    montantVerse: 0,
    dateDebut: date
  };
  currentData.ouvriers.push(o);
  saveUserData(currentUser,currentUserData);
  ouvrierForm.reset();
  ouvrierDateInput.value = "";
  renderOuvriers();
  renderBudgetStats();
  renderInventory();
  addLog(`Ajout de l’ouvrier « ${nom} ».`);
  alert("Ouvrier ajouté avec succès.");
});

filterMetierSelect.addEventListener("change",()=>{ renderOuvriers(); });

/**********************
 * Transactions
 **********************/
transactionTypeSelect.addEventListener("change",()=>{
  const type = transactionTypeSelect.value;
  if(type === "tranche_ouvrier"){
    transactionOuvrierField.classList.remove("hidden");
    transactionMateriauField.classList.add("hidden");
  }else if(type === "remboursement_credit"){
    transactionOuvrierField.classList.add("hidden");
    transactionMateriauField.classList.remove("hidden");
  }else{
    transactionOuvrierField.classList.add("hidden");
    transactionMateriauField.classList.add("hidden");
  }
});

transactionForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  if(!currentUser || !currentUserData || !currentData) return;
  if(!requireAdmin("L’enregistrement d’une transaction")) return;
  if(currentData.verrouille){
    alert("Ce chantier est verrouillé. Impossible d’enregistrer des transactions.");
    return;
  }

  const type = transactionTypeSelect.value;
  const montant = parseFloat(transactionMontantInput.value);
  const date = transactionDateInput.value;
  const note = transactionNoteInput.value.trim();

  if(!Number.isFinite(montant) || montant<=0 || !date){
    alert("Veuillez saisir un montant et une date de transaction valides.");
    return;
  }
  if(!isValidPastOrToday(date)){
    alert("La date de la transaction doit être valide et ne peut pas être dans le futur.");
    return;
  }

  const t = {
    id: generateId(),
    type,
    date,
    montant,
    impactBudget: true,
    cibleType: null,
    cibleId: null,
    description: ""
  };

  if(type === "tranche_ouvrier"){
    const ouvId = transactionOuvrierSelect.value;
    if(!ouvId){
      alert("Veuillez sélectionner un ouvrier.");
      return;
    }
    const o = currentData.ouvriers.find(x=>x.id===ouvId);
    if(!o){
      alert("Ouvrier introuvable.");
      return;
    }
    const restant = Math.max(0,(o.montantConvenu||0)-(o.montantVerse||0));
    if(montant > restant+0.0001){
      alert("Le montant dépasse le reste à payer pour cet ouvrier.");
      return;
    }
    o.montantVerse = (o.montantVerse||0) + montant;
    t.cibleType = "ouvrier";
    t.cibleId = ouvId;
    t.description = note || `Tranche versée à ${o.nom}${o.metier?" ("+o.metier+")":""}`;
  }else if(type === "remboursement_credit"){
    const matId = transactionMateriauSelect.value;
    if(!matId){
      alert("Veuillez sélectionner un matériau à crédit.");
      return;
    }
    const m = currentData.materiaux.find(x=>x.id===matId && x.payeACredit);
    if(!m){
      alert("Matériau à crédit introuvable.");
      return;
    }
    const restant = Math.max(0,(m.montantTotal||0)-(m.montantPaye||0));
    if(montant > restant+0.0001){
      alert("Le montant dépasse la dette restante pour ce matériau.");
      return;
    }
    m.montantPaye = (m.montantPaye||0) + montant;
    t.cibleType = "materiau_credit";
    t.cibleId = matId;
    t.description = note || `Remboursement du matériau à crédit : ${m.nom}`;
  }else{
    t.cibleType = "autre";
    t.description = note || "Dépense diverse";
  }

  currentData.transactions.push(t);
  saveUserData(currentUser,currentUserData);
  transactionForm.reset();
  transactionDateInput.value = "";
  transactionTypeSelect.value = "tranche_ouvrier";
  transactionTypeSelect.dispatchEvent(new Event("change"));

  renderOuvriers();
  renderMateriaux();
  renderTransactions();
  renderBudgetStats();
  renderInventory();
  addLog(`Enregistrement d’une transaction de type « ${t.type} ».`);
  alert("Transaction enregistrée avec succès.");
});

/**********************
 * Historique + filtres
 **********************/
function applyTransactionFilters(list){
  const typeFilter = filterTypeSelect.value || "";
  const ouvFilter = filterOuvrierSelect.value || "";
  const matFilter = filterMateriauTransacSelect.value || "";
  const dateMin = filterDateMinInput.value || "";
  const dateMax = filterDateMaxInput.value || "";

  return list.filter(t=>{
    if(typeFilter && t.type !== typeFilter) return false;
    if(ouvFilter){
      if(t.cibleType !== "ouvrier" || t.cibleId !== ouvFilter) return false;
    }
    if(matFilter){
      if(!((t.cibleType==="materiau_credit" && t.cibleId===matFilter) ||
            (t.type==="paiement_materiau_comptant" && t.cibleId===matFilter))){
        return false;
      }
    }
    if(dateMin && t.date && t.date < dateMin) return false;
    if(dateMax && t.date && t.date > dateMax) return false;
    return true;
  });
}
function renderTransactions(){
  transactionsTbody.innerHTML = "";
  if(!currentData || !currentData.transactions.length){
    transactionsTbody.innerHTML =
      '<tr><td colspan="4" style="font-size:11px;color:#9ca3af;padding:6px 4px;">Aucune transaction enregistrée pour le moment.</td></tr>';
    transactionsCountChip.textContent = "0 opération enregistrée";
    return;
  }

  const sorted = currentData.transactions.slice().sort((a,b)=>{
    if(a.date===b.date) return 0;
    return a.date > b.date ? -1 : 1;
  });
  const filtered = applyTransactionFilters(sorted);

  filtered.forEach(t=>{
    let label;
    switch(t.type){
      case "tranche_ouvrier": label="Tranche ouvrier"; break;
      case "remboursement_credit": label="Remboursement crédit"; break;
      case "paiement_materiau_comptant": label="Matériau comptant"; break;
      default: label="Dépense diverse";
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date || "—"}</td>
      <td>${label}</td>
      <td>${t.description || "—"}</td>
      <td class="amount">${formatAmount(t.montant||0)}</td>
    `;
    transactionsTbody.appendChild(tr);
  });

  transactionsCountChip.textContent = `${filtered.length} opération${filtered.length>1?"s":""} affichée${filtered.length>1?"s":""}`;
}
btnClearFilters.addEventListener("click",()=>{
  filterTypeSelect.value = "";
  filterOuvrierSelect.value = "";
  filterMateriauTransacSelect.value = "";
  filterDateMinInput.value = "";
  filterDateMaxInput.value = "";
  renderTransactions();
});
[filterTypeSelect,filterOuvrierSelect,filterMateriauTransacSelect,
 filterDateMinInput,filterDateMaxInput]
  .forEach(el => el.addEventListener("change", renderTransactions));

/**********************
 * Onglets
 **********************/
tabButtons.forEach(btn=>{
  btn.addEventListener("click",()=>{
    const target = btn.getAttribute("data-tab");
    tabButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    if(target==="materiaux"){
      tabMateriauxPanel.classList.remove("hidden");
      tabOuvriersPanel.classList.add("hidden");
    }else{
      tabMateriauxPanel.classList.add("hidden");
      tabOuvriersPanel.classList.remove("hidden");
    }
  });
});

/**********************
 * Export PDF chantier actif
 **********************/
btnExportPDF.addEventListener("click", ()=>{
  if(!currentData){
    alert("Aucune donnée à exporter pour ce chantier.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const totals = computeTotals();

  let y = 10;
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text("Rapport de chantier", 10, y); y+=8;

  doc.setFontSize(11);
  doc.setFont("helvetica","normal");
  doc.text(`Utilisateur : ${currentUser || "-"}`, 10, y); y+=6;
  doc.text(`Chantier : ${currentData.nom || "-"}`, 10, y); y+=6;
  doc.text(`Budget initial : ${formatAmount(currentData.budgetInitial||0)}`, 10, y); y+=6;
  doc.text(`Dépenses : ${formatAmount(totals.depenses)}`, 10, y); y+=6;
  doc.text(`Solde disponible : ${formatAmount(totals.solde)}`, 10, y); y+=6;
  doc.text(`Dettes fournisseurs : ${formatAmount(totals.dettes)}`, 10, y); y+=8;

  doc.setFont("helvetica","bold");
  doc.text("Transactions", 10, y); y+=6;
  doc.setFont("helvetica","normal");

  const tx = currentData.transactions.slice().sort((a,b)=> a.date>b.date?1:-1);
  tx.forEach(t=>{
    if(y>280){ doc.addPage(); y=10; }
    const label = (t.type==="tranche_ouvrier")?"Tranche ouvrier":
                  (t.type==="remboursement_credit")?"Remboursement crédit":
                  (t.type==="paiement_materiau_comptant")?"Matériau comptant":
                  "Dépense";
    doc.text(`${t.date||"-"}  [${label}]  ${t.description||""}  -  ${formatAmount(t.montant||0)}`, 10, y);
    y+=5;
  });

  doc.save(`chantier_${(currentData.nom||"rapport").replace(/\s+/g,"_")}.pdf`);
  addLog("Export PDF du chantier actif.");
});

/**********************
 * Export Excel chantier actif
 **********************/
btnExportExcel.addEventListener("click", ()=>{
  if(!currentData){
    alert("Aucune donnée à exporter pour ce chantier.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const totals = computeTotals();

  const wsBudget = XLSX.utils.aoa_to_sheet([
    ["Chantier", currentData.nom || ""],
    ["Budget initial", currentData.budgetInitial||0],
    ["Dépenses", totals.depenses],
    ["Solde disponible", totals.solde],
    ["Dettes fournisseurs", totals.dettes],
    ["Note", currentData.budgetNote||""]
  ]);
  XLSX.utils.book_append_sheet(wb, wsBudget, "Budget");

  const matData = [["Nom","Montant total","Paiement à crédit ?","Montant déjà payé","Quantité","Catégorie","Date"]];
  currentData.materiaux.forEach(m=>{
    matData.push([
      m.nom,
      m.montantTotal||0,
      m.payeACredit?"Oui":"Non",
      m.montantPaye||0,
      m.quantite != null ? m.quantite : 1,
      m.categorie || "",
      m.date||""
    ]);
  });
  const wsMat = XLSX.utils.aoa_to_sheet(matData);
  XLSX.utils.book_append_sheet(wb, wsMat, "Matériaux");

  const ouvData = [["Nom","Métier","Montant convenu","Montant versé","Reste","Date début"]];
  currentData.ouvriers.forEach(o=>{
    const reste = Math.max(0,(o.montantConvenu||0)-(o.montantVerse||0));
    ouvData.push([
      o.nom,
      o.metier||"",
      o.montantConvenu||0,
      o.montantVerse||0,
      reste,
      o.dateDebut||""
    ]);
  });
  const wsOuv = XLSX.utils.aoa_to_sheet(ouvData);
  XLSX.utils.book_append_sheet(wb, wsOuv, "Ouvriers");

  const txData = [["Date","Type","Description","Montant"]];
  currentData.transactions.forEach(t=>{
    const label = (t.type==="tranche_ouvrier")?"Tranche ouvrier":
                  (t.type==="remboursement_credit")?"Remboursement crédit":
                  (t.type==="paiement_materiau_comptant")?"Matériau comptant":
                  "Dépense diverse";
    txData.push([t.date||"", label, t.description||"", t.montant||0]);
  });
  const wsTx = XLSX.utils.aoa_to_sheet(txData);
  XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

  XLSX.writeFile(wb, `chantier_${(currentData.nom||"export").replace(/\s+/g,"_")}.xlsx`);
  addLog("Export Excel du chantier actif.");
});

/**********************
 * Paramètres compte
 **********************/
function getCurrentUserRecord(){
  const users = loadUsers();
  return users.find(u=>u.username===currentUser) || null;
}
function updateCurrentUserRecord(updater){
  const users = loadUsers();
  const idx = users.findIndex(u=>u.username===currentUser);
  if(idx === -1) return;
  const updated = Object.assign({}, users[idx]);
  updater(updated);
  users[idx] = updated;
  saveUsers(users);
}
avatarInput.addEventListener("change",(e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    const dataUrl = reader.result;
    avatarPreview.style.backgroundImage = `url(${dataUrl})`;
    updateCurrentUserRecord(u=>{u.avatarDataUrl=dataUrl;});
    addLog("Mise à jour de la photo de profil.");
  };
  reader.readAsDataURL(file);
});
formChangeUsername.addEventListener("submit",async (e)=>{
  e.preventDefault();
  if(!currentUser) return;
  const newUsername = newUsernameInput.value.trim();
  const password = passwordForUsernameInput.value;
  if(!newUsername){
    alert("Veuillez saisir un nouvel identifiant.");
    return;
  }
  if(!password){
    alert("Veuillez confirmer votre mot de passe.");
    return;
  }
  const users = loadUsers();
  const me = users.find(u=>u.username===currentUser);
  if(!me || !(await verifyPassword(me,password))){
    alert("Mot de passe incorrect.");
    return;
  }
  if(users.some(u=>u.username===newUsername && u.username!==currentUser)){
    alert("Ce nouvel identifiant est déjà utilisé.");
    return;
  }

  const oldKey = LS_DATA_PREFIX + currentUser;
  const newKey = LS_DATA_PREFIX + newUsername;
  const dataRaw = localStorage.getItem(oldKey);
  if(dataRaw != null){
    localStorage.setItem(newKey,dataRaw);
    localStorage.removeItem(oldKey);
  }

  me.username = newUsername;
  saveUsers(users);
  currentUser = newUsername;
  setCurrentUsername(newUsername);
  settingsUsernameDisplay.textContent = newUsername;
  currentUsernameSpan.textContent = newUsername;
  newUsernameInput.value = "";
  passwordForUsernameInput.value = "";
  addLog(`Changement d’identifiant : « ${currentUser} ».`);
  alert("Identifiant modifié avec succès.");
});
formChangePassword.addEventListener("submit",async (e)=>{
  e.preventDefault();
  if(!currentUser) return;
  const oldPwd = oldPasswordInput.value;
  const newPwd = newPasswordInput.value;
  const newPwdConf = newPasswordConfirmInput.value;
  if(!oldPwd || !newPwd || !newPwdConf){
    alert("Veuillez renseigner tous les champs de mot de passe.");
    return;
  }
  if(newPwd !== newPwdConf){
    alert("La confirmation ne correspond pas au nouveau mot de passe.");
    return;
  }
  if(!validatePasswordComplexity(newPwd)){
    alert("Nouveau mot de passe trop simple. Merci d’utiliser au moins 8 caractères incluant lettres et chiffres.");
    return;
  }
  const users = loadUsers();
  const idx = users.findIndex(u=>u.username===currentUser);
  const userRecord = users[idx];
  if(idx === -1 || !(await verifyPassword(userRecord,oldPwd))){
    alert("Ancien mot de passe incorrect.");
    return;
  }
  users[idx].passwordHash = await hashPassword(newPwd);
  delete users[idx].password;
  saveUsers(users);
  oldPasswordInput.value = "";
  newPasswordInput.value = "";
  newPasswordConfirmInput.value = "";
  addLog("Modification du mot de passe du compte.");
  alert("Mot de passe mis à jour avec succès.");
});

if(formRegisterGuard){
  formRegisterGuard.addEventListener("submit",async (e)=>{
    e.preventDefault();
    if(!requireAdmin("La gestion du mot de passe d’activation")) return;
    const pwd = registerGuardPasswordInput.value;
    const confirm = registerGuardPasswordConfirmInput.value;
    if(!pwd || !confirm){
      alert("Veuillez saisir et confirmer le mot de passe d’activation.");
      return;
    }
    if(pwd !== confirm){
      alert("La confirmation du mot de passe d’activation ne correspond pas.");
      return;
    }
    const hash = await hashPassword(pwd);
    saveRegisterGuardHash(hash);
    registerGuardPasswordInput.value = "";
    registerGuardPasswordConfirmInput.value = "";
    renderRegisterGuardControls();
    updateRegisterGuardFieldState();
    addLog("Mise à jour du mot de passe d’activation pour la création de comptes.");
    alert("Mot de passe d’activation enregistré.");
  });
}
if(btnClearRegisterGuard){
  btnClearRegisterGuard.addEventListener("click",()=>{
    if(!requireAdmin("La désactivation du mot de passe d’activation")) return;
    if(!confirm("Voulez-vous désactiver l’exigence de mot de passe pour créer un compte ?")) return;
    clearRegisterGuardHash();
    renderRegisterGuardControls();
    updateRegisterGuardFieldState();
    addLog("Suppression du mot de passe d’activation des créations de comptes.");
    alert("Exigence de mot de passe désactivée. Les administrateurs doivent en définir un nouveau avant toute création.");
  });
}

if(customListsForm){
  customListsForm.addEventListener("submit",(e)=>{
    e.preventDefault();
    if(!currentUserData) return;
    if(!requireAdmin("La mise à jour des listes personnalisées")) return;
    const materiaux = normalizeListInput(customMaterialsTextarea.value);
    const metiers = normalizeListInput(customMetiersTextarea.value);
    const categories = normalizeListInput(customCategoriesTextarea.value);

    currentUserData.customLists = { materiaux, metiers, categories };
    saveUserData(currentUser,currentUserData);
    renderMateriaux();
    renderOuvriers();
    renderCustomLists();
    addLog("Mise à jour des listes personnalisées (matériaux, métiers, catégories).");
    alert("Listes personnalisées mises à jour.");
  });
}

if(sarRateForm){
  sarRateForm.addEventListener("submit",async (e)=>{
    e.preventDefault();
    if(!currentUserData) return;
    if(!requireAdmin("La mise à jour du taux SAR")) return;

    const rate = parseFloat(sarRateInput.value);
    if(!Number.isFinite(rate) || rate <= 0){
      alert("Veuillez saisir un taux positif (1 SAR = n FCFA).");
      return;
    }

    const adminPassword = sarRatePasswordInput.value;
    if(!adminPassword){
      alert("Veuillez saisir le mot de passe administrateur pour confirmer la modification.");
      return;
    }

    const record = getCurrentUserRecord();
    if(!record || !(await verifyPassword(record, adminPassword))){
      alert("Mot de passe administrateur incorrect.");
      return;
    }

    currentUserData.sarRate = rate;
    currentUserData.sarRateUpdatedAt = new Date().toISOString();
    saveUserData(currentUser,currentUserData);
    sarRatePasswordInput.value = "";
    renderSarRateSettings();
    renderBudgetStats();
    addLog(`Mise à jour du taux SAR : ${formatSarRateDescription()}.`);
    alert("Taux SAR mis à jour.");
  });
}

/**********************
 * Paramètres chantiers
 **********************/
function renderSettingsChantiers(){
  settingsChantiersList.innerHTML = "";
  if(!currentUserData || !currentUserData.chantiers){
    settingsChantiersList.innerHTML = '<div class="hint">Aucun chantier pour ce compte.</div>';
    return;
  }
  const ids = Object.keys(currentUserData.chantiers);
  if(ids.length === 0){
    settingsChantiersList.innerHTML = '<div class="hint">Aucun chantier pour ce compte.</div>';
    return;
  }

  ids.forEach(id=>{
    const c = currentUserData.chantiers[id];
    const totals = (()=>{
      let dep=0,det=0;
      (c.transactions||[]).forEach(t=>{ if(t.impactBudget && t.montant>0) dep+=t.montant; });
      (c.materiaux||[]).forEach(m=>{
        if(m.payeACredit){
          const r = Math.max(0,(m.montantTotal||0)-(m.montantPaye||0));
          det += r;
        }
      });
      const solde = Math.max(0,(c.budgetInitial||0)-dep);
      return {dep,det,solde};
    })();

    const row = document.createElement("div");
    row.className = "chantier-item";
    row.innerHTML = `
      <div class="chantier-main">
        <div class="chantier-name">${c.nom || "Chantier sans nom"}</div>
        <div class="chantier-meta">
          Budget : ${formatAmount(c.budgetInitial||0)} · Dépenses : ${formatAmount(totals.dep)}
          · Dettes : ${formatAmount(totals.det)} · Solde : ${formatAmount(totals.solde)}
        </div>
        <div class="chantier-tags">
          ${currentUserData.chantierActif === id ? '<span class="chip chip-accent">Actif</span>' : ''}
          ${c.defaut ? '<span class="chip">Par défaut</span>' : ''}
          ${c.archive ? '<span class="chip chip-danger">Archivé</span>' : ''}
          ${c.verrouille ? '<span class="chip chip-danger">Verrouillé</span>' : ''}
        </div>
      </div>
      <div class="settings-chantiers-actions">
        <button type="button" class="btn btn-ghost action-rename" data-id="${id}">Renommer</button>
        <button type="button" class="btn btn-ghost action-duplicate" data-id="${id}">Dupliquer</button>
        <button type="button" class="btn btn-ghost action-archive" data-id="${id}">
          ${c.archive ? "Restaurer" : "Archiver"}
        </button>
        <button type="button" class="btn btn-ghost action-lock" data-id="${id}">
          ${c.verrouille ? "Déverrouiller" : "Verrouiller"}
        </button>
        <button type="button" class="btn btn-ghost action-default" data-id="${id}">
          Définir par défaut
        </button>
        <button type="button" class="btn btn-danger action-delete" data-id="${id}">
          Supprimer
        </button>
      </div>
    `;
    settingsChantiersList.appendChild(row);
  });

  settingsChantiersList.querySelectorAll(".action-rename").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      const c = currentUserData.chantiers[id];
      const name = prompt("Nouveau nom pour ce chantier :", c.nom || "Chantier");
      if(!name) return;
      c.nom = name.trim();
      saveUserData(currentUser,currentUserData);
      if(currentData && currentData.id===id) currentData.nom = c.nom;
      renderChantiersUI();
      renderSettingsChantiers();
      addLog(`Renommage du chantier en « ${c.nom} ».`);
    });
  });

  settingsChantiersList.querySelectorAll(".action-duplicate").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      const c = currentUserData.chantiers[id];
      const name = prompt("Nom du chantier dupliqué :", (c.nom || "Chantier")+" (copie)") || (c.nom || "Chantier")+" (copie)";
      const newId = generateId();
      const clone = JSON.parse(JSON.stringify(c));
      clone.id = newId;
      clone.nom = name.trim();
      clone.archive = false;
      clone.verrouille = false;
      clone.defaut = false;
      currentUserData.chantiers[newId] = clone;
      saveUserData(currentUser,currentUserData);
      renderChantiersUI();
      renderSettingsChantiers();
      addLog(`Duplication du chantier « ${c.nom || "Sans nom"} » en « ${clone.nom} ».`);
    });
  });

  settingsChantiersList.querySelectorAll(".action-archive").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      const c = currentUserData.chantiers[id];
      c.archive = !c.archive;
      if(c.archive && currentUserData.chantierActif===id){
        ensureAtLeastOneChantier();
        currentData = currentUserData.chantiers[currentUserData.chantierActif];
      }
      saveUserData(currentUser,currentUserData);
      renderChantiersUI();
      renderSettingsChantiers();
      renderAll();
      addLog(`${c.archive ? "Archivage" : "Restauration"} du chantier « ${c.nom || "Sans nom"} ».`);
    });
  });

  settingsChantiersList.querySelectorAll(".action-lock").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      const c = currentUserData.chantiers[id];
      c.verrouille = !c.verrouille;
      saveUserData(currentUser,currentUserData);
      if(currentData && currentData.id===id) currentData.verrouille = c.verrouille;
      renderChantiersUI();
      renderSettingsChantiers();
      addLog(`${c.verrouille ? "Verrouillage" : "Déverrouillage"} du chantier « ${c.nom || "Sans nom"} ».`);
    });
  });

  settingsChantiersList.querySelectorAll(".action-default").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id = btn.getAttribute("data-id");
      Object.values(currentUserData.chantiers).forEach(c=> c.defaut=false);
      if(currentUserData.chantiers[id]) currentUserData.chantiers[id].defaut = true;
      saveUserData(currentUser,currentUserData);
      renderSettingsChantiers();
      addLog(`Définition du chantier « ${currentUserData.chantiers[id].nom || "Sans nom"} » comme chantier par défaut.`);
    });
  });

  settingsChantiersList.querySelectorAll(".action-delete").forEach(btn=>{
    btn.addEventListener("click",async ()=>{
      const id = btn.getAttribute("data-id");
      await supprimerChantierParId(id);
      renderSettingsChantiers();
    });
  });
}

async function supprimerChantierParId(chantierId){
  if(!currentUser || !currentUserData || !currentUserData.chantiers[chantierId]) return;
  if(!requireAdmin("La suppression d’un chantier")) return;
  const c = currentUserData.chantiers[chantierId];
  const nomChantier = c.nom || "chantier sans nom";

  if(!confirm(`Voulez-vous vraiment supprimer le chantier « ${nomChantier} » et toutes ses données ?`)){
    return;
  }
  const pwd = prompt("Veuillez saisir votre mot de passe pour confirmer la suppression :");
  if(pwd == null) return;

  const users = loadUsers();
  const userRec = users.find(u=>u.username===currentUser);
  const passwordOk = await verifyPassword(userRec,pwd);
  if(!passwordOk){
    alert("Mot de passe incorrect. Suppression annulée.");
    return;
  }

  delete currentUserData.chantiers[chantierId];

  let newActiveId = null;
  const remainingIds = Object.keys(currentUserData.chantiers).filter(id=>!currentUserData.chantiers[id].archive);
  if(remainingIds.length === 0){
    const defaultName = prompt("Aucun chantier restant. Nom du nouveau chantier :", "Nouveau chantier") || "Nouveau chantier";
    const id = generateId();
    currentUserData.chantiers[id] = {
      id,
      nom: defaultName.trim(),
      budgetInitial: 0,
      budgetNote: "",
      budgetInitialLocked: false,
      materiaux: [],
      ouvriers: [],
      transactions: [],
      archive:false,
      verrouille:false,
      defaut:true
    };
    newActiveId = id;
    addLog(`Création d’un nouveau chantier « ${defaultName.trim()} » après suppression de tous les précédents.`);
  }else{
    newActiveId = remainingIds[0];
  }

  currentUserData.chantierActif = newActiveId;
  currentData = currentUserData.chantiers[newActiveId];
  saveUserData(currentUser,currentUserData);
  renderChantiersUI();
  renderSettingsChantiers();
  renderAll();
  addLog(`Suppression définitive du chantier « ${nomChantier} ».`);
  alert("Chantier supprimé avec succès.");
}

btnNewChantier.addEventListener("click",()=>{
  if(!currentUser || !currentUserData) return;
  if(!requireAdmin("La création d’un nouveau chantier")) return;
  const count = Object.keys(currentUserData.chantiers || {}).length;
  const defaultName = "Chantier " + (count+1);
  const name = prompt("Nom du nouveau chantier :", defaultName);
  if(!name) return;
  const id = generateId();
  currentUserData.chantiers[id] = {
    id,
    nom: name.trim(),
    budgetInitial: 0,
    budgetNote: "",
    budgetInitialLocked: false,
    materiaux: [],
    ouvriers: [],
    transactions: [],
    archive:false,
    verrouille:false,
    defaut:false
  };
  currentUserData.chantierActif = id;
  currentData = currentUserData.chantiers[id];
  saveUserData(currentUser,currentUserData);
  renderChantiersUI();
  renderSettingsChantiers();
  renderAll();
  addLog(`Création d’un nouveau chantier « ${name.trim()} ».`);
});
btnDeleteChantier.addEventListener("click",async ()=>{
  if(!currentUserData || !currentUserData.chantierActif) return;
  await supprimerChantierParId(currentUserData.chantierActif);
});
chantierSelect.addEventListener("change",()=>{
  const id = chantierSelect.value;
  if(!id) return;
  setActiveChantier(id);
});

/**********************
 * Logs
 **********************/
function renderLogs(){
  logsList.innerHTML = "";
  if(!currentUserData || !Array.isArray(currentUserData.logs) || currentUserData.logs.length===0){
    logsList.innerHTML = '<div class="hint">Aucune entrée de journal pour le moment.</div>';
    return;
  }
  currentUserData.logs.forEach(log=>{
    const d = new Date(log.date);
    const dateStr = isNaN(d.getTime()) ? log.date : d.toLocaleString("fr-FR");
    const div = document.createElement("div");
    div.className = "log-item";
    div.innerHTML = `
      <div>${log.message}</div>
      <div class="log-meta">${dateStr}</div>
    `;
    logsList.appendChild(div);
  });
}

/**********************
 * Paramètres vue
 **********************/
function renderSettingsView(){
  if(!currentUserData) return;
  settingsUsernameDisplay.textContent = currentUser || "";
  const rec = getCurrentUserRecord();
  if(rec && rec.avatarDataUrl){
    avatarPreview.style.backgroundImage = `url(${rec.avatarDataUrl})`;
  }else{
    avatarPreview.style.backgroundImage = "";
  }
  renderRegisterGuardControls();
  renderCustomLists();
  renderSarRateSettings();
  renderSettingsChantiers();
  renderLogs();
}

function renderRegisterGuardControls(){
  if(!registerGuardStatus) return;
  const guardHash = loadRegisterGuardHash();
  if(guardHash){
    registerGuardStatus.textContent = "Un mot de passe d’activation est actuellement requis pour créer un compte.";
    if(btnClearRegisterGuard) btnClearRegisterGuard.disabled = false;
  }else{
    registerGuardStatus.textContent = "Aucun mot de passe d’activation n’est défini : la création de nouveaux comptes reste bloquée.";
    if(btnClearRegisterGuard) btnClearRegisterGuard.disabled = true;
  }
}

function renderCustomLists(){
  if(!currentUserData || !customListsForm) return;
  ensureCustomLists(currentUserData);
  customMaterialsTextarea.value = (currentUserData.customLists.materiaux || []).join("\n");
  customMetiersTextarea.value = (currentUserData.customLists.metiers || []).join("\n");
  customCategoriesTextarea.value = (currentUserData.customLists.categories || []).join("\n");
}

function renderSarRateSettings(){
  if(!sarRateInput || !sarRateHint) return;
  const rate = getSarRate();
  sarRateInput.value = rate || "";

  if(!currentUserData){
    sarRateHint.textContent = "Connectez-vous pour ajuster le taux SAR.";
    return;
  }

  const updatedDate = currentUserData.sarRateUpdatedAt ? new Date(currentUserData.sarRateUpdatedAt) : null;
  const dateText = updatedDate && !isNaN(updatedDate.getTime()) ? updatedDate.toLocaleString("fr-FR") : null;
  if(rate){
    sarRateHint.textContent = dateText
      ? `${formatSarRateDescription()} (mis à jour le ${dateText})`
      : formatSarRateDescription();
  }else{
    sarRateHint.textContent = "Définissez le taux du jour pour afficher le budget en SAR.";
  }
}

/**********************
 * Inventaire : calculs
 **********************/
function computeInventory(){
  const result = {
    materialsByCategory:{},
    workersByMetier:{},
    totalMaterials:0,
    totalWorkforce:0,
    totalGlobal:0
  };
  if(!currentData) return result;

  (currentData.materiaux||[]).forEach(m=>{
    const cat = (m.categorie && m.categorie.trim()) || "Non renseigné";
    const q = (m.quantite != null && m.quantite>0) ? m.quantite : 1;
    const cost = m.payeACredit ? (m.montantPaye || 0) : (m.montantTotal || 0);

    if(!result.materialsByCategory[cat]){
      result.materialsByCategory[cat] = {
        totalCost:0,
        totalQuantity:0,
        itemsByName:{}
      };
    }
    const catObj = result.materialsByCategory[cat];
    catObj.totalCost += cost;
    catObj.totalQuantity += q;

    const key = m.nom || "Sans nom";
    if(!catObj.itemsByName[key]){
      catObj.itemsByName[key] = {quantity:0,cost:0};
    }
    catObj.itemsByName[key].quantity += q;
    catObj.itemsByName[key].cost += cost;
  });

  (currentData.ouvriers||[]).forEach(o=>{
    const metier = (o.metier && o.metier.trim()) || "Non renseigné";
    const convenu = o.montantConvenu || 0;
    const verse = o.montantVerse || 0;
    if(!result.workersByMetier[metier]){
      result.workersByMetier[metier] = {
        totalConvenu:0,
        totalVerse:0,
        ouvriers:[]
      };
    }
    const mObj = result.workersByMetier[metier];
    mObj.totalConvenu += convenu;
    mObj.totalVerse += verse;
    mObj.ouvriers.push({
      nom:o.nom,
      convenu,
      verse,
      reste:Math.max(0,convenu-verse)
    });
  });

  Object.values(result.materialsByCategory).forEach(cat=>{
    result.totalMaterials += cat.totalCost;
  });
  Object.values(result.workersByMetier).forEach(m=>{
    result.totalWorkforce += m.totalVerse;
  });
  result.totalGlobal = result.totalMaterials + result.totalWorkforce;

  return result;
}

/**********************
 * Inventaire : rendu
 **********************/
function renderInventory(){
  const inv = computeInventory();

  invTotalMatSpan.textContent = formatAmount(inv.totalMaterials);
  invTotalOuvSpan.textContent = formatAmount(inv.totalWorkforce);
  invTotalGlobalSpan.textContent = formatAmount(inv.totalGlobal);

  invMatTbody.innerHTML = "";
  const cats = Object.keys(inv.materialsByCategory);
  if(cats.length === 0){
    invMatTbody.innerHTML =
      '<tr><td colspan="4" style="font-size:11px;color:#9ca3af;padding:6px 4px;">Aucun matériau enregistré pour ce chantier.</td></tr>';
  }else{
    cats.forEach(cat=>{
      const catObj = inv.materialsByCategory[cat];
      const sectionRow = document.createElement("tr");
      sectionRow.className = "inv-section-row";
      sectionRow.innerHTML = `<td colspan="4">Catégorie / métier : ${cat} — Coût total : ${formatAmount(catObj.totalCost)} · Quantité totale : ${catObj.totalQuantity}</td>`;
      invMatTbody.appendChild(sectionRow);

      Object.keys(catObj.itemsByName).forEach(nom=>{
        const item = catObj.itemsByName[nom];
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${cat}</td>
          <td>${nom}</td>
          <td>${item.quantity}</td>
          <td class="amount">${formatAmount(item.cost)}</td>
        `;
        invMatTbody.appendChild(tr);
      });
    });
  }

  invOuvTbody.innerHTML = "";
  const metiers = Object.keys(inv.workersByMetier);
  if(metiers.length === 0){
    invOuvTbody.innerHTML =
      '<tr><td colspan="4" style="font-size:11px;color:#9ca3af;padding:6px 4px;">Aucun ouvrier enregistré pour ce chantier.</td></tr>';
  }else{
    metiers.forEach(metier=>{
      const mObj = inv.workersByMetier[metier];
      const sectionRow = document.createElement("tr");
      sectionRow.className = "inv-section-row";
      sectionRow.innerHTML = `<td colspan="4">Métier : ${metier} — Versé : ${formatAmount(mObj.totalVerse)} · Convenu : ${formatAmount(mObj.totalConvenu)}</td>`;
      invOuvTbody.appendChild(sectionRow);

      mObj.ouvriers.forEach(o=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${metier}</td>
          <td>${o.nom}</td>
          <td>${formatAmount(o.verse)}</td>
          <td class="amount">${formatAmount(o.reste)}</td>
        `;
        invOuvTbody.appendChild(tr);
      });
    });
  }

  renderInventoryCharts(inv);
}

/**********************
 * Inventaire : graphiques
 **********************/
function renderInventoryCharts(inv){
  const matCanvas = document.getElementById("inv-mat-chart");
  const ouvCanvas = document.getElementById("inv-ouv-chart");
  if(!matCanvas || !ouvCanvas || !window.Chart) return;

  const catLabels = Object.keys(inv.materialsByCategory);
  const catData = catLabels.map(c=>inv.materialsByCategory[c].totalCost);

  if(invMatChart) invMatChart.destroy();
  invMatChart = new Chart(matCanvas.getContext("2d"),{
    type:"bar",
    data:{
      labels:catLabels,
      datasets:[{
        label:"Coût des matériaux (FCFA)",
        data:catData
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false},title:{display:false}},
      scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}}
    }
  });

  const metiers = Object.keys(inv.workersByMetier);
  const ouvData = metiers.map(m=>inv.workersByMetier[m].totalVerse);

  if(invOuvChart) invOuvChart.destroy();
  invOuvChart = new Chart(ouvCanvas.getContext("2d"),{
    type:"bar",
    data:{
      labels:metiers,
      datasets:[{
        label:"Main-d’œuvre versée (FCFA)",
        data:ouvData
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false},title:{display:false}},
      scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}}
    }
  });
}

/**********************
 * Inventaire : exports
 **********************/
btnExportInventoryPDF.addEventListener("click",()=>{
  if(!currentData){
    alert("Aucun chantier actif.");
    return;
  }
  const inv = computeInventory();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 10;
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text("Inventaire du chantier",10,y); y+=8;

  doc.setFont("helvetica","normal");
  doc.setFontSize(11);
  doc.text(`Utilisateur : ${currentUser || "-"}`,10,y); y+=6;
  doc.text(`Chantier : ${currentData.nom || "-"}`,10,y); y+=6;
  doc.text(`Total matériaux : ${formatAmount(inv.totalMaterials)}`,10,y); y+=6;
  doc.text(`Total main-d’œuvre : ${formatAmount(inv.totalWorkforce)}`,10,y); y+=6;
  doc.text(`Dépense totale : ${formatAmount(inv.totalGlobal)}`,10,y); y+=8;

  doc.setFont("helvetica","bold");
  doc.text("Matériaux par catégorie",10,y); y+=6;
  doc.setFont("helvetica","normal");
  const cats = Object.keys(inv.materialsByCategory);
  cats.forEach(cat=>{
    const catObj = inv.materialsByCategory[cat];
    if(y>270){ doc.addPage(); y=10; }
    doc.text(`Catégorie : ${cat} — Coût : ${formatAmount(catObj.totalCost)} — Quantité : ${catObj.totalQuantity}`,10,y); y+=5;
    Object.keys(catObj.itemsByName).forEach(nom=>{
      const item = catObj.itemsByName[nom];
      if(y>280){ doc.addPage(); y=10; }
      doc.text(`• ${nom} — Qté : ${item.quantity} — Coût : ${formatAmount(item.cost)}`,12,y); y+=5;
    });
    y+=2;
  });

  if(y>260){ doc.addPage(); y=10; }
  doc.setFont("helvetica","bold");
  doc.text("Ouvriers par métier",10,y); y+=6;
  doc.setFont("helvetica","normal");
  const metiers = Object.keys(inv.workersByMetier);
  metiers.forEach(metier=>{
    const mObj = inv.workersByMetier[metier];
    if(y>270){ doc.addPage(); y=10; }
    doc.text(`Métier : ${metier} — Versé : ${formatAmount(mObj.totalVerse)} — Convenu : ${formatAmount(mObj.totalConvenu)}`,10,y); y+=5;
    mObj.ouvriers.forEach(o=>{
      if(y>280){ doc.addPage(); y=10; }
      doc.text(`• ${o.nom} — Versé : ${formatAmount(o.verse)} — Reste : ${formatAmount(o.reste)}`,12,y); y+=5;
    });
    y+=2;
  });

  doc.save(`inventaire_${(currentData.nom||"chantier").replace(/\s+/g,"_")}.pdf`);
  addLog("Export PDF de l’inventaire du chantier actif.");
});

btnExportInventoryExcel.addEventListener("click",()=>{
  if(!currentData){
    alert("Aucun chantier actif.");
    return;
  }
  const inv = computeInventory();
  const wb = XLSX.utils.book_new();

  const synth = [
    ["Chantier", currentData.nom || ""],
    ["Total matériaux (dépenses)", inv.totalMaterials],
    ["Total main-d’œuvre (versé)", inv.totalWorkforce],
    ["Dépense totale", inv.totalGlobal]
  ];
  const wsSynth = XLSX.utils.aoa_to_sheet(synth);
  XLSX.utils.book_append_sheet(wb, wsSynth, "Synthèse");

  const matRows = [["Catégorie","Matériau","Quantité","Coût (FCFA)"]];
  Object.entries(inv.materialsByCategory).forEach(([cat,catObj])=>{
    Object.entries(catObj.itemsByName).forEach(([nom,item])=>{
      matRows.push([cat, nom, item.quantity, item.cost]);
    });
  });
  const wsMat = XLSX.utils.aoa_to_sheet(matRows);
  XLSX.utils.book_append_sheet(wb, wsMat, "Matériaux");

  const ouvRows = [["Métier","Ouvrier","Versé (FCFA)","Reste (FCFA)"]];
  Object.entries(inv.workersByMetier).forEach(([metier,mObj])=>{
    mObj.ouvriers.forEach(o=>{
      ouvRows.push([metier, o.nom, o.verse, o.reste]);
    });
  });
  const wsOuv = XLSX.utils.aoa_to_sheet(ouvRows);
  XLSX.utils.book_append_sheet(wb, wsOuv, "Ouvriers");

  XLSX.writeFile(wb, `inventaire_${(currentData.nom||"chantier").replace(/\s+/g,"_")}.xlsx`);
  addLog("Export Excel de l’inventaire du chantier actif.");
});

/**********************
 * Exports globaux (tous les chantiers)
 **********************/
btnExportAllPDF.addEventListener("click",()=>{
  if(!currentUserData || !currentUserData.chantiers){
    alert("Aucun chantier à exporter.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let first = true;

  Object.values(currentUserData.chantiers).forEach(c=>{
    if(!first) doc.addPage();
    first = false;

    let y = 10;
    doc.setFont("helvetica","bold");
    doc.setFontSize(14);
    doc.text("Rapport de chantier",10,y); y+=8;

    const totals = (()=>{
      let dep=0,det=0;
      (c.transactions||[]).forEach(t=>{ if(t.impactBudget && t.montant>0) dep+=t.montant; });
      (c.materiaux||[]).forEach(m=>{
        if(m.payeACredit){
          const r = Math.max(0,(m.montantTotal||0)-(m.montantPaye||0));
          det+=r;
        }
      });
      const solde = Math.max(0,(c.budgetInitial||0)-dep);
      return {dep,det,solde};
    })();

    doc.setFontSize(11);
    doc.setFont("helvetica","normal");
    doc.text(`Utilisateur : ${currentUser || "-"}`,10,y); y+=6;
    doc.text(`Chantier : ${c.nom || "-"}`,10,y); y+=6;
    doc.text(`Budget initial : ${formatAmount(c.budgetInitial||0)}`,10,y); y+=6;
    doc.text(`Dépenses : ${formatAmount(totals.dep)}`,10,y); y+=6;
    doc.text(`Solde disponible : ${formatAmount(totals.solde)}`,10,y); y+=6;
    doc.text(`Dettes fournisseurs : ${formatAmount(totals.det)}`,10,y); y+=10;
    doc.text("Transactions (résumé)",10,y); y+=6;

    (c.transactions||[]).slice(0,40).forEach(t=>{
      if(y>280){ doc.addPage(); y=10; }
      doc.text(`${t.date||"-"}  -  ${t.description||""}  -  ${formatAmount(t.montant||0)}`,10,y);
      y+=5;
    });
  });

  doc.save("tous_les_chantiers.pdf");
  addLog("Export PDF unique pour tous les chantiers.");
});

btnExportAllZIP.addEventListener("click",()=>{
  if(!currentUserData || !currentUserData.chantiers){
    alert("Aucun chantier à exporter.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const zip = new JSZip();
  const promises = [];

  Object.values(currentUserData.chantiers).forEach(c=>{
    const p = new Promise(resolve=>{
      const doc = new jsPDF();
      let y = 10;
      doc.setFont("helvetica","bold");
      doc.setFontSize(14);
      doc.text("Rapport de chantier",10,y); y+=8;

      const totals = (()=>{
        let dep=0,det=0;
        (c.transactions||[]).forEach(t=>{ if(t.impactBudget && t.montant>0) dep+=t.montant; });
        (c.materiaux||[]).forEach(m=>{
          if(m.payeACredit){
            const r = Math.max(0,(m.montantTotal||0)-(m.montantPaye||0));
            det+=r;
          }
        });
        const solde = Math.max(0,(c.budgetInitial||0)-dep);
        return {dep,det,solde};
      })();

      doc.setFontSize(11);
      doc.setFont("helvetica","normal");
      doc.text(`Utilisateur : ${currentUser || "-"}`,10,y); y+=6;
      doc.text(`Chantier : ${c.nom || "-"}`,10,y); y+=6;
      doc.text(`Budget initial : ${formatAmount(c.budgetInitial||0)}`,10,y); y+=6;
      doc.text(`Dépenses : ${formatAmount(totals.dep)}`,10,y); y+=6;
      doc.text(`Solde disponible : ${formatAmount(totals.solde)}`,10,y); y+=6;
      doc.text(`Dettes fournisseurs : ${formatAmount(totals.det)}`,10,y); y+=10;

      const blob = doc.output("blob");
      const filename = `chantier_${(c.nom||"rapport").replace(/\s+/g,"_")}.pdf`;
      zip.file(filename, blob);
      resolve();
    });
    promises.push(p);
  });

  Promise.all(promises).then(()=>{
    zip.generateAsync({type:"blob"}).then(content=>{
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "chantiers_rapports.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      addLog("Export ZIP (un PDF par chantier) réalisé.");
    });
  });
});

/**********************
 * Rendu global
 **********************/
function renderAll(){
  if(!currentData) return;
  renderBudgetStats();
  renderMateriaux();
  renderOuvriers();
  renderTransactions();
  transactionTypeSelect.dispatchEvent(new Event("change"));
  renderChantiersUI();
  renderInventory();
}

/**********************
 * Initialisation
 **********************/
(function init(){
  materiauDateInput.value = "";
  ouvrierDateInput.value = "";
  transactionDateInput.value = "";

  autoCorrectInput(materiauNomInput, CORRECTIONS_MATERIAUX);
  autoCorrectInput(materiauCategorieInput, CORRECTIONS_CATEGORIES);
  autoCorrectInput(ouvrierMetierInput, CORRECTIONS_METIERS);

  const username = getCurrentUsername();
  if(username){
    currentUser = username;
    currentUserData = loadUserData(username);
    const record = getCurrentUserRecord();
    currentUserRole = (record && record.role) ? record.role : (currentUserData.role || ROLE_ADMIN);
    currentUserData.role = currentUserRole;
    ensureAtLeastOneChantier();
    currentData = currentUserData.chantiers[currentUserData.chantierActif];
    saveUserData(currentUser,currentUserData);
    showApp();
  }else{
    showAuth();
  }
  setAuthMode("login");
  currentMainView = "dashboard";
  updateMainView();
  setupPasswordToggle(authPasswordInput, togglePasswordBtn);
  setupPasswordToggle(authPasswordConfirmInput, togglePasswordConfirmBtn);
  window.addEventListener("beforeunload", ()=>{
    if(currentUser){
      setCurrentUsername(null);
    }
  });
})();
