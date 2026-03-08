// --- 1. FIREBASE SETUP ---
            import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
            import { 
            getFirestore, 
            collection, 
            addDoc, 
            getDocs, 
            doc, 
            updateDoc, 
            deleteDoc, 
            setDoc, 
            getDoc,
            query,                // mới
            where,                // mới
            serverTimestamp       // mới (rất nên có)
            } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

            import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } 
            from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

            import { setPersistence, browserLocalPersistence, browserSessionPersistence } 
            from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
// Các biến DOM
const loadingOverlay = document.getElementById('loading-overlay');
const authScreen = document.getElementById('auth-screen');
const logoutBtn = document.getElementById('btn-logout');
const statusEl = document.getElementById('connection-status');
const retryBtn = document.getElementById('retry-connect') || document.createElement('button'); // Nếu chưa có thì tạo
if (!document.getElementById('retry-connect')) {
    retryBtn.id = 'retry-connect';
    retryBtn.className = 'hidden text-[10px] bg-red-200 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-300 mt-1';
    retryBtn.innerText = 'THỬ LẠI';
    retryBtn.onclick = () => initAppWithRetry();
    document.querySelector('.text-right').appendChild(retryBtn);
}

// Hàm show/hide loading
function showLoading(message = 'Đang kiểm tra đăng nhập...') {
    loadingOverlay.querySelector('p').innerText = message;
    loadingOverlay.classList.remove('hidden');
    document.getElementById('btn-login').disabled = true;
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    document.getElementById('btn-login').disabled = false;
}

// Init app với retry
async function initAppWithRetry() {
    updateStatus('connecting');
    
    try {
        await initAppData(); // syncTypes + loadInventory → sẽ dùng spinner cục bộ
        updateStatus('online');
        retryBtn.classList.add('hidden');
    } catch (e) {
        console.error("Lỗi load dữ liệu:", e);
        updateStatus('failed', "Tải dữ liệu thất bại");
        retryBtn.classList.remove('hidden');
    }
}

// Firebase Auth listener
// Trong onAuthStateChanged
onAuthStateChanged(auth, async (user) => {
    const appMain = document.getElementById('app-main');

    if (user && user.email === MY_GMAIL) {
        // Kiểm tra 15 ngày (giữ nguyên)

        authScreen.style.display = 'none';
        appMain.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        if (document.getElementById('inventory').classList.contains('active')) {
            // Nếu tab Kho đang active, hiện spinner sớm
            const invLoading = document.getElementById('inventory-loading');
            invLoading.classList.remove('hidden');
        }
        // Ẩn global overlay NGAY LẬP TỨC (không cần text "Đang xác thực phiên...")
        hideLoading();

        // Load kho (sẽ dùng spinner cục bộ)
        if (window.rawInventory.length === 0) {
            await initAppWithRetry();
        }
    } else {
        authScreen.style.display = 'flex';
        appMain.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        updateStatus('online');
        hideLoading();
    }
});

// Login button (giữ nguyên nhưng thêm loading)
document.getElementById('btn-login').onclick = async () => {
    showLoading('Đang đăng nhập Google...');
    const provider = new GoogleAuthProvider();
    const isRemember = document.getElementById('remember-me').checked;
    
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
        await setPersistence(auth, isRemember ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithPopup(auth, provider);
        
        if (result.user.email === MY_GMAIL) {
            if (isRemember) {
                localStorage.setItem('last_login_timestamp', Date.now().toString());
            }
            
            // Buộc ẩn auth-screen và hiện app ngay sau login thành công
            authScreen.style.display = 'none';
            document.getElementById('app-main').classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            
            // Gọi load data ngay lập tức (không chờ onAuthStateChanged)
            await initAppWithRetry();
        } else {
            alert("Tài khoản không có quyền!");
            await signOut(auth);
        }
    } catch (e) {
        console.error("Lỗi đăng nhập:", e);
        alert("Lỗi đăng nhập: " + e.message);
    } finally {
        hideLoading();
    }
};

// Hàm logout chính
async function handleLogout() {
    try {
        // Xóa timestamp ghi nhớ
        localStorage.removeItem('last_login_timestamp');
        
        // Đăng xuất Firebase Auth
        await signOut(auth);
        
        // Reload trang để quay về trạng thái chưa login
        location.reload();
    } catch (error) {
        console.error("Lỗi logout:", error);
        alert("Lỗi khi đăng xuất: " + error.message);
    }
}

// Gắn sự kiện cho nút logout (chỉ chạy khi DOM sẵn sàng)
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            if (confirm("Bạn có chắc muốn đăng xuất khỏi kho?")) {
                handleLogout();
            }
        };
    } else {
        console.warn("Không tìm thấy nút #btn-logout");
    }
});

// --- 4. DATA MANAGEMENT ---
async function initAppData() {
    await syncTypes();
    await loadInventory();
}

window.loadInventory = async () => {
    
    const invLoading = document.getElementById('inventory-loading');
    const inventoryContent = document.getElementById('inventory-content');
    const stockList = document.getElementById('stock-list');
    
    stockList.innerHTML = ''; 
    invLoading.classList.remove('hidden'); // Hiện spinner
    inventoryContent.classList.add('hidden'); // Ẩn nội dung tĩnh
    
    try {
        const snapshot = await getDocs(stockCol);
        window.rawInventory = snapshot.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            createdAt: d.data().createdAt ? d.data().createdAt.toMillis() : 0 
        }));
        renderInventory();
        updateStatus('online');
        
        // Load xong → hiện nội dung, ẩn spinner
        inventoryContent.classList.remove('hidden');
        invLoading.classList.add('hidden');
    } catch (e) {
        console.error("Lỗi load kho:", e);
        updateStatus('failed', 'Tải kho thất bại');
        stockList.innerHTML = '<p class="text-center text-red-500 py-10 col-span-full font-bold">Lỗi tải kho. Nhấn "THỬ LẠI" ở header.</p>';
        invLoading.classList.add('hidden');
        inventoryContent.classList.remove('hidden'); // Hiện để thấy thông báo lỗi
    }finally {
    invLoading.classList.add('hidden');
    inventoryContent.classList.remove('hidden'); // Hiện nội dung sau khi load xong
}
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
                <button 
                    class="text-blue-500 text-[10px] font-bold edit-group-btn"
                    data-type="${g.type.replace(/"/g, '&quot;')}" 
                    data-length="${g.length}"
                    data-qty="${g.qty}"
                    data-ids="${g.ids.join(',')}">
                    SỬA
                </button>
                <button 
                    class="text-red-400 text-[10px] font-bold delete-group-btn"
                    data-type="${g.type.replace(/"/g, '&quot;')}"
                    data-length="${g.length}"
                    data-qty="${g.qty}"
                    data-ids="${g.ids.join(',')}">
                    XÓA
                </button>
            </div>
        </div>
    </div>
`).join('');
};

window.openEditModal = (type, length, maxQty, idsStr) => {
    const modal = document.getElementById('edit-modal');
    const typeSelect = document.getElementById('edit-type');
    const lengthInput = document.getElementById('edit-length');
    const qtyNormal = document.getElementById('edit-qty-normal');
    const qtySingle = document.getElementById('edit-qty-single');
    const maxQtySpan = document.getElementById('edit-max-qty');
    const maxQtyLabel = document.getElementById('edit-max-qty-label');
    const qtyInput = document.getElementById('edit-qty');
    const preview = document.getElementById('edit-preview');
    const confirmBtn = document.getElementById('confirm-edit');

    // Fill data
    typeSelect.innerHTML = types.map(t => `<option value="${t}" ${t === type ? 'selected' : ''}>${t}</option>`).join('');
    lengthInput.value = length;

    if (maxQty === 1) {
        qtyNormal.classList.add('hidden');
        qtySingle.classList.remove('hidden');
        maxQtyLabel.classList.add('hidden');  // Ẩn "(1 - 1)"
    } else {
        qtyNormal.classList.remove('hidden');
        qtySingle.classList.add('hidden');
        maxQtyLabel.classList.remove('hidden');
        maxQtySpan.innerText = maxQty;
        qtyInput.value = 1;
        qtyInput.max = maxQty;
    }

    // Preview live
    const updatePreview = () => {
        const applyQty = (maxQty === 1) ? 1 : (parseInt(qtyInput.value) || 1);
        preview.innerText = `Sau sửa: ${applyQty} cây sẽ thành loại "${typeSelect.value}", dài ${lengthInput.value}cm.`;
    };

    typeSelect.onchange = updatePreview;
    lengthInput.oninput = updatePreview;
    if (maxQty > 1) qtyInput.oninput = updatePreview;
    updatePreview();

    // Confirm
    confirmBtn.onclick = async () => {
        const newType = typeSelect.value;
        const newLen = parseInt(lengthInput.value);
        const applyQty = (maxQty === 1) ? 1 : parseInt(qtyInput.value);

        if (isNaN(newLen) || applyQty < 1 || applyQty > maxQty) {
            return alert("Dữ liệu không hợp lệ!");
        }

        const ids = idsStr.split(',').sort((a, b) => {
            const itemA = rawInventory.find(i => i.id === a);
            const itemB = rawInventory.find(i => i.id === b);
            return (itemA?.createdAt || 0) - (itemB?.createdAt || 0);
        });

        try {
            for (let i = 0; i < applyQty; i++) {
                await updateDoc(doc(db, "inventory", ids[i]), { type: newType, length: newLen });
            }
            closeEditModal();
            loadInventory();
        } catch (e) {
            alert("Lỗi: " + e.message);
        }
    };

    modal.classList.remove('hidden');
};

window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');

window.openDeleteModal = (type, length, maxQty, idsStr) => {
    const modal = document.getElementById('delete-modal');
    const qtyNormal = document.getElementById('delete-qty-normal');
    const qtySingle = document.getElementById('delete-qty-single');
    const maxQtySpan = document.getElementById('delete-max-qty');
    const maxQtySpan2 = document.getElementById('delete-max-qty2');
    const maxQtyLabel = document.getElementById('delete-max-qty-label');
    const typeSpan = document.getElementById('delete-type');
    const lengthSpan = document.getElementById('delete-length');
    const qtyInput = document.getElementById('delete-qty');
    const preview = document.getElementById('delete-preview');
    const confirmBtn = document.getElementById('confirm-delete');

    // Fill data
    typeSpan.innerText = type;
    lengthSpan.innerText = length;

    if (maxQty === 1) {
        qtyNormal.classList.add('hidden');
        qtySingle.classList.remove('hidden');
        maxQtyLabel.classList.add('hidden');  // Ẩn "(1 - 1)"
        maxQtySpan.innerText = maxQty;
        maxQtySpan2.innerText = maxQty;
    } else {
        qtyNormal.classList.remove('hidden');
        qtySingle.classList.add('hidden');
        maxQtyLabel.classList.remove('hidden');
        maxQtySpan.innerText = maxQty;
        maxQtySpan2.innerText = maxQty;
        qtyInput.value = 1;
        qtyInput.max = maxQty;
    }

    // Preview live
    const updatePreview = () => {
        const deleteQty = (maxQty === 1) ? 1 : (parseInt(qtyInput.value) || 1);
        preview.innerText = `Sẽ xóa vĩnh viễn ${deleteQty} cây (cũ nhất trong nhóm).`;
    };

    if (maxQty > 1) qtyInput.oninput = updatePreview;
    updatePreview();

    // Confirm
    confirmBtn.onclick = async () => {
        const deleteQty = (maxQty === 1) ? 1 : parseInt(qtyInput.value);

        if (isNaN(deleteQty) || deleteQty < 1 || deleteQty > maxQty) {
            return alert("Số lượng không hợp lệ!");
        }

        if (!confirm(`Xác nhận xóa ${deleteQty} cây? Không thể khôi phục!`)) return;

        const ids = idsStr.split(',').sort((a, b) => {
            const itemA = rawInventory.find(i => i.id === a);
            const itemB = rawInventory.find(i => i.id === b);
            return (itemA?.createdAt || 0) - (itemB?.createdAt || 0);
        });

        try {
            for (let i = 0; i < deleteQty; i++) {
                await deleteDoc(doc(db, "inventory", ids[i]));
            }
            closeDeleteModal();
            loadInventory();
        } catch (e) {
            alert("Lỗi: " + e.message);
        }
    };

    modal.classList.remove('hidden');
};

window.closeDeleteModal = () => document.getElementById('delete-modal').classList.add('hidden');

window.importStock = async () => {
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
        // Thêm qty document riêng lẻ
        for (let i = 0; i < qty; i++) {
            await addDoc(collection(db, "inventory"), { 
                type, 
                length, 
                createdAt: serverTimestamp()  // Giữ để sort mới/cũ
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
    if (!len || len <= 0 || !qty || qty <= 0) return alert("Nhập độ dài và số lượng hợp lệ!");

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
let flatReqsCache = [];

function isGoodRemnant(rem, level = 1) {
    if (rem === 0) return true;
    if (level === 1) return rem >= 120 && rem % 20 === 0; // Full good: >=120 và %20==0
    if (level === 2) return rem >= 120; // Relax: Chỉ >=120
    if (level === 3) return rem > 0; // Chấp nhận bất kỳ
    return false;
}

window.processSmartCut = async () => {
    if (cutRequests.length === 0) return alert("Vui lòng thêm yêu cầu cắt!");

    const div = document.getElementById('cut-proposals');
    div.innerHTML = "<p class='text-center text-gray-500 py-4 flex items-center justify-center gap-2'><svg class='animate-spin h-5 w-5 text-blue-500' viewBox='0 0 24 24'><circle class='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' stroke-width='4'/><path class='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'/></svg> Đang tính toán...</p>";

    // Prepare stock: Lẻ ngắn → dài + nguyên cuối
    let localStock = [...window.rawInventory];
    let le = localStock.filter(s => s.length !== 600).sort((a, b) => a.length - b.length);
    let original = localStock.filter(s => s.length === 600);
    localStock = [...le, ...original];

    flatReqsCache = [];
    cutRequests.forEach(r => { for (let i = 0; i < r.qty; i++) flatReqsCache.push({ type: r.type, length: r.length }); });
    flatReqsCache.sort((a, b) => b.length - a.length); // Sort req dài → ngắn

    let groupedProposals = {};
    let failedRequests = [...flatReqsCache];
    let relaxLevel = 1;
    let virtualRemnants = []; // Stack cho iterative "recursion"

    while (failedRequests.length > 0 && relaxLevel <= 3) {
        let processedStock = [...localStock, ...virtualRemnants]; // Thêm remnant từ trước
        virtualRemnants = []; // Reset cho loop này

        for (let stockIdx = 0; stockIdx < processedStock.length; stockIdx++) {
            const stockItem = processedStock[stockIdx];
            if (failedRequests.every(r => r.type !== stockItem.type)) continue;

            let tempLen = stockItem.length;
            let cutsForThisBar = [];
            let i = 0;
            while (i < failedRequests.length) {
                const req = failedRequests[i];
                if (req.type === stockItem.type && tempLen >= req.length) {
                    let testRem = tempLen - req.length;
                    if (isGoodRemnant(testRem, relaxLevel)) {
                        cutsForThisBar.push(req.length);
                        tempLen = testRem;
                        failedRequests.splice(i, 1);
                    } else {
                        i++;
                    }
                } else {
                    i++;
                }
            }
            if (cutsForThisBar.length > 0) {
                const proposalId = stockItem.id || `rem_${Date.now()}`; // Fake id cho rem
                groupedProposals[proposalId] = {
                    sourceId: proposalId,
                    initialLen: stockItem.length,
                    type: stockItem.type,
                    cuts: cutsForThisBar,
                    finalRemnant: tempLen
                };
                // Nếu remnant tốt và đủ cho ít nhất 1 req còn lại → thêm vào stack virtual
                if (tempLen > 0 && isGoodRemnant(tempLen, relaxLevel) && failedRequests.some(r => r.type === stockItem.type && tempLen >= r.length)) {
                    virtualRemnants.push({ id: `rem_${proposalId}`, length: tempLen, type: stockItem.type });
                }
                // Xóa stock đã dùng khỏi processed
                processedStock.splice(stockIdx, 1);
                stockIdx--; // Adjust index sau splice
            }
        }
        // Nếu có virtualRemnants mới → loop lại với chúng (iterative recursion)
        if (virtualRemnants.length > 0) continue;

        // Nếu vẫn fail → relax level
        if (failedRequests.length > 0) relaxLevel++;
    }

    lastCalculatedProposals = groupedProposals;
    renderGroupedProposals(groupedProposals, failedRequests);
};

function renderGroupedProposals(proposals, fails) {
    const div = document.getElementById('cut-proposals');
    div.innerHTML = `<h3 class="font-bold text-gray-700 mb-2 flex justify-between items-center">
        Phương án thực hiện: 
        <button onclick="processSmartCut()" class="text-blue-500 text-xs font-bold px-2 py-1 bg-blue-50 rounded">TỐI ƯU LẠI</button>
    </h3>`;

    let totalRemnant = Object.values(proposals).reduce((sum, p) => sum + p.finalRemnant, 0);
    let totalCuts = Object.values(proposals).reduce((sum, p) => sum + p.cuts.length, 0);
    let totalInitial = Object.values(proposals).reduce((sum, p) => sum + p.initialLen, 0);
    let wastePct = totalInitial > 0 ? ((totalRemnant / totalInitial) * 100).toFixed(1) : 0;
    div.innerHTML += `<div class="bg-blue-50 p-2 rounded mb-4 text-sm">
        Tổng: ${totalCuts} cuts thành công | Dư tổng: ${totalRemnant}cm | Lãng phí: ${wastePct}%
    </div>`;

    if (fails.length > 0) {
        // ... (giữ code fails nguyên)
    }

    const proposalList = document.createElement('div');
    proposalList.id = 'proposal-list';
    proposalList.className = 'space-y-4';
    Object.values(proposals).forEach((p) => {
        const isBadRem = !isGoodRemnant(p.finalRemnant, 1);
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl border shadow-sm mb-4 proposal-card";
        card.dataset.id = p.sourceId;

        let cutSummary = p.cuts.map((len, idx) => `
            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold cut-item" data-len="${len}" onclick="editCut('${p.sourceId}', ${idx})">${len}cm</span>
            <button onclick="removeCut('${p.sourceId}', ${idx})" class="text-red-500 text-xs ml-1">X</button>
        `).join(' + ');

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="text-[10px] font-bold text-gray-400 uppercase">${p.type}</span>
                    <h4 class="font-bold text-slate-800 uppercase">Cây gốc: ${p.initialLen}cm</h4>
                </div>
                <button onclick="removeProposal('${p.sourceId}')" class="text-gray-300">✕</button>
            </div>
            <div class="py-2 border-y border-dashed border-gray-100 my-2 text-sm cut-summary sortable-container">${cutSummary}</div>
            <div class="flex justify-between items-end">
                <div>
                    <span class="text-xs text-gray-400 font-bold uppercase">Còn dư:</span>
                    <span class="text-lg font-bold ${isBadRem ? 'text-red-500' : 'text-green-600'}">${p.finalRemnant}cm</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="addManualCutToProposal('${p.sourceId}')" class="text-[10px] bg-green-100 px-2 py-1 rounded font-bold">THÊM CUT</button>
                    <button onclick="openManualModalForGroup('${p.sourceId}')" class="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold">ĐỔI CÂY</button>
                    <button onclick="executeGroupCut('${p.sourceId}', ${p.finalRemnant}, this)" class="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition">XÁC NHẬN CẮT</button>
                </div>
            </div>
        `;
        proposalList.appendChild(card);
    });
    div.appendChild(proposalList);

    initSortable();
}

window.addManualCutToProposal = (sourceId) => {
    const newCut = parseInt(prompt("Thêm cut mới (cm):"));
    if (newCut && newCut > 0) {
        const p = lastCalculatedProposals[sourceId];
        if (p.finalRemnant >= newCut) {
            p.cuts.push(newCut);
            p.finalRemnant -= newCut;
            renderGroupedProposals(lastCalculatedProposals, flatReqsCache);
        } else {
            alert("Không đủ dư để cắt thêm!");
        }
    }
};

window.editCut = (sourceId, idx) => {
    const p = lastCalculatedProposals[sourceId];
    const oldLen = p.cuts[idx];
    const newLen = parseInt(prompt("Sửa cut (cm):", oldLen));
    if (newLen && newLen > 0 && newLen !== oldLen) {
        const diff = oldLen - newLen;
        if (p.finalRemnant + diff >= 0) {
            p.cuts[idx] = newLen;
            p.finalRemnant += diff;
            renderGroupedProposals(lastCalculatedProposals, flatReqsCache);
        } else {
            alert("Không đủ dư để sửa lớn hơn!");
        }
    }
};

window.removeCut = (sourceId, idx) => {
    if (confirm("Xóa cut này?")) {
        const p = lastCalculatedProposals[sourceId];
        const removedLen = p.cuts.splice(idx, 1)[0];
        p.finalRemnant += removedLen;
        // Thêm lại vào failedRequests nếu cần (để re-render fails)
        flatReqsCache.push({ type: p.type, length: removedLen });
        renderGroupedProposals(lastCalculatedProposals, flatReqsCache);
    }
};

window.removeProposal = (sourceId) => {
    const p = lastCalculatedProposals[sourceId];
    flatReqsCache.push(...p.cuts.map(len => ({ type: p.type, length: len })));
    delete lastCalculatedProposals[sourceId];
    renderGroupedProposals(lastCalculatedProposals, flatReqsCache);
};

// executeGroupCut thêm confirm nếu remnant xấu
window.executeGroupCut = async (sourceId, finalRem, btn) => {
    btn.disabled = true;
    btn.innerText = "...";

    try {
        // Kiểm tra sourceId có phải id thật từ Firestore không (không bắt đầu bằng 'rem_')
        if (sourceId.startsWith('rem_')) {
            // Đây là remnant ảo → không update Firestore, chỉ thông báo (vì remnant đã được dùng ảo)
            console.log(`Remnant ảo ${sourceId} đã cắt xong, không cần update DB (dư: ${finalRem}cm)`);
            alert("Cắt thành công từ remnant ảo! (Không thay đổi kho gốc vì đây là dư từ cắt trước)");
        } else {
            // Id thật → update hoặc delete document thật
            const docRef = doc(db, "inventory", sourceId);
            
            if (finalRem > 0) {
                await updateDoc(docRef, { 
                    length: finalRem,
                    updatedAt: serverTimestamp()  // Optional: thêm timestamp
                });
                console.log(`Cập nhật cây ${sourceId} → dư ${finalRem}cm`);
            } else {
                await deleteDoc(docRef);
                console.log(`Xóa cây ${sourceId} (dư 0)`);
            }
        }

        // Thành công: Làm mờ card, đổi text, reload kho
        btn.closest('.proposal-card').style.opacity = '0.4';
        btn.innerText = "Xong";
        
        // Reload toàn bộ inventory để cập nhật UI
        await loadInventory();
        
        // Optional: Xóa proposal khỏi danh sách sau khi cắt xong
        delete lastCalculatedProposals[sourceId];
        renderGroupedProposals(lastCalculatedProposals, flatReqsCache);

    } catch (e) {
        console.error("Lỗi khi xác nhận cắt:", e);
        alert("Lỗi khi xác nhận cắt: " + e.message);
        btn.innerText = "XÁC NHẬN CẮT";
    } finally {
        btn.disabled = false;
    }
};

// --- 7. MANUAL ADJUSTMENT ---
window.openManualModalForGroup = (sourceId) => {
    currentManualGroupIdx = sourceId;
    const p = lastCalculatedProposals[sourceId];
    const listUi = document.getElementById('manual-options');
    
    const totalCutNeeded = p.cuts.reduce((a, b) => a + b, 0);
    
    // Thu thập tất cả id đang dùng ở các proposal khác (loại trừ proposal hiện tại)
    const allUsedIds = Object.entries(lastCalculatedProposals)
        .filter(([key, prop]) => key !== currentManualGroupIdx && prop.sourceId !== sourceId)
        .map(([_, prop]) => prop.sourceId);
    
    // Lấy tất cả cây phù hợp (bao gồm cây đang dùng, nhưng loại trừ id đang dùng ở proposal khác)
    let options = window.rawInventory.filter(s => 
        s.type === p.type && 
        s.length >= totalCutNeeded &&
        (s.id === sourceId || !allUsedIds.includes(s.id))  // Giữ cây đang dùng, loại cây dùng ở nơi khác
    );
    
    // Sort: Ưu tiên remnant tốt, cây đang dùng lên đầu
    options.sort((a, b) => {
        const remA = a.length - totalCutNeeded;
        const remB = b.length - totalCutNeeded;
        const scoreA = isGoodRemnant(remA, 1) ? remA + 10000 : (isGoodRemnant(remA, 2) ? remA + 5000 : -remA);
        const scoreB = isGoodRemnant(remB, 1) ? remB + 10000 : (isGoodRemnant(remB, 2) ? remB + 5000 : -remB);
        
        // Cây đang dùng ưu tiên cao nhất
        if (a.id === sourceId) return -1;
        if (b.id === sourceId) return 1;
        
        return scoreB - scoreA;
    });
    
    listUi.innerHTML = options.map(s => {
        const remnant = s.length - totalCutNeeded;
        const isGood = isGoodRemnant(remnant, 1);
        const isOk = isGoodRemnant(remnant, 2);
        const status = isGood ? '✅ Tốt' : (isOk ? '🆗 Chấp nhận' : '⚠ Xấu');
        const isCurrent = s.id === sourceId;
        const bgClass = isCurrent ? 'bg-blue-50 border-blue-300' : 'hover:bg-blue-50';
        const label = isCurrent ? '(Đang dùng)' : '';
        
        return `
            <div onclick="selectManualSource('${s.id}', ${s.length})" 
                 class="p-3 border rounded-lg cursor-pointer ${bgClass} flex justify-between items-center">
                <div>
                    <div class="font-bold">${s.type} - Dài ${s.length}cm ${label}</div>
                    <div class="text-xs text-gray-500">Dư dự kiến: ${remnant}cm</div>
                </div>
                <span class="text-${isGood ? 'green' : isOk ? 'yellow' : 'red'}-600 text-xs font-bold">${status}</span>
            </div>
        `;
    }).join('');
    
    if (options.length === 0) {
        listUi.innerHTML = "<p class='text-center text-gray-400 py-4'>Không có cây nào đủ dài để thay thế.</p>";
    } else if (options.length === 1 && options[0].id === sourceId) {
        listUi.innerHTML += "<p class='text-center text-gray-400 mt-2'>Không có cây khác phù hợp để thay thế.</p>";
    }
    
    document.getElementById('manual-modal').classList.remove('hidden');
};

window.selectManualSource = (newId, newLen) => {
    const p = lastCalculatedProposals[currentManualGroupIdx];
    const totalCutNeeded = p.cuts.reduce((a, b) => a + b, 0);
    const newRem = newLen - totalCutNeeded;
    const isBad = !isGoodRemnant(newRem, 1);
    
    if (isBad && !confirm(`Dư mới ${newRem}cm không tốt (có thể <120 hoặc lẻ hàng chục). Vẫn đổi cây?`)) {
        return;
    }
    
    // Cập nhật proposal
    p.sourceId = newId;
    p.initialLen = newLen;
    p.finalRemnant = newRem;

    delete lastCalculatedProposals[currentManualGroupIdx];
    lastCalculatedProposals[newId] = p;

    closeManualModal();
    renderGroupedProposals(lastCalculatedProposals, flatReqsCache);
};

window.closeManualModal = () => document.getElementById('manual-modal').classList.add('hidden');

        // --- 8. UI NAVIGATION ---
window.showTab = (tabId) => {
    // Ẩn tất cả tab
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
    }
    
    // Update nav button
    document.querySelectorAll('#main-nav button').forEach(btn => {
        btn.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
        btn.classList.add('text-gray-500');
    });
    const activeBtn = document.getElementById('nav-' + tabId);
    if (activeBtn) {
        activeBtn.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
        activeBtn.classList.remove('text-gray-500');
    }

    if (tabId === 'inventory') {
        updateStatus('connecting');

        // Hiện spinner cục bộ NGAY LẬP TỨC khi vào tab (không chờ getDocs)
        const invLoading = document.getElementById('inventory-loading');
        const inventoryContent = document.getElementById('inventory-content');
        const stockList = document.getElementById('stock-list');
        
        stockList.innerHTML = ''; // Xóa nội dung cũ ngay
        invLoading.classList.remove('hidden'); // Spinner hiện ngay
        inventoryContent.classList.add('hidden'); // Ẩn search/combo/stock-list

        // Sau đó mới load dữ liệu (spinner đã hiện rồi)
        loadInventory();
    }
};

// --- 9. CONNECTION CHECK & STATUS UTILITY ---
// Hàm updateStatus duy nhất, hỗ trợ tất cả trạng thái
function updateStatus(status, customMessage = '') {
    let text = '';
    let className = '';

    switch (status) {
        case 'connecting':
            text = customMessage || 'Đang kết nối...';
            className = 'text-[9px] bg-yellow-500 text-white px-3 py-1 rounded-full font-bold uppercase';
            break;
        case 'online':
            text = 'Đã kết nối';
            className = 'text-[9px] bg-green-500 text-white px-3 py-1 rounded-full font-bold uppercase';
            break;
        case 'failed':
            text = customMessage || 'Kết nối thất bại';
            className = 'text-[9px] bg-red-500 text-white px-3 py-1 rounded-full font-bold uppercase';
            break;
        case 'offline':
            text = 'Mất kết nối';
            className = 'text-[9px] bg-red-500 text-white px-3 py-1 rounded-full font-bold uppercase';
            break;
        default:
            text = 'Không xác định';
            className = 'text-[9px] bg-gray-500 text-white px-3 py-1 rounded-full font-bold uppercase';
    }

    if (statusEl) {
        statusEl.innerText = text;
        statusEl.className = className;
    }
}

// Listener online/offline
window.addEventListener('online', () => updateStatus('online'));
window.addEventListener('offline', () => updateStatus('offline'));

// Khởi tạo ban đầu
updateStatus('connecting');

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
// Live search: Khi nhập/xóa trong ô tìm kiếm → render lại toàn bộ danh sách
let debounceTimer;
document.getElementById('search-length').addEventListener('input', function(e) {
    clearTimeout(debounceTimer);
    
    const searchValue = e.target.value.trim();
    const clearBtn = document.getElementById('clear-search');
    
    if (searchValue !== "") {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }

    debounceTimer = setTimeout(() => {
        renderInventory();
    }, 300); // chờ 300ms sau khi ngừng gõ
});

// Nút Xóa nhanh (clear-search) → xóa nội dung input và render lại
document.getElementById('clear-search').onclick = () => {
    const input = document.getElementById('search-length');
    input.value = "";                  // Xóa nội dung ô tìm kiếm
    renderInventory();                 // Render lại toàn bộ danh sách (không cần dispatch event nữa)
    input.focus();                     // Đưa con trỏ về ô tìm kiếm (giữ UX tốt)
};

function initSortable() {
    const containers = document.querySelectorAll('.sortable-container');
    containers.forEach(container => {
        new Sortable(container, {
            group: 'cuts', // Cho phép kéo giữa các proposals
            animation: 150,
            onEnd: (evt) => {
                // Cập nhật logic khi kéo: Di chuyển cut từ proposal cũ sang mới
                const oldProposalId = evt.from.closest('.proposal-card').dataset.id;
                const newProposalId = evt.to.closest('.proposal-card').dataset.id;
                if (oldProposalId !== newProposalId) {
                    const movedLen = parseInt(evt.item.dataset.len);
                    // Xóa cut từ old
                    const oldP = lastCalculatedProposals[oldProposalId];
                    const idx = oldP.cuts.indexOf(movedLen);
                    if (idx > -1) oldP.cuts.splice(idx, 1);
                    oldP.finalRemnant += movedLen;
                    // Thêm vào new (nếu fit)
                    const newP = lastCalculatedProposals[newProposalId];
                    if (newP.finalRemnant >= movedLen) {
                        newP.cuts.push(movedLen);
                        newP.finalRemnant -= movedLen;
                    } else {
                        alert("Không fit vào cây mới!");
                        // Undo kéo
                        evt.from.appendChild(evt.item);
                    }
                    renderGroupedProposals(lastCalculatedProposals, flatReqsCache);
                }
            }
        });
    });
}

// Xử lý click cho nút SỬA / XÓA trong kho
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-group-btn')) {
        const btn = e.target;
        openEditModal(
            btn.dataset.type,
            Number(btn.dataset.length),
            Number(btn.dataset.qty),
            btn.dataset.ids
        );
        return;
    }

    if (e.target.classList.contains('delete-group-btn')) {
        const btn = e.target;
        openDeleteModal(
            btn.dataset.type,
            Number(btn.dataset.length),
            Number(btn.dataset.qty),
            btn.dataset.ids
        );
        return;
    }
});