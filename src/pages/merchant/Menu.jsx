import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, ToggleLeft, ToggleRight, Edit, Trash2, Check, X, ClipboardList, UtensilsCrossed, AlertTriangle, Tags, Tag, FolderPlus, Pencil, ImagePlus, FileText, Wallet, FolderOpen } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { useNavigate } from 'react-router-dom';
import { getFoodImageUrl, DEFAULT_FOOD_IMAGE } from '../../utils/avatarHelper';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { useFetchData } from '../../hooks/useFetchData';
import { useModalState } from '../../hooks/useModalState';
import { useImageUpload } from '../../hooks/useImageUpload';
import FilterTabs from '../../components/common/FilterTabs';


export default function MerchantMenu() {
  const navigate = useNavigate();

  // Fetch dữ liệu bằng useFetchData
  const { data: resData, loading: loadingRes, error: resError } = useFetchData('/merchant/restaurant');
  const restaurantId = resData ? (resData.restaurantId || resData.id) : null;
  const noRestaurant = resError?.response?.status === 404;

  const { data: categoriesData, loading: loadingCats, refetch: refetchCats } = useFetchData(
    restaurantId ? `/restaurants/${restaurantId}/categories` : null,
    {
      mapFn: (data) => (data || []).map(c => ({
        id: c.categoryId,
        name: c.categoryName,
        displayOrder: c.displayOrder
      }))
    }
  );
  const categories = categoriesData || [];

  const { data: menuItemsData, loading: loadingFoods, refetch: refetchFoods } = useFetchData(
    restaurantId ? `/merchant/restaurants/${restaurantId}/foods` : null,
    {
      mapFn: (data) => (data || []).map(item => ({
        id: item.id,
        catId: item.categoryId,
        name: item.foodName,
        price: Number(item.price),
        active: item.isAvailable ?? true,
        image: item.imageUrl || '',
        desc: item.description
      }))
    }
  );
  const menuItems = menuItemsData || [];

  const loading = loadingRes || (restaurantId && (loadingCats || loadingFoods));

  const refreshAll = useCallback(() => {
    refetchCats();
    refetchFoods();
  }, [refetchCats, refetchFoods]);

  const [activeCategory, setActiveCategory] = useState(null);

  // Đồng bộ activeCategory khi danh mục thực phẩm thay đổi
  useEffect(() => {
    if (categories.length > 0) {
      setActiveCategory(prev => {
        if (prev && categories.some(c => c.id === prev)) {
          return prev;
        }
        return categories[0].id;
      });
    } else {
      setActiveCategory(null);
    }
  }, [categories]);

  // Các Modal States sử dụng useModalState
  const addCatModal = useModalState();
  const editCatModal = useModalState();
  const deleteCatModal = useModalState();
  const deleteFoodModal = useModalState();
  const addFoodModal = useModalState();
  const editFoodModalState = useModalState();

  // Bộ lọc trạng thái món ăn
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, AVAILABLE, UNAVAILABLE

  // States lưu trữ form data
  const [newCatName, setNewCatName] = useState('');
  const [editCatName, setEditCatName] = useState('');

  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodDesc, setNewFoodDesc] = useState('');
  const [newFoodPrice, setNewFoodPrice] = useState('');
  const [newFoodCat, setNewFoodCat] = useState('');
  const [newFoodImage, setNewFoodImage] = useState('');

  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodDesc, setEditFoodDesc] = useState('');
  const [editFoodPrice, setEditFoodPrice] = useState('');
  const [editFoodCat, setEditFoodCat] = useState('');
  const [editFoodImage, setEditFoodImage] = useState('');

  // State lỗi cho form Thêm mới
  const [nameErr, setNameErr] = useState('');
  const [priceErr, setPriceErr] = useState('');
  const [catErr, setCatErr] = useState('');

  // State lỗi cho form Sửa
  const [eNameErr, setENameErr] = useState('');
  const [ePriceErr, setEPriceErr] = useState('');
  const [eCatErr, setECatErr] = useState('');
  

  // Upload hình ảnh sử dụng useImageUpload
  const { uploading: uploadingAddImage, uploadImage: uploadAddImage } = useImageUpload();
  const { uploading: uploadingEditImage, uploadImage: uploadEditImage } = useImageUpload();

  const fileInputAddRef = useRef(null);
  const fileInputEditRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFoodImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newUrl = type === 'add' ? await uploadAddImage(file) : await uploadEditImage(file);
    if (newUrl) {
      if (type === 'add') {
        setNewFoodImage(newUrl);
      } else {
        setEditFoodImage(newUrl);
      }
    }

    if (type === 'add') {
      if (fileInputAddRef.current) fileInputAddRef.current.value = "";
    } else {
      if (fileInputEditRef.current) fileInputEditRef.current.value = "";
    }
  };

  const toggleItemActive = async (item) => {
    try {
      setSubmitting(true);
      const updatedStatus = !item.active;
      await apiClient.put(`/merchant/foods/${item.id}`, {
        categoryId: item.catId,
        foodName: item.name,
        description: item.desc,
        price: item.price,
        imageUrl: item.image,
        isAvailable: updatedStatus
      });
      toast.success(`Đã cập nhật trạng thái món ăn sang: ${updatedStatus ? 'Mở bán' : 'Hết hàng'}`);
      refetchFoods();
    } catch (err) {
      console.error(err);
      toast.error('Không thể thay đổi trạng thái món ăn vào lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (itemId, name) => {
    deleteFoodModal.open({ id: itemId, name });
  };

  const handleDeleteConfirm = async () => {
    const data = deleteFoodModal.data;
    if (!data) return;
    try {
      setSubmitting(true);
      await apiClient.delete(`/merchant/foods/${data.id}`);
      toast.success(`Đã xóa thành công món ăn "${data.name}"!`);
      deleteFoodModal.close();
      refetchFoods();
    } catch (err) {
      console.error(err);
      toast.error('Không thể xóa món ăn này.');
    } finally {
      setSubmitting(false);
    }
  };

  const validate = (name, price, catId, isEdit = false) => {
    let isValid = true;
    const getPriceError = (val) => {
      const strVal = String(val).trim();
      if (strVal === '') return 'Vui lòng nhập giá.';
      if (isNaN(Number(val)) || Number(val) < 0) return 'Giá không hợp lệ.';
      return '';
    };

    if (!isEdit) {
      // FORM THÊM MỚI
      const nErr = !name?.trim() ? 'Vui lòng nhập tên món.' : '';
      const pErr = getPriceError(price);
      const cErr = !catId ? 'Vui lòng chọn danh mục.' : '';
      
      setNameErr(nErr);
      setPriceErr(pErr);
      setCatErr(cErr);
      
      if (nErr || pErr || cErr) isValid = false;
    } else {
      // FORM CHỈNH SỬA
      const nErr = !name?.trim() ? 'Vui lòng nhập tên món.' : '';
      const pErr = getPriceError(price);
      const cErr = !catId ? 'Vui lòng chọn danh mục.' : '';
      
      setENameErr(nErr);
      setEPriceErr(pErr);
      setECatErr(cErr);
      
      if (nErr || pErr || cErr) isValid = false;
    }
    return isValid;
  };

  //thêm món ăn
  const handleAddFood = async (e) => {
    e.preventDefault();
    if (!validate(newFoodName, newFoodPrice, newFoodCat, false)) return;

    setSubmitting(true);
    try {
      const createReq = {
        categoryId: Number(newFoodCat),
        foodName: newFoodName,
        description: newFoodDesc,
        price: Number(newFoodPrice),
        imageUrl: newFoodImage
      };

      await apiClient.post(`/merchant/restaurants/${restaurantId}/foods`, createReq);
      toast.success(`Đã thêm thành công món ăn "${newFoodName}" vào thực đơn!`);
      
      addFoodModal.close();
      refetchFoods();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo món ăn mới!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (item) => {
    setENameErr(''); setEPriceErr(''); setECatErr('');
    setEditFoodName(item.name);
    setEditFoodDesc(item.desc);
    setEditFoodPrice(item.price);
    setEditFoodCat(item.catId);
    setEditFoodImage(item.image);
    editFoodModalState.open(item);
  };

  //sửa món ăn
  const handleEditFood = async (e) => {
    e.preventDefault();
    if (!validate(editFoodName, editFoodPrice, editFoodCat, true)) return;

    const editingItem = editFoodModalState.data;
    if (!editingItem) return;

    setSubmitting(true);
    try {
      await apiClient.put(`/merchant/foods/${editingItem.id}`, {
        categoryId: editFoodCat ? Number(editFoodCat) : null,
        foodName: editFoodName.trim(),
        description: editFoodDesc,
        price: Number(editFoodPrice),
        imageUrl: editFoodImage,
        isAvailable: editingItem.active
      });
      toast.success(`Đã cập nhật thành công món ăn "${editFoodName}"!`);
      editFoodModalState.close();
      refetchFoods();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật món ăn!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddModal = () => {
    setNameErr(''); setPriceErr(''); setCatErr('');
    if (categories.length === 0) {
      toast.warning('Vui lòng tạo ít nhất 1 danh mục trước khi thêm món ăn!');
      return;
    }
    setNewFoodCat(categories[0].id);
    setNewFoodName('');
    setNewFoodDesc('');
    setNewFoodPrice('');
    setNewFoodImage('');
    addFoodModal.open();
  };

  const handleAddCategoryClick = () => {
    setNewCatName('');
    addCatModal.open();
  };

  const handleAddCategoryConfirm = async () => {
    if (!newCatName.trim()) {
      toast.warning('Tên danh mục không được để trống!');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/merchant/restaurants/${restaurantId}/categories`, {
        categoryName: newCatName.trim(),
        displayOrder: categories.length + 1
      });
      toast.success(`Đã thêm danh mục "${newCatName.trim()}" thành công!`);
      addCatModal.close();
      refetchCats();
    } catch (err) {
      console.error(err);
      toast.error('Không thể tạo danh mục mới vào lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategoryClick = () => {
    const activeCat = categories.find(c => Number(c.id) === Number(activeCategory));
    if (!activeCat) return;
    setEditCatName(activeCat.name);
    editCatModal.open();
  };

  const handleEditCategoryConfirm = async () => {
    if (!editCatName.trim()) {
      toast.warning('Tên danh mục không được để trống!');
      return;
    }

    setSubmitting(true);
    try {
      const activeCat = categories.find(c => Number(c.id) === Number(activeCategory));
      await apiClient.put(`/merchant/categories/${activeCategory}`, {
        categoryName: editCatName.trim(),
        displayOrder: activeCat ? activeCat.displayOrder : 0
      });
      toast.success(`Đã cập nhật tên danh mục thành "${editCatName.trim()}" thành công!`);
      editCatModal.close();
      refetchCats();
    } catch (err) {
      console.error(err);
      toast.error('Không thể cập nhật danh mục vào lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategoryClick = () => {
    deleteCatModal.open();
  };

  const handleDeleteCategoryConfirm = async () => {
    setSubmitting(true);
    try {
      await apiClient.delete(`/merchant/categories/${activeCategory}`);
      toast.success('Đã xóa danh mục thành công!');
      deleteCatModal.close();
      
      const remainingCats = categories.filter(c => Number(c.id) !== Number(activeCategory));
      if (remainingCats.length > 0) {
        setActiveCategory(remainingCats[0].id);
      } else {
        setActiveCategory(null);
      }
      
      refreshAll();
    } catch (err) {
      console.error(err);
      toast.error('Không thể xóa danh mục này vào lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  if (noRestaurant && !loading) {
    return (
      <div className="flex-1 p-10 flex flex-col items-center justify-center text-center font-google-sans h-full min-h-[60vh] bg-md-surface">
        <ClipboardList size={56} className="text-md-outline/40 mb-4" />
        <h2 className="text-xl font-bold text-md-on-surface">Chưa đăng ký nhà hàng</h2>
        <p className="text-sm text-md-on-surface-variant mt-2 max-w-xs">Bạn cần tạo và đăng ký nhà hàng của mình để quản lý thực đơn.</p>
        <button
          onClick={() => navigate('/merchant/settings')}
          className="mt-6 bg-md-secondary text-white font-bold px-6 py-2.5 rounded-radius-lg shadow-sm hover:scale-105 transition-all text-xs"
        >
          Đăng ký ngay
        </button>
      </div>
    );
  }

  const hasUncategorized = menuItems.some(item =>
    !item.catId || !categories.some(c => Number(c.id) === Number(item.catId))
  );

  // Tên danh mục đang chọn (cho thanh thao tác Sửa/Xóa rõ ràng)
  const activeCatName = categories.find(c => Number(c.id) === Number(activeCategory))?.name || '';

  // ── Sức khoẻ thực đơn (dùng để làm nổi bật việc quan trọng cần xử lý) ──
  const availableCount = menuItems.filter(i => i.active).length;
  const unavailableCount = menuItems.filter(i => !i.active).length;
  const uncategorizedCount = menuItems.filter(item =>
    !item.catId || !categories.some(c => Number(c.id) === Number(item.catId))
  ).length;

  const displayedItems = menuItems.filter(item => {
    const matchCat = activeCategory === 'UNCATEGORIZED'
      ? (!item.catId || !categories.some(c => Number(c.id) === Number(item.catId)))
      : Number(item.catId) === Number(activeCategory);

    if (!matchCat) return false;
    if (statusFilter === 'AVAILABLE') return item.active === true;
    if (statusFilter === 'UNAVAILABLE') return item.active === false;
    return true;
  });

  const getFilteredCount = (statusType) => {
    return menuItems.filter(item => {
      const matchCat = activeCategory === 'UNCATEGORIZED'
        ? (!item.catId || !categories.some(c => Number(c.id) === Number(item.catId)))
        : Number(item.catId) === Number(activeCategory);
      if (!matchCat) return false;
      if (statusType === 'AVAILABLE') return item.active === true;
      if (statusType === 'UNAVAILABLE') return item.active === false;
      return true;
    }).length;
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
          <span className="p-2 rounded-radius-lg bg-md-secondary/10 text-md-secondary">
            <UtensilsCrossed size={20} />
          </span>
          Quản Lý Thực Đơn
        </h1>
        <button
          onClick={handleOpenAddModal}
          className="bg-md-secondary text-white font-bold px-4 py-2 rounded-radius-full text-xs shadow-sm hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={16} />
          Thêm món mới
        </button>
      </div>

      {/* ─── HÀNG KPI TÓM TẮT THỰC ĐƠN (đếm THẬT từ menuItems toàn quán) ──────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        {[
          { label: 'Tổng số món', value: menuItems.length, icon: UtensilsCrossed, tint: 'from-blue-50', ring: 'ring-blue-100/70', chip: 'bg-blue-100 text-blue-600', num: 'text-slate-800' },
          { label: 'Đang bán', value: availableCount, icon: ToggleRight, tint: 'from-emerald-50', ring: 'ring-emerald-100/70', chip: 'bg-emerald-100 text-emerald-600', num: 'text-emerald-600' },
          { label: 'Tạm hết', value: unavailableCount, icon: ToggleLeft, tint: 'from-rose-50', ring: 'ring-rose-100/70', chip: 'bg-rose-100 text-rose-600', num: unavailableCount > 0 ? 'text-rose-600' : 'text-slate-800' },
        ].map((kpi, idx) => {
          const KIcon = kpi.icon;
          return (
            <div key={idx} className={`relative overflow-hidden bg-gradient-to-br ${kpi.tint} to-white rounded-radius-xl p-3.5 border border-slate-200/60 shadow-sm ring-1 ${kpi.ring} flex items-center gap-3`}>
              <span className={`p-2 rounded-radius-md shrink-0 ${kpi.chip}`}>
                <KIcon size={18} />
              </span>
              <div className="min-w-0">
                <span className={`text-xl font-black block leading-none ${kpi.num}`}>{kpi.value}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1 truncate">{kpi.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── CẢNH BÁO SỨC KHOẺ THỰC ĐƠN — làm nổi bật việc quan trọng cần xử lý ────── */}
      {(unavailableCount > 0 || uncategorizedCount > 0) && (
        <div className="mb-6 rounded-radius-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 flex items-start gap-3 shadow-sm animate-rise-in">
          <span className="p-2 rounded-radius-lg bg-amber-100 text-amber-600 shrink-0 animate-pulse">
            <AlertTriangle size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-amber-800 flex items-center gap-1.5">
              Cần chú ý để không lỡ đơn của khách
            </p>
            <ul className="mt-1.5 space-y-1">
              {unavailableCount > 0 && (
                <li className="text-xs text-amber-700/90 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span><b className="text-rose-600">{unavailableCount} món</b> đang <b>tạm hết</b> — khách <b>không nhìn thấy</b> trên app.</span>
                </li>
              )}
              {uncategorizedCount > 0 && (
                <li className="text-xs text-amber-700/90 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span><b className="text-amber-700">{uncategorizedCount} món</b> <b>chưa phân loại</b> — nên gán danh mục để khách dễ tìm.</span>
                </li>
              )}
            </ul>
          </div>
          {unavailableCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('UNAVAILABLE')}
              className="shrink-0 self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-radius-lg bg-amber-500 text-white text-xs font-bold shadow-sm hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
            >
              <AlertTriangle size={14} /> Xem món tạm hết
            </button>
          )}
        </div>
      )}

      {/* ─── DANH MỤC THỰC PHẨM ─── */}
      <div className="mb-6 bg-white p-4 sm:p-5 rounded-radius-xl border border-slate-200/60 shadow-sm">
        {/* Header: tiêu đề có icon + nút Thêm danh mục rõ ràng */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-radius-md bg-md-secondary/10 text-md-secondary shrink-0">
              <Tags size={16} />
            </span>
            <h3 className="text-sm font-extrabold text-slate-700">Danh mục thực phẩm</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
              {categories.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddCategoryClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-radius-lg bg-md-secondary/10 text-md-secondary font-bold text-xs border border-md-secondary/20 hover:bg-md-secondary hover:text-white transition-all cursor-pointer shrink-0"
            title="Tạo danh mục mới"
          >
            <FolderPlus size={15} /> <span className="hidden sm:inline">Thêm danh mục</span>
          </button>
        </div>

        {/* Chips danh mục (mỗi chip có icon nhận diện) */}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => {
            const isActive = Number(activeCategory) === Number(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-radius-lg text-xs font-bold transition-all border shrink-0 ${
                  isActive
                    ? 'bg-md-secondary text-white border-md-secondary shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Tag size={12} className={isActive ? 'text-white/80' : 'text-slate-400'} />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-500'
                }`}>
                  {menuItems.filter(i => Number(i.catId) === Number(cat.id)).length}
                </span>
              </button>
            );
          })}

          {hasUncategorized && (
            <button
              type="button"
              onClick={() => setActiveCategory('UNCATEGORIZED')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-radius-lg text-xs font-bold transition-all border shrink-0 ${
                activeCategory === 'UNCATEGORIZED'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={12} className={activeCategory === 'UNCATEGORIZED' ? 'text-white/80' : 'text-amber-500'} />
              <span>Chưa phân loại</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeCategory === 'UNCATEGORIZED' ? 'bg-white/20 text-white' : 'bg-amber-200/70 text-amber-800'
              }`}>
                {menuItems.filter(item => !item.catId || !categories.some(c => Number(c.id) === Number(item.catId))).length}
              </span>
            </button>
          )}
        </div>

        {/* Thanh thao tác cho danh mục đang chọn — nút rõ ràng, dễ bấm (thay link chữ tí xíu) */}
        {activeCategory && activeCategory !== 'UNCATEGORIZED' && activeCatName && (
          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 font-semibold inline-flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-md-secondary shrink-0"></span>
              Đang quản lý: <b className="text-slate-700 truncate">{activeCatName}</b>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleEditCategoryClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-radius-lg text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Sửa tên danh mục đang chọn"
              >
                <Pencil size={13} /> Sửa tên
              </button>
              <button
                type="button"
                onClick={handleDeleteCategoryClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-radius-lg text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors cursor-pointer"
                title="Xóa danh mục đang chọn"
              >
                <Trash2 size={13} /> Xóa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bộ lọc trạng thái món ăn */}
      {categories.length > 0 && (
        <FilterTabs
          tabs={[
            { id: 'ALL', label: `Tất cả (${getFilteredCount('ALL')})` },
            { id: 'AVAILABLE', label: `Đang bán (${getFilteredCount('AVAILABLE')})` },
            { id: 'UNAVAILABLE', label: `Tạm hết (${getFilteredCount('UNAVAILABLE')})` },
          ]}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
          className="mb-5 border-b border-slate-150 pb-2.5"
          activeClassName="bg-md-secondary text-white shadow-sm shadow-md-secondary/25"
        />
      )}

      {/* Loading Spinner hoặc Food List */}
      {loading && menuItems.length === 0 ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-radius-xl border border-slate-200/60 shadow-sm text-slate-400 text-xs font-bold">
          Chủ quán chưa tạo danh mục nào. Hãy nhấn nút "+ Thêm danh mục" phía trên để bắt đầu!
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-radius-xl border border-slate-200/60 shadow-sm text-slate-400 text-xs font-bold">
          Không tìm thấy món ăn nào phù hợp với bộ lọc.
        </div>
      ) : (
        // Lưới 2 cột trên màn rộng (xl) để tận dụng không gian, 1 cột ở màn hẹp.
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {displayedItems.map((item, idx) => (
              <div
                key={item.id}
                style={{ animationDelay: `${idx * 45}ms` }}
                className={`bg-white rounded-radius-xl p-3.5 border border-slate-200/60 shadow-sm flex gap-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 animate-rise-in ${
                  !item.active ? 'opacity-70 bg-slate-50/50' : ''
                }`}
              >
                {/* Ảnh món (to hơn) + nhãn trạng thái đè lên ảnh */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-radius-lg overflow-hidden shrink-0 border border-slate-100">
                  <img
                    src={getFoodImageUrl(item.image)}
                    alt={item.name}
                    onError={(e) => { e.currentTarget.src = DEFAULT_FOOD_IMAGE; }}
                    className="w-full h-full object-cover"
                  />
                  {!item.active && (
                    <span className="absolute top-1 left-1 bg-rose-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm">
                      Tạm hết
                    </span>
                  )}
                </div>

                {/* Thông tin món — dồn giá + lượt bán xuống đáy để lấp khoảng trống */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <h3 className="font-bold text-sm text-slate-800 truncate">{item.name}</h3>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                    {item.desc || 'Chưa có mô tả cho món này'}
                  </p>
                  <div className="mt-auto flex items-center gap-2 pt-2 flex-wrap">
                    {/* Pill trạng thái (trang trí + chỉ báo, không phải chỉ số nghiệp vụ) */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {item.active ? 'Đang bán' : 'Tạm hết'}
                    </span>
                    <span className="font-extrabold text-sm sm:text-base text-md-secondary">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                </div>

                {/* Thao tác — cột gọn bên phải, toggle trên / sửa-xóa dưới */}
                <div className="flex flex-col items-end justify-between shrink-0 pl-3 border-l border-slate-100">
                  <button
                    onClick={() => toggleItemActive(item)}
                    className="inline-flex items-center gap-1 focus:outline-none active:scale-95 transition-transform cursor-pointer"
                    title={item.active ? 'Đang mở bán — bấm để chuyển tạm hết' : 'Đang hết — bấm để mở bán lại'}
                  >
                    <span className={`text-[9px] font-bold hidden sm:inline ${item.active ? 'text-md-secondary' : 'text-slate-400'}`}>
                      {item.active ? 'Mở bán' : 'Hết hàng'}
                    </span>
                    {item.active ? (
                      <ToggleRight size={26} className="text-md-secondary" />
                    ) : (
                      <ToggleLeft size={26} className="text-slate-300" />
                    )}
                  </button>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 rounded-radius-md hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                      title="Sửa món"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id, item.name)}
                      className="p-1.5 rounded-radius-md hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                      title="Xóa món"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
        </div>
      )}

      {/* MODAL THÊM MÓN MỚI */}
      <Modal
        isOpen={addFoodModal.isOpen}
        onClose={addFoodModal.close}
        title="Thêm Món Ăn Mới"
        size="md"
      >
        <form onSubmit={handleAddFood} className="space-y-4" noValidate>
          <div className="flex items-center gap-4 py-2 border-b border-slate-100">
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
              <img src={getFoodImageUrl(newFoodImage)} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={ImagePlus}
                onClick={() => fileInputAddRef.current?.click()}
                loading={uploadingAddImage}
              >
                Chọn ảnh món ăn
              </Button>
              <input
                type="file"
                ref={fileInputAddRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFoodImageUpload(e, 'add')}
              />
              <p className="text-[9px] text-slate-400 mt-1 font-normal">Định dạng JPEG, PNG, WEBP, HEIC, HEIF dưới 5MB</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><UtensilsCrossed size={12} className="text-md-secondary" /> Tên món ăn *</label>
              <input
                type="text"
                value={newFoodName}
                placeholder="Ví dụ: Cơm Tấm Sườn..."
                onChange={(e) => { setNewFoodName(e.target.value); if (nameErr) setNameErr(''); }}
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-radius-lg focus:outline-none focus:bg-white transition-all ${nameErr ? 'border-red-500' : 'border-slate-200'}`}
              />
              {nameErr && <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> {nameErr}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><Wallet size={12} className="text-emerald-500" /> Giá bán (VNĐ) *</label>
                <input
                  type="number"
                  value={newFoodPrice}
                  placeholder="Ví dụ: 45000"
                  onChange={(e) => { setNewFoodPrice(e.target.value); if (priceErr) setPriceErr(''); }}
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-radius-lg focus:outline-none focus:bg-white transition-all ${priceErr ? 'border-red-500' : 'border-slate-200'}`}
                />
                {priceErr && <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> {priceErr}</span>}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><FolderOpen size={12} className="text-amber-500" /> Danh mục</label>
                <select
                  value={newFoodCat}
                  onChange={(e) => { setNewFoodCat(Number(e.target.value)); if (catErr) setCatErr(''); }}
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-radius-lg focus:outline-none focus:bg-white transition-all ${catErr ? 'border-red-500' : 'border-slate-200'}`}
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {catErr && <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> {catErr}</span>}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><FileText size={12} className="text-blue-500" /> Mô tả món ăn</label>
              <textarea
                rows={2.5}
                value={newFoodDesc}
                onChange={(e) => setNewFoodDesc(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg focus:outline-none focus:border-md-secondary focus:bg-white resize-none transition-all"
              />
            </div>
          </div>

          {/* Nút lưu */}
          <Button
            type="submit"
            variant="secondary"
            loading={submitting}
            className="w-full"
          >
            Lưu món ăn mới
          </Button>
        </form>
      </Modal>

      {/* MODAL CHỈNH SỬA MÓN ĂN */}
      <Modal
        isOpen={editFoodModalState.isOpen}
        onClose={editFoodModalState.close}
        title="Chỉnh Sửa Món Ăn"
        size="md"
      >
        <form onSubmit={handleEditFood} className="space-y-4" noValidate>
          <div className="flex items-center gap-4 py-2 border-b border-slate-100">
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
              <img src={getFoodImageUrl(editFoodImage)} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={ImagePlus}
                onClick={() => fileInputEditRef.current?.click()}
                loading={uploadingEditImage}
              >
                Thay đổi ảnh món ăn
              </Button>
              <input
                type="file"
                ref={fileInputEditRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFoodImageUpload(e, 'edit')}
              />
              <p className="text-[9px] text-slate-400 mt-1 font-normal">Định dạng JPEG, PNG, WEBP, HEIC, HEIF dưới 5MB</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><UtensilsCrossed size={12} className="text-md-secondary" /> Tên món ăn *</label>
              <input
                type="text"
                value={editFoodName}
                onChange={(e) => { setEditFoodName(e.target.value); if (eNameErr) setENameErr(''); }}
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-radius-lg focus:outline-none focus:bg-white transition-all ${eNameErr ? 'border-red-500' : 'border-slate-200'}`}
              />
              {eNameErr && <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> {eNameErr}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><Wallet size={12} className="text-emerald-500" /> Giá bán (VNĐ) *</label>
                <input
                  type="number"
                  value={editFoodPrice}
                  onChange={(e) => { setEditFoodPrice(e.target.value); if (ePriceErr) setEPriceErr(''); }}
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-radius-lg focus:outline-none focus:bg-white transition-all ${ePriceErr ? 'border-red-500' : 'border-slate-200'}`}
                />
                {ePriceErr && <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> {ePriceErr}</span>}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><FolderOpen size={12} className="text-amber-500" /> Danh mục</label>
                <select
                  value={editFoodCat || ''}
                  onChange={(e) => setEditFoodCat(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg focus:outline-none focus:border-md-secondary focus:bg-white transition-all"
                >
                  {!editFoodCat && <option value="">-- Chưa phân loại --</option>}
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]"><FileText size={12} className="text-blue-500" /> Mô tả món ăn</label>
              <textarea
                rows={2.5}
                placeholder="Sườn nướng thơm ngon mật ong..."
                value={editFoodDesc}
                onChange={(e) => setEditFoodDesc(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg focus:outline-none focus:border-md-secondary focus:bg-white resize-none transition-all"
              />
            </div>
          </div>

          {/* Nút lưu */}
          <Button
            type="submit"
            variant="secondary"
            loading={submitting}
            className="w-full"
          >
            Lưu thay đổi
          </Button>
        </form>
      </Modal>

      {/* Confirm xóa món ăn */}
      <ConfirmDialog
        isOpen={deleteFoodModal.isOpen}
        onClose={() => deleteFoodModal.close()}
        onConfirm={handleDeleteConfirm}
        title="Xóa món ăn"
        message={`Bạn có chắc chắn muốn xóa món ăn "${deleteFoodModal.data?.name}" khỏi menu không?`}
        confirmLabel="Xóa"
        danger
        loading={submitting}
      />

      {/* Modal thêm danh mục mới */}
      <Modal
        isOpen={addCatModal.isOpen}
        onClose={() => addCatModal.close()}
        title="Thêm Danh Mục"
        size="sm"
      >
        <div className="space-y-4 font-google-sans">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5 uppercase"><FolderPlus size={13} className="text-md-secondary" /> Tên danh mục mới *</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Ví dụ: Món nướng, Khai vị..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-md-secondary text-slate-800"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => addCatModal.close()}
              disabled={submitting}
              size="sm"
            >
              Hủy
            </Button>
            <Button
              variant="secondary"
              onClick={handleAddCategoryConfirm}
              loading={submitting}
              disabled={!newCatName.trim()}
              size="sm"
            >
              Lưu danh mục
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal sửa danh mục */}
      <Modal
        isOpen={editCatModal.isOpen}
        onClose={() => editCatModal.close()}
        title="Chỉnh Sửa Danh Mục"
        size="sm"
      >
        <div className="space-y-4 font-google-sans">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5 uppercase"><Pencil size={13} className="text-blue-500" /> Tên danh mục *</label>
            <input
              type="text"
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              placeholder="Nhập tên danh mục..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-md-secondary text-slate-800"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => editCatModal.close()}
              disabled={submitting}
              size="sm"
            >
              Hủy
            </Button>
            <Button
              variant="secondary"
              onClick={handleEditCategoryConfirm}
              loading={submitting}
              disabled={!editCatName.trim()}
              size="sm"
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm xóa danh mục */}
      <ConfirmDialog
        isOpen={deleteCatModal.isOpen}
        onClose={() => deleteCatModal.close()}
        onConfirm={handleDeleteCategoryConfirm}
        title="Xóa danh mục"
        message="Bạn có chắc chắn muốn xóa danh mục này? Các món ăn đang thuộc danh mục này sẽ được đưa về trạng thái 'Chưa phân loại' để không bị mất dữ liệu."
        confirmLabel="Xóa"
        danger
        loading={submitting}
      />

    </div>
  );
}