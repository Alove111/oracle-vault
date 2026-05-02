import React, { useMemo, useRef, useState } from "react";
import {
  Lock,
  Plus,
  Search,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  KeyRound,
  Globe,
  Sparkles,
  Gamepad2,
  AppWindow,
  CreditCard,
  StickyNote,
  Download,
  Upload,
  X,
  Menu,
} from "lucide-react";

export default function App() {
  const [master, setMaster] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [passwords, setPasswords] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All Passwords");
  const [showAdd, setShowAdd] = useState(false);

  const [site, setSite] = useState("");
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [category, setCategory] = useState("Websites");
  const [search, setSearch] = useState("");

  const importInputRef = useRef(null);
  const MOBILE_STORAGE_KEY = "oracle_mobile_vault";

  const categories = [
    { name: "All Passwords", icon: KeyRound },
    { name: "Websites", icon: Globe },
    { name: "Apps", icon: AppWindow },
    { name: "Games", icon: Gamepad2 },
    { name: "Cards", icon: CreditCard },
    { name: "Notes", icon: StickyNote },
  ];

  function isElectron() {
    return Boolean(window.oracleVault);
  }

  async function readVaultStorage() {
    if (isElectron()) return await window.oracleVault.readVault();
    return localStorage.getItem(MOBILE_STORAGE_KEY);
  }

  async function writeVaultStorage(data) {
    if (isElectron()) return await window.oracleVault.writeVault(data);
    localStorage.setItem(MOBILE_STORAGE_KEY, data);
    return true;
  }

  async function exportVaultStorage() {
    if (isElectron()) {
      const result = await window.oracleVault.exportVault();
      alert(result.message);
      return;
    }

    const data = localStorage.getItem(MOBILE_STORAGE_KEY);

    if (!data) {
      alert("No vault found to export.");
      return;
    }

    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "oracle-vault-backup.ovault";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    alert("Backup exported.");
  }

  async function importVaultFile(file) {
    if (!file) return;

    const text = await file.text();
    await writeVaultStorage(text);

    alert("Backup imported. Lock and unlock again with the backup master password.");
  }

  async function importVaultStorage() {
    if (isElectron()) {
      const result = await window.oracleVault.importVault();
      alert(result.message);
      return;
    }

    importInputRef.current?.click();
  }

  async function deriveKey(password, salt) {
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 250000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptVault(data, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKey(password, salt);

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    return {
      version: 1,
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };
  }

  async function decryptVault(payload, password) {
    const decoder = new TextDecoder();

    const salt = new Uint8Array(payload.salt);
    const iv = new Uint8Array(payload.iv);
    const data = new Uint8Array(payload.data);

    const key = await deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    return JSON.parse(decoder.decode(decrypted));
  }

  async function saveEncryptedVault(updatedPasswords) {
    const encrypted = await encryptVault(updatedPasswords, master);
    await writeVaultStorage(JSON.stringify(encrypted));
    setPasswords(updatedPasswords);
  }

  async function unlock() {
    if (!master) return alert("Enter master password");

    const savedVault = await readVaultStorage();

    if (savedVault) {
      try {
        const decrypted = await decryptVault(JSON.parse(savedVault), master);
        setPasswords(decrypted);
        setUnlocked(true);
        return;
      } catch {
        alert("Wrong master password or corrupted vault.");
        return;
      }
    }

    const encrypted = await encryptVault([], master);
    await writeVaultStorage(JSON.stringify(encrypted));

    setPasswords([]);
    setUnlocked(true);
  }

  async function addPassword() {
    if (!site || !username || !pass) return alert("Fill all fields");

    const updated = [
      ...passwords,
      {
        id: Date.now(),
        site,
        username,
        pass,
        category,
        show: false,
      },
    ];

    await saveEncryptedVault(updated);

    setSite("");
    setUsername("");
    setPass("");
    setCategory("Websites");
    setShowAdd(false);
  }

  async function toggleShow(id) {
    const updated = passwords.map((item) =>
      item.id === id ? { ...item, show: !item.show } : item
    );

    await saveEncryptedVault(updated);
  }

  async function deletePassword(id) {
    const updated = passwords.filter((item) => item.id !== id);
    await saveEncryptedVault(updated);
  }

  async function copyPassword(text) {
    await navigator.clipboard.writeText(text);
    alert("Copied.");
  }

  function lockVault() {
    setUnlocked(false);
    setMaster("");
    setPasswords([]);
  }

  function generatePassword() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";

    let result = "";

    for (let i = 0; i < 18; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    setPass(result);
  }

  const filteredPasswords = useMemo(() => {
    return passwords.filter((item) => {
      const matchesCategory =
        activeCategory === "All Passwords" || item.category === activeCategory;

      const matchesSearch =
        item.site.toLowerCase().includes(search.toLowerCase()) ||
        item.username.toLowerCase().includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [passwords, activeCategory, search]);

  function getCategoryIcon(categoryName) {
    const found = categories.find((cat) => cat.name === categoryName);
    return found ? found.icon : Globe;
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#050509] text-white relative overflow-hidden flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.45),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(6,182,212,0.28),_transparent_35%)]" />

        <div className="relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/[0.07] backdrop-blur-2xl shadow-2xl p-6">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-4">
              <Shield size={32} />
            </div>

            <h1 className="text-3xl font-black tracking-tight">Oracle Vault</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Encrypted offline vault
            </p>
          </div>

          <div className="rounded-3xl bg-black/30 border border-white/10 p-4 mb-4">
            <div className="flex items-center gap-2 text-zinc-300 mb-3">
              <Lock size={17} />
              <span className="text-sm">Master Password</span>
            </div>

            <input
              type="password"
              placeholder="Enter vault key"
              value={master}
              onChange={(e) => setMaster(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-2xl p-4 outline-none focus:border-violet-400 text-white placeholder:text-zinc-600 text-base"
            />
          </div>

          <button
            onClick={unlock}
            className="w-full rounded-2xl p-4 font-bold bg-gradient-to-r from-violet-500 to-cyan-400 text-white active:scale-[0.98] transition shadow-lg shadow-violet-500/25"
          >
            Unlock Vault
          </button>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Sparkles size={14} />
            {isElectron()
              ? "Desktop encrypted storage"
              : "Android PWA encrypted storage"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050509] text-white relative overflow-hidden">
      <input
        ref={importInputRef}
        type="file"
        accept=".ovault,application/json,text/plain"
        className="hidden"
        onChange={(e) => importVaultFile(e.target.files?.[0])}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.25),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.2),_transparent_35%)]" />

      <div className="relative min-h-screen pb-24">
        <header className="sticky top-0 z-20 bg-[#050509]/80 backdrop-blur-2xl border-b border-white/10 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shrink-0">
                <Shield size={24} />
              </div>

              <div className="min-w-0">
                <h1 className="font-black text-xl truncate">Oracle Vault</h1>
                <p className="text-xs text-zinc-500 truncate">
                  {passwords.length} saved items
                </p>
              </div>
            </div>

            <button
              onClick={lockVault}
              className="rounded-2xl bg-white/10 border border-white/10 p-3"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="relative mt-4">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              size={18}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vault"
              className="w-full rounded-2xl bg-black/40 border border-white/10 p-4 pl-11 outline-none focus:border-cyan-400 text-base"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pt-4 pb-1 no-scrollbar">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.name;

              return (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`shrink-0 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-black"
                      : "bg-white/10 border border-white/10 text-zinc-300"
                  }`}
                >
                  <Icon size={16} />
                  {cat.name.replace(" Passwords", "")}
                </button>
              );
            })}
          </div>
        </header>

        <main className="px-4 pt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={exportVaultStorage}
              className="rounded-3xl bg-white/[0.07] border border-white/10 p-4 text-left"
            >
              <Download size={20} className="text-cyan-300 mb-2" />
              <p className="font-bold">Export</p>
              <p className="text-xs text-zinc-500">Backup file</p>
            </button>

            <button
              onClick={importVaultStorage}
              className="rounded-3xl bg-white/[0.07] border border-white/10 p-4 text-left"
            >
              <Upload size={20} className="text-violet-300 mb-2" />
              <p className="font-bold">Import</p>
              <p className="text-xs text-zinc-500">Restore vault</p>
            </button>
          </div>

          {filteredPasswords.map((item) => {
            const FallbackIcon = getCategoryIcon(item.category);

            return (
              <div
                key={item.id}
                className="rounded-[1.7rem] bg-white/[0.06] border border-white/10 p-4 shadow-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.category === "Websites" ? (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${item.site}&sz=64`}
                        alt={item.site}
                        className="w-7 h-7"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <FallbackIcon size={22} className="text-cyan-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg truncate">{item.site}</h3>
                    <p className="text-zinc-500 text-sm truncate">
                      {item.username}
                    </p>
                  </div>

                  <span className="text-[11px] rounded-full bg-white/10 px-3 py-1 text-zinc-400 shrink-0">
                    {item.category}
                  </span>
                </div>

                <div className="rounded-2xl bg-black/35 border border-white/10 px-4 py-3 mb-3 text-center text-zinc-300 tracking-widest">
                  {item.show ? item.pass : "••••••••••••"}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => toggleShow(item.id)}
                    className="rounded-2xl bg-white/10 p-3 flex justify-center"
                  >
                    {item.show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>

                  <button
                    onClick={() => copyPassword(item.pass)}
                    className="rounded-2xl bg-white/10 p-3 flex justify-center"
                  >
                    <Copy size={18} />
                  </button>

                  <button
                    onClick={() => deletePassword(item.id)}
                    className="rounded-2xl bg-red-500/20 text-red-300 p-3 flex justify-center"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPasswords.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-zinc-500">
              No items found.
            </div>
          )}
        </main>

        <button
          onClick={() => setShowAdd(true)}
          className="fixed right-5 bottom-24 z-30 w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-2xl shadow-violet-500/30 active:scale-95 transition"
        >
          <Plus size={30} />
        </button>

        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#050509]/90 backdrop-blur-2xl border-t border-white/10 p-3">
          <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
            <button
              onClick={() => setActiveCategory("All Passwords")}
              className="rounded-2xl p-3 bg-white/10 flex flex-col items-center gap-1 text-xs"
            >
              <KeyRound size={18} />
              Vault
            </button>

            <button
              onClick={() => setShowAdd(true)}
              className="rounded-2xl p-3 bg-white/10 flex flex-col items-center gap-1 text-xs"
            >
              <Plus size={18} />
              Add
            </button>

            <button
              onClick={exportVaultStorage}
              className="rounded-2xl p-3 bg-white/10 flex flex-col items-center gap-1 text-xs"
            >
              <Download size={18} />
              Backup
            </button>

            <button
              onClick={lockVault}
              className="rounded-2xl p-3 bg-white/10 flex flex-col items-center gap-1 text-xs"
            >
              <Lock size={18} />
              Lock
            </button>
          </div>
        </nav>

        {showAdd && (
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#101014] p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black">Add Password</h2>

                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-2xl bg-white/10 p-3"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="Website / App / Note"
                  className="w-full rounded-2xl bg-black/40 border border-white/10 p-4 outline-none focus:border-violet-400 text-base"
                />

                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username / Email"
                  className="w-full rounded-2xl bg-black/40 border border-white/10 p-4 outline-none focus:border-violet-400 text-base"
                />

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 p-4 outline-none focus:border-violet-400 text-base"
                >
                  {categories
                    .filter((cat) => cat.name !== "All Passwords")
                    .map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                </select>

                <div className="flex gap-2">
                  <input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Password / Secret"
                    className="flex-1 min-w-0 rounded-2xl bg-black/40 border border-white/10 p-4 outline-none focus:border-violet-400 text-base"
                  />

                  <button
                    onClick={generatePassword}
                    className="rounded-2xl bg-white/10 border border-white/10 px-4 text-sm"
                  >
                    Gen
                  </button>
                </div>

                <button
                  onClick={addPassword}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-400 p-4 font-bold shadow-lg shadow-violet-500/20 active:scale-[0.98] transition"
                >
                  Save Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}