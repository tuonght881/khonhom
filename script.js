// --- 1. FIREBASE SETUP ---
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
        import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        import { setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        const firebaseConfig = {
            apiKey: "AIzaSyCIkXopYV133e4FNUoJRYGc12FE3wg1y34",
            authDomain: "ql-khonhom-5dccc.firebaseapp.com",
            projectId: "ql-khonhom-5dccc",
            storageBucket: "ql-khonhom-5dccc.firebasestorage.app",
            messagingSenderId: "150168801606",
            appId: "1:150168801606:web:a53e12f2afeeee0f07d547"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        const MY_GMAIL = "frachlitzgaming78@gmail.com";
        const stockCol = collection(db, "inventory");

        // --- 2. BIẾN TOÀN CỤC ---
        window.rawInventory = [];
        let cutRequests = [];
        let types = ["Nâu", "Trắng", "Nẹp"];
        let currentManualGroupIdx = null;

        // --- 3. LOGIC XÁC THỰC ---
        onAuthStateChanged(auth, async (user) => {
            const authScreen = document.getElementById('auth-screen');
            const logoutBtn = document.getElementById('btn-logout');

            if (user && user.email === MY_GMAIL) {
                // Kiểm tra thời hạn 15 ngày
                const loginDate = localStorage.getItem('last_login_timestamp');
                if (loginDate) {
                    const fifteenDays = 15 * 24 * 60 * 60 * 1000;
                    if (Date.now() - parseInt(loginDate) > fifteenDays) {
                        alert("Phiên đăng nhập đã hết hạn (15 ngày). Vui lòng đăng nhập lại!");
                        handleLogout();
                        return;
                    }
                }

                authScreen.classList.add('hidden');
                logoutBtn.classList.remove('hidden');
                initAppData();
            } else {
                if (user) { alert("Tài khoản không có quyền!"); handleLogout(); }
                authScreen.classList.remove('hidden');
                logoutBtn.classList.add('hidden');
            }
        });

        document.getElementById('btn-login').onclick = async () => {
            const provider = new GoogleAuthProvider();
            const isRemember = document.getElementById('remember-me').checked;
            
            provider.setCustomParameters({ prompt: 'select_account' });
            
            try {
                // Thiết lập loại lưu trữ: Local (nhớ mãi) hoặc Session (tắt trình duyệt là mất)
                await setPersistence(auth, isRemember ? browserLocalPersistence : browserSessionPersistence);
                
                const result = await signInWithPopup(auth, provider);
                
                if (result.user.email === MY_GMAIL && isRemember) {
                    // Lưu mốc thời gian nếu người dùng chọn ghi nhớ
                    localStorage.setItem('last_login_timestamp', Date.now().toString());
                }
            } 
            catch (e) { alert("Lỗi đăng nhập: " + e.message); }
        };

        async function handleLogout() {
            localStorage.removeItem('last_login_timestamp');
            await signOut(auth);
            location.reload();
        }

        document.getElementById('btn-logout').onclick = () => {
            if (confirm("Đăng xuất khỏi kho?")) handleLogout();
        };

        // --- 4. DATA MANAGEMENT ---
        async function initAppData() {
            await syncTypes();
            await loadInventory();
        }

        window.loadInventory = async () => {
            const snapshot = await getDocs(stockCol);
            // Lưu thêm thời gian để sau này sort Mới/Cũ
            window.rawInventory = snapshot.docs.map(d => ({ 
                id: d.id, 
                ...d.data(),
                // Nếu không có ngày tạo thì mặc định là 0 để đẩy xuống dưới cùng khi sort mới
                createdAt: d.data().createdAt ? d.data().createdAt.toMillis() : 0 
            }));
            renderInventory();
        };

        window.syncTypes = async () => {
            const docRef = doc(db, "metadata", "aluminum_types");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                types = docSnap.data().list;
            } else {
                await setDoc(docRef, { list: types });
            }
            updateTypeDropdowns();
        };

        function updateTypeDropdowns() {
            const html = types.map(t => `<option value="${t}">${t}</option>`).join('');
            
            // Đổ dữ liệu vào các ID mới trong HTML của bạn
            const newSelect = document.getElementById('new-type-select');
            if (newSelect) newSelect.innerHTML = html;
            
            const cutSelect = document.getElementById('cut-type');
            if (cutSelect) cutSelect.innerHTML = html;
            
            const filterSelect = document.getElementById('filter-type');
            if (filterSelect) filterSelect.innerHTML = `<option value="All">Tất cả loại</option>` + html;
        }

        window.addNewTypePrompt = async () => {
            const name = prompt("Nhập tên loại nhôm mới:");
            if (name && !types.includes(name.trim())) {
                types.push(name.trim());
                await setDoc(doc(db, "metadata", "aluminum_types"), { list: types });
                updateTypeDropdowns();
                // Tự động chọn loại vừa thêm ở mục Nhập kho
                document.getElementById('new-type-select').value = name.trim();
            }
        };

        // --- 5. INVENTORY UI ---
        // window.renderInventory = () => {
        //     const listDiv = document.getElementById('stock-list');
        //     const filter = document.getElementById('filter-type').value;
        //     const sort = document.getElementById('sort-order').value;

        //     let filtered = window.rawInventory.filter(item => filter === 'All' || item.type === filter);
        //     filtered.sort((a, b) => sort === 'asc' ? a.length - b.length : b.length - a.length);

        //     let groups = {};
        //     filtered.forEach(item => {
        //         const key = `${item.type}-${item.length}`;
        //         if (!groups[key]) groups[key] = { ...item, qty: 0, ids: [] };
        //         groups[key].qty++;
        //         groups[key].ids.push(item.id);
        //     });

            // listDiv.innerHTML = Object.values(groups).map(g => `
            //     <div class="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center">
            //         <div>
            //             <div class="font-bold text-slate-800 uppercase">${g.type}</div>
            //             <div class="text-sm font-bold text-blue-700">${g.length} cm</div>
            //         </div>
            //         <div class="text-right">
            //             <div class="text-xl font-black text-slate-900">${g.qty} cây</div>
            //             <div class="flex gap-3 justify-end mt-1">
            //                 <button onclick="editFirstInGroup('${g.ids[0]}', ${g.length})" class="text-blue-500 text-[10px] font-bold">SỬA</button>
            //                 <button onclick="deleteFirstInGroup('${g.ids[0]}')" class="text-red-400 text-[10px] font-bold">XÓA</button>
            //             </div>
            //         </div>
            //     </div>
            // `).join('');
        // };
window.renderInventory = () => {
    const listDiv = document.getElementById('stock-list');
    const filter = document.getElementById('filter-type').value;
    const sort = document.getElementById('sort-order').value;
    // Lấy thêm giá trị từ thanh tìm kiếm
    const searchVal = document.getElementById('search-length').value.trim();

    // 1. Lọc theo LOẠI (Combo box)
    let filtered = window.rawInventory.filter(item => filter === 'All' || item.type === filter);

    // 2. Lọc thêm theo TÌM KIẾM (Nếu người dùng có nhập số)
    if (searchVal !== '') {
        filtered = filtered.filter(item => {
            // Kiểm tra xem độ dài có bắt đầu bằng số đang nhập không
            return item.length.toString().startsWith(searchVal);
        });
    }

    // 3. Sắp xếp
    filtered.sort((a, b) => sort === 'asc' ? a.length - b.length : b.length - a.length);

    // 4. Nhóm các cây giống nhau để hiển thị
    let groups = {};
    filtered.forEach(item => {
        const key = `${item.type}-${item.length}`;
        if (!groups[key]) groups[key] = { ...item, qty: 0, ids: [] };
        groups[key].qty++;
        groups[key].ids.push(item.id);
    });

    // 5. Hiển thị
    if (Object.keys(groups).length === 0) {
        listDiv.innerHTML = '<p class="text-center text-gray-400 py-10 col-span-full font-bold">Không tìm thấy kết quả phù hợp</p>';
        return;
    }

            listDiv.innerHTML = Object.values(groups).map(g => `
                <div class="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center">
                    <div>
                        <div class="font-bold text-slate-800 uppercase">${g.type}</div>
                        <div class="text-sm font-bold text-blue-700">${g.qty} cây</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xl font-black text-slate-900">${g.length} cm</div>
                        <div class="flex gap-3 justify-end mt-1">
                            <button onclick="editFirstInGroup('${g.ids[0]}', ${g.length})" class="text-blue-500 text-[10px] font-bold">SỬA</button>
                            <button onclick="deleteFirstInGroup('${g.ids[0]}')" class="text-red-400 text-[10px] font-bold">XÓA</button>
                        </div>
                    </div>
                </div>
            `).join('');
};
        window.editFirstInGroup = async (id, oldLen) => {
            const newLen = prompt("Chiều dài mới (cm):", oldLen);
            if (newLen && newLen != oldLen) {
                await updateDoc(doc(db, "inventory", id), { length: parseInt(newLen) });
                loadInventory();
            }
        };

        window.deleteFirstInGroup = async (id) => {
            if (confirm("Xóa 1 cây này?")) { await deleteDoc(doc(db, "inventory", id)); loadInventory(); }
        };

        window.importStock = async () => {
            // Cập nhật ID mới: new-type-select, new-original-len, new-qty
            const type = document.getElementById('new-type-select').value;
            const length = parseInt(document.getElementById('new-original-len').value);
            const qty = parseInt(document.getElementById('new-qty').value);

            if (!type || isNaN(length) || isNaN(qty) || qty <= 0) {
                alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
                return;
            }

            const btn = document.getElementById('btn-import');
            btn.disabled = true;
            btn.innerText = "ĐANG LƯU...";

            try {
                const q = query(collection(db, "inventory"), where("type", "==", type), where("length", "==", length));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const docRef = doc(db, "inventory", snap.docs[0].id);
                    await updateDoc(docRef, { 
                        quantity: snap.docs[0].data().quantity + qty,
                        updatedAt: serverTimestamp() // Thêm ngày cập nhật
                    });
                } else {
                    await addDoc(collection(db, "inventory"), { 
                        type, 
                        length, 
                        quantity: qty,
                        createdAt: serverTimestamp() // Thêm ngày tạo để Sort mới/cũ
                    });
                }
                alert("Đã nhập kho thành công!");
                document.getElementById('new-qty').value = 1;
                loadInventory();
            } catch (e) {
                alert("Lỗi: " + e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = "XÁC NHẬN NHẬP KHO";
            }
        };

        // --- 6. SMART CUT LOGIC ---
        window.addRequestToList = () => {
            const type = document.getElementById('cut-type').value;
            const len = parseInt(document.getElementById('cut-length').value);
            const qty = parseInt(document.getElementById('cut-qty').value);
            if (!len || len <= 0) return;

            let existing = cutRequests.find(r => r.type === type && r.length === len);
            if (existing) existing.qty += qty;
            else cutRequests.push({ type, length: len, qty });
            renderRequestDisplay();
        };

        function renderRequestDisplay() {
            document.getElementById('request-display').innerHTML = cutRequests.map((r, i) => `
                <div class="flex justify-between items-center bg-orange-50 p-2 rounded border border-orange-100 text-sm">
                    <span><b>${r.qty}</b> cây x <b>${r.length}cm</b> (${r.type})</span>
                    <button onclick="removeRequest(${i})" class="text-red-500 font-bold px-2">X</button>
                </div>
            `).join('');
        }

        window.removeRequest = (i) => { cutRequests.splice(i, 1); renderRequestDisplay(); };

        let lastCalculatedProposals = {};

        window.processSmartCut = async () => {
            if (cutRequests.length === 0) return alert("Vui lòng thêm yêu cầu cắt!");
            const div = document.getElementById('cut-proposals');
            div.innerHTML = "<p class='text-center text-gray-500 py-4'>Đang tính toán dồn phế liệu...</p>";

            let localStock = [...window.rawInventory].sort((a, b) => b.length - a.length);
            let flatReqs = [];
            cutRequests.forEach(r => { for (let i = 0; i < r.qty; i++) flatReqs.push({ ...r }); });

            let groupedProposals = {};
            let failedRequests = [];

            for (let stockItem of localStock) {
                let tempLen = stockItem.length;
                let cutsForThisBar = [];
                
                // Thuật toán: Ưu tiên nhét các đoạn ngắn trước để tận dụng tối đa cây gốc
                flatReqs.sort((a, b) => a.length - b.length);
                
                let i = 0;
                while (i < flatReqs.length) {
                    if (flatReqs[i].type === stockItem.type && tempLen >= flatReqs[i].length) {
                        cutsForThisBar.push(flatReqs[i].length);
                        tempLen -= flatReqs[i].length;
                        flatReqs.splice(i, 1);
                    } else {
                        i++;
                    }
                }

                if (cutsForThisBar.length > 0) {
                    groupedProposals[stockItem.id] = {
                        sourceId: stockItem.id,
                        initialLen: stockItem.length,
                        type: stockItem.type,
                        cuts: cutsForThisBar,
                        finalRemnant: tempLen
                    };
                }
            }
            
            lastCalculatedProposals = groupedProposals;
            renderGroupedProposals(groupedProposals, flatReqs);
        };

        function renderGroupedProposals(proposals, fails) {
            const div = document.getElementById('cut-proposals');
            div.innerHTML = `<h3 class="font-bold text-gray-700 mb-2">Phương án thực hiện:</h3>`;

            if (fails.length > 0) {
                let failedGroups = {};
                fails.forEach(f => {
                    const key = `${f.type}-${f.length}`;
                    failedGroups[key] = (failedGroups[key] || 0) + 1;
                });
                Object.entries(failedGroups).forEach(([key, qty]) => {
                    const [type, len] = key.split('-');
                    div.innerHTML += `
                        <div class="bg-red-50 border-l-4 border-red-500 p-3 mb-2 text-sm text-red-700">
                            <b>⚠ Thiếu nhôm ${type}:</b> Không đủ cây để cắt <b>${qty} đoạn ${len}cm</b>
                        </div>
                    `;
                });
            }

            Object.values(proposals).forEach((p, idx) => {
                const isBadRem = p.finalRemnant > 0 && (p.finalRemnant < 120 || p.finalRemnant % 2 !== 0);
                const card = document.createElement('div');
                card.className = "bg-white p-4 rounded-xl border shadow-sm mb-4";
                
                let cutCounts = {};
                p.cuts.forEach(c => cutCounts[c] = (cutCounts[c] || 0) + 1);
                let cutSummary = Object.entries(cutCounts).map(([len, qty]) => 
                    `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">${len}cm x ${qty}</span>`
                ).join(' + ');

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">${p.type}</span>
                            <h4 class="font-bold text-slate-800 uppercase">Cây gốc: ${p.initialLen}cm</h4>
                        </div>
                        <button onclick="this.parentElement.parentElement.remove()" class="text-gray-300">✕</button>
                    </div>
                    <div class="py-2 border-y border-dashed border-gray-100 my-2 text-sm">${cutSummary}</div>
                    <div class="flex justify-between items-end">
                        <div>
                            <span class="text-xs text-gray-400 font-bold uppercase">Còn dư:</span>
                            <span class="text-lg font-bold ${isBadRem ? 'text-red-500' : 'text-green-600'}">${p.finalRemnant}cm</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="openManualModalForGroup('${p.sourceId}')" class="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold">ĐỔI CÂY</button>
                            <button onclick="executeGroupCut('${p.sourceId}', ${p.finalRemnant}, this)" class="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition">XÁC NHẬN CẮT</button>
                        </div>
                    </div>
                `;
                div.appendChild(card);
            });
        }

        window.executeGroupCut = async (sourceId, finalRem, btn) => {
            btn.disabled = true; btn.innerText = "...";
            if (finalRem > 0) await updateDoc(doc(db, "inventory", sourceId), { length: finalRem });
            else await deleteDoc(doc(db, "inventory", sourceId));
            
            btn.closest('.bg-white').style.opacity = '0.4';
            btn.innerText = "Xong";
            loadInventory();
        };

        // --- 7. MANUAL ADJUSTMENT ---
        window.openManualModalForGroup = (sourceId) => {
            currentManualGroupIdx = sourceId;
            const p = lastCalculatedProposals[sourceId];
            const listUi = document.getElementById('manual-options');
            
            const totalCutNeeded = p.cuts.reduce((a, b) => a + b, 0);
            const options = window.rawInventory.filter(s => s.type === p.type && s.length >= totalCutNeeded && s.id !== sourceId);
            
            listUi.innerHTML = options.map(s => `
                <div onclick="selectManualSource('${s.id}', ${s.length})" class="p-3 border rounded-lg cursor-pointer hover:bg-blue-50 flex justify-between">
                    <b>Cây dài ${s.length}cm</b>
                    <span class="text-green-600 text-xs font-bold">(Dư: ${s.length - totalCutNeeded}cm)</span>
                </div>
            `).join('');
            
            if (options.length === 0) listUi.innerHTML = "<p class='text-center text-gray-400'>Không có cây nào khác đủ dài.</p>";
            document.getElementById('manual-modal').classList.remove('hidden');
        };

        window.selectManualSource = (newId, newLen) => {
            const p = lastCalculatedProposals[currentManualGroupIdx];
            const totalCutNeeded = p.cuts.reduce((a, b) => a + b, 0);
            
            // Cập nhật lại đối tượng đề xuất
            p.sourceId = newId;
            p.initialLen = newLen;
            p.finalRemnant = newLen - totalCutNeeded;

            // Xóa khóa cũ và gán lại khóa mới để đồng nhất UI
            delete lastCalculatedProposals[currentManualGroupIdx];
            lastCalculatedProposals[newId] = p;

            closeManualModal();
            renderGroupedProposals(lastCalculatedProposals, []);
        };

        window.closeManualModal = () => document.getElementById('manual-modal').classList.add('hidden');

        // --- 8. UI NAVIGATION ---
        window.showTab = (tabId) => {
            // 1. Ẩn tất cả các tab
            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.remove('active');
                el.style.display = 'none'; // Đảm bảo ẩn hẳn
            });
            
            // 2. Hiện tab được chọn
            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.classList.add('active');
                activeTab.style.display = 'block'; // Hiện tab lên
            }
            
            // 3. Cập nhật màu sắc nút bấm trên Nav
            document.querySelectorAll('#main-nav button').forEach(btn => {
                btn.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
                btn.classList.add('text-gray-500');
            });
            const activeBtn = document.getElementById('nav-' + tabId);
            if (activeBtn) {
                activeBtn.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
                activeBtn.classList.remove('text-gray-500');
            }

            // Load lại dữ liệu nếu vào tab Kho
            if (tabId === 'inventory') loadInventory();
        };

        // --- 9. CONNECTION CHECK ---
        const statusEl = document.getElementById('connection-status');
        const updateStatus = () => {
            if (navigator.onLine) {
                statusEl.innerText = "Đã kết nối";
                statusEl.className = "text-[9px] bg-green-500 text-white px-3 py-1 rounded-full font-bold uppercase";
            } else {
                statusEl.innerText = "Mất kết nối";
                statusEl.className = "text-[9px] bg-red-500 text-white px-3 py-1 rounded-full font-bold uppercase";
            }
        };
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
// --- 10. XỬ LÝ SCROLL: ẨN/HIỆN NAV VÀ NÚT LÊN ĐẦU TRANG ---
let lastScrollY = window.scrollY;
const mainNav = document.getElementById('main-nav');
const backToTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const isMobile = window.innerWidth < 768;

    if (currentScrollY > lastScrollY && currentScrollY > 60) {
        // ĐANG CUỘN XUỐNG -> ẨN
        if (isMobile) {
            mainNav.style.transform = 'translateY(100%)';
        } else {
            // Ẩn Nav lên phía sau Header
            mainNav.style.transform = 'translateY(-200%)'; 
        }
    } else {
        // ĐANG CUỘN LÊN -> HIỆN
        mainNav.style.transform = 'translateY(0)';
    }

    // Nút lên đầu trang
    if (currentScrollY > 200) {
        backToTop.classList.remove('hidden');
    } else {
        backToTop.classList.add('hidden');
    }

    lastScrollY = currentScrollY;
});
backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Cuộn mượt mà
    });
});
// --- 11. LOGIC TÌM KIẾM TƯƠNG ĐỐI (LIVE SEARCH) ---
document.getElementById('search-length').addEventListener('input', function(e) {
    const searchValue = e.target.value.trim();
    const clearBtn = document.getElementById('clear-search');
    
    // Lấy tất cả các "thẻ" nhôm trong danh sách (là các thẻ div con trực tiếp của stock-list)
    const cards = document.querySelectorAll('#stock-list > div');

    // Hiện/Ẩn nút X xóa nhanh
    if (searchValue !== "") {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }

    cards.forEach(card => {
        // Tìm dòng chữ chứa số cm trong mỗi thẻ (thẻ div có class text-blue-700)
        const lengthText = card.querySelector('.text-slate-900').innerText; // Ví dụ: "120 cm"
        
        // Loại bỏ chữ "cm" để lấy đúng số so sánh
        const lengthNumber = lengthText.replace(' cm', '').trim();

        // Kiểm tra xem số kích thước có bắt đầu bằng số đang nhập không
        if (lengthNumber.startsWith(searchValue)) {
            card.style.display = ""; // Hiện lại (mặc định flex)
        } else {
            card.style.display = "none"; // Ẩn đi
        }
    });
});

// Nút Xóa nhanh ô tìm kiếm
document.getElementById('clear-search').onclick = () => {
    const input = document.getElementById('search-length');
    input.value = "";
    // Kích hoạt lại sự kiện input để hiện lại toàn bộ danh sách
    input.dispatchEvent(new Event('input')); 
    input.focus();
};