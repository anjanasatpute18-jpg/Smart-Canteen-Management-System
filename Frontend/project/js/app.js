/* ============================================================
   App Core - Auth state, Cart, Toast, Helpers
   ============================================================ */

// ---------- Storage helpers ----------
const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

// ---------- Database wrapper (simulated backend) ----------
const DB = {
  get(key, fallback = null) {
    return Store.get(`scms_db_${key}`, fallback);
  },
  set(key, val) {
    Store.set(`scms_db_${key}`, val);
  },
  remove(key) {
    Store.remove(`scms_db_${key}`);
  },
  getAdminProfile() {
    return this.get('admin_profile', null);
  },
  saveAdminProfile(profile) {
    this.set('admin_profile', profile);
    return profile;
  },
  getUserProfile() {
    return this.get('user_profile', null);
  },
  saveUserProfile(profile) {
    this.set('user_profile', profile);
    return profile;
  },
  addLoginEvent(event) {
    const history = this.get('login_history', []);
    history.unshift(event);
    this.set('login_history', history);
    return history;
  },
  getLoginHistory() {
    return this.get('login_history', []);
  }
};

// ---------- Auth ----------
if (!document.querySelector('link[data-fa-stylesheet="true"]')) {
  const faLink = document.createElement('link');
  faLink.rel = 'stylesheet';
  faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
  faLink.crossOrigin = 'anonymous';
  faLink.referrerPolicy = 'no-referrer';
  faLink.setAttribute('data-fa-stylesheet', 'true');
  document.head.appendChild(faLink);
}

const Auth = {
  getUser() {
    return Store.get('scms_user');
  },
  getProfile() {
    return {
      name: 'Student User',
      enrollment: 'EN2026001',
      email: 'student@edu.in',
      role: 'student',
      department: 'Computer Science',
      phone: '+91 98765 43210',
      ...(this.getUser() || {})
    };
  },
  adminDefault() {
    return {
      name: 'Administrator',
      adminId: 'Janvi Satpute',
      email: 'janvisatpute378@gmail.com',
      role: 'admin',
      isAdmin: true,
      passwordHash: btoa('pass@378')
    };
  },
  getAdminRecord(identifier) {
    const value = String(identifier || '').toLowerCase().trim();
    const stored = DB.getAdminProfile();
    if (stored && stored.email && String(stored.email).toLowerCase() === value) {
      return stored;
    }
    const def = this.adminDefault();
    return value === String(def.email).toLowerCase() ? def : null;
  },
  getUserRecord(identifier) {
    const value = String(identifier || '').toLowerCase().trim();
    const admin = this.getAdminRecord(value);
    if (admin) return { ...admin, role: 'admin' };
    const students = Store.get('scms_students', []);
    return students.find(student => {
      return (student.enrollment && String(student.enrollment).toLowerCase() === value) ||
        (student.email && String(student.email).toLowerCase() === value);
    }) || null;
  },
  updateUserRecord(user) {
    if (!user) return null;
    if (user.role === 'admin') {
      return DB.saveAdminProfile({ ...this.getAdminRecord(user.email), ...user });
    }
    return this.updateStudentRecord(user);
  },
  syncStudentRecord(profile = {}) {
    if (profile.role === 'admin') return profile;

    const students = Store.get('scms_students', []);
    const normalized = {
      id: profile.id || profile.studentId || (students[0] ? Math.max(...students.map(student => Number(student.id) || 0)) + 1 : 1),
      name: profile.name || 'Student User',
      enrollment: profile.enrollment || '',
      email: profile.email || '',
      mobile: profile.mobile || profile.phone || '',
      department: profile.department || 'Computer Science',
      password: profile.password || '',
      passwordHash: profile.password ? this.hashPassword(profile.password) : profile.passwordHash || '',
      role: profile.role || 'student',
      orders: Number(profile.orders || 0),
      imported: Boolean(profile.imported),
      ...profile
    };

    const existingIndex = students.findIndex(student => {
      const enrollmentMatch = student.enrollment && normalized.enrollment && String(student.enrollment).toLowerCase() === String(normalized.enrollment).toLowerCase();
      const emailMatch = student.email && normalized.email && String(student.email).toLowerCase() === String(normalized.email).toLowerCase();
      return enrollmentMatch || emailMatch;
    });

    if (existingIndex >= 0) {
      students[existingIndex] = { ...students[existingIndex], ...normalized, id: students[existingIndex].id || normalized.id };
    } else {
      students.unshift(normalized);
    }

    Store.set('scms_students', students);
    return normalized;
  },
  login(user) {
    const normalized = { ...this.getProfile(), ...user };
    const stored = Store.get('scms_user') || {};
    const passwordHash = user.password ? this.hashPassword(user.password) : stored.passwordHash || user.passwordHash;
    const finalProfile = { ...normalized, passwordHash };
    this.syncStudentRecord(finalProfile);
    Store.set('scms_user', finalProfile);
    if (finalProfile.role === 'admin') {
      Store.set('scms_admin_profile', finalProfile);
      DB.saveAdminProfile(finalProfile);
    } else {
      DB.saveUserProfile(finalProfile);
    }
    this.recordLoginEvent({
      type: 'login',
      role: finalProfile.role || 'student',
      email: finalProfile.email,
      message: finalProfile.role === 'admin' ? 'Admin signed in.' : 'User signed in.'
    });
    return finalProfile;
  },
  async updateProfile(profile) {
  const currentUser = this.getUser();

  if (!currentUser) {
    throw new Error('User is not logged in');
  }

  const updated = { ...currentUser, ...profile };

  // Admin profile remains local
  if (updated.role === 'admin') {
    Store.set('scms_user', updated);
    Store.set('scms_admin_profile', updated);
    DB.saveAdminProfile(updated);
    return updated;
  }

  // Send student profile changes to Flask backend
  const response = await fetch('http://127.0.0.1:5000/api/update_profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
  body: JSON.stringify({
  enrollment: currentUser.enrollment,
  current_email: currentUser.email,
  name: updated.name,
  email: updated.email,
  department: updated.department,
  phone: updated.phone,
  gender: updated.gender,
  profile_images: updated.profile_images,
  password: updated.password
})
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Profile update failed');
  }

  // Update local session after database update succeeds
  Store.set('scms_user', updated);
  this.syncStudentRecord(updated);
  DB.saveUserProfile(updated);

  return updated;
},
  hashPassword(value) {
    return btoa(String(value));
  },
  verifyPassword(password) {
    const user = this.getProfile();
    if (!user) return false;
    const storedHash = user.passwordHash || '';
    if (storedHash) {
      return storedHash === this.hashPassword(password);
    }
    return user.password && user.password === password;
  },
  verifyRecordPassword(record, password) {
    if (!record) return false;
    if (record.passwordHash) {
      return record.passwordHash === this.hashPassword(password);
    }
    return record.password && record.password === password;
  },
  verifyStudentPassword(student, password) {
    if (!student) return false;
    if (student.passwordHash) {
      return student.passwordHash === this.hashPassword(password);
    }
    return student.password && student.password === password;
  },
  getStudentRecord(identifier) {
    const students = Store.get('scms_students', []);
    const value = String(identifier || '').toLowerCase().trim();
    return students.find(student => {
      return (student.enrollment && String(student.enrollment).toLowerCase() === value) ||
        (student.email && String(student.email).toLowerCase() === value);
    }) || null;
  },
  updateStudentRecord(student) {
    const students = Store.get('scms_students', []);
    const index = students.findIndex(item => item.email === student.email || item.enrollment === student.enrollment);
    if (index >= 0) {
      students[index] = { ...students[index], ...student };
    } else {
      students.unshift(student);
    }
    Store.set('scms_students', students);
    return student;
  },
  sendResetOTP(email) {
    const record = this.getUserRecord(email);
    if (!record) return null;
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const payload = {
      email: record.email,
      otp,
      expires: Date.now() + 5 * 60 * 1000
    };
    Store.set('scms_password_reset', payload);
    return payload;
  },
  verifyResetOTP(email, code) {
    const payload = Store.get('scms_password_reset', null);
    if (!payload) return false;
    const normalizedEmail = String(email || '').toLowerCase().trim();
    return payload.email && payload.email.toLowerCase() === normalizedEmail && payload.otp === String(code).trim() && Date.now() < payload.expires;
  },
  resetPasswordByEmail(email, otp, newPassword) {
    if (!this.verifyResetOTP(email, otp)) return false;
    const record = this.getUserRecord(email);
    if (!record) return false;
    const updated = {
      ...record,
      password: newPassword,
      passwordHash: this.hashPassword(newPassword)
    };
    this.updateUserRecord(updated);
    const currentUser = this.getUser();
    if (currentUser && currentUser.email === updated.email) {
      Store.set('scms_user', { ...currentUser, ...updated });
    }
    return true;
  },
  changePassword(oldPassword, newPassword) {
    if (!this.verifyPassword(oldPassword)) {
      return false;
    }
    const user = this.getProfile();
    const updated = { ...user, password: newPassword, passwordHash: this.hashPassword(newPassword) };
    Store.set('scms_user', updated);
    if (updated.role === 'admin') {
      Store.set('scms_admin_profile', updated);
      DB.saveAdminProfile(updated);
    } else {
      DB.saveUserProfile(updated);
      this.updateStudentRecord(updated);
    }
    return true;
  },
  getLoginHistoryKey() {
    return 'scms_login_history';
  },
  recordLoginEvent(event = {}) {
    return DB.addLoginEvent({
      id: `lh-${Date.now()}-${Math.round(Math.random() * 999)}`,
      email: event.email || this.getUser()?.email || 'unknown',
      role: event.role || this.getUser()?.role || 'student',
      type: event.type || 'login',
      message: event.message || (event.type === 'logout' ? 'Logged out' : 'Signed in'),
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    });
  },
  getLoginHistory() {
    const user = this.getUser();
    if (!user) return [];
    return DB.getLoginHistory().filter(item => item.email === user.email);
  },
  logout(redirect = '../index.html') {
    const user = this.getUser();
    if (user) {
      this.recordLoginEvent({
        type: 'logout',
        role: user.role || 'student',
        email: user.email,
        message: user.role === 'admin' ? 'Admin signed out.' : 'User signed out.'
      });
    }
    Store.remove('scms_user');
    if (redirect) window.location.href = redirect;
  },
  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'admin';
  },
  guard() {
    if (!this.getUser()) {
      window.location.href = '../index.html';
      return false;
    }
    return true;
  },
  guardAdmin() {
    if (!this.isAdmin()) {
      window.location.href = 'admin-login.html';
      return false;
    }
    return true;
  }
};

// ---------- Menu management ----------
async function loadFoodsFromDatabase() {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/foods");

        if (!response.ok) {
            throw new Error("Failed to load foods");
        }

        const foods = await response.json();

        window.MENU_ITEMS = foods.map(food => ({
            id: Number(food.Food_id),
            name: food.Food_name,
            categoryId: Number(food.Category_id),
            price: Number(food.Price),
            img:
              food.Food_name.trim().toLowerCase() === "puri bhaji"
                  ? "../assets/images/food/Puri Bhaji.png"
                  :food.Food_name.trim().toLowerCase() === "cup ice cream"
                  ? "../assets/images/food/Cup Ice Cream.jpg"
                  : food.Image,
            available: food.Available
        }));

        console.log("Foods loaded from database:", window.MENU_ITEMS);

        return window.MENU_ITEMS;

    } catch (error) {
        console.error("Food API Error:", error);
        return [];
    }
}

const Menu = {
  getAll() {
    const stored = Store.get('scms_menu_items');
    const source = Array.isArray(window.MENU_ITEMS) ? window.MENU_ITEMS : (typeof MENU_ITEMS !== 'undefined' ? MENU_ITEMS : []);

    if (Array.isArray(stored) && stored.length) {
      const merged = [...(Array.isArray(source) ? source : [])];
      stored.forEach(item => {
        const exists = merged.some(existing => existing.id === item.id || existing.name === item.name);
        if (!exists) {
          merged.push(item);
        }
      });
      window.MENU_ITEMS = merged;
      return merged;
    }

    if (!Array.isArray(source)) {
      window.MENU_ITEMS = [];
      return [];
    }

    window.MENU_ITEMS = source;
    return source;
  },

  save(items = this.getAll()) {
    const list = Array.isArray(items) ? items : [];
    Store.set('scms_menu_items', list);
    window.MENU_ITEMS = list;
    try {
      window.dispatchEvent(new CustomEvent('menu.updated', { detail: { items: list } }));
    } catch (e) { /* ignore in non-browser env */ }
    return list;
  },

  add(item) {
    const list = this.getAll();
    const entry = {
      id: item.id || (list[0] ? Math.max(...list.map(i => i.id)) + 1 : 1),
      name: item.name || 'New Item',
      category: item.category || 'Snacks',
      price: Number(item.price || 0),
      rating: Number(item.rating || 4.5),
      img: item.img || (typeof getFoodImage === 'function' ? getFoodImage('Food') : '../assets/images/placeholder.svg'),
      desc: item.desc || 'Freshly prepared item.',
      ingredients: item.ingredients || []
    };
    list.unshift(entry);
    return this.save(list);
  },

  update(id, updates) {
    const list = this.getAll();
    const index = list.findIndex(i => i.id === Number(id));
    if (index < 0) return null;
    const updated = { ...list[index], ...updates, id: Number(id) };
    list[index] = updated;
    this.save(list);
    return updated;
  },

  remove(id) {
    const list = this.getAll().filter(i => i.id !== Number(id));
    return this.save(list);
  }
};

window.Menu = Menu;

// ---------- Cart ----------
const Cart = {
  items: Store.get('scms_cart', []),

  save() {
    Store.set('scms_cart', this.items);
  },

  add(item, qty = 1) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) {
      existing.qty += qty;
    } else {
      this.items.push({ ...item, qty });
    }
    this.save();
    this.refreshCartBadge();
    Toast.show(`${item.name} added to cart`, 'success');
  },

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
    this.refreshCartBadge();
  },

  updateQty(id, qty) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.qty = Math.max(1, qty);
      this.save();
      this.refreshCartBadge();
    }
  },

  clear() {
    this.items = [];
    this.save();
    this.refreshCartBadge();
  },

  refreshCartBadge() {
    const cartDot = document.getElementById('cartCountDot');
    if (!cartDot) return;
    const count = this.count();
    cartDot.textContent = count;
    cartDot.style.display = count ? 'flex' : 'none';
  },

  count() {
    return this.items.reduce((s, i) => s + i.qty, 0);
  },

  total() {
    return this.items.reduce((s, i) => s + i.price * i.qty, 0);
  }
};

// ---------- Orders ----------
const Orders = {
  items: Store.get('scms_orders', []),

  save() {
    Store.set('scms_orders', this.items);
    try {
      window.dispatchEvent(new CustomEvent('orders.updated', { detail: { orders: this.items } }));
    } catch (e) { /* ignore in non-browser env */ }
    return this.items;
  },

  syncFromStorage() {
    const stored = Store.get('scms_orders', []);
    this.items = Array.isArray(stored) ? stored : [];
    return this.items;
  },

  add(order) {
    const entry = {
      id: order.id || `ORD-${Date.now()}`,
      createdAt: order.createdAt || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: order.status || 'pending',
      payment: order.payment || 'UPI',
      paymentStatus: order.paymentStatus || 'Pending',
      pickupCounter: order.pickupCounter || 'Counter 3',
      items: order.items || [],
      amount: order.amount || 0,
      userEmail: order.userEmail || Auth.getUser()?.email || 'student@edu.in',
      userEnrollment: order.userEnrollment || Auth.getProfile()?.enrollment || '',
      ...order
    };
    this.items.unshift(entry);
    this.save();
    return entry;
  },

  all() {
    return this.items;
  },

  forUser() {
    const user = Auth.getUser();
    if (!user) return [];
    return this.items.filter(o => {
      return (user.email && o.userEmail && String(o.userEmail).toLowerCase() === String(user.email).toLowerCase()) ||
             (user.enrollment && o.userEnrollment && String(o.userEnrollment).toLowerCase() === String(user.enrollment).toLowerCase());
    });
  },

  getById(id) {
    return this.items.find(o => o.id === id) || null;
  },

  cancel(id) {
    const order = this.getById(id);
    if (order) {
      order.status = 'cancelled';
      this.save();
    }
    return order;
  },

  updateStatus(id, status) {
    const order = this.getById(id);
    if (order) {
      order.status = status;
      this.save();
    }
    return order;
  }
};

// ---------- Wallet ----------
const Wallet = {
  balance: Store.get('scms_wallet_balance', 500),
  transactions: Store.get('scms_wallet_transactions', []),

  save() {
    Store.set('scms_wallet_balance', this.balance);
    Store.set('scms_wallet_transactions', this.transactions);
  },

  getBalance() {
    return this.balance;
  },

  getTransactions() {
    return this.transactions;
  },

  add(amount, meta = {}) {
    this.balance += amount;
    this.transactions.unshift({
      id: `txn-${Date.now()}`,
      type: 'credit',
      amount,
      label: meta.label || 'Wallet Recharge',
      note: meta.note || 'Added via app',
      date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    });
    this.save();
    return this.balance;
  },

  spend(amount, meta = {}) {
    this.balance = Math.max(0, this.balance - amount);
    this.transactions.unshift({
      id: `txn-${Date.now()}`,
      type: 'debit',
      amount: -amount,
      label: meta.label || 'Payment',
      note: meta.note || 'Processed successfully',
      date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    });
    this.save();
    return this.balance;
  }
};

// ---------- Favorites ----------
const Fav = {
  ids: new Set(Store.get('scms_favs', [])),

  toggle(id) {
    if (this.ids.has(id)) {
      this.ids.delete(id);
    } else {
      this.ids.add(id);
      Toast.show('Added to favorites', 'success');
    }
    Store.set('scms_favs', [...this.ids]);
  },

  has(id) {
    return this.ids.has(id);
  }
};

// ---------- Toast ----------
const Toast = {
  show(msg, type = 'info', duration = 3000) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastIn 0.3s reverse';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }
};

async function loadBackendNotifications() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/notifications");

    if (!response.ok) {
      throw new Error("Failed to load notifications");
    }

    const result = await response.json();

    console.log("Backend Notifications:", result);

    return Array.isArray(result) ? result : result.data || [];

  } catch (error) {
    console.error("Notifications API Error:", error);
    return [];
  }
}

const Notifications = {
  getStorageKey(role = 'user') {
    return role === 'admin' ? 'scms_admin_notifications' : 'scms_user_notifications';
  },
  get(role = 'user') {
    return Store.get(this.getStorageKey(role), []);
  },
  save(list, role = 'user') {
    Store.set(this.getStorageKey(role), list);
    return list;
  },
  create(message, meta = {}, role = 'user') {
    const list = this.get(role);
    const note = {
      id: `ntf-${Date.now()}-${Math.round(Math.random() * 999)}`,
      message,
      type: meta.type || 'info',
      category: meta.category || 'general',
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      read: false,
      ...meta
    };
    list.unshift(note);
    this.save(list, role);
    return note;
  },
  unreadCount(role = 'user') {
    return this.get(role).filter(note => !note.read).length;
  },
  markRead(id, role = 'user') {
    const updated = this.get(role).map(note => note.id === id ? { ...note, read: true } : note);
    this.save(updated, role);
    return updated;
  },
  markAllRead(role = 'user') {
    const updated = this.get(role).map(note => ({ ...note, read: true }));
    this.save(updated, role);
    return updated;
  },
  renderBell(role = 'user') {
    const id = role === 'admin' ? 'adminNotificationCountDot' : 'notificationCountDot';
    const dot = document.getElementById(id);
    if (!dot) return;
    const count = this.unreadCount(role);
    dot.textContent = count > 0 ? count : '';
    dot.style.display = count > 0 ? 'flex' : 'none';
  },

  openBackendModal(notes) {
  const unread = notes.length;

  const modal = Modal.open(`
    <div style="padding:20px;min-width:320px;max-width:420px;">
      <h3 style="margin:0 0 6px;">Admin Notifications</h3>

      <p style="margin:0 0 18px;color:var(--ink-600);">
        ${unread} notifications
      </p>

      <div style="max-height:380px;overflow:auto;">
        ${
          notes.length
            ? notes.map(note => `
                <div style="padding:12px;border-bottom:1px solid #eee;">
                  <strong>${note.title}</strong>
                  <div style="margin-top:5px;">${note.message}</div>
                  <small style="color:var(--ink-600);">
                    ${note.created_at}
                  </small>
                </div>
              `).join('')
            : '<div style="padding:18px 0;">No notifications found.</div>'
        }
      </div>
    </div>
  `);

  return modal;
},

   openModal(role = 'user') {
    loadBackendNotifications().then(notes => {
    this.openBackendModal(notes);
    });
    return;
  },
 
   ensureSeed(role = 'user') {
    const existing = this.get(role);
    if (existing.length) return;
    if (role === 'user') {
      this.save([
        { id: 'ntf-welcome', message: 'Welcome! Your order updates show here in real-time.', type: 'info', category: 'announcement', timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), read: true },
        { id: 'ntf-order-placed', message: 'Order Placed: Your meal order has been received.', type: 'success', category: 'order', timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), read: false }
      ], role);
    } else {
      this.save([
        { id: 'ntf-admin-welcome', message: 'Admin alert: New order alerts and system notices appear here.', type: 'info', category: 'system', timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), read: true },
        { id: 'ntf-admin-order', message: 'New order received in the canteen queue.', type: 'warning', category: 'order', timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), read: false }
      ], role);
    }
  },
  runSimulation(role = 'user') {
    const sessionKey = `scms_notifications_simulated_${role}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    const events = role === 'admin' ? [
      { delay: 4200, message: 'New online order received.', type: 'info', category: 'order' },
      { delay: 8200, message: 'Payment confirmed for order ORD' + Math.floor(Math.random() * 900 + 100) + '.', type: 'success', category: 'payment' },
      { delay: 13200, message: 'Low stock warning: Paneer running low.', type: 'warning', category: 'stock' },
      { delay: 17200, message: 'QR scan activity detected at counter 2.', type: 'info', category: 'qr' },
      { delay: 21200, message: 'System alert: Daily report is ready.', type: 'info', category: 'system' }
    ] : [
      { delay: 5200, message: 'Preparing: Your order is being cooked.', type: 'info', category: 'order' },
      { delay: 11200, message: 'Ready for Pickup: Your meal is waiting at the counter.', type: 'success', category: 'order' },
      { delay: 16200, message: 'Completed: Enjoy your meal!', type: 'success', category: 'order' }
    ];
    events.forEach(evt => setTimeout(() => {
      this.create(evt.message, { type: evt.type, category: evt.category }, role);
      this.renderBell(role);
    }, evt.delay));
  }
};

// ---------- Modal ----------
const Modal = {
  open(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${content}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close(overlay);
    });
    document.body.appendChild(overlay);
    return overlay;
  },
  close(overlay) {
    overlay.style.animation = 'fadeIn 0.2s reverse';
    setTimeout(() => overlay.remove(), 200);
  }
};

// ---------- Helpers ----------
function $(sel, parent = document) {
  return parent.querySelector(sel);
}

function $$(sel, parent = document) {
  return parent.querySelectorAll(sel);
}

function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function createGenderAvatar(gender, size = 96) {
  const g = String(gender || '').toLowerCase();
  const isGirl = ['female', 'girl'].includes(g);
  const isBoy = ['male', 'boy'].includes(g);
  const bg = isGirl ? '#ff6fa8' : isBoy ? '#4ea8ff' : '#CCCCCC';
  const emoji = isGirl ? '👧' : isBoy ? '👦' : '👤';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 200 200'><rect width='100%' height='100%' rx='28' fill='${bg}'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='96' font-family='Segoe UI Emoji, Noto Color Emoji, sans-serif'>${emoji}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function starsHTML(rating) {
  const starUrl = '../assets/images/food/5%20Star.jpg';
  return `<img src="${starUrl}" alt="${Number(rating).toFixed(1)} star rating" class="rating-image" />`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function findFood(id) {
  return (window.MENU_ITEMS || MENU_ITEMS || []).find(i => i.id === Number(id));
}

// ---------- Sidebar component (shared by dashboard pages) ----------
function renderSidebar(activeKey) {
  const links = [
    { key: 'home', label: 'home', iconClass: 'fa-house', href: 'dashboard.html' },
    { key: 'menu', label: 'menu', iconClass: 'fa-utensils', href: 'menu.html' },
    { key: 'orders', label: 'myOrders', iconClass: 'fa-box', href: 'order.html' },
    { key: 'history', label: 'orderHistory', iconClass: 'fa-clock-rotate-left', href: 'order-history.html' },
    { key: 'scan', label: 'scanFood', iconClass: 'fa-qrcode', href: 'food-scan.html' },
    { key: 'wallet', label: 'wallet', iconClass: 'fa-wallet', href: 'wallet.html' },
    { key: 'upi', label: 'upiPayment', iconClass: 'fa-mobile-screen-button', href: 'upi-payment.html' },
    { key: 'profile', label: 'profile', iconClass: 'fa-user', href: 'profile.html' }
  ];

  const items = links.map(l => {
    const translatedLabel = typeof t === 'function' ? t(l.label) : l.label;
    return `<a class="nav-item ${l.key === activeKey ? 'active' : ''}" href="${l.href}">
      <span class="nav-icon"><i class="fa-solid ${l.iconClass}"></i></span>
      <span>${translatedLabel}</span>
    </a>`;
  }).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo"><i class="fa-solid fa-utensils"></i></div>
        <div class="sidebar-title">Smart Canteen<small>Management System</small></div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Menu</div>
        ${items}
      </nav>
      <div style="padding: 16px;">
        <a class="nav-item" href="#" onclick="Auth.logout('../index.html'); return false;" style="color: var(--error);">
          <span class="nav-icon"><i class="fa-solid fa-right-from-bracket"></i></span><span>${typeof t === 'function' ? t('logout') : 'Logout'}</span>
        </a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
  `;
}

function renderNavbar(pageTitle) {
  const user = Auth.getUser() || { name: 'Student' };
  return `
    <header class="navbar">
      <button class="menu-toggle" id="menuToggle"><i class="fa-solid fa-bars"></i></button>
      <div class="navbar-search">
        <span class="icon"><i class="fa-solid fa-magnifying-glass"></i></span>
        <input class="input" id="globalSearch" placeholder="Search food, orders..." />
      </div>
      <div class="navbar-actions">
        <button class="icon-btn" title="Cart" id="cartBtn" onclick="location.href='cart.html'">
          <i class="fa-solid fa-cart-shopping"></i><span class="dot" id="cartCountDot"></span>
        </button>
        <button class="icon-btn" title="Notifications" id="notificationBtn">
          <i class="fa-solid fa-bell"></i><span class="dot" id="notificationCountDot"></span>
        </button>
        <img class="avatar" src="${createGenderAvatar(user.gender)}" alt="Profile" onclick="location.href='profile.html'" />
      </div>
    </header>
  `;
}

// ---------- Dashboard shell init ----------
function initDashboard(activeKey) {
  if (!Auth.guard()) return;
  document.body.innerHTML = `
    <div class="app">
      ${renderSidebar(activeKey)}
      <div class="main">
        ${renderNavbar()}
        <main class="page" id="pageContent"></main>
      </div>
    </div>
  `;
  // Sidebar toggle
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebarBackdrop');
  $('#menuToggle')?.addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  });
  backdrop?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  });

  const searchInput = $('#globalSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.food-card').forEach(card => {
        const name = card.querySelector('.food-name')?.textContent.toLowerCase() || '';
        card.style.display = name.includes(value) ? 'block' : 'none';
      });
    });
  }

  const cartDot = $('#cartCountDot');
  if (cartDot) {
    cartDot.textContent = Cart.count();
    cartDot.style.display = Cart.count() ? 'flex' : 'none';
  }

  Notifications.ensureSeed('user');
  Notifications.ensureSeed('admin');
  Notifications.renderBell('user');
  Notifications.renderBell('admin');
  Notifications.runSimulation('user');

  $('#notificationBtn')?.addEventListener('click', () => {
    Notifications.openModal('user');
  });

}

// ---------- Validation helpers ----------
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^\+?[0-9\s\-]{7,15}$/.test(phone);
}

function validateEnrollment(en) {
  return /^[A-Za-z0-9]{6,}$/.test(en);
}

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

// ---------- Button ripple effect ----------
document.addEventListener('mousemove', (e) => {
  const btn = e.target.closest('.btn');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
    btn.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
  }
});

// ---------- Page transition on link clicks ----------
function initPageTransitions() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
    e.preventDefault();
    const overlay = document.createElement('div');
    overlay.className = 'page-transition';
    overlay.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1)';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.transform = 'translateY(0)'; });
    setTimeout(() => { window.location.href = link.href; }, 400);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPageTransitions);
} else {
  initPageTransitions();
}

loadFoodsFromDatabase().then(() => {
    console.log("Database Menu Ready:", window.MENU_ITEMS);
});