/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  LogOut, 
  Trash2, 
  Send, 
  Database,
  ArrowRight,
  ShieldCheck,
  Hash,
  Plus,
  Eye,
  Upload,
  X,
  Move,
  Sun,
  Moon,
  Copy,
  ExternalLink,
  Palette,
  ChevronDown,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, signIn, logOut } from './lib/firebase';

// Types
interface Entry {
  id: string;
  imageId: string;
  resolutionRef?: string;
  promptIA?: string;
  logo: boolean;
  logoSize?: string;
  logoColorFill?: string;
  logoColorFillEnabled?: boolean;
  logoExtra?: string;
  logoPrompt?: string;
  logoPromptActive?: boolean;
  imageSize?: string;
  imageColorFill?: string;
  // Autorise le changement de couleur du fond (néon/LED) côté PWA. Défaut : non.
  imageColorFillEnabled?: boolean;
  // Portée quand autorisé : false = néon seul ; true = néon + murs de la même teinte.
  imageColorFillWalls?: boolean;
  imageExtra?: string;
  logoX: string;
  logoY: string;
  text: boolean;
  textContent: string;
  textFont: string;
  textSize: string;
  textAlign: string;
  textColorFill: string;
  textColorFillEnabled?: boolean;
  textPrompt?: string;
  textPromptActive?: boolean;
  textExtra?: string;
  textX: string;
  textY: string;
  createdAt: any;
  userId: string;
}

interface PromptIA {
  id: string;
  promptName: string;
  aPrompt: string;
  bPrompt: string;
  cPrompt: string;
  generalPrompt: string;
  promptNegative?: string;
  createdAt: any;
  userId: string;
}

interface ShadowEffectConfig {
  enabled: boolean;
  mode: 'shadow' | 'light';
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'diffused';
  opacity: number;
  distance: number;
  blur: number;
  color: string;
}

const hexToRgba = (hex: string, opacity: number): string => {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  if (cleanHex.length !== 6) {
    return `rgba(255, 255, 255, ${opacity})`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getSafeCoord = (val: string | undefined, fallback: number): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
};

const getFontFamilyStack = (font: string) => {
  switch (font) {
    case 'Inter':
      return '"Inter", sans-serif';
    case 'Garamond':
      return '"EB Garamond", Garamond, serif';
    case 'Times New Roman':
      return '"Times New Roman", Times, serif';
    case 'Georgia':
      return 'Georgia, serif';
    case 'Impact':
      return 'Impact, Charcoal, sans-serif';
    case 'Arial':
      return 'Arial, Helvetica, sans-serif';
    default:
      return font ? `"${font}", serif` : '"Inter", sans-serif';
  }
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error (Gracefully handeled): ', JSON.stringify(errInfo));
}

const isEntryChanged = (entry: Entry | undefined, formData: any): boolean => {
  if (!entry) return true;
  
  const getNorm = (val: any) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val;
    return String(val).trim();
  };

  const entryLogoSize = entry.logoSize !== undefined ? entry.logoSize : entry.imageSize;
  const entryLogoColorFill = entry.logoColorFill !== undefined ? entry.logoColorFill : entry.imageColorFill;
  const entryLogoPrompt = entry.logoPrompt !== undefined ? entry.logoPrompt : (entry.logoExtra !== undefined ? entry.logoExtra : entry.imageExtra);
  const entryLogoPromptActive = entry.logoPromptActive !== undefined ? !!entry.logoPromptActive : (entryLogoPrompt ? entryLogoPrompt !== '' : false);
  const entryTextPrompt = entry.textPrompt !== undefined ? entry.textPrompt : entry.textExtra;
  const entryTextPromptActive = entry.textPromptActive !== undefined ? !!entry.textPromptActive : (entryTextPrompt ? entryTextPrompt !== '' : false);

  return (
    getNorm(entry.promptIA) !== getNorm(formData.promptIA) ||
    getNorm(entry.resolutionRef || '1280') !== getNorm(formData.resolutionRef || '1280') ||
    (entry.logo ?? true) !== formData.logo ||
    getNorm(entryLogoSize) !== getNorm(formData.logoSize) ||
    getNorm(entryLogoColorFill) !== getNorm(formData.logoColorFill) ||
    (entry.logoColorFillEnabled !== undefined ? !!entry.logoColorFillEnabled : (entryLogoColorFill ? entryLogoColorFill !== '' : false)) !== !!formData.logoColorFillEnabled ||
    getNorm(entryLogoPrompt) !== getNorm(formData.logoPrompt) ||
    !!entryLogoPromptActive !== !!formData.logoPromptActive ||
    getNorm(entry.logoX) !== getNorm(formData.logoX) ||
    getNorm(entry.logoY) !== getNorm(formData.logoY) ||
    (entry.text ?? true) !== formData.text ||
    getNorm(entry.textContent) !== getNorm(formData.textContent) ||
    getNorm(entry.textFont) !== getNorm(formData.textFont) ||
    getNorm(entry.textSize) !== getNorm(formData.textSize) ||
    getNorm(entry.textAlign || 'CENTRE') !== getNorm(formData.textAlign || 'CENTRE') ||
    getNorm(entry.textColorFill) !== getNorm(formData.textColorFill) ||
    (entry.textColorFillEnabled !== undefined ? !!entry.textColorFillEnabled : (entry.textColorFill ? entry.textColorFill !== '' : false)) !== !!formData.textColorFillEnabled ||
    getNorm(entryTextPrompt) !== getNorm(formData.textPrompt) ||
    !!entryTextPromptActive !== !!formData.textPromptActive ||
    getNorm(entry.textX) !== getNorm(formData.textX) ||
    getNorm(entry.textY) !== getNorm(formData.textY) ||
    (entry.imageColorFillEnabled !== undefined ? !!entry.imageColorFillEnabled : false) !== !!formData.imageColorFillEnabled ||
    (entry.imageColorFillWalls !== undefined ? !!entry.imageColorFillWalls : false) !== !!formData.imageColorFillWalls
  );
};

const isPromptChanged = (prompt: PromptIA | undefined, promptForm: any): boolean => {
  if (!prompt) return true;
  return (
    (prompt.aPrompt || '') !== (promptForm.aPrompt || '') ||
    (prompt.bPrompt || '') !== (promptForm.bPrompt || '') ||
    (prompt.cPrompt || '') !== (promptForm.cPrompt || '') ||
    (prompt.generalPrompt || '') !== (promptForm.generalPrompt || '') ||
    (prompt.promptNegative || '') !== (promptForm.promptNegative || '')
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  
  // Prompt IA additions
  const [activeModule, setActiveModule] = useState<'entries' | 'prompts_ia'>('entries');
  const [promptsIa, setPromptsIa] = useState<Record<string, PromptIA>>({});
  const [activePromptId, setActivePromptId] = useState<string>('');
  const [promptForm, setPromptForm] = useState({
    promptName: '',
    aPrompt: '',
    bPrompt: '',
    cPrompt: '',
    generalPrompt: '',
    promptNegative: '',
  });
  const [newPromptName, setNewPromptName] = useState('');
  const [createPromptError, setCreatePromptError] = useState('');
  const [isPromptDropdownOpen, setIsPromptDropdownOpen] = useState(false);
  const [promptPresetSearchQuery, setPromptPresetSearchQuery] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [firestoreError, setFirestoreError] = useState<FirestoreErrorInfo | null>(null);

  const triggerFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
        emailVerified: user?.emailVerified ?? null,
      },
      operationType,
      path
    };
    console.error('Firestore Error Captured:', errInfo);
    setFirestoreError(errInfo);
  };
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync Mode: 'auto' (Live Sync) or 'manual' (Push to Cloud)
  const [syncMode, setSyncMode] = useState<'auto' | 'manual'>(() => {
    try {
      return (localStorage.getItem('sync_mode') as 'auto' | 'manual') || 'auto';
    } catch {
      return 'auto';
    }
  });

  const handleSyncModeChange = (mode: 'auto' | 'manual') => {
    setSyncMode(mode);
    try {
      localStorage.setItem('sync_mode', mode);
    } catch (e) {
      console.error(e);
    }
  };
  
  // Row State holds the active document ID (which is the imageId now, e.g. "ARCHI 01.jpg")
  const [rowNumber, setRowNumber] = useState<string>('');
  
  // Create Preset Inputs
  const [newImageId, setNewImageId] = useState('');
  const [createError, setCreateError] = useState('');

  // Copy-Paste Row Settings State
  const [copiedSettings, setCopiedSettings] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Push All/Sync All Status State
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllSuccess, setSyncAllSuccess] = useState<string | null>(null);

  // CSV Import States
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);

  // Preview Workspace States (Persisted in LocalStorage)
  const [firebaseStoragePath, setFirebaseStoragePath] = useState<string>(() => {
    try {
      return localStorage.getItem('sheetsync_firebase_storage_path') || 'gs://gen-lang-client-0870404092.firebasestorage.app/ENVIRONMENTS';
    } catch {
      return 'gs://gen-lang-client-0870404092.firebasestorage.app/ENVIRONMENTS';
    }
  });

  const handleFirebaseStoragePathChange = (val: string) => {
    setFirebaseStoragePath(val);
    try {
      localStorage.setItem('sheetsync_firebase_storage_path', val);
    } catch {}
    // Reset image error and ext on path changes so it tries loading again
    setStorageImgError(false);
    setStorageImgExt('png');
  };

  const [useFirebaseStorage, setUseFirebaseStorage] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_use_firebase_storage');
      return saved !== 'false'; // Default to true so it works out of the box when requested
    } catch {
      return true;
    }
  });

  const [storageImgError, setStorageImgError] = useState<boolean>(false);
  const [storageImgExt, setStorageImgExt] = useState<'png' | 'jpg'>('png');

  const handleToggleFirebaseStorage = (val: boolean) => {
    setUseFirebaseStorage(val);
    try {
      localStorage.setItem('sheetsync_use_firebase_storage', String(val));
    } catch {}
  };

  // Helper inside/outside component to construct the Firebase storage HTTP URL from a gs:// bucket path
  const getFirebaseStorageUrl = (gsPath: string, fileName: string, ext: string) => {
    try {
      const clean = gsPath.replace(/^gs:\/\//i, '').trim();
      if (!clean) return '';
      const parts = clean.split('/');
      const bucket = parts[0];
      const folder = parts.slice(1).join('/');
      const folderEncoded = folder ? encodeURIComponent(folder) + '%2F' : '';
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${folderEncoded}${encodeURIComponent(fileName)}.${ext}?alt=media`;
    } catch (e) {
      return `https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0870404092.firebasestorage.app/o/ENVIRONMENTS%2F${encodeURIComponent(fileName)}.${ext}?alt=media`;
    }
  };

  const [previewBg, setPreviewBg] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sheetsync_preview_bg') || null;
    } catch {
      return null;
    }
  });

  const [previewLogo, setPreviewLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sheetsync_preview_logo') || null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'sheet' | 'preview'>('sheet');
  const [dragTarget, setDragTarget] = useState<'logo' | 'text' | 'vehicle' | null>(null);
  const [show43Overlay, setShow43Overlay] = useState<boolean>(true);
  const [fakeText, setFakeText] = useState<string>(() => {
    try {
      return localStorage.getItem('sheetsync_preview_fake_text') ?? '';
    } catch {
      return '';
    }
  });

  const [showColorModal, setShowColorModal] = useState<'logoColorFill' | 'textColorFill' | null>(null);
  const [modalColorVal, setModalColorVal] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [presetSearchQuery, setPresetSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'alpha' | 'date'>('alpha');
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState<boolean>(false);

  const handleModalColorChange = (newVal: string) => {
    setModalColorVal(newVal);
    if (showColorModal) {
      handleFormChange(showColorModal, newVal);
    }
  };

  const [previewVehicle, setPreviewVehicle] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sheetsync_preview_vehicle') || null;
    } catch {
      return null;
    }
  });

  const [vehicleOrigWidth, setVehicleOrigWidth] = useState<number>(1920);
  const [vehicleOrigHeight, setVehicleOrigHeight] = useState<number>(1080);

  const [vehicleScale, setVehicleScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_vehicle_scale');
      return saved ? Number(saved) : 70.3125;
    } catch {
      return 70.3125;
    }
  });

  const [vehicleOpacity, setVehicleOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_vehicle_opacity');
      return saved ? Number(saved) : 60;
    } catch {
      return 60;
    }
  });

  const [vehicleX, setVehicleX] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_vehicle_x');
      return saved ? Number(saved) : 640;
    } catch {
      return 640;
    }
  });

  const [vehicleY, setVehicleY] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_vehicle_y');
      return saved ? Number(saved) : 640;
    } catch {
      return 640;
    }
  });

  const updateVehicleScale = (val: number) => {
    setVehicleScale(val);
    try {
      localStorage.setItem('sheetsync_vehicle_scale', String(val));
    } catch {}
  };

  const updateVehicleOpacity = (val: number) => {
    setVehicleOpacity(val);
    try {
      localStorage.setItem('sheetsync_vehicle_opacity', String(val));
    } catch {}
  };

  const updateVehicleX = (val: number) => {
    setVehicleX(val);
    try {
      localStorage.setItem('sheetsync_vehicle_x', String(val));
    } catch {}
  };

  const updateVehicleY = (val: number) => {
    setVehicleY(val);
    try {
      localStorage.setItem('sheetsync_vehicle_y', String(val));
    } catch {}
  };

  // Pixel cache for logo and vehicle transparent collision detection
  interface ImagePixelCache {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }
  const [logoPixelCache, setLogoPixelCache] = useState<ImagePixelCache | null>(null);
  const [vehiclePixelCache, setVehiclePixelCache] = useState<ImagePixelCache | null>(null);

  useEffect(() => {
    if (!previewLogo) {
      setLogoPixelCache(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 300 / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const imgData = ctx.getImageData(0, 0, w, h);
          setLogoPixelCache({
            width: w,
            height: h,
            data: imgData.data
          });
        } catch (e) {
          console.warn("Could not read image pixel data for opacity checks", e);
        }
      }
    };
    img.src = previewLogo;
  }, [previewLogo]);

  useEffect(() => {
    if (!previewVehicle) {
      setVehiclePixelCache(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setVehicleOrigWidth(img.naturalWidth || img.width || 1920);
      setVehicleOrigHeight(img.naturalHeight || img.height || 1080);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 300 / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const imgData = ctx.getImageData(0, 0, w, h);
          setVehiclePixelCache({
            width: w,
            height: h,
            data: imgData.data
          });
        } catch (e) {
          console.warn("Could not read image pixel data for opacity checks", e);
        }
      }
    };
    img.src = previewVehicle;
  }, [previewVehicle]);

  const isLogoPixelOpaque = (relX: number, relY: number, width: number, height: number): boolean => {
    if (!logoPixelCache) return true; // fallback
    const imageX = Math.round((relX / width) * logoPixelCache.width);
    const imageY = Math.round((relY / height) * logoPixelCache.height);
    if (imageX < 0 || imageX >= logoPixelCache.width || imageY < 0 || imageY >= logoPixelCache.height) {
      return false;
    }
    const index = (imageY * logoPixelCache.width + imageX) * 4 + 3;
    return logoPixelCache.data[index] > 15;
  };

  const isVehiclePixelOpaque = (relX: number, relY: number, width: number, height: number): boolean => {
    if (!vehiclePixelCache) return true; // fallback
    const imageX = Math.round((relX / width) * vehiclePixelCache.width);
    const imageY = Math.round((relY / height) * vehiclePixelCache.height);
    if (imageX < 0 || imageX >= vehiclePixelCache.width || imageY < 0 || imageY >= vehiclePixelCache.height) {
      return false;
    }
    const index = (imageY * vehiclePixelCache.width + imageX) * 4 + 3;
    return vehiclePixelCache.data[index] > 15;
  };

  const isTextPixelOpaque = (text: string, font: string, size: number, align: string, relX: number, relY: number, width: number, height: number): boolean => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true; // fallback to true if canvas not supported
    
    ctx.font = `600 ${size}px ${getFontFamilyStack(font)}`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    
    let x = 0;
    if (align === 'GAUCHE') {
      ctx.textAlign = 'left';
      x = 0;
    } else if (align === 'DROITE') {
      ctx.textAlign = 'right';
      x = width;
    } else {
      ctx.textAlign = 'center';
      x = width / 2;
    }
    
    ctx.fillText(text, x, 0);
    
    try {
      const imgData = ctx.getImageData(Math.round(relX), Math.round(relY), 1, 1);
      return imgData.data[3] > 10; // check alpha
    } catch {
      return true; // fallback
    }
  };

  const handleStartEyeDropper = async (key: 'logoColorFill' | 'textColorFill') => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          handleFormChange(key, result.sRGBHex);
        }
      } catch (err) {
        console.warn('EyeDropper failed or cancelled', err);
      }
    }
  };

  const defaultShadowEffect = (isLogo: boolean): ShadowEffectConfig => ({
    enabled: isLogo ? false : true,
    mode: 'shadow',
    position: isLogo ? 'diffused' : 'bottom-center',
    opacity: isLogo ? 50 : 80,
    distance: isLogo ? 4 : 3,
    blur: isLogo ? 8 : 4,
    color: '#ffffff'
  });

  const [logoShadow, setLogoShadow] = useState<ShadowEffectConfig>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_logo_shadow');
      return saved ? JSON.parse(saved) : defaultShadowEffect(true);
    } catch {
      return defaultShadowEffect(true);
    }
  });

  const [textShadow, setTextShadow] = useState<ShadowEffectConfig>(() => {
    try {
      const saved = localStorage.getItem('sheetsync_text_shadow');
      return saved ? JSON.parse(saved) : defaultShadowEffect(false);
    } catch {
      return defaultShadowEffect(false);
    }
  });

  const updateLogoShadow = (config: Partial<ShadowEffectConfig>) => {
    setLogoShadow(prev => {
      const next = { ...prev, ...config };
      try {
        localStorage.setItem('sheetsync_logo_shadow', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateTextShadow = (config: Partial<ShadowEffectConfig>) => {
    setTextShadow(prev => {
      const next = { ...prev, ...config };
      try {
        localStorage.setItem('sheetsync_text_shadow', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const getLogoFilterStyle = (config: ShadowEffectConfig): string => {
    if (!config.enabled) return 'none';
    
    let dx = 0;
    let dy = 0;
    const dist = config.distance;
    
    switch (config.position) {
      case 'bottom-left':
        dx = -dist;
        dy = dist;
        break;
      case 'bottom-center':
        dx = 0;
        dy = dist;
        break;
      case 'bottom-right':
        dx = dist;
        dy = dist;
        break;
      case 'diffused':
        dx = 0;
        dy = 0;
        break;
    }
    
    const colorStr = config.mode === 'shadow' 
      ? `rgba(0, 0, 0, ${config.opacity / 100})`
      : hexToRgba(config.color || '#ffffff', config.opacity / 100);
      
    return `drop-shadow(${dx}px ${dy}px ${config.blur}px ${colorStr})`;
  };

  const getTextShadowStyle = (config: ShadowEffectConfig): string => {
    if (!config.enabled) return 'none';
    
    let dx = 0;
    let dy = 0;
    const dist = config.distance;
    
    switch (config.position) {
      case 'bottom-left':
        dx = -dist;
        dy = dist;
        break;
      case 'bottom-center':
        dx = 0;
        dy = dist;
        break;
      case 'bottom-right':
        dx = dist;
        dy = dist;
        break;
      case 'diffused':
        dx = 0;
        dy = 0;
        break;
    }
    
    const colorStr = config.mode === 'shadow' 
      ? `rgba(0, 0, 0, ${config.opacity / 100})`
      : hexToRgba(config.color || '#ffffff', config.opacity / 100);
      
    return `${dx}px ${dy}px ${config.blur}px ${colorStr}`;
  };

  // Form State
  const [formData, setFormData] = useState({
    imageId: '',
    resolutionRef: '1280',
    promptIA: '',
    imageColorFillEnabled: false,
    imageColorFillWalls: false,
    logo: true,
    logoSize: '',
    logoColorFill: '',
    logoColorFillEnabled: true,
    logoPrompt: '',
    logoPromptActive: false,
    logoX: '',
    logoY: '',
    text: true,
    textContent: ' VOTRE TEXTE ICI ',
    textFont: '',
    textSize: '',
    textAlign: 'CENTRE',
    textColorFill: '',
    textColorFillEnabled: true,
    textPrompt: '',
    textPromptActive: false,
    textX: '',
    textY: ''
  });

  // Reset storage image settings when imageId or rowNumber changes
  useEffect(() => {
    setStorageImgError(false);
    setStorageImgExt('png');
  }, [formData.imageId, rowNumber]);

  const handleFormChange = (key: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'logoColorFillEnabled' && !value) {
        updated.logoPromptActive = true;
        updated.logoPrompt = "Use logo exactly as supplied. Do not modify colors, aspect ratio, perspective, transparency, typography, or graphic elements. No effects, distortion, recoloring, rotation, or warping. Only position and uniform scale may be adjusted.";
      }
      return updated;
    });
  };

  // Preview Image Upload Handlers
  const handleBgUpload = (file: File) => {
    handleToggleFirebaseStorage(false); // Disable Firebase Storage automatic sync on manual upload
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewBg(result);
      try {
        localStorage.setItem('sheetsync_preview_bg', result);
      } catch (err) {
        console.warn('LocalStorage preview background storage failed', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewLogo(result);
      try {
        localStorage.setItem('sheetsync_preview_logo', result);
      } catch (err) {
        console.warn('LocalStorage preview logo storage failed', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVehicleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewVehicle(result);
      updateVehicleScale(70.3125);
      updateVehicleX(640);
      try {
        localStorage.setItem('sheetsync_preview_vehicle', result);
      } catch (err) {
        console.warn('LocalStorage preview vehicle storage failed', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetBg = () => {
    setPreviewBg(null);
    try {
      localStorage.removeItem('sheetsync_preview_bg');
    } catch {}
  };

  const handleResetLogo = () => {
    setPreviewLogo(null);
    try {
      localStorage.removeItem('sheetsync_preview_logo');
    } catch {}
  };

  const handleResetVehicle = () => {
    setPreviewVehicle(null);
    try {
      localStorage.removeItem('sheetsync_preview_vehicle');
    } catch {}
  };

  // Canvas Drag & Drop Repositioning Handlers (Percentage-based, compatible with responsive resizing)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    
    const currentRefRes = Math.max(1, Number(formData.resolutionRef) || 1280);
    const refX = Math.max(0, Math.min(currentRefRes, Math.round(pctX * currentRefRes)));
    const refY = Math.max(0, Math.min(currentRefRes, Math.round(pctY * currentRefRes)));

    if (dragTarget === 'logo') {
      setFormData(prev => ({
        ...prev,
        logoX: String(refX),
        logoY: String(refY)
      }));
    } else if (dragTarget === 'text') {
      setFormData(prev => ({
        ...prev,
        textX: String(refX),
        textY: String(refY)
      }));
    } else if (dragTarget === 'vehicle') {
      updateVehicleX(refX);
      updateVehicleY(refY);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragTarget || e.touches.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    
    const pctX = (touch.clientX - rect.left) / rect.width;
    const pctY = (touch.clientY - rect.top) / rect.height;
    
    const currentRefRes = Math.max(1, Number(formData.resolutionRef) || 1280);
    const refX = Math.max(0, Math.min(currentRefRes, Math.round(pctX * currentRefRes)));
    const refY = Math.max(0, Math.min(currentRefRes, Math.round(pctY * currentRefRes)));

    if (dragTarget === 'logo') {
      setFormData(prev => ({
        ...prev,
        logoX: String(refX),
        logoY: String(refY)
      }));
    } else if (dragTarget === 'text') {
      setFormData(prev => ({
        ...prev,
        textX: String(refX),
        textY: String(refY)
      }));
    } else if (dragTarget === 'vehicle') {
      updateVehicleX(refX);
      updateVehicleY(refY);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries({});
      return;
    }

    const q = query(
      collection(db, 'entries'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, Entry> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Entry;
      });
      setEntries(data);
    }, (error) => {
      triggerFirestoreError(error, OperationType.LIST, 'entries');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPromptsIa({});
      return;
    }

    const q = query(
      collection(db, 'prompts_ia'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, PromptIA> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as PromptIA;
      });
      setPromptsIa(data);
    }, (error) => {
      triggerFirestoreError(error, OperationType.LIST, 'prompts_ia');
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-select the first alphabetical prompt IA preset on initial load or deletion
  useEffect(() => {
    const keys = Object.keys(promptsIa).sort((a, b) => a.localeCompare(b));
    if (keys.length > 0) {
      if (!activePromptId || !promptsIa[activePromptId]) {
        setActivePromptId(keys[0]);
      }
    } else {
      if (activePromptId !== '') {
        setActivePromptId('');
      }
    }
  }, [promptsIa, activePromptId]);

  // Sync promptForm when activePromptId or its prompt data changes
  useEffect(() => {
    if (activePromptId && promptsIa[activePromptId]) {
      const p = promptsIa[activePromptId];
      setPromptForm({
        promptName: p.promptName || p.id || '',
        aPrompt: p.aPrompt || '',
        bPrompt: p.bPrompt || '',
        cPrompt: p.cPrompt || '',
        generalPrompt: p.generalPrompt || '',
        promptNegative: p.promptNegative || '',
      });
    } else {
      setPromptForm({
        promptName: '',
        aPrompt: '',
        bPrompt: '',
        cPrompt: '',
        generalPrompt: '',
        promptNegative: '',
      });
    }
  }, [activePromptId, promptsIa]);

  // Auto-select the first alphabetical entry on initial load or deletion
  useEffect(() => {
    const keys = Object.keys(entries).sort((a, b) => a.localeCompare(b));
    if (keys.length > 0) {
      if (!rowNumber || !entries[rowNumber]) {
        setRowNumber(keys[0]);
      }
    } else {
      if (rowNumber !== '') {
        setRowNumber('');
      }
    }
  }, [entries, rowNumber]);

  // Load form data when active preset changes
  useEffect(() => {
    if (rowNumber && entries[rowNumber]) {
      const entry = entries[rowNumber];
      const fallbackLogoPrompt = entry.logoPrompt !== undefined ? entry.logoPrompt : (entry.logoExtra !== undefined ? entry.logoExtra : (entry.imageExtra || ''));
      const fallbackLogoPromptActive = entry.logoPromptActive !== undefined 
        ? !!entry.logoPromptActive 
        : (fallbackLogoPrompt !== '');

      const fallbackTextPrompt = entry.textPrompt !== undefined ? entry.textPrompt : (entry.textExtra || '');
      const fallbackTextPromptActive = entry.textPromptActive !== undefined 
        ? !!entry.textPromptActive 
        : (fallbackTextPrompt !== '');

      setFormData({
        imageId: entry.imageId || '',
        resolutionRef: entry.resolutionRef || '1280',
        promptIA: entry.promptIA || '',
        imageColorFillEnabled: entry.imageColorFillEnabled !== undefined ? !!entry.imageColorFillEnabled : false,
        imageColorFillWalls: entry.imageColorFillWalls !== undefined ? !!entry.imageColorFillWalls : false,
        logo: !!entry.logo,
        logoSize: entry.logoSize !== undefined ? entry.logoSize : (entry.imageSize || ''),
        logoColorFill: entry.logoColorFill !== undefined ? entry.logoColorFill : (entry.imageColorFill || ''),
        logoColorFillEnabled: entry.logoColorFillEnabled !== undefined 
          ? !!entry.logoColorFillEnabled 
          : (entry.logoColorFill !== undefined ? entry.logoColorFill !== '' : (entry.imageColorFill !== undefined ? entry.imageColorFill !== '' : true)),
        logoPrompt: fallbackLogoPrompt,
        logoPromptActive: fallbackLogoPromptActive,
        logoX: entry.logoX || '',
        logoY: entry.logoY || '',
        text: entry.text !== undefined ? !!entry.text : (((entry as any).textEnabled) !== undefined ? !!((entry as any).textEnabled) : true),
        textContent: entry.textContent !== undefined ? entry.textContent : ' VOTRE TEXTE ICI ',
        textFont: entry.textFont || '',
        textSize: entry.textSize || '',
        textAlign: entry.textAlign || 'CENTRE',
        textColorFill: entry.textColorFill || '',
        textColorFillEnabled: entry.textColorFillEnabled !== undefined 
          ? !!entry.textColorFillEnabled 
          : (entry.textColorFill !== undefined ? entry.textColorFill !== '' : true),
        textPrompt: fallbackTextPrompt,
        textPromptActive: fallbackTextPromptActive,
        textX: entry.textX || '',
        textY: entry.textY || ''
      });
    } else {
      setFormData({
        imageId: '',
        resolutionRef: '1280',
        promptIA: '',
        imageColorFillEnabled: false,
        imageColorFillWalls: false,
        logo: true,
        logoSize: '',
        logoColorFill: '',
        logoColorFillEnabled: true,
        logoPrompt: '',
        logoPromptActive: false,
        logoX: '',
        logoY: '',
        text: true,
        textContent: ' VOTRE TEXTE ICI ',
        textFont: '',
        textSize: '',
        textAlign: 'CENTRE',
        textColorFill: '',
        textColorFillEnabled: true,
        textPrompt: '',
        textPromptActive: false,
        textX: '',
        textY: ''
      });
    }
  }, [rowNumber, entries]);

  // AUTO-SAVE LOGIC
  useEffect(() => {
    if (!user || !rowNumber || !entries[rowNumber]) return;
    if (syncMode === 'manual') return; // Do not auto-save in manual mode

    const saveTimeout = setTimeout(async () => {
      // Small check to see if data actually changed from what's in the entries
      const currentEntry = entries[rowNumber];
      const hasChanged = isEntryChanged(currentEntry, formData);

      if (!hasChanged) return;

      setIsSaving(true);
      try {
        await setDoc(doc(db, 'entries', rowNumber), {
          ...formData,
          imageId: rowNumber, // Force the field to match the document ID key
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Auto-save error:', error);
        triggerFirestoreError(error, OperationType.WRITE, `entries/${rowNumber}`);
      } finally {
        setTimeout(() => setIsSaving(false), 500); // Visual feedback duration
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(saveTimeout);
  }, [formData, user, rowNumber, entries, syncMode]);

  const handleManualSave = async () => {
    if (!user || !rowNumber) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'entries', rowNumber), {
        ...formData,
        imageId: rowNumber,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Manual save error:', error);
      triggerFirestoreError(error, OperationType.WRITE, 'entries');
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  // AUTO-SAVE LOGIC FOR PROMPTS
  useEffect(() => {
    if (!user || !activePromptId || !promptsIa[activePromptId]) return;
    if (syncMode === 'manual') return; // Do not auto-save in manual mode

    const saveTimeout = setTimeout(async () => {
      const currentPrompt = promptsIa[activePromptId];
      const hasChanged = isPromptChanged(currentPrompt, promptForm);

      if (!hasChanged) return;

      setIsSaving(true);
      try {
        await setDoc(doc(db, 'prompts_ia', activePromptId), {
          ...promptForm,
          promptName: activePromptId,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Auto-save prompt error:', error);
        triggerFirestoreError(error, OperationType.WRITE, `prompts_ia/${activePromptId}`);
      } finally {
        setTimeout(() => setIsSaving(false), 500);
      }
    }, 800);

    return () => clearTimeout(saveTimeout);
  }, [promptForm, user, activePromptId, promptsIa, syncMode]);

  const handleManualSavePrompt = async () => {
    if (!user || !activePromptId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'prompts_ia', activePromptId), {
        ...promptForm,
        promptName: activePromptId,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Manual save prompt error:', error);
      triggerFirestoreError(error, OperationType.WRITE, 'prompts_ia');
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handleFormChangePrompt = (key: string, value: string) => {
    setPromptForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCreatePromptPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newPromptName.trim();
    if (!cleanId) {
      setCreatePromptError('Veuillez entrer un ID de prompt.');
      return;
    }

    const validIdRegex = /^[a-zA-Z0-9_\- .()]+$/;
    if (!validIdRegex.test(cleanId)) {
      setCreatePromptError('Caractères permis : lettres, chiffres, tirets, underscores, espaces, points, parenthèses.');
      return;
    }

    if (promptsIa[cleanId]) {
      setCreatePromptError('Ce prompt existe déjà !');
      setActivePromptId(cleanId);
      return;
    }

    setCreatePromptError('');
    setIsSaving(true);
    try {
      // Find default values from "A blanc" prompt if it exists, or empty strings
      const basePreset = (Object.values(promptsIa) as PromptIA[]).find(
        (p) => p.promptName?.toLowerCase().trim() === 'a blanc'
      );

      const newPrompt = {
        promptName: cleanId,
        aPrompt: basePreset ? (basePreset.aPrompt ?? '') : '',
        bPrompt: basePreset ? (basePreset.bPrompt ?? '') : '',
        cPrompt: basePreset ? (basePreset.cPrompt ?? '') : '',
        generalPrompt: basePreset ? (basePreset.generalPrompt ?? '') : '',
        promptNegative: basePreset ? (basePreset.promptNegative ?? '') : '',
        userId: user!.uid,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'prompts_ia', cleanId), newPrompt);
      setActivePromptId(cleanId);
      setNewPromptName('');
    } catch (error) {
      console.error('Error creating prompt in Firestore:', error);
      setCreatePromptError('Erreur de création : ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePromptPreset = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'prompts_ia', id));
      if (activePromptId === id) {
        setActivePromptId('');
      }
    } catch (error) {
      console.error('Error deleting prompt preset:', error);
      triggerFirestoreError(error, OperationType.DELETE, `prompts_ia/${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newImageId.trim();
    if (!cleanId) {
      setCreateError('Veuillez entrer un ID d\'image.');
      return;
    }

    const validIdRegex = /^[a-zA-Z0-9_\- .()]+$/;
    if (!validIdRegex.test(cleanId)) {
      setCreateError('Caractères permis : lettres, chiffres, tirets, underscores, espaces, points, parenthèses.');
      return;
    }

    if (entries[cleanId]) {
      setCreateError('Ce preset d\'image existe déjà !');
      setRowNumber(cleanId);
      return;
    }

    setCreateError('');
    setIsSaving(true);
    try {
      // Find default values from "A blanc" preset if it exists
      const basePreset = (Object.values(entries) as Entry[]).find(
        (entry) => entry.imageId?.toLowerCase().trim() === 'a blanc'
      );

      const baseLogoPrompt = basePreset ? (basePreset.logoPrompt ?? basePreset.logoExtra ?? basePreset.imageExtra ?? '') : '';
      const baseLogoPromptActive = basePreset ? (basePreset.logoPromptActive ?? (baseLogoPrompt !== '')) : false;
      const baseTextPrompt = basePreset ? (basePreset.textPrompt ?? basePreset.textExtra ?? '') : '';
      const baseTextPromptActive = basePreset ? (basePreset.textPromptActive ?? (baseTextPrompt !== '')) : false;

      const newPreset = {
        imageId: cleanId,
        resolutionRef: basePreset ? (basePreset.resolutionRef ?? '1280') : '1280',
        promptIA: basePreset ? (basePreset.promptIA ?? '') : '',
        logo: basePreset ? (basePreset.logo ?? true) : true,
        logoSize: basePreset ? (basePreset.logoSize ?? basePreset.imageSize ?? '150') : '150',
        logoColorFill: basePreset ? (basePreset.logoColorFill ?? basePreset.imageColorFill ?? '#ffffff') : '#ffffff',
        logoColorFillEnabled: basePreset ? (basePreset.logoColorFillEnabled !== undefined ? !!basePreset.logoColorFillEnabled : (basePreset.logoColorFill ? basePreset.logoColorFill !== '' : true)) : true,
        logoPrompt: baseLogoPrompt,
        logoPromptActive: baseLogoPromptActive,
        logoX: basePreset ? (basePreset.logoX ?? '512') : '512',
        logoY: basePreset ? (basePreset.logoY ?? '100') : '100',
        text: basePreset ? (basePreset.text !== undefined ? basePreset.text : (((basePreset as any).textEnabled) ?? true)) : true,
        textContent: basePreset ? (basePreset.textContent ?? ' VOTRE TEXTE ICI ') : ' VOTRE TEXTE ICI ',
        textFont: basePreset ? (basePreset.textFont ?? 'Inter') : 'Inter',
        textSize: basePreset ? (basePreset.textSize ?? '32') : '32',
        textAlign: basePreset ? (basePreset.textAlign ?? 'CENTRE') : 'CENTRE',
        textColorFill: basePreset ? (basePreset.textColorFill ?? '#ffffff') : '#ffffff',
        textPrompt: baseTextPrompt,
        textPromptActive: baseTextPromptActive,
        textX: basePreset ? (basePreset.textX ?? '512') : '512',
        textY: basePreset ? (basePreset.textY ?? '400') : '400',
        userId: user!.uid,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'entries', cleanId), newPreset);
      setRowNumber(cleanId);
      setNewImageId('');
    } catch (error) {
      console.error('Error creating preset in Firestore:', error);
      setCreateError('Erreur de création : ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (activeModule === 'prompts_ia') {
      const headers = [
        'Row', 'Prompt Name', 'aPrompt', 'bPrompt', 'cPrompt', 'generalPrompt', 'promptNegative'
      ];
      const sortedKeys = Object.keys(promptsIa).sort((a, b) => a.localeCompare(b));
      const rows = sortedKeys.map((id, index) => {
        const p = promptsIa[id];
        const displayIndex = (index + 1).toString().padStart(2, '0');
        return [
          displayIndex,
          p.promptName || id,
          p.aPrompt || '',
          p.bPrompt || '',
          p.cPrompt || '',
          p.generalPrompt || '',
          p.promptNegative || '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Dataset_Prompts_IA_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = [
      'Row', 'Image ID', 'Prompt IA', 'Resolution Ref', 'Logo', 'Taille', 'Logo X', 'Logo Y', 'Color Fill', 'Color Fill Active', 
      'Logo Prompt IA', 'Logo Prompt IA Active', 'Text', 'Text Content', 'Police', 'Text Taille', 'Text Alignement', 
      'Text X', 'Text Y', 'Text Color', 'Text Color Active', 'Text Prompt IA Active', 'Text Prompt IA'
    ];
    const rows = visibleRows.map((id, index) => {
      const e = entries[id];
      const displayIndex = (index + 1).toString().padStart(2, '0');
      const textVal = e?.text !== undefined ? e.text : (e as any)?.textEnabled;
      const lp = e?.logoPrompt !== undefined ? e.logoPrompt : (e?.logoExtra !== undefined ? e.logoExtra : (e?.imageExtra || ''));
      const lpa = e?.logoPromptActive !== undefined ? !!e.logoPromptActive : (lp !== '');
      const tp = e?.textPrompt !== undefined ? e.textPrompt : (e?.textExtra || '');
      const tpa = e?.textPromptActive !== undefined ? !!e.textPromptActive : (tp !== '');

      return [
        displayIndex,
        e?.imageId || '',
        e?.promptIA || '',
        e?.resolutionRef || '1280',
        e?.logo ? 'TRUE' : 'FALSE',
        e?.logoSize !== undefined ? e.logoSize : (e?.imageSize || ''),
        e?.logoX || '',
        e?.logoY || '',
        e?.logoColorFill !== undefined ? e.logoColorFill : (e?.imageColorFill || ''),
        e?.logoColorFillEnabled !== undefined ? (e.logoColorFillEnabled ? 'TRUE' : 'FALSE') : (e?.logoColorFill ? 'TRUE' : 'FALSE'),
        lpa ? lp : '',
        lpa ? 'TRUE' : 'FALSE',
        textVal ? 'TRUE' : 'FALSE',
        e?.textContent || '',
        e?.textFont || '',
        e?.textSize || '',
        e?.textAlign || 'CENTRE',
        e?.textX || '',
        e?.textY || '',
        e?.textColorFill || '',
        e?.textColorFillEnabled !== undefined ? (e.textColorFillEnabled ? 'TRUE' : 'FALSE') : (e?.textColorFill ? 'TRUE' : 'FALSE'),
        tpa ? 'TRUE' : 'FALSE',
        tpa ? tp : ''
      ].map(v => `"${v}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sheet_sync_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): string[][] => {
    // Detect delimiter dynamically: count semicolons vs commas in the first non-empty line
    const lines = text.split(/\r?\n/);
    const firstNonEmptyLine = lines.find(l => l.trim().length > 0) || '';
    const commaCount = (firstNonEmptyLine.match(/,/g) || []).length;
    const semicolonCount = (firstNonEmptyLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const result: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current);
        current = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(current);
        result.push(row);
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
    if (row.length > 0 || current !== '') {
      row.push(current);
      result.push(row);
    }
    return result;
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsImportingCSV(true);
    setCsvImportSuccess(null);
    setCsvImportError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error("Impossible de lire le fichier.");
        }

        const parsedRows = parseCSV(text);
        if (parsedRows.length <= 1) {
          throw new Error("Le fichier CSV est vide ou invalide.");
        }

        // Clean cells and remove trailing/leading double quotes
        const cleanCellVal = (v: string | undefined): string => {
          if (!v) return '';
          let cv = v.trim();
          if (cv.startsWith('"') && cv.endsWith('"')) {
            cv = cv.substring(1, cv.length - 1);
          }
          return cv.trim();
        };

        const headers = parsedRows[0].map(h => cleanCellVal(h).toLowerCase());
        
        const findIndex = (possibleNames: string[]): number => {
          const cleanedPossible = possibleNames.map(p => p.trim().toLowerCase());
          
          // Phase 1: Robust Exact Match
          let index = headers.findIndex(h => cleanedPossible.includes(h.trim().toLowerCase()));
          if (index !== -1) return index;

          // Phase 2: Exact Match with alphanumeric cleaning (ignores spaces and dashes)
          index = headers.findIndex(h => {
            const hc = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanedPossible.some(p => p.replace(/[^a-z0-9]/g, '') === hc);
          });
          if (index !== -1) return index;

          // Phase 3: Word boundaries check to prevent wrong mapping (like finding 'logo' in 'logo size')
          index = headers.findIndex(h => {
            const hVal = h.trim().toLowerCase();
            return cleanedPossible.some(p => {
              const regex = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
              return regex.test(hVal);
            });
          });
          if (index !== -1) return index;

          // Phase 4: Fallback includes
          return headers.findIndex(h => cleanedPossible.some(p => h.trim().toLowerCase().includes(p)));
        };

        const isPromptsCSV = headers.includes('prompt name') || headers.includes('prompt_name') || headers.includes('promptname') || headers.includes('aprompt') || headers.includes('promptimagea');

        if (isPromptsCSV) {
          const nameIdx = findIndex(['prompt name', 'prompt_name', 'promptname', 'id_prompt', 'preset', 'name']);
          const imageAIdx = findIndex(['aprompt', 'promptimagea', 'arriere-plan (image a)', 'image_a', 'imagea', 'background', 'background prompt']);
          const imageBIdx = findIndex(['bprompt', 'promptimageb', 'vehicule (image b)', 'image_b', 'imageb', 'vehicle', 'vehicle prompt']);
          const imageCIdx = findIndex(['cprompt', 'promptimagec', 'composition guide (image c)', 'composition (image c - jpg)', 'image_c', 'imagec', 'composition', 'composition prompt']);
          const generalIdx = findIndex(['generalprompt', 'promptgeneral', 'prompt general commun', 'prompt general', 'general', 'commun', 'general prompt']);
          const negativeIdx = findIndex(['promptnegative', 'prompt_negative', 'negativeprompt', 'negative', 'negatif', 'prompt negatif']);

          let importedCount = 0;
          for (let i = 1; i < parsedRows.length; i++) {
            const row = parsedRows[i];
            if (row.length === 0 || (row.length === 1 && cleanCellVal(row[0]) === '')) continue;
            if (row.every(cell => !cell || cleanCellVal(cell) === '')) continue;

            const baseName = nameIdx !== -1 ? cleanCellVal(row[nameIdx]) : '';
            const cleanId = baseName || `Prompt_${i.toString().padStart(2, '0')}`;
            const aPrompt = imageAIdx !== -1 ? cleanCellVal(row[imageAIdx]) : '';
            const bPrompt = imageBIdx !== -1 ? cleanCellVal(row[imageBIdx]) : '';
            const cPrompt = imageCIdx !== -1 ? cleanCellVal(row[imageCIdx]) : '';
            const generalPrompt = generalIdx !== -1 ? cleanCellVal(row[generalIdx]) : '';
            const promptNegative = negativeIdx !== -1 ? cleanCellVal(row[negativeIdx]) : '';

            const newPrompt = {
              promptName: cleanId,
              aPrompt,
              bPrompt,
              cPrompt,
              generalPrompt,
              promptNegative,
              userId: user.uid,
              createdAt: serverTimestamp()
            };

            await setDoc(doc(db, 'prompts_ia', cleanId), newPrompt);
            importedCount++;
          }
          setCsvImportSuccess(`Félicitations ! Les ${importedCount} prompts IA ont été importés et enregistrés avec succès.`);
          setTimeout(() => setCsvImportSuccess(null), 8000);
          setIsImportingCSV(false);
          return;
        }

        // Header mappings
        const rowIdx = findIndex(['row', 'num', 'ligne']);
        const imageIdIdx = findIndex(['image id', 'imageid', 'id_image', 'id_photo']);
        const resolutionIdx = findIndex(['resolution ref', 'resolutionref', 'resolution', 'ref_res']);
        const logoIdx = findIndex(['logo']);
        const sizeIdx = findIndex(['taille', 'logo size', 'logosize', 'dim_logo']);
        const logoXIdx = findIndex(['logo x', 'logox']);
        const logoYIdx = findIndex(['logo y', 'logoy']);
        const colorValIdx = findIndex(['color fill', 'color_fill', 'couleur_logo', 'logo color fill']);
        const colorActiveIdx = findIndex(['color fill active', 'color_fill_active', 'couleur_active']);
        const logoPromptIdx = findIndex(['logo prompt ia', 'logoprompt', 'prompt_logo']);
        const logoPromptActiveIdx = findIndex(['logo prompt ia active', 'logopromptactive', 'prompt_logo_active']);
        const textIdx = findIndex(['text', 'texte']);
        const textContentIdx = findIndex(['text content', 'textcontent', 'contenu_texte', 'texte_content']);
        const policeIdx = findIndex(['police', 'text font', 'textfont', 'font']);
        const textSizeIdx = findIndex(['text taille', 'textsize', 'taille_texte', 'text_size']);
        const textAlignIdx = findIndex(['text alignement', 'textalign', 'alignement_texte', 'align']);
        const textXIdx = findIndex(['text x', 'textx']);
        const textYIdx = findIndex(['text y', 'texty']);
        const textColorIdx = findIndex(['text color', 'textcolor', 'couleur_texte', 'text_color']);
        const textColorActiveIdx = findIndex(['text color active', 'textcoloractive', 'text_color_active', 'couleur_texte_active']);
        const textPromptActiveIdx = findIndex(['text prompt ia active', 'textpromptactive', 'prompt_texte_active']);
        const textPromptIdx = findIndex(['text prompt ia', 'textprompt', 'prompt_texte']);
        const promptIAIdx = findIndex(['prompt ia', 'prompt_ia', 'promptia']);

        let importedCount = 0;
        let errorsFound = 0;
        const errorDetails: string[] = [];

        // Loop through data rows (skip index 0 as it's the header)
        for (let i = 1; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          if (row.length === 0 || (row.length === 1 && cleanCellVal(row[0]) === '')) {
            continue;
          }

          // Skip completely empty lines
          const isRowEmpty = row.every(cell => !cell || cleanCellVal(cell) === '');
          if (isRowEmpty) {
            continue;
          }

          // Retrieve and clean values
          const rawRow = rowIdx !== -1 ? row[rowIdx] : row[0];
          const cleanId = cleanCellVal(rawRow).padStart(2, '0') || i.toString().padStart(2, '0');
          const imageId = cleanCellVal(imageIdIdx !== -1 ? row[imageIdIdx] : row[1]) || `IMG-${cleanId}`;
          const resolutionRef = cleanCellVal(resolutionIdx !== -1 ? row[resolutionIdx] : row[2]) || '1280';
          
          const rawLogo = logoIdx !== -1 ? row[logoIdx] : row[3];
          const logo = rawLogo ? cleanCellVal(rawLogo).toUpperCase() === 'TRUE' : true;
          
          const logoSize = cleanCellVal(sizeIdx !== -1 ? row[sizeIdx] : row[4]) || '200';
          const logoX = cleanCellVal(logoXIdx !== -1 ? row[logoXIdx] : row[5]) || '512';
          const logoY = cleanCellVal(logoYIdx !== -1 ? row[logoYIdx] : row[6]) || '100';
          
          const logoColorFill = cleanCellVal(colorValIdx !== -1 ? row[colorValIdx] : row[7]);
          
          const rawColorActive = colorActiveIdx !== -1 ? row[colorActiveIdx] : row[8];
          const logoColorFillEnabled = rawColorActive ? cleanCellVal(rawColorActive).toUpperCase() === 'TRUE' : (logoColorFill !== '');
          
          const logoPrompt = cleanCellVal(logoPromptIdx !== -1 ? row[logoPromptIdx] : row[9]);
          
          const rawLogoPromptActive = logoPromptActiveIdx !== -1 ? row[logoPromptActiveIdx] : row[10];
          const logoPromptActive = rawLogoPromptActive ? cleanCellVal(rawLogoPromptActive).toUpperCase() === 'TRUE' : (logoPrompt !== '');

          const rawText = textIdx !== -1 ? row[textIdx] : row[11];
          const text = rawText ? cleanCellVal(rawText).toUpperCase() === 'TRUE' : true;

          const textContent = cleanCellVal(textContentIdx !== -1 ? row[textContentIdx] : row[12]) || ' VOTRE TEXTE ICI ';
          const textFont = cleanCellVal(policeIdx !== -1 ? row[policeIdx] : row[13]) || 'Inter';
          const textSize = cleanCellVal(textSizeIdx !== -1 ? row[textSizeIdx] : row[14]) || '32';
          const textAlign = cleanCellVal(textAlignIdx !== -1 ? row[textAlignIdx] : row[15]) || 'CENTRE';
          const textX = cleanCellVal(textXIdx !== -1 ? row[textXIdx] : row[16]) || '512';
          const textY = cleanCellVal(textYIdx !== -1 ? row[textYIdx] : row[17]) || '400';
          const textColorFill = cleanCellVal(textColorIdx !== -1 ? row[textColorIdx] : row[18]) || '#ffffff';
          
          const rawTextColorActive = textColorActiveIdx !== -1 ? row[textColorActiveIdx] : undefined;
          const textColorFillEnabled = rawTextColorActive ? cleanCellVal(rawTextColorActive).toUpperCase() === 'TRUE' : (textColorFill !== '');

          const rawTextPromptActive = textPromptActiveIdx !== -1 ? row[textPromptActiveIdx] : row[19];
          const textPromptActive = rawTextPromptActive ? cleanCellVal(rawTextPromptActive).toUpperCase() === 'TRUE' : false;
          
          const textPrompt = cleanCellVal(textPromptIdx !== -1 ? row[textPromptIdx] : row[20]);
          const promptIA = promptIAIdx !== -1 ? cleanCellVal(row[promptIAIdx]) : '';

          const newPreset = {
            id: cleanId,
            imageId,
            resolutionRef,
            promptIA: promptIA || '',
            logo,
            logoSize,
            logoX,
            logoY,
            logoColorFill,
            logoColorFillEnabled,
            logoPrompt,
            logoPromptActive,
            text,
            textContent,
            textFont,
            textSize,
            textAlign,
            textX,
            textY,
            textColorFill,
            textColorFillEnabled,
            textPromptActive,
            textPrompt,
            userId: user.uid,
            createdAt: serverTimestamp()
          };

          try {
            await setDoc(doc(db, 'entries', cleanId), newPreset);
            importedCount++;
          } catch (rowErr: any) {
            console.error(`Erreur d'écriture pour la ligne ID ${cleanId}:`, rowErr);
            errorsFound++;
            errorDetails.push(`Ligne ${cleanId}: ${rowErr?.message || String(rowErr)}`);
          }
        }

        if (errorsFound > 0) {
          setCsvImportSuccess(null);
          setCsvImportError(`Importation partielle : ${importedCount} réussies, ${errorsFound} échecs. Détails : ${errorDetails.join(' | ')}`);
        } else {
          setCsvImportSuccess(`Félicitations ! Les ${importedCount} lignes du dataset CSV ont été correctement importées et enregistrées.`);
        }
        setTimeout(() => setCsvImportSuccess(null), 8000);
      } catch (err) {
        console.error("Erreur lors de l'importation du CSV:", err);
        setCsvImportError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsImportingCSV(false);
        if (event.target) {
          event.target.value = '';
        }
      }
    };

    reader.onerror = () => {
      setCsvImportError("Une erreur s'est produite lors de la lecture du fichier.");
      setIsImportingCSV(false);
    };

    reader.readAsText(file);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'entries', id));
    } catch (error) {
      triggerFirestoreError(error, OperationType.DELETE, `entries/${id}`);
    }
  };

  const handlePushAll = async () => {
    if (!user || Object.keys(entries).length === 0) return;
    setIsSyncingAll(true);
    setSyncAllSuccess(null);
    try {
      const keys = Object.keys(entries);
      let successCount = 0;
      for (const key of keys) {
        const e = entries[key];
        const textVal = e.text !== undefined ? !!e.text : (((e as any).textEnabled) !== undefined ? !!((e as any).textEnabled) : true);
        const fallbackLogoPrompt = e.logoPrompt !== undefined ? e.logoPrompt : (e.logoExtra !== undefined ? e.logoExtra : (e.imageExtra || ''));
        const fallbackLogoPromptActive = e.logoPromptActive !== undefined ? !!e.logoPromptActive : (fallbackLogoPrompt !== '');
        const fallbackTextPrompt = e.textPrompt !== undefined ? e.textPrompt : (e.textExtra || '');
        const fallbackTextPromptActive = e.textPromptActive !== undefined ? !!e.textPromptActive : (fallbackTextPrompt !== '');

        const mappedDoc = {
          imageId: e.imageId || key,
          resolutionRef: e.resolutionRef || '1280',
          promptIA: e.promptIA || '',
          logo: e.logo !== undefined ? !!e.logo : true,
          logoSize: e.logoSize !== undefined ? e.logoSize : (e.imageSize || '150'),
          logoColorFill: e.logoColorFill !== undefined ? e.logoColorFill : (e.imageColorFill || '#ffffff'),
          logoColorFillEnabled: e.logoColorFillEnabled !== undefined ? !!e.logoColorFillEnabled : (e.logoColorFill ? e.logoColorFill !== '' : true),
          logoPrompt: fallbackLogoPrompt,
          logoPromptActive: fallbackLogoPromptActive,
          logoX: (e.logoX !== undefined && e.logoX !== '') ? e.logoX : '512',
          logoY: (e.logoY !== undefined && e.logoY !== '') ? e.logoY : '100',
          text: textVal,
          textContent: e.textContent !== undefined ? e.textContent : ' VOTRE TEXTE ICI ',
          textFont: e.textFont || 'Inter',
          textSize: e.textSize || '32',
          textAlign: e.textAlign || 'CENTRE',
          textColorFill: e.textColorFill || '#ffffff',
          textColorFillEnabled: e.textColorFillEnabled !== undefined ? !!e.textColorFillEnabled : (e.textColorFill ? e.textColorFill !== '' : true),
          textPrompt: fallbackTextPrompt,
          textPromptActive: fallbackTextPromptActive,
          textX: (e.textX !== undefined && e.textX !== '') ? e.textX : '512',
          textY: (e.textY !== undefined && e.textY !== '') ? e.textY : '400',
          userId: e.userId || user.uid,
          createdAt: e.createdAt || serverTimestamp()
        };
        await setDoc(doc(db, 'entries', key), mappedDoc);
        successCount++;
      }
      setSyncAllSuccess(`Félicitations ! Les ${successCount} documents ont été normalisés et mis à jour avec le nouveau schéma dans Firestore.`);
      setTimeout(() => setSyncAllSuccess(null), 8000); // Clear after 8 seconds
    } catch (error) {
      console.error('Error synchronizing all presets:', error);
      triggerFirestoreError(error, OperationType.WRITE, 'entries_bulk_sync');
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans font-medium text-slate-400 animate-pulse">
        Initializing Workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-lg">
              SS
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">SheetSync Pro</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Experience high-fidelity remote data synchronization with your shared cloud database.
            </p>
          </div>
          
          <button
            onClick={signIn}
            className="w-full bg-slate-900 text-white py-4 px-6 rounded-xl flex items-center justify-center gap-3 group hover:bg-slate-800 transition-all shadow-md hover:shadow-lg"
          >
            <span className="font-semibold tracking-tight text-sm">Connect with Google Access</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          
          <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Secured via SOC-2 Firestore Protocol
          </div>
        </motion.div>
      </div>
    );
  }

  const getEntryTime = (id: string): number => {
    const entry = entries[id];
    if (!entry) return 0;
    const ca = entry.createdAt;
    if (!ca) return 0;
    if (typeof ca.toMillis === 'function') return ca.toMillis();
    if (typeof ca.toDate === 'function') return ca.toDate().getTime();
    if (ca.seconds) return ca.seconds * 1000 + (ca.nanoseconds || 0) / 1000000;
    const parsed = Date.parse(String(ca));
    return isNaN(parsed) ? 0 : parsed;
  };

  const visibleRows = Object.keys(entries).sort((a, b) => {
    if (sortBy === 'date') {
      const timeA = getEntryTime(a);
      const timeB = getEntryTime(b);
      return timeB - timeA; // Plus récent en premier
    }
    return a.localeCompare(b);
  });

  const refRes = Math.max(1, Number(formData.resolutionRef) || 1280);

  // Vehicle rendering properties calculated exactly as in the specification blueprint
  const vehicleProps = (() => {
    const resolutionRef = refRes;
    const virtualContainerSize = 960;
    const targetVehicleWidth = 900;
    const wOrig = vehicleOrigWidth || 1920;
    const hOrig = vehicleOrigHeight || 1080;
    const aspectVehicle = wOrig / hOrig;

    let initialWidthIn960 = 0;
    let initialHeightIn960 = 0;

    if (aspectVehicle > 1) {
      initialWidthIn960 = virtualContainerSize;
      initialHeightIn960 = virtualContainerSize / aspectVehicle;
    } else {
      initialWidthIn960 = virtualContainerSize * aspectVehicle;
      initialHeightIn960 = virtualContainerSize;
    }

    const boundingBoxWidthRatio = 1.0; // Default full bounding box
    const activeWidthNoScale = initialWidthIn960 * boundingBoxWidthRatio;
    const scaleBase = activeWidthNoScale > 0 ? (targetVehicleWidth / activeWidthNoScale) : 1.0;
    const scaleUser = vehicleScale / 100;
    const baselineScale = 1.0;
    const scaleTotal = scaleUser * baselineScale * scaleBase;

    const widthPercent = (initialWidthIn960 * scaleTotal) / resolutionRef * 100;
    const heightPercent = (initialHeightIn960 * scaleTotal) / resolutionRef * 100;

    return {
      width: `${widthPercent}%`,
      height: `${heightPercent}%`
    };
  })();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">SP</div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">SheetSync Pro</h1>
          <div className="h-4 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>
          <button 
            onClick={handleExport}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full transition-all border border-slate-100"
          >
            <Database className="w-3 h-3" />
            Exporter Dataset (CSV)
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            accept=".csv" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImportingCSV}
            className={`text-xs font-bold flex items-center gap-2 px-3 py-1 rounded-full transition-all border ${
              isImportingCSV 
                ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse cursor-not-allowed'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-900 active:scale-95 shadow-sm'
            }`}
            title="Importer un dataset à partir d'un fichier CSV exporté"
          >
            <Upload className="w-3 h-3" />
            {isImportingCSV ? 'Import en cours...' : 'Importer Dataset (CSV)'}
          </button>
          <button 
            onClick={handlePushAll}
            disabled={isSyncingAll || Object.keys(entries).length === 0}
            className={`text-xs font-bold flex items-center gap-2 px-3 py-1 rounded-full transition-all border ${
              isSyncingAll 
                ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse cursor-not-allowed' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 active:scale-95 shadow-sm'
            }`}
            title="Normaliser et pousser tous les presets locaux de la liste vers Firestore"
          >
            <Upload className="w-3 h-3" />
            {isSyncingAll ? 'Synchronisation...' : 'Normaliser & Tout Pousser'}
          </button>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Synchronisation Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => handleSyncModeChange('auto')}
              className={`px-2.5 py-1 rounded-md transition-all ${syncMode === 'auto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Sauvegarde automatique en continu"
            >
              🔄 AUTO (LIVE)
            </button>
            <button
              type="button"
              onClick={() => handleSyncModeChange('manual')}
              className={`px-2.5 py-1 rounded-md transition-all ${syncMode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Sauvegarde manuelle à la demande"
            >
              ☁️ PUSH (MANUEL)
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${isSaving ? 'bg-orange-400 animate-ping' : syncMode === 'auto' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isSaving ? 'Sinc...' : syncMode === 'auto' ? 'Live Connected' : 'Push Ready'}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-slate-700">{user.email?.split('@')[0]}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Verified</span>
            </div>
            <button 
              onClick={logOut}
              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
              title="Terminate Connection"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-6 lg:p-10 gap-8 overflow-hidden xl:h-[calc(100vh-64px)] xl:p-8">
        {syncAllSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-emerald-100 rounded-lg text-emerald-700 font-bold text-xs shrink-0 select-none">✅</span>
              <p className="text-xs font-semibold leading-relaxed">
                {syncAllSuccess}
              </p>
            </div>
            <button 
              onClick={() => setSyncAllSuccess(null)}
              className="text-xs font-bold text-emerald-500 hover:text-emerald-800 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
        {csvImportSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-emerald-100 rounded-lg text-emerald-700 font-bold text-xs shrink-0 select-none">✅</span>
              <p className="text-xs font-semibold leading-relaxed">
                {csvImportSuccess}
              </p>
            </div>
            <button 
              onClick={() => setCsvImportSuccess(null)}
              className="text-xs font-bold text-emerald-500 hover:text-emerald-800 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
        {csvImportError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-red-100 rounded-lg text-red-700 font-bold text-xs shrink-0 select-none">⚠️</span>
              <p className="text-xs font-semibold leading-relaxed">
                {csvImportError}
              </p>
            </div>
            <button 
              onClick={() => setCsvImportError(null)}
              className="text-xs font-bold text-red-500 hover:text-red-800 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
        {firestoreError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 animate-fade-in shrink-0 shadow-sm max-h-[80vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-amber-100 rounded-lg text-amber-700 font-bold text-xs shrink-0 select-none">⚠️</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Accès restreint aux données Firestore (Sécurité / Permissions)
                </h4>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Votre base de données Firebase a retourné une erreur d'autorisation de type <strong className="font-mono">{firestoreError.operationType}</strong> sur le chemin <strong className="font-mono">{firestoreError.path}</strong>. 
                  Cela arrive si vos règles de sécurité de console Firebase n'ont pas encore été configurées.
                </p>
                <div className="text-[10px] text-amber-800/80 leading-normal pt-2">
                  <div className="font-semibold mb-1 uppercase tracking-tight">👉 Comment appliquer l'Option A (Règles Firestore ouvertes) :</div>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Rendez-vous sur votre <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-amber-950">Console Firebase</a>.</li>
                    <li>Sélectionnez votre projet, allez dans <strong>Firestore Database</strong> puis l'onglet <strong>Rules</strong> (Règles).</li>
                    <li>Remplacez le bloc <code className="bg-amber-100/60 px-1 rounded font-mono font-semibold">match /entries/&#123;entryId&#125;</code> par : 
                      <pre className="mt-1.5 p-2 bg-slate-900 text-slate-100 rounded-md font-mono text-[9px] overflow-x-auto text-left select-all leading-relaxed whitespace-pre font-medium max-w-xl">
{`match /entries/{entryId} {
  allow read, write: if true;
}`}
                      </pre>
                    </li>
                    <li>Cliquez sur <strong>Publish</strong> (Publier) dans votre console Firebase. Et voilà, les erreurs disparaîtront instantanément !</li>
                  </ol>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setFirestoreError(null)}
              className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 active:scale-95 text-[10px] font-black text-amber-900 select-none transition-all cursor-pointer border border-amber-300 shrink-0 self-start mt-1"
            >
              IGNORER ET FERMER
            </button>
          </div>
        )}

        {/* Module Navigation Toggle */}
        <div className="flex bg-slate-250/70 p-1 bg-slate-200/50 rounded-xl border border-slate-200 self-start text-xs font-bold gap-1 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('entries')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-bold cursor-pointer ${
              activeModule === 'entries' 
                ? 'bg-slate-900 text-white shadow-sm font-extrabold' 
                : 'text-slate-650 hover:text-slate-950 font-semibold text-slate-500'
            }`}
          >
            📋 CONFIGS BRANDING
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('prompts_ia')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-bold cursor-pointer ${
              activeModule === 'prompts_ia' 
                ? 'bg-slate-900 text-white shadow-sm font-extrabold' 
                : 'text-slate-650 hover:text-slate-950 font-semibold text-slate-500'
            }`}
          >
            🤖 PROMPTS IA PRESETS
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-12 h-full overflow-hidden">
          {/* Input Sidebar */}
          <section className="flex flex-col shrink-0 xl:h-full xl:overflow-hidden">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-140px)] xl:max-h-full xl:h-full scrollbar-hide">
              {activeModule === 'entries' ? (
                <div className="space-y-6">
                {/* 1. Add Image Preset Widget */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                    Créer un Preset Image
                  </label>
                  <form onSubmit={handleCreatePreset} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: ARCHI 01.jpg"
                      value={newImageId}
                      onChange={e => setNewImageId(e.target.value)}
                      className="flex-grow min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      className="px-3 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                    >
                      Ajouter
                    </button>
                  </form>
                  {createError && (
                    <p className="text-[10px] text-red-500 font-semibold leading-relaxed animate-pulse">{createError}</p>
                  )}
                </div>

                {/* 2. Active Image Display */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between px-1">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Preset Sélectionné
                    </span>
                    <span className="text-[9px] text-slate-400/80 font-normal italic">cliquez pour changer de preset</span>
                  </label>
                  
                  {/* The Black Box Trigger button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(!isDropdownOpen);
                      setPresetSearchQuery(''); // Reset search when toggling
                    }}
                    className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono flex items-center justify-between shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all border border-slate-800/50 cursor-pointer select-none"
                  >
                    <span className="truncate max-w-[200px] text-left font-bold text-slate-100" title={rowNumber || 'Aucun preset'}>
                      {rowNumber ? `${rowNumber}` : 'Aucun preset'}
                    </span>
                    <div className="flex items-center gap-1 px-1 shrink-0">
                      {rowNumber && (
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded font-black tracking-widest uppercase text-center scale-90">
                          Active
                        </span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Dropdown Popover */}
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <>
                        {/* Invisible click backdrop to close click-outside */}
                        <div 
                          className="fixed inset-0 z-40 bg-transparent" 
                          onClick={() => setIsDropdownOpen(false)} 
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[300px]"
                        >
                          {/* Search Input Box */}
                          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 sticky top-0 z-10">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                            <input
                              type="text"
                              placeholder="Rechercher... (ex: AB, SP, etc.)"
                              value={presetSearchQuery}
                              onChange={(e) => setPresetSearchQuery(e.target.value)}
                              autoFocus
                              className="w-full bg-transparent border-none text-xs text-slate-800 placeholder:text-slate-400 font-medium outline-none h-7"
                            />
                            {presetSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setPresetSearchQuery('')}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* List Items of Presets */}
                          <div className="overflow-y-auto scrollbar-thin divide-y divide-slate-50 bg-white max-h-[220px]">
                            {(() => {
                              const filtered = visibleRows.filter(id => 
                                id.toLowerCase().includes(presetSearchQuery.toLowerCase())
                              );

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-4 text-center text-[11px] text-slate-400 italic">
                                    Aucun preset ne correspond à "{presetSearchQuery}"
                                  </div>
                                );
                              }

                              return filtered.map((id) => {
                                const isSelected = rowNumber === id;
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => {
                                      setRowNumber(id);
                                      setIsDropdownOpen(false);
                                      setPresetSearchQuery('');
                                    }}
                                    className={`w-full text-left px-3.5 py-2.5 text-xs font-mono transition-all flex items-center justify-between group ${isSelected ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                  >
                                    <span className="truncate pr-2 font-semibold">
                                      {id}
                                    </span>
                                    {isSelected ? (
                                      <span className="text-[8px] bg-indigo-500 text-white font-black px-1.5 py-0.5 rounded uppercase">
                                        Courant
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 group-hover:text-slate-600 transition-colors font-sans font-bold">
                                        Sélectionner
                                      </span>
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {rowNumber && (
                    <div className="flex gap-2.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Copy all settings except imageId
                          const { imageId, ...settingsToCopy } = formData;
                          setCopiedSettings(settingsToCopy);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className={`flex-1 py-1.5 px-3 border rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${copySuccess ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        title="Copier les paramètres de ce preset"
                      >
                        {copySuccess ? 'Copié !' : 'Copier TOUT'}
                      </button>
                      <button
                        type="button"
                        disabled={!copiedSettings}
                        onClick={() => {
                          if (copiedSettings) {
                            setFormData(prev => ({
                              ...prev,
                              ...copiedSettings
                            }));
                          }
                        }}
                        className={`flex-1 py-1.5 px-3 border rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${copiedSettings ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600 cursor-pointer' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                        title={copiedSettings ? 'Coller les paramètres copiés sur ce preset' : 'Aucun paramètre dans le presse-papiers'}
                      >
                        Coller TOUT
                      </button>
                    </div>
                  )}
                  {copiedSettings && (
                    <p className="text-[9px] text-slate-400 italic text-center mt-1">
                      Paramètres copiés en mémoire
                    </p>
                  )}

                  {syncMode === 'manual' && rowNumber && (
                    <div className={`mt-3.5 p-3 rounded-xl border transition-all ${isEntryChanged(entries[rowNumber], formData) ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Sauvegarde Manuelle
                        </span>
                        {isEntryChanged(entries[rowNumber], formData) ? (
                          <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse"></span>
                            Modifié
                          </span>
                        ) : (
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                            ✅ Synchronisé
                          </span>
                        )}
                      </div>
                      
                      {isEntryChanged(entries[rowNumber], formData) ? (
                        <button
                          type="button"
                          onClick={handleManualSave}
                          disabled={isSaving}
                          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider text-[10px]"
                        >
                          {isSaving ? 'Enregistrement...' : '📤 Sauvegarder (Push)'}
                        </button>
                      ) : (
                        <p className="text-[10px] text-slate-400 text-center italic py-1">
                          Aucun changement à sauvegarder
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Preset Parameters Panel */}
                <div className={`space-y-4 ${!rowNumber ? 'opacity-30 pointer-events-none select-none' : ''}`}>
                  {!rowNumber && (
                    <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 text-center space-y-1">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Aucune Sélection</p>
                      <p className="text-[9px] text-amber-600">Sélectionnez ou créez un preset d'image pour modifier ses options.</p>
                    </div>
                  )}

                  {/* Active simulation files indicator */}
                  {(previewBg || previewLogo || previewVehicle) && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-sm animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          Fichiers de Prévisualisation Actifs
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewBg && (
                          <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm">
                            🌅 Fond d'écran
                            <button
                              type="button"
                              onClick={handleResetBg}
                              className="w-4 h-4 rounded-full hover:bg-slate-100 flex items-center justify-center text-rose-500 transition-colors cursor-pointer"
                              title="Réinitialiser"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {previewLogo && (
                          <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm">
                            🛡️ Logo de test
                            <button
                              type="button"
                              onClick={handleResetLogo}
                              className="w-4 h-4 rounded-full hover:bg-slate-100 flex items-center justify-center text-rose-500 transition-colors cursor-pointer"
                              title="Réinitialiser"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {previewVehicle && (
                          <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm">
                            🚗 Véhicule PNG
                            <button
                              type="button"
                              onClick={handleResetVehicle}
                              className="w-4 h-4 rounded-full hover:bg-slate-100 flex items-center justify-center text-rose-500 transition-colors cursor-pointer"
                              title="Réinitialiser"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="h-[1px] flex-grow bg-slate-100"></div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">General</span>
                    <div className="h-[1px] flex-grow bg-slate-100"></div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                       <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] transition-colors ${isSaving ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                        A
                      </span>
                      Image ID
                    </label>
                    <input
                      type="text"
                      disabled
                      title="L'ID d'image sert de clé unique pour ce preset et n'est pas modifiable."
                      value={formData.imageId || ''}
                      className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-400 font-mono cursor-not-allowed outline-none select-none"
                    />
                    <span className="text-[9px] text-slate-400 italic px-1 block mt-0.5">
                      Identifiant unique (non-modifiable)
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] transition-colors ${isSaving ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-white'}`}>
                        REF
                      </span>
                      Resolution ref
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 1280, 1980, 2048, 3840"
                      value={formData.resolutionRef || '1280'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, resolutionRef: e.target.value.replace(/[^0-9]/g, '') }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-mono focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none shadow-sm transition-all"
                    />
                    <span className="text-[9px] text-slate-400 italic px-1 block mt-0.5">
                      Résolution de référence pour l'adaptation proportionnelle de la PWA et de l'API (ex: 1280, 1980, 2048)
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] transition-colors ${isSaving ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-white'}`}>
                        IA
                      </span>
                      prompt IA
                    </label>
                    <select
                      value={formData.promptIA || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, promptIA: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-sans focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none shadow-sm transition-all cursor-pointer"
                    >
                      <option value="">Sélectionner un prompt IA (aucun)</option>
                      {Object.keys(promptsIa).sort((a, b) => a.localeCompare(b)).map((id) => (
                        <option key={id} value={id}>
                          {promptsIa[id].promptName || id}
                        </option>
                      ))}
                    </select>
                    <span className="text-[9px] text-slate-400 italic px-1 block mt-0.5">
                      Sélectionnez le preset de prompt IA associé à cette configuration
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-[1px] flex-grow bg-amber-100"></div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Section Logo</span>
                    <div className="h-[1px] flex-grow bg-amber-100"></div>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-amber-700 block uppercase tracking-wide">⚠️ Canvas réf : {formData.resolutionRef || '1280'}x{formData.resolutionRef || '1280'}</span>
                    <span className="text-[9px] text-amber-600 italic block leading-snug">
                      Les coordonnées X, Y et la taille (définie en pixels du côté le plus grand, ex: 150) s'appliquent sur le canvas de référence de {formData.resolutionRef || '1280'}px.
                    </span>
                  </div>

                  {previewLogo && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-xl flex items-center justify-between text-[11px] font-semibold text-rose-800 shadow-sm animate-fade-in gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="truncate">Logo de test personnalisé actif</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetLogo}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[9px] tracking-wider rounded-lg border border-rose-700 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                      >
                        Effacer
                      </button>
                    </div>
                  )}

                  {[
                    { id: 'B', label: 'LOGO', key: 'logo', type: 'toggle' },
                    { id: 'C', label: 'TAILLE', key: 'logoSize', type: 'text', placeholder: 'Côté le plus grand en px (ex: 150)' },
                    { id: 'DX', label: 'LOGO X', key: 'logoX', type: 'text', placeholder: 'Ex: 512' },
                    { id: 'DY', label: 'LOGO Y', key: 'logoY', type: 'text', placeholder: 'Ex: 100' },
                    { id: 'E1', label: 'LOGO COLOR FILL ACTIVE', key: 'logoColorFillEnabled', type: 'toggle' },
                    { id: 'E', label: 'COLOR FILL', key: 'logoColorFill', type: 'text' },
                    { id: 'F', label: 'PROMPT IA LOGO', key: 'logoPrompt', type: 'text', placeholder: 'Prompt supplémentaire pour le logo' },
                    { id: 'FA', label: 'PROMPT IA LOGO ACTIF', key: 'logoPromptActive', type: 'toggle' },
                  ].map((field) => {
                    const val = (formData as any)[field.key];
                    const isValidHex = typeof val === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(val);
                    const isDisabled = (field.key === 'logoColorFill' && !formData.logoColorFillEnabled) || (field.key === 'logoPrompt' && !formData.logoPromptActive);
                    
                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] transition-colors ${isSaving ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
                              {field.id}
                            </span>
                            {field.label}
                          </label>
                          {field.id === 'DX' && (
                            <button
                              type="button"
                              onClick={() => handleFormChange(field.key, '640')}
                              className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 active:scale-95 text-[9px] font-black text-amber-700 hover:text-amber-900 transition-all border border-amber-200 cursor-pointer uppercase tracking-tight duration-150 animate-fade-in"
                              title="Centrer à 640"
                            >
                              CENTRE
                            </button>
                          )}
                        </div>
                        <div className="relative flex items-center gap-2">
                          {field.type === 'toggle' ? (
                            <button
                              type="button"
                              onClick={() => handleFormChange(field.key, !val)}
                              className={`w-full h-8 px-3 rounded-lg flex items-center justify-between transition-all border ${val ? 'bg-amber-500 border-amber-600 text-white font-bold' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                            >
                              <span className="text-[10px] uppercase tracking-widest">{val ? 'ON' : 'OFF'}</span>
                              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${val ? 'translate-x-0' : '-translate-x-0'}`} />
                            </button>
                          ) : (
                            <input
                              type="text"
                              placeholder={field.placeholder || `-`}
                              value={val || ''}
                              disabled={isDisabled}
                              onChange={e => handleFormChange(field.key, e.target.value)}
                              className={`flex-grow px-3 py-1.5 border rounded-lg text-sm outline-none transition-all placeholder:text-slate-300 ${
                                isDisabled
                                  ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-1 focus:ring-amber-400 focus:bg-white'
                              }`}
                            />
                          )}
                          {field.label.includes('COLOR FILL') && (
                            <div className={`flex items-center gap-1 shrink-0 ${field.key === 'logoColorFill' && !formData.logoColorFillEnabled ? 'opacity-30 pointer-events-none' : ''}`}>
                              {/* Native Color Picker Option */}
                              <div className="relative w-8 h-8 rounded-lg border border-slate-200 shrink-0 shadow-sm transition-all hover:scale-110 active:scale-95 cursor-pointer overflow-hidden flex items-center justify-center" title="Sélecteur de couleur natif">
                                <input
                                  type="color"
                                  value={isValidHex ? (val as string) : '#ffffff'}
                                  onChange={e => handleFormChange(field.key, e.target.value)}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
                                />
                                <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: isValidHex ? (val as string) : '#f1f5f9' }} />
                                {!isValidHex && <span className="text-[10px] text-slate-400 font-bold z-10 pointer-events-none">?</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-[1px] flex-grow bg-emerald-100"></div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Couleur du fond</span>
                    <div className="h-[1px] flex-grow bg-emerald-100"></div>
                  </div>

                  {[
                    { id: 'M1', label: 'COULEUR DU FOND MODIFIABLE', key: 'imageColorFillEnabled' },
                    ...(formData.imageColorFillEnabled
                      ? [{ id: 'M2', label: 'INCLURE MURS DE MÊME TEINTE', key: 'imageColorFillWalls' }]
                      : []),
                  ].map((field) => {
                    const val = (formData as any)[field.key];
                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] transition-colors ${isSaving ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                              {field.id}
                            </span>
                            {field.label}
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFormChange(field.key, !val)}
                          className={`w-full h-8 px-3 rounded-lg flex items-center justify-between transition-all border ${val ? 'bg-emerald-500 border-emerald-600 text-white font-bold' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                        >
                          <span className="text-[10px] uppercase tracking-widest">{val ? 'ON' : 'OFF'}</span>
                          <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                        </button>
                        {field.key === 'imageColorFillWalls' && (
                          <span className="text-[9px] text-slate-500 italic block leading-snug">
                            ON = recolore le néon ET les murs de la même teinte. OFF = néon seul. (Jamais toute l'image.)
                          </span>
                        )}
                        {field.key === 'imageColorFillEnabled' && !val && (
                          <span className="text-[9px] text-slate-400 italic block leading-snug">
                            OFF = l'utilisateur ne peut pas changer la couleur de ce fond.
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-[1px] flex-grow bg-blue-100"></div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Section Texte</span>
                    <div className="h-[1px] flex-grow bg-blue-100"></div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-2.5 space-y-1">
                    <span className="text-[10px] font-black text-blue-700 block uppercase tracking-wide">⚠️ Canvas réf : {formData.resolutionRef || '1280'}x{formData.resolutionRef || '1280'}</span>
                    <span className="text-[9px] text-blue-600 italic block leading-snug">
                      Les coordonnées X, Y et la taille du texte s'appliquent sur le canvas de référence de {formData.resolutionRef || '1280'}px.
                    </span>
                  </div>

                  {[
                    { id: 'G', label: 'TEXTE', key: 'text', type: 'toggle' },
                    { id: 'GP', label: 'TEXTE PAR DEFAUT', key: 'textContent', type: 'text', placeholder: ' VOTRE TEXTE ICI ' },
                    { id: 'H', label: 'POLICE', key: 'textFont', type: 'select' },
                    { id: 'I', label: 'TAILLE', key: 'textSize', type: 'text' },
                    { id: 'J', label: 'ALIGNEMENT', key: 'textAlign', type: 'align' },
                    { id: 'KX', label: 'TEXT X', key: 'textX', type: 'text', placeholder: 'Ex: 512' },
                    { id: 'KY', label: 'TEXT Y', key: 'textY', type: 'text', placeholder: 'Ex: 400' },
                    { id: 'L1', label: 'TEXT COLOR FILL ACTIVE', key: 'textColorFillEnabled', type: 'toggle' },
                    { id: 'L', label: 'COLOR FILL', key: 'textColorFill', type: 'text' },
                    { id: 'N', label: 'PROMPT IA TEXTE', key: 'textPrompt', type: 'text', placeholder: 'Prompt supplémentaire pour le texte' },
                    { id: 'NA', label: 'PROMPT IA TEXTE ACTIF', key: 'textPromptActive', type: 'toggle' },
                  ].map((field) => {
                    const val = (formData as any)[field.key];
                    const isValidHex = typeof val === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(val);
                    const isDisabled = (field.key === 'textColorFill' && !formData.textColorFillEnabled) || (field.key === 'textPrompt' && !formData.textPromptActive);
                    
                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] transition-colors ${isSaving ? 'bg-blue-500 text-white' : 'bg-slate-900 text-white'}`}>
                              {field.id}
                            </span>
                            {field.label}
                          </label>
                          {field.id === 'KX' && (
                            <button
                              type="button"
                              onClick={() => handleFormChange(field.key, '640')}
                              className="px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 active:scale-95 text-[9px] font-black text-blue-700 hover:text-blue-900 transition-all border border-blue-200 cursor-pointer uppercase tracking-tight duration-150 animate-fade-in"
                              title="Centrer à 640"
                            >
                              CENTRE
                            </button>
                          )}
                        </div>
                        <div className="relative flex items-center gap-2">
                          {field.type === 'toggle' ? (
                            <button
                              type="button"
                              onClick={() => handleFormChange(field.key, !val)}
                              className={`w-full h-8 px-3 rounded-lg flex items-center justify-between transition-all border ${val ? 'bg-blue-500 border-blue-600 text-white font-bold' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                            >
                              <span className="text-[10px] uppercase tracking-widest">{val ? 'ON' : 'OFF'}</span>
                              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${val ? 'translate-x-0' : '-translate-x-0'}`} />
                            </button>
                          ) : field.type === 'select' ? (
                            <select
                              value={val || ''}
                              onChange={e => handleFormChange(field.key, e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-blue-400 focus:bg-white outline-none transition-all cursor-pointer font-sans"
                            >
                              <option value="">Sélectionner une police</option>
                              <optgroup label="Sans-Serif">
                                <option value="Arial">Arial</option>
                                <option value="Inter">Inter</option>
                                <option value="Impact">Impact</option>
                              </optgroup>
                              <optgroup label="Serif">
                                <option value="Georgia">Georgia</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Garamond">Garamond</option>
                              </optgroup>
                            </select>
                          ) : field.type === 'align' ? (
                            <div className="flex items-center gap-3 bg-slate-50 p-2 border border-slate-200 rounded-lg w-full justify-around">
                              {['GAUCHE', 'CENTRE', 'DROITE'].map((alignOpt) => (
                                <label key={alignOpt} className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 select-none">
                                  <input
                                    type="checkbox"
                                    checked={(val || 'CENTRE') === alignOpt}
                                    onChange={() => handleFormChange('textAlign', alignOpt)}
                                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span>{alignOpt}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder={field.placeholder || `-`}
                              value={val || ''}
                              disabled={isDisabled}
                              onChange={e => handleFormChange(field.key, e.target.value)}
                              className={`flex-grow px-3 py-1.5 border rounded-lg text-sm outline-none transition-all placeholder:text-slate-300 ${
                                isDisabled
                                  ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed opacity-60 font-sans'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-1 focus:ring-blue-400 focus:bg-white'
                              }`}
                            />
                          )}
                          {field.label.includes('COLOR FILL') && (
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Native Color Picker Option */}
                              <div className="relative w-8 h-8 rounded-lg border border-slate-200 shrink-0 shadow-sm transition-all hover:scale-110 active:scale-95 cursor-pointer overflow-hidden flex items-center justify-center" title="Sélecteur de couleur natif">
                                <input
                                  type="color"
                                  value={isValidHex ? (val as string) : '#ffffff'}
                                  onChange={e => handleFormChange(field.key, e.target.value)}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20"
                                />
                                <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: isValidHex ? (val as string) : '#f1f5f9' }} />
                                {!isValidHex && <span className="text-[10px] text-slate-400 font-bold z-10 pointer-events-none">?</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
                <div className="space-y-6">
                  {/* 1. Add Prompt Preset Widget */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-blue-500" />
                      Créer un Preset Prompt
                    </label>
                    <form onSubmit={handleCreatePromptPreset} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Prompt Archi01"
                        value={newPromptName}
                        onChange={e => setNewPromptName(e.target.value)}
                        className="flex-grow min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <button
                        type="submit"
                        className="px-3 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                      >
                        Ajouter
                      </button>
                    </form>
                    {createPromptError && (
                      <p className="text-[10px] text-red-500 font-semibold leading-relaxed animate-pulse">{createPromptError}</p>
                    )}
                  </div>

                  {/* 2. Selected Prompt display & Selector popover */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between px-1">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                        Prompt Sélectionné
                      </span>
                      <span className="text-[9px] text-slate-400/80 font-normal italic">cliquez pour changer</span>
                    </label>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsPromptDropdownOpen(!isPromptDropdownOpen);
                        setPromptPresetSearchQuery('');
                      }}
                      className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono flex items-center justify-between shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all border border-slate-800/50 cursor-pointer select-none animate-fade-in"
                    >
                      <span className="truncate max-w-[200px] text-left font-bold text-slate-100" title={activePromptId || 'Aucun prompt'}>
                        {activePromptId ? `${activePromptId}` : 'Aucun prompt'}
                      </span>
                      <div className="flex items-center gap-1 px-1 shrink-0">
                        {activePromptId && (
                          <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded font-black tracking-widest uppercase text-center scale-90 animate-pulse">
                            Active
                          </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isPromptDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isPromptDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40 bg-transparent" 
                            onClick={() => setIsPromptDropdownOpen(false)} 
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[300px]"
                          >
                            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 sticky top-0 z-10">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                              <input
                                type="text"
                                placeholder="Rechercher un prompt..."
                                value={promptPresetSearchQuery}
                                onChange={(e) => setPromptPresetSearchQuery(e.target.value)}
                                autoFocus
                                className="w-full bg-transparent border-none text-xs text-slate-800 placeholder:text-slate-400 font-medium outline-none h-7 px-1.5"
                              />
                              {promptPresetSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setPromptPresetSearchQuery('')}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="overflow-y-auto scrollbar-thin divide-y divide-slate-50 bg-white max-h-[220px]">
                              {(() => {
                                const keysPr = Object.keys(promptsIa).sort((a,b) => a.localeCompare(b));
                                const filtered = keysPr.filter(id => 
                                  id.toLowerCase().includes(promptPresetSearchQuery.toLowerCase())
                                );

                                if (filtered.length === 0) {
                                  return (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">
                                      Aucun résultat
                                    </div>
                                  );
                                }

                                return filtered.map(id => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => {
                                      setActivePromptId(id);
                                      setIsPromptDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-xs font-mono transition-colors flex items-center justify-between group cursor-pointer ${
                                      activePromptId === id 
                                        ? 'bg-blue-50 text-blue-700 font-bold' 
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                  >
                                    <span className="truncate">{id}</span>
                                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`Voulez-vous vraiment supprimer le prompt ${id} ?`)) {
                                            handleDeletePromptPreset(id);
                                          }
                                        }}
                                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                        title="Supprimer définitivement"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </button>
                                ));
                              })()}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 3. Autosave warning and manual controls */}
                  {syncMode === 'manual' && activePromptId && (
                    <div className={`p-3 rounded-xl border transition-all ${isPromptChanged(promptsIa[activePromptId], promptForm) ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Sauvegarde Manuelle (Prompt)
                        </span>
                        {isPromptChanged(promptsIa[activePromptId], promptForm) ? (
                          <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                            Modifié
                          </span>
                        ) : (
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                            ✅ Synchronisé
                          </span>
                        )}
                      </div>
                      
                      {isPromptChanged(promptsIa[activePromptId], promptForm) ? (
                        <button
                          type="button"
                          onClick={handleManualSavePrompt}
                          disabled={isSaving}
                          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {isSaving ? 'Enregistrement...' : '📤 Sauvegarder Prompt'}
                        </button>
                      ) : (
                        <p className="text-[10px] text-slate-400 text-center italic py-1">
                          Aucun changement à sauvegarder
                        </p>
                      )}
                    </div>
                  )}

                  {/* 4. Parameters Panel for Prompts */}
                  <div className={`space-y-4 ${!activePromptId ? 'opacity-30 pointer-events-none select-none' : ''}`}>
                    {!activePromptId && (
                      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 text-center space-y-1">
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Aucune Sélection</p>
                        <p className="text-[9px] text-blue-600">Sélectionnez ou créez un preset de prompt pour le configurer.</p>
                      </div>
                    )}

                    {activePromptId && (
                      <div className="space-y-4 bg-slate-50/50 border border-slate-100 rounded-xl p-4">
                        {/* FIELD A - aPrompt */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-700 tracking-widest">
                              aPrompt
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (promptForm.aPrompt) {
                                  navigator.clipboard.writeText(promptForm.aPrompt);
                                  alert('aPrompt copié !');
                                }
                              }}
                              className="text-[9px] text-blue-600 hover:underline font-bold cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                          <textarea
                            rows={3}
                            value={promptForm.aPrompt}
                            onChange={e => handleFormChangePrompt('aPrompt', e.target.value)}
                            placeholder="Saisissez la description de l'arrière-plan (aPrompt)..."
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-sans outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>

                        {/* FIELD B - bPrompt */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-700 tracking-widest">
                              bPrompt
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (promptForm.bPrompt) {
                                  navigator.clipboard.writeText(promptForm.bPrompt);
                                  alert('bPrompt copié !');
                                }
                              }}
                              className="text-[9px] text-blue-600 hover:underline font-bold cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                          <textarea
                            rows={3}
                            value={promptForm.bPrompt}
                            onChange={e => handleFormChangePrompt('bPrompt', e.target.value)}
                            placeholder="Saisissez la description du véhicule (bPrompt)..."
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-sans outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>

                        {/* FIELD C - cPrompt */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-700 tracking-widest">
                              cPrompt
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (promptForm.cPrompt) {
                                  navigator.clipboard.writeText(promptForm.cPrompt);
                                  alert('cPrompt copié !');
                                }
                              }}
                              className="text-[9px] text-blue-600 hover:underline font-bold cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                          <textarea
                            rows={3}
                            value={promptForm.cPrompt}
                            onChange={e => handleFormChangePrompt('cPrompt', e.target.value)}
                            placeholder="Saisissez le prompt lié à la maquette de référence (cPrompt)..."
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-sans outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>

                        {/* FIELD D - generalPrompt */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-700 tracking-widest">
                              generalPrompt
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (promptForm.generalPrompt) {
                                  navigator.clipboard.writeText(promptForm.generalPrompt);
                                  alert('generalPrompt copié !');
                                }
                              }}
                              className="text-[9px] text-blue-600 hover:underline font-bold cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                          <textarea
                            rows={8}
                            value={promptForm.generalPrompt}
                            onChange={e => handleFormChangePrompt('generalPrompt', e.target.value)}
                            placeholder="Saisissez les instructions d'unification globale (generalPrompt)..."
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-sans outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                          />
                        </div>

                        {/* FIELD E - promptNegative */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-rose-700 tracking-widest">
                              promptNegative
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (promptForm.promptNegative) {
                                  navigator.clipboard.writeText(promptForm.promptNegative);
                                  alert('promptNegative copié !');
                                }
                              }}
                              className="text-[9px] text-rose-600 hover:underline font-bold cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                          <textarea
                            rows={4}
                            value={promptForm.promptNegative || ''}
                            onChange={e => handleFormChangePrompt('promptNegative', e.target.value)}
                            placeholder="Saisissez les instructions de prompt négatif (promptNegative)..."
                            className="w-full p-2.5 bg-white border border-rose-100 rounded-lg text-xs font-sans outline-none focus:ring-1 focus:ring-rose-400 font-mono text-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Data View Section */}
          <section className="flex flex-col min-w-0 h-full overflow-hidden">
            {/* Premium Navigation Tabs for Sheet vs Canvas Studio */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none shrink-0">
              <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('sheet')}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-150 flex items-center gap-2 ${activeTab === 'sheet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Database className="w-3.5 h-3.5" />
                  📋 Tableur de Données
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-150 flex items-center gap-2 ${activeTab === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  🎨 Aperçu Live (Échelle 1:2)
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {activeTab === 'sheet' && (
                  <>
                    <div className="flex items-center bg-slate-200/50 p-1 rounded-xl border border-slate-200 text-[10px] font-extrabold select-none">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest px-2.5 font-black flex items-center gap-1">
                        <ArrowUpDown className="w-3 h-3 text-slate-500 shrink-0 animate-pulse" />
                        Tri :
                      </span>
                      <button
                        type="button"
                        onClick={() => setSortBy('alpha')}
                        className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all duration-150 ${sortBy === 'alpha' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 font-bold'}`}
                      >
                        🔤 ID / Alpha
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy('date')}
                        className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all duration-150 ${sortBy === 'date' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 font-bold'}`}
                      >
                        📅 Date Modification
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkDeleteMode(prev => !prev);
                        setSelectedRowIds({});
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all border flex items-center gap-1.5 shadow-sm ${
                        isBulkDeleteMode 
                          ? 'bg-rose-100 border-rose-300 text-rose-700 font-black ring-2 ring-rose-200' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isBulkDeleteMode ? 'Sélection Active' : 'Suppression Multiple'}
                    </button>

                    {isBulkDeleteMode && Object.values(selectedRowIds).filter(Boolean).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-700 hover:bg-rose-700 active:scale-95 flex items-center gap-1.5 shadow-md shadow-rose-200/50 transition-all"
                      >
                        🗑️ Supprimer ({Object.values(selectedRowIds).filter(Boolean).length})
                      </button>
                    )}
                  </>
                )}
                {activeTab === 'preview' && (
                  <button
                    type="button"
                    onClick={() => setShow43Overlay(prev => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all border flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] ${show43Overlay ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${show43Overlay ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    Cadre Sécurité 4:3 : {show43Overlay ? 'ACTIF' : 'INACTIF'}
                  </button>
                )}
                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400 bg-white/70 px-2.5 py-1.5 border border-slate-200 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Canvas Réf : {formData.resolutionRef || '1280'}x{formData.resolutionRef || '1280'} (100%)</span>
                </div>
              </div>
            </div>

            {/* Render Tab Contents */}
            {activeModule === 'prompts_ia' ? (
              activeTab === 'sheet' ? (
                <div className="flex-grow bg-white border border-slate-200 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col font-mono">
                  <div className="flex-grow overflow-auto scrollbar-hide relative bg-white">
                    <div className="min-w-fit">
                      {/* Higher Group Header - Sticky Level 1 */}
                      <div className="sticky top-0 z-30 grid grid-cols-[40px_50px_180px_250px_250px_250px_350px_350px] bg-slate-100 text-[8px] font-black uppercase tracking-[0.2em] divide-x divide-slate-200 transition-all border-b border-slate-200 shadow-sm">
                        <div className="p-2 bg-slate-200/50"></div>
                        <div className="p-2 bg-slate-200/50"></div>
                        <div className="p-2 bg-slate-50 text-slate-400 flex items-center justify-center italic">Meta</div>
                        <div className="col-span-5 p-2 bg-blue-600 text-white flex items-center justify-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                          Dataset Prompts IA (Moteur IA Pipeline)
                        </div>
                      </div>

                      {/* Table Header (Letters) - Sticky Level 2 */}
                      <div className="sticky top-[33px] z-30 grid grid-cols-[40px_50px_180px_250px_250px_250px_350px_350px] border-b border-slate-200 bg-slate-50 text-[9px] text-slate-400 uppercase font-bold tracking-wider divide-x divide-slate-200/50 shadow-sm">
                        <div className="p-3 flex items-center justify-center italic">Opt</div>
                        <div className="p-3 flex items-center justify-center">RNG</div>
                        {['A', 'B', 'C', 'D', 'E', 'F'].map((l) => (
                          <div key={l} className="p-3 flex items-center justify-center bg-blue-50/50 text-blue-600">{l}</div>
                        ))}
                      </div>

                      {/* Labels Row - Sticky Level 3 */}
                      <div className="sticky top-[77px] z-20 grid grid-cols-[40px_50px_180px_250px_250px_250px_350px_350px] text-[7px] text-slate-400 font-bold bg-white/95 backdrop-blur-sm divide-x divide-slate-100/50 border-b border-slate-100 shadow-sm">
                        <div className="p-2"></div>
                        <div className="p-2"></div>
                        {[
                          'PROMPT PRESET NAME', 'aPrompt', 'bPrompt',
                          'cPrompt', 'generalPrompt', 'promptNegative'
                        ].map((label, i) => (
                          <div key={i} className="p-2 flex items-center justify-center text-center leading-tight whitespace-pre-wrap text-blue-500/70">
                            {label}
                          </div>
                        ))}
                      </div>

                      {/* Table Rows */}
                      <div className="divide-y divide-slate-100">
                        {Object.keys(promptsIa).length === 0 && (
                          <div className="p-16 text-center text-slate-400 bg-slate-50/20 flex flex-col items-center justify-center gap-3">
                            <Database className="w-10 h-10 text-slate-300 animate-pulse" />
                            <div className="space-y-1.5">
                              <p className="font-bold text-xs text-slate-700 uppercase tracking-widest">Aucun Prompt IA Enregistré</p>
                              <p className="text-[10px] text-slate-500 max-w-sm leading-relaxed">
                                Créez votre premier preset de prompt IA (ex: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[9px] text-slate-600">Prompt Archi01</code>) à l'aide de l'onglet de gauche.
                              </p>
                            </div>
                          </div>
                        )}
                        {Object.keys(promptsIa).sort((a,b) => a.localeCompare(b)).map((id, index) => {
                          const p = promptsIa[id];
                          const displayIndex = (index + 1).toString().padStart(2, '0');
                          const isSelected = activePromptId === id;

                          return (
                            <div
                              key={id}
                              onClick={() => {
                                setActivePromptId(id);
                              }}
                              className={`grid grid-cols-[40px_50px_180px_250px_250px_250px_350px_350px] items-stretch text-[10px] divide-x divide-slate-100 hover:bg-slate-50/80 cursor-pointer select-none transition-colors duration-150 ${isSelected ? 'bg-blue-50/40 text-blue-900 border-l-2 border-l-blue-500 font-semibold' : 'text-slate-600'}`}
                            >
                              {/* Option Action Column */}
                              <div className="p-2.5 flex items-center justify-center bg-slate-50/40 min-h-[44px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Voulez-vous vraiment supprimer le prompt ${id} ?`)) {
                                      handleDeletePromptPreset(id);
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Index Column */}
                              <div className="p-2.5 flex items-center justify-center text-slate-400 font-bold bg-slate-50/20 text-center text-[9px]">
                                {displayIndex}
                              </div>

                              {/* Name column */}
                              <div className="p-2.5 flex items-center font-bold text-slate-800 break-all">
                                {p.promptName}
                              </div>

                              {/* Fields aPrompt */}
                              <div className="p-2.5 flex items-center overflow-hidden" title={p.aPrompt}>
                                <span className="line-clamp-2 leading-tight break-all">{p.aPrompt || '-'}</span>
                              </div>

                              {/* Fields bPrompt */}
                              <div className="p-2.5 flex items-center overflow-hidden" title={p.bPrompt}>
                                <span className="line-clamp-2 leading-tight break-all">{p.bPrompt || '-'}</span>
                              </div>

                              {/* Fields cPrompt */}
                              <div className="p-2.5 flex items-center overflow-hidden" title={p.cPrompt}>
                                <span className="line-clamp-2 leading-tight break-all">{p.cPrompt || '-'}</span>
                              </div>

                              {/* Fields generalPrompt */}
                              <div className="p-2.5 flex items-center overflow-hidden" title={p.generalPrompt}>
                                <span className="line-clamp-2 leading-tight break-all">{p.generalPrompt || '-'}</span>
                              </div>

                              {/* Fields promptNegative */}
                              <div className="p-2.5 flex items-center overflow-hidden" title={p.promptNegative}>
                                <span className="line-clamp-2 leading-tight break-all">{p.promptNegative || '-'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Prompt Conceptual visualizer / Beautiful Cards for Preview Tab of Prompt IA */
                <div className="flex-grow bg-slate-50 border border-slate-200 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] p-6 md:p-8 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-140px)]">
                  <div>
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-1 shadow-sm inline-block px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
                      ✨ Studio Rendu Prompts IA : {activePromptId || 'Aucun Prompt IA Sélectionné'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal mt-1">
                      Visualisez et copiez d'un simple clic vos canaux de prompts IA formatés pour le raccordement avec le Moteur de Synthèse.
                    </p>
                  </div>

                  {!activePromptId ? (
                    <div className="flex-grow bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
                      <ShieldCheck className="w-10 h-10 text-slate-300 animate-pulse" />
                      <div className="space-y-1">
                        <p className="font-bold text-xs text-slate-700 uppercase tracking-wider">Aucune sélection active</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs">
                          Veuillez sélectionner ou créer un preset de prompt dans le panneau de gauche pour afficher l'aperçu consolidé des blocs de prompts.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { title: 'aPrompt', value: promptForm.aPrompt, color: 'border-l-indigo-500' },
                        { title: 'bPrompt', value: promptForm.bPrompt, color: 'border-l-blue-500' },
                        { title: 'cPrompt', value: promptForm.cPrompt, color: 'border-l-cyan-500' },
                      ].map((card, i) => (
                        <div key={i} className={`bg-white border border-slate-200 border-l-4 ${card.color} rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow`}>
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-slate-500 tracking-wider font-sans">
                              {card.title}
                            </h4>
                            <p className="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                              {card.value || <span className="text-slate-400 italic">Non configuré</span>}
                            </p>
                          </div>
                          {card.value && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(card.value);
                                alert('Contenu copié !');
                              }}
                              className="self-end px-3 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-[9px] font-black text-slate-700 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copier
                            </button>
                          )}
                        </div>
                      ))}

                      {/* GENERAL UNIFIED COMMUNE CARD */}
                      <div className="col-span-1 md:col-span-3 bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4 text-white hover:border-slate-800 transition-colors">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                            <h4 className="text-[10px] font-black tracking-widest text-slate-300 font-sans">
                              generalPrompt (Instructions globales communes de Synthèse)
                            </h4>
                          </div>
                          {promptForm.generalPrompt && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(promptForm.generalPrompt);
                                alert('generalPrompt copié !');
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-[9px] font-black text-white rounded-lg flex items-center gap-1.5 transition-all border border-blue-500 shadow-md shadow-blue-500/20 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copier generalPrompt
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap break-all bg-slate-950 p-4 rounded-xl border border-slate-850">
                          {promptForm.generalPrompt || <span className="text-slate-650 italic">Aucune instruction globale configurée</span>}
                        </p>
                      </div>

                      {/* NEGATIVE PROMPT CARD */}
                      <div className="col-span-1 md:col-span-3 bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4 text-white hover:border-slate-800 transition-colors">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                            <h4 className="text-[10px] font-black tracking-widest text-slate-300 font-sans">
                              promptNegative (Instructions de prompt négatif)
                            </h4>
                          </div>
                          {promptForm.promptNegative && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(promptForm.promptNegative);
                                alert('promptNegative copié !');
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-[9px] font-black text-white rounded-lg flex items-center gap-1.5 transition-all border border-rose-500 shadow-md shadow-rose-500/20 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copier promptNegative
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap break-all bg-slate-900 p-4 rounded-xl border border-slate-850">
                          {promptForm.promptNegative || <span className="text-slate-650 italic">Aucune instruction de prompt négatif configurée</span>}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : activeTab === 'sheet' ? (
              <div className="flex-grow bg-white border border-slate-200 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col font-mono">
                <div className="flex-grow overflow-auto scrollbar-hide relative bg-white">
                  <div className="min-w-fit">
                    {/* Higher Group Header - Sticky Level 1 */}
                    <div className="sticky top-0 z-30 grid grid-cols-[40px_50px_repeat(21,minmax(100px,1fr))] bg-slate-100 text-[8px] font-black uppercase tracking-[0.2em] divide-x divide-slate-200 transition-all border-b border-slate-200 shadow-sm">
                      <div className="p-2 bg-slate-200/50"></div>
                      <div className="p-2 bg-slate-200/50"></div>
                      <div className="col-span-2 p-2 bg-slate-50 text-slate-400 flex items-center justify-center italic">Général</div>
                      <div className="col-span-8 p-2 bg-amber-500 text-white flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                        Section Logo
                      </div>
                      <div className="col-span-11 p-2 bg-blue-500 text-white flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                        Section Texte
                      </div>
                    </div>

                    {/* Table Header (Letters) - Sticky Level 2 */}
                    <div className="sticky top-[33px] z-30 grid grid-cols-[40px_50px_repeat(21,minmax(100px,1fr))] border-b border-slate-200 bg-slate-50 text-[9px] text-slate-400 uppercase font-bold tracking-wider divide-x divide-slate-200/50 shadow-sm">
                      {isBulkDeleteMode ? (
                        <div className="p-3 flex items-center justify-center bg-rose-50/50">
                          <input 
                            type="checkbox"
                            checked={visibleRows.length > 0 && visibleRows.every(id => selectedRowIds[id])}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated: Record<string, boolean> = {};
                              if (checked) {
                                visibleRows.forEach(id => {
                                  updated[id] = true;
                                });
                              }
                              setSelectedRowIds(updated);
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-350 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            title={visibleRows.length > 0 && visibleRows.every(id => selectedRowIds[id]) ? "Tout désélectionner" : "Tout sélectionner"}
                          />
                        </div>
                      ) : (
                        <div className="p-3 flex items-center justify-center italic">Opt</div>
                      )}
                      <div className="p-3 flex items-center justify-center">RNG</div>
                      {['A', 'PA', 'B', 'C', 'DX', 'DY', 'E1', 'E', 'F', 'FA', 'G', 'GP', 'H', 'I', 'J', 'KX', 'KY', 'L1', 'L', 'N', 'NA'].map((l) => {
                        let bgColor = '';
                        let textColor = 'text-slate-400';
                        if (l === 'PA') {
                          bgColor = 'bg-indigo-50/80';
                          textColor = 'text-indigo-600';
                        } else if (['B','C','DX','DY','E1','E','F','FA'].includes(l)) {
                          bgColor = 'bg-amber-50/80';
                          textColor = 'text-amber-600';
                        } else if (['G','GP','H','I','J','KX','KY','L1','L','N','NA'].includes(l)) {
                          bgColor = 'bg-blue-50/80';
                          textColor = 'text-blue-600';
                        }
                        return (
                          <div key={l} className={`p-3 flex items-center justify-center ${bgColor} ${textColor}`}>{l}</div>
                        );
                      })}
                    </div>

                    {/* Labels Row - Sticky Level 3 */}
                    <div className="sticky top-[77px] z-20 grid grid-cols-[40px_50px_repeat(21,minmax(100px,1fr))] text-[7px] text-slate-400 font-bold bg-white/95 backdrop-blur-sm divide-x divide-slate-100/50 border-b border-slate-100 shadow-sm">
                      <div className="p-2"></div>
                      <div className="p-2"></div>
                      {[
                        'IMAGE ID', 'PROMPT IA', 'LOGO', 'TAILLE', 'LOGO X', 'LOGO Y', 'COLOR FILL ACTIVE', 'COLOR FILL', 'PROMPT IA LOGO', 'PROMPT ACTIF LOGO',
                        'TEXTE', 'TEXTE PAR DEFAUT', 'POLICE', 'TAILLE', 'ALIGNEMENT', 'TEXT X', 'TEXT Y', 'COLOR FILL ACTIVE', 'COLOR FILL', 'PROMPT IA TEXTE', 'PROMPT ACTIF TEXTE'
                      ].map((label, i) => {
                        const isPromptIa = i === 1;
                        const isLogoGroup = i >= 2 && i <= 9;
                        const isTextGroup = i >= 10;
                        return (
                          <div key={i} className={`p-2 flex items-center justify-center text-center leading-tight whitespace-pre-wrap ${isPromptIa ? 'text-indigo-500/70' : isLogoGroup ? 'text-amber-500/70' : isTextGroup ? 'text-blue-500/70' : ''}`}>
                            {label}
                          </div>
                        );
                      })}
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-slate-100">
                      {visibleRows.length === 0 && (
                        <div className="p-16 text-center text-slate-400 bg-slate-50/20 flex flex-col items-center justify-center gap-3">
                          <Database className="w-10 h-10 text-slate-300 animate-pulse" />
                          <div className="space-y-1.5">
                            <p className="font-bold text-xs text-slate-700 uppercase tracking-widest">Aucun Preset Enregistré</p>
                            <p className="text-[10px] text-slate-500 max-w-sm leading-relaxed">
                              Votre base de données Firestore est vide. Créez votre premier preset d'image (ex: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[9px] text-slate-600">ARCHI 01.jpg</code>) à l'aide du volet de gauche.
                            </p>
                          </div>
                        </div>
                      )}
                      {visibleRows.map((id, index) => {
                        const entry = entries[id];
                        const displayIndex = (index + 1).toString().padStart(2, '0');
                        const textVal = entry?.text !== undefined ? entry.text : entry?.textEnabled;
                        const lp = entry?.logoPrompt !== undefined ? entry.logoPrompt : (entry?.logoExtra !== undefined ? entry.logoExtra : (entry?.imageExtra || ''));
                        const lpa = entry?.logoPromptActive !== undefined ? !!entry.logoPromptActive : (lp !== '');
                        const tp = entry?.textPrompt !== undefined ? entry.textPrompt : (entry?.textExtra || '');
                        const tpa = entry?.textPromptActive !== undefined ? !!entry.textPromptActive : (tp !== '');

                        return (
                          <div
                            key={id}
                            onClick={() => {
                              if (isBulkDeleteMode) {
                                setSelectedRowIds(prev => ({
                                  ...prev,
                                  [id]: !prev[id]
                                }));
                              } else {
                                  setRowNumber(id);
                              }
                            }}
                            className={`grid grid-cols-[40px_50px_repeat(21,minmax(100px,1fr))] text-[10px] text-slate-600 transition-colors group divide-x divide-slate-100 cursor-pointer ${rowNumber === id ? 'bg-slate-900 text-white' : (isBulkDeleteMode && selectedRowIds[id] ? 'bg-rose-50/70 hover:bg-rose-100/60' : 'bg-white hover:bg-slate-50/50')}`}
                          >
                            <div className="p-3 flex items-center justify-center">
                              {isBulkDeleteMode ? (
                                <input 
                                  type="checkbox"
                                  checked={!!selectedRowIds[id]}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setSelectedRowIds(prev => ({
                                      ...prev,
                                      [id]: !prev[id]
                                    }));
                                  }}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                              ) : (
                                entry && (
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(id);
                                    }}
                                    className={`transition-all ${rowNumber === id ? 'text-white/50 hover:text-white' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500'}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                            <div className={`p-3 flex items-center justify-center font-bold ${rowNumber === id ? 'text-white' : 'text-slate-300'}`}>
                              {displayIndex}
                            </div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold" title={entry?.imageId}>{entry?.imageId || ''}</div>
                            <div className={`p-3 flex items-center justify-center truncate px-1 font-semibold ${rowNumber === id ? 'text-indigo-200' : 'text-indigo-500'}`} title={entry?.promptIA}>{entry?.promptIA || ''}</div>
                            <div className={`p-3 flex items-center justify-center font-bold px-1 ${entry?.logo ? 'text-amber-500' : 'text-slate-300'}`}>
                              {entry?.logo !== undefined ? (entry.logo ? 'TRUE' : 'FALSE') : ''}
                            </div>
                            <div className="p-3 flex items-center justify-center truncate px-1">{(entry?.logoSize !== undefined ? entry.logoSize : entry?.imageSize) || ''}</div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold text-amber-500">{entry?.logoX || ''}</div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold text-amber-500">{entry?.logoY || ''}</div>
                            <div className={`p-3 flex items-center justify-center font-bold px-1 ${entry?.logoColorFillEnabled !== undefined ? (entry.logoColorFillEnabled ? 'text-amber-500' : 'text-slate-300') : (entry?.logoColorFill ? 'text-amber-500' : 'text-slate-300')}`}>
                              {entry?.logoColorFillEnabled !== undefined ? (entry.logoColorFillEnabled ? 'TRUE' : 'FALSE') : (entry?.logoColorFill ? 'TRUE' : 'FALSE')}
                            </div>
                            <div className="p-3 flex items-center justify-center truncate px-1 gap-1.5 font-mono">
                              {(entry?.logoColorFill !== undefined ? entry.logoColorFill : entry?.imageColorFill) || ''}
                              {((entry?.logoColorFill !== undefined ? entry.logoColorFill : entry?.imageColorFill)) && /^#([0-9A-F]{3}){1,2}$/i.test((entry?.logoColorFill !== undefined ? entry.logoColorFill : entry?.imageColorFill)!) && (
                                <div 
                                  className="w-2 h-2 rounded-full border border-slate-200 shrink-0 shadow-sm"
                                  style={{ backgroundColor: (entry?.logoColorFill !== undefined ? entry.logoColorFill : entry?.imageColorFill) }}
                                />
                              )}
                            </div>
                            <div 
                              className={`p-3 flex items-center justify-center truncate px-1 ${lpa ? 'text-slate-700 font-medium' : 'text-slate-300 italic'}`} 
                              title={lpa ? lp : (lp ? `${lp} (Non transmis)` : '')}
                            >
                              {lpa ? lp : ''}
                            </div>
                            <div className={`p-3 flex items-center justify-center font-bold px-1 ${lpa ? 'text-amber-500' : 'text-slate-300'}`}>
                              {lpa ? 'TRUE' : 'FALSE'}
                            </div>
                            <div className={`p-3 flex items-center justify-center font-bold px-1 ${textVal ? 'text-blue-500' : 'text-slate-300'}`}>
                              {textVal !== undefined ? (textVal ? 'TRUE' : 'FALSE') : ''}
                            </div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold text-blue-500" title={entry?.textContent}>{entry?.textContent || ''}</div>
                            <div className="p-3 flex items-center justify-center truncate px-1">{entry?.textFont || ''}</div>
                            <div className="p-3 flex items-center justify-center truncate px-1">{entry?.textSize || ''}</div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold text-blue-500 font-sans text-[9px] bg-blue-50/5 border-x border-slate-50" title={entry?.textAlign}>
                              {entry?.textAlign || 'CENTRE'}
                            </div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold text-blue-500">{entry?.textX || ''}</div>
                            <div className="p-3 flex items-center justify-center truncate px-1 font-semibold text-blue-500">{entry?.textY || ''}</div>
                            <div className={`p-3 flex items-center justify-center font-bold px-1 ${entry?.textColorFillEnabled !== undefined ? (entry.textColorFillEnabled ? 'text-blue-500' : 'text-slate-300') : (entry?.textColorFill ? 'text-blue-500' : 'text-slate-300')}`}>
                              {entry?.textColorFillEnabled !== undefined ? (entry.textColorFillEnabled ? 'TRUE' : 'FALSE') : (entry?.textColorFill ? 'TRUE' : 'FALSE')}
                            </div>
                            <div className="p-3 flex items-center justify-center truncate px-1 gap-1.5 font-mono">
                              {entry?.textColorFill || ''}
                              {entry?.textColorFill && /^#([0-9A-F]{3}){1,2}$/i.test(entry.textColorFill) && (
                                <div 
                                  className="w-2 h-2 rounded-full border border-slate-200 shrink-0 shadow-sm"
                                  style={{ backgroundColor: entry.textColorFill }}
                                />
                              )}
                            </div>
                            <div 
                              className={`p-3 flex items-center justify-center truncate px-1 ${tpa ? 'text-slate-700 font-medium' : 'text-slate-300 italic'}`} 
                              title={tpa ? tp : (tp ? `${tp} (Non transmis)` : '')}
                            >
                              {tpa ? tp : ''}
                            </div>
                            <div className={`p-3 flex items-center justify-center font-bold px-1 ${tpa ? 'text-blue-500' : 'text-slate-300'}`}>
                              {tpa ? 'TRUE' : 'FALSE'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PREVIEW STUDIO CANVAS (Drag, Drop backgrounds & unique designs, realtime update of presets) */
              <div className="flex-grow flex flex-col xl:flex-row gap-8 overflow-y-auto xl:overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                {/* Column 1: Interactive 640x640 Canvas Frame */}
                <div className="flex flex-col items-center gap-4 shrink-0 mx-auto w-full max-w-[520px] 2xl:max-w-[640px] xl:h-full xl:overflow-y-auto scrollbar-hide py-1">
                  {rowNumber ? (
                    <div className="flex gap-4 text-[10px] font-mono text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/50 w-full justify-between select-none shadow-inner shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>Logo : <b className="text-slate-800">{formData.logo ? `${formData.logoX || '0'}x, ${formData.logoY || '0'}y` : 'OFF'}</b></span>
                        {formData.logo && (
                          <span className="text-slate-300"> ({formData.logoSize || '150'}px)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span>Texte : <b className="text-slate-800">{formData.text ? `${formData.textX || '0'}x, ${formData.textY || '0'}y` : 'OFF'}</b></span>
                        {formData.text && (
                          <span className="text-slate-300"> ({formData.textSize || '32'}px)</span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Absolute positioning canvas with CSS containerquery for perfect text vector resizing */}
                  <div 
                    className="relative border-4 border-slate-900/10 rounded-2xl shadow-xl bg-slate-950 overflow-hidden select-none w-full aspect-square cursor-crosshair active:cursor-grabbing shrink-0"
                    style={{ containerType: 'inline-size' }}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={() => setDragTarget(null)}
                    onMouseLeave={() => setDragTarget(null)}
                    onTouchMove={handleCanvasTouchMove}
                    onTouchEnd={() => setDragTarget(null)}
                  >
                    {/* 1. Dragged custom background or blueprint grid */}
                    {(useFirebaseStorage && (formData.imageId || rowNumber) && !storageImgError) ? (
                      <img 
                        src={getFirebaseStorageUrl(firebaseStoragePath, formData.imageId || rowNumber, storageImgExt)}
                        alt="Background Preview" 
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          if (storageImgExt === 'png') {
                            setStorageImgExt('jpg');
                          } else {
                            setStorageImgError(true);
                          }
                        }}
                      />
                    ) : previewBg ? (
                      <img 
                        src={previewBg} 
                        alt="Background Preview" 
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-slate-950" style={{
                         backgroundImage: 'radial-gradient(rgba(51, 65, 85, 0.4) 1.5px, transparent 1.5px), linear-gradient(rgba(51, 65, 85, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(51, 65, 85, 0.15) 1px, transparent 1px)',
                         backgroundSize: '24px 24px',
                         backgroundPosition: 'center',
                      }} />
                    )}

                    {/* Central axes guides */}
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                      <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-sky-500 border-t border-dashed border-sky-500/50" />
                      <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-sky-500 border-l border-dashed border-sky-500/50" />
                    </div>

                    {/* Vehicle Overlay Layer (Reference vehicle, transparent PNG, resizable & draggable) */}
                    {previewVehicle && (
                      <div 
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const relY = e.clientY - rect.top;
                          if (!isVehiclePixelOpaque(relX, relY, rect.width, rect.height)) {
                            return;
                          }
                          e.stopPropagation();
                          setDragTarget('vehicle');
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const touch = e.touches[0];
                          const relX = touch.clientX - rect.left;
                          const relY = touch.clientY - rect.top;
                          if (!isVehiclePixelOpaque(relX, relY, rect.width, rect.height)) {
                            return;
                          }
                          e.stopPropagation();
                          setDragTarget('vehicle');
                        }}
                        className="absolute select-none z-10"
                        style={{
                          left: `${(vehicleX) / refRes * 100}%`,
                          top: `${(vehicleY) / refRes * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          width: vehicleProps.width,
                          height: vehicleProps.height,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: vehicleOpacity / 100,
                          cursor: 'move',
                          pointerEvents: 'auto'
                        }}
                        title="Faites glisser pour ajuster la position du véhicule de test"
                      >
                        <img 
                          src={previewVehicle} 
                          alt="Vehicle transparent reference overlay" 
                          className="w-full h-full object-contain pointer-events-none select-none"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* 2. Logo Overlay (Visual bounds & Coordinates derived horizontally & vertically) */}
                    {formData.logo && (
                      <div 
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const relY = e.clientY - rect.top;
                          if (previewLogo && !isLogoPixelOpaque(relX, relY, rect.width, rect.height)) {
                            return;
                          }
                          e.stopPropagation();
                          setDragTarget('logo');
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const touch = e.touches[0];
                          const relX = touch.clientX - rect.left;
                          const relY = touch.clientY - rect.top;
                          if (previewLogo && !isLogoPixelOpaque(relX, relY, rect.width, rect.height)) {
                            return;
                          }
                          e.stopPropagation();
                          setDragTarget('logo');
                        }}
                        className="absolute select-none cursor-move z-10 hover:opacity-90"
                        style={{
                          left: `${getSafeCoord(formData.logoX, 512) / refRes * 100}%`,
                          top: `${getSafeCoord(formData.logoY, 100) / refRes * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          width: `${getSafeCoord(formData.logoSize, 150) / refRes * 100}%`,
                          height: `${getSafeCoord(formData.logoSize, 150) / refRes * 100}%`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          filter: getLogoFilterStyle(logoShadow)
                        }}
                        title="Faites glisser pour changer la position du Logo"
                      >
                        {previewLogo ? (
                          formData.logoColorFillEnabled && formData.logoColorFill && formData.logoColorFill.trim() ? (
                            <div
                              className="w-full h-full pointer-events-none select-none"
                              style={{
                                backgroundColor: formData.logoColorFill,
                                maskImage: `url(${previewLogo})`,
                                WebkitMaskImage: `url(${previewLogo})`,
                                maskSize: 'contain',
                                WebkitMaskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                WebkitMaskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                WebkitMaskPosition: 'center'
                              }}
                            />
                          ) : (
                            <img 
                              src={previewLogo} 
                              alt="Logo preview configuré" 
                              className="w-full h-full object-contain pointer-events-none select-none"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (() => {
                          const isColorFillActive = formData.logoColorFillEnabled && formData.logoColorFill && /^#([0-9A-F]{3}){1,2}$/i.test(formData.logoColorFill);
                          const strokeColor = isColorFillActive ? formData.logoColorFill : 'url(#logoGrad)';
                          return (
                            <svg 
                              viewBox="0 0 100 100" 
                              style={{ 
                                width: '100%', 
                                height: '100%'
                              }}
                              className={`transition-colors duration-150 pointer-events-none select-none ${logoShadow.enabled ? '' : 'drop-shadow-md'}`}
                            >
                              <defs>
                                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#ec4899" />
                                  <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                              </defs>
                              {/* 4 corners of the focus frame adjusted closer to borders to match user calculation perfectly */}
                              <path 
                                d="M 4,25 L 4,4 L 25,4" 
                                fill="none" 
                                stroke={strokeColor} 
                                strokeWidth="5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />
                              <path 
                                d="M 75,4 L 96,4 L 96,25" 
                                fill="none" 
                                stroke={strokeColor} 
                                strokeWidth="5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />
                              <path 
                                d="M 4,75 L 4,96 L 25,96" 
                                fill="none" 
                                stroke={strokeColor} 
                                strokeWidth="5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />
                              <path 
                                d="M 75,96 L 96,96 L 96,75" 
                                fill="none" 
                                stroke={strokeColor} 
                                strokeWidth="5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />
                              {/* Central bold LOGO label with gradient or fill */}
                              <text
                                x="50"
                                y="58"
                                textAnchor="middle"
                                fill={isColorFillActive ? strokeColor : 'url(#logoGrad)'}
                                style={{
                                  fontFamily: '"Inter", sans-serif',
                                  fontWeight: '900',
                                  fontSize: '22px',
                                  letterSpacing: '1px'
                                }}
                              >
                                LOGO
                              </text>
                            </svg>
                          );
                        })()}
                      </div>
                    )}

                    {/* 3. Text Overlay (Conditional and Draggable) */}
                    {formData.text && (
                      <div 
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = e.clientX - rect.left;
                          const relY = e.clientY - rect.top;
                          const textCont = formData.textContent || fakeText || rowNumber || 'Exemple de Texte';
                          const fontFam = formData.textFont || 'Inter';
                          const alignMode = formData.textAlign || 'CENTRE';
                          if (!isTextPixelOpaque(textCont, fontFam, rect.height, alignMode, relX, relY, rect.width, rect.height)) {
                            return;
                          }
                          e.stopPropagation();
                          setDragTarget('text');
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const touch = e.touches[0];
                          const relX = touch.clientX - rect.left;
                          const relY = touch.clientY - rect.top;
                          const textCont = formData.textContent || fakeText || rowNumber || 'Exemple de Texte';
                          const fontFam = formData.textFont || 'Inter';
                          const alignMode = formData.textAlign || 'CENTRE';
                          if (!isTextPixelOpaque(textCont, fontFam, rect.height, alignMode, relX, relY, rect.width, rect.height)) {
                            return;
                          }
                          e.stopPropagation();
                          setDragTarget('text');
                        }}
                        className="absolute select-none whitespace-nowrap cursor-move z-10 hover:opacity-95"
                        style={{
                          left: `${getSafeCoord(formData.textX, 512) / refRes * 100}%`,
                          top: `${getSafeCoord(formData.textY, 400) / refRes * 100}%`,
                          transform: `translate(${formData.textAlign === 'GAUCHE' ? '0%' : formData.textAlign === 'DROITE' ? '-100%' : '-50%'}, -50%)`,
                          color: (formData.textColorFillEnabled !== false) && formData.textColorFill && /^#([0-9A-F]{3}){1,2}$/i.test(formData.textColorFill) ? formData.textColorFill : '#ffffff',
                          fontSize: `${getSafeCoord(formData.textSize, 32) / refRes * 100}cqw`, 
                          fontFamily: getFontFamilyStack(formData.textFont || 'Inter'),
                          textAlign: formData.textAlign === 'GAUCHE' ? 'left' : formData.textAlign === 'DROITE' ? 'right' : 'center',
                          transformStyle: 'preserve-3d',
                          perspective: formData.textperspective ? `${formData.textperspective}px` : undefined,
                          textShadow: getTextShadowStyle(textShadow),
                          lineHeight: 1
                        }}
                      >
                        <span className="font-semibold pointer-events-none select-none uppercase tracking-tight">
                          {formData.textContent || fakeText || rowNumber || 'Exemple de Texte'}
                        </span>
                      </div>
                    )}

                    {/* 4. Ratio 4:3 Safety Guide Overlays with high-contrast indicator lines */}
                    {show43Overlay && (
                      <>
                        {/* Top shaded band (12.5% height - representing 160px from the top of the 1280px canvas) */}
                        <div className="absolute top-0 left-0 right-0 h-[12.5%] bg-slate-950/75 border-b border-rose-500/70 backdrop-blur-[0.5px] pointer-events-none z-10 flex items-center justify-center">
                          <span className="text-[9px] font-mono tracking-widest text-rose-300 font-bold bg-slate-900/60 py-0.5 px-2 rounded border border-rose-500/20">160 px</span>
                        </div>
                        {/* Bottom shaded band (12.5% height - representing 160px from the bottom of the 1280px canvas) */}
                        <div className="absolute bottom-0 left-0 right-0 h-[12.5%] bg-slate-950/75 border-t border-rose-500/70 backdrop-blur-[0.5px] pointer-events-none z-10 flex items-center justify-center">
                          <span className="text-[9px] font-mono tracking-widest text-rose-300 font-bold bg-slate-900/60 py-0.5 px-2 rounded border border-rose-500/20">160 px</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Drag and Drop instructions indicator bar */}
                  <div className="text-[10px] text-slate-500 font-medium text-center select-none bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
                    🖱️ <b>Déplacez</b> la cible (logo, texte ou calque véhicule) à la souris pour l'ajuster en temps réel.
                  </div>
                </div>

                {/* Column 2: Drag and Drop Setup and Assets Config */}
                <div className="flex-grow flex flex-col gap-6 justify-between min-w-0 xl:h-full xl:overflow-y-auto scrollbar-hide p-1">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        Ajustement Vidéo & Maquette
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Établissez ici vos éléments de prévisualisation généraux. Glissez simplement vos fichiers : ils resteront mémorisés sur votre poste local pour des validations fluides. Aucun impact sur vos exports bruts !
                      </p>
                    </div>

                    {/* Firebase Storage Environment Sync Option */}
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={useFirebaseStorage}
                            onChange={(e) => handleToggleFirebaseStorage(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          Firebase Storage
                        </label>
                        <span className="text-[9px] bg-slate-200/70 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          gs://...
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Lien du dossier Firebase Storage (GS://)</span>
                        <input 
                          type="text"
                          value={firebaseStoragePath}
                          onChange={(e) => handleFirebaseStoragePathChange(e.target.value)}
                          placeholder="gs://gen-lang-client-0870404092.firebasestorage.app/ENVIRONMENTS"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-[11px] font-mono text-slate-700 shadow-sm outline-none"
                        />
                      </div>
                      {useFirebaseStorage && (formData.imageId || rowNumber) && (
                        <div className="p-2 bg-emerald-50 text-emerald-800 text-[10px] rounded-lg border border-emerald-100/50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="truncate">
                              Fichier recherché : <strong className="font-mono text-[10.5px]">{formData.imageId || rowNumber}.{storageImgExt}</strong>
                            </span>
                          </div>
                          {storageImgError ? (
                            <span className="text-red-500 font-bold shrink-0 text-[9px] uppercase">NON TROUVÉ</span>
                          ) : (
                            <span className="text-emerald-600 font-bold shrink-0 text-[9px] uppercase">ACTIF</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 1. Drag & Drop Background Upload Zone */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest">
                        🖼️ Image d'Arrière-Plan
                      </label>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Lien de l'image (URL)</span>
                        <input 
                          type="text"
                          value={previewBg || ''}
                          onChange={(e) => {
                            const val = e.target.value.trim() || null;
                            setPreviewBg(val);
                            try {
                              if (val) localStorage.setItem('sheetsync_preview_bg', val);
                              else localStorage.removeItem('sheetsync_preview_bg');
                            } catch {}
                          }}
                          placeholder="Collez ou insérez l'URL du fond d'écran"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-[11px] font-mono text-slate-700 shadow-sm outline-none placeholder:text-slate-400"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                        <div 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleBgUpload(e.dataTransfer.files[0]);
                            }
                          }}
                          className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50/50 transition-all group flex flex-col items-center justify-center gap-1 shrink-0"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files;
                              if (files && files[0]) handleBgUpload(files[0]);
                            };
                            input.click();
                          }}
                        >
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          <span className="text-[10.5px] font-bold text-slate-600 group-hover:text-slate-800">
                            Glissez un fond ou cliquez ici
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Format recommandé : 1280x1280 (ex: ARCHI)
                          </span>
                        </div>
                        
                        {previewBg && (
                          <button
                            type="button"
                            onClick={handleResetBg}
                            className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-extrabold uppercase border border-red-200 tracking-wider flex items-center justify-center gap-1.5 md:flex-col shrink-0 min-h-[80px]"
                          >
                            <X className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 1.5. Vehicle Transparent Overlay Setup (Below the background image) */}
                    <div className="space-y-3 bg-emerald-50/20 border border-emerald-100/40 p-4 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-emerald-700 block uppercase tracking-widest flex items-center gap-1">
                          🚗 Calque Véhicule (PNG)
                        </label>
                        {previewVehicle && (
                          <span className="text-[8px] bg-emerald-500 text-white font-mono font-bold px-1.5 py-0.5 rounded animate-pulse">
                            CALQUE CHARGÉ
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-emerald-600/85 uppercase tracking-wide block">Lien du Calque Véhicule (URL)</span>
                        <input 
                          type="text"
                          value={previewVehicle || ''}
                          onChange={(e) => {
                            const val = e.target.value.trim() || null;
                            setPreviewVehicle(val);
                            if (val) {
                              updateVehicleScale(70.3125);
                              updateVehicleX(640);
                            }
                            try {
                              if (val) localStorage.setItem('sheetsync_preview_vehicle', val);
                              else localStorage.removeItem('sheetsync_preview_vehicle');
                            } catch {}
                          }}
                          placeholder="Collez ou insérez l'URL de l'image véhicule"
                          className="w-full px-3 py-1.5 border border-emerald-200/50 rounded-xl bg-white text-[11px] font-mono text-emerald-700 shadow-sm outline-none placeholder:text-emerald-400"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                        <div 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleVehicleUpload(e.dataTransfer.files[0]);
                            }
                          }}
                          className="border-2 border-dashed border-emerald-200/60 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer hover:bg-emerald-50/45 transition-all group flex flex-col items-center justify-center gap-1 shrink-0"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files;
                              if (files && files[0]) handleVehicleUpload(files[0]);
                            };
                            input.click();
                          }}
                        >
                          <Upload className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                          <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-800">
                            Glissez un véhicule (PNG) ou cliquez ici
                          </span>
                          <span className="text-[8.5px] text-slate-400">
                            Format avec transparence de préférence (gabarit route/tram)
                          </span>
                        </div>
                        
                        {previewVehicle && (
                          <button
                            type="button"
                            onClick={handleResetVehicle}
                            className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-extrabold uppercase border border-red-200 tracking-wider flex items-center justify-center gap-1.5 md:flex-col shrink-0 min-h-[70px]"
                          >
                            <X className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>

                      {previewVehicle && (
                        <div className="space-y-3 pt-2 border-t border-emerald-100/40">
                          {/* Scale and Opacity Controls Side-By-Side */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* 1. Scale control */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                <span>Échelle (%)</span>
                                <input 
                                  type="number" 
                                  min="5" 
                                  max="200" 
                                  value={vehicleScale}
                                  onChange={(e) => updateVehicleScale(Math.max(5, Math.min(200, Number(e.target.value) || 50)))}
                                  className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none font-bold"
                                />
                              </div>
                              <input 
                                type="range" 
                                min="5" 
                                max="200" 
                                value={vehicleScale} 
                                onChange={(e) => updateVehicleScale(Number(e.target.value))}
                                className="w-full accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer block mt-1"
                              />
                            </div>

                            {/* 2. Opacity control */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                <span>Opacité (%)</span>
                                <input 
                                  type="number" 
                                  min="5" 
                                  max="100" 
                                  value={vehicleOpacity}
                                  onChange={(e) => updateVehicleOpacity(Math.max(5, Math.min(100, Number(e.target.value) || 60)))}
                                  className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none font-bold"
                                />
                              </div>
                              <input 
                                type="range" 
                                min="5" 
                                max="100" 
                                value={vehicleOpacity} 
                                onChange={(e) => updateVehicleOpacity(Number(e.target.value))}
                                className="w-full accent-emerald-600 h-1 bg-slate-200 rounded-lg cursor-pointer block mt-1"
                              />
                            </div>
                          </div>

                          {/* 3. Coordinate fields */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="space-y-1">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide block">Position X (px)</span>
                              <input 
                                type="number" 
                                min="0"
                                max={refRes}
                                value={vehicleX}
                                onChange={(e) => updateVehicleX(Math.max(0, Math.min(refRes, Number(e.target.value) || 0)))}
                                className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-left text-[10px] font-mono text-slate-700 shadow-sm outline-none font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide block">Position Y (px)</span>
                              <input 
                                type="number" 
                                min="0"
                                max={refRes}
                                value={vehicleY}
                                onChange={(e) => updateVehicleY(Math.max(0, Math.min(refRes, Number(e.target.value) || 0)))}
                                className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-left text-[10px] font-mono text-slate-700 shadow-sm outline-none font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Drag & Drop Logo Upload Zone */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 block uppercase tracking-widest">
                        🛡️ Fichier Logo Unique (Générique de test)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                        <div 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleLogoUpload(e.dataTransfer.files[0]);
                            }
                           }}
                           className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50/50 transition-all group flex flex-col items-center justify-center gap-1 shrink-0"
                           onClick={() => {
                             const input = document.createElement('input');
                             input.type = 'file';
                             input.accept = 'image/*';
                             input.onchange = (e) => {
                               const files = (e.target as HTMLInputElement).files;
                               if (files && files[0]) handleLogoUpload(files[0]);
                             };
                             input.click();
                           }}
                        >
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                          <span className="text-[10.5px] font-bold text-slate-600 group-hover:text-slate-800">
                            Glissez le logo ou cliquez ici
                          </span>
                          <span className="text-[9px] text-slate-400">
                            PNG à fond transparent de préférence
                          </span>
                        </div>
                        
                        {previewLogo && (
                          <button
                            type="button"
                            onClick={handleResetLogo}
                            className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-extrabold uppercase border border-red-200 tracking-wider flex items-center justify-center gap-1.5 md:flex-col shrink-0 min-h-[80px]"
                          >
                            <X className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3. Custom Fake Text Input for Preview Simulation */}
                    <div className="space-y-2 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">
                          📝 Texte de Test (Simulation Preview)
                        </label>
                        {fakeText && (
                          <button
                            type="button"
                            onClick={() => {
                              setFakeText('');
                              try {
                                localStorage.removeItem('sheetsync_preview_fake_text');
                              } catch {}
                            }}
                            className="text-[9px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wide flex items-center gap-1 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" /> EFFACER
                          </button>
                        )}
                      </div>
                      
                      <div className="relative">
                        <input
                          type="text"
                          value={fakeText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFakeText(val);
                            try {
                              localStorage.setItem('sheetsync_preview_fake_text', val);
                            } catch (err) {
                              console.warn('LocalStorage preview fake text storage failed', err);
                            }
                          }}
                          placeholder={rowNumber ? `Utilise l'ID actif : "${rowNumber}"` : "Saisissez un texte personnalisé..."}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all font-sans"
                        />
                      </div>
                      
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Modifie temporairement l'affichage du texte sur le canvas ci-contre pour tester les polices, tailles et alignements. {fakeText ? <span>Indicateur : <b>{fakeText.length} caractères</b>.</span> : <span>Actuellement : affiche l'ID par défaut de la ligne.</span>}
                      </p>
                    </div>

                    {/* 4. Shadow & Light Configuration Interface */}
                    <div className="space-y-4 bg-slate-50 border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                            ✨ Effets d'Ombre & Lumière (Visualisation)
                          </h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateLogoShadow(textShadow)}
                            className="px-2.5 py-1 text-[9px] font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 rounded-lg shadow-sm flex items-center gap-1 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            title="Applique l'effet du texte au logo"
                          >
                            <Copy className="w-2.5 h-2.5" /> IDEM sur Logo
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTextShadow(logoShadow)}
                            className="px-2.5 py-1 text-[9px] font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 rounded-lg shadow-sm flex items-center gap-1 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            title="Applique l'effet du logo au texte"
                          >
                            <Copy className="w-2.5 h-2.5" /> IDEM sur Texte
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                        {/* LEFT COLUMN: Logo effect parameters */}
                        <div className="space-y-3.5 pr-0 md:pr-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                              🛡️ Effet du Logo
                            </span>
                            <button
                              type="button"
                              onClick={() => updateLogoShadow({ enabled: !logoShadow.enabled })}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border transition-all ${logoShadow.enabled ? 'bg-amber-500 border-amber-600 text-white' : 'bg-slate-200 border-slate-300 text-slate-500'}`}
                            >
                              {logoShadow.enabled ? 'ACTIF' : 'INACTIF'}
                            </button>
                          </div>

                          {logoShadow.enabled && (
                            <div className="space-y-3 pt-1">
                              {/* 1. Mode select */}
                              <div className="grid grid-cols-2 gap-1 bg-slate-200/55 p-1 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => updateLogoShadow({ mode: 'shadow' })}
                                  className={`py-1 text-[9px] font-extrabold uppercase rounded-md transition-all flex items-center justify-center gap-1 ${logoShadow.mode === 'shadow' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                  <Moon className="w-2.5 h-2.5" /> Ombre
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateLogoShadow({ mode: 'light' })}
                                  className={`py-1 text-[9px] font-extrabold uppercase rounded-md transition-all flex items-center justify-center gap-1 ${logoShadow.mode === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                  <Sun className="w-2.5 h-2.5" /> Lumière
                                </button>
                              </div>

                              {/* 2. Positions checkboxes */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Orientation physique</label>
                                <div className="grid grid-cols-4 gap-1">
                                  {[
                                    { id: 'bottom-left', label: '↙️ Bas-G' },
                                    { id: 'bottom-center', label: '⬇️ Bas-M' },
                                    { id: 'bottom-right', label: '↘️ Bas-D' },
                                    { id: 'diffused', label: '✨ Diffus' }
                                  ].map(pos => (
                                    <button
                                      type="button"
                                      key={pos.id}
                                      onClick={() => updateLogoShadow({ position: pos.id as any })}
                                      className={`py-1 text-[8.5px] font-bold rounded-md border text-center transition-all ${logoShadow.position === pos.id ? 'bg-white border-amber-400 text-amber-700 shadow-sm' : 'bg-white/50 border-slate-200 text-slate-500 hover:bg-white'}`}
                                    >
                                      {pos.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 3. Opacity Slider + Input */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                  <span>Intensité (Opacité)</span>
                                  <span className="font-mono text-slate-700">{logoShadow.opacity}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={logoShadow.opacity} 
                                    onChange={(e) => updateLogoShadow({ opacity: Number(e.target.value) })}
                                    className="flex-grow accent-amber-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                                  />
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    value={logoShadow.opacity}
                                    onChange={(e) => updateLogoShadow({ opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                    className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none"
                                  />
                                </div>
                              </div>

                              {/* 4. Distance Slider + Input */}
                              {logoShadow.position !== 'diffused' && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                    <span>Distance (Décalage)</span>
                                    <span className="font-mono text-slate-700">{logoShadow.distance}px</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="range" 
                                      min="0" 
                                      max="50" 
                                      value={logoShadow.distance} 
                                      onChange={(e) => updateLogoShadow({ distance: Number(e.target.value) })}
                                      className="flex-grow accent-amber-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                                    />
                                    <input 
                                      type="number" 
                                      min="0" 
                                      max="100" 
                                      value={logoShadow.distance}
                                      onChange={(e) => updateLogoShadow({ distance: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                      className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* 5. Blur/Softness Slider + Input */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                  <span>Flou de Diffusion</span>
                                  <span className="font-mono text-slate-700">{logoShadow.blur}px</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="50" 
                                    value={logoShadow.blur} 
                                    onChange={(e) => updateLogoShadow({ blur: Number(e.target.value) })}
                                    className="flex-grow accent-amber-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                                  />
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="50" 
                                    value={logoShadow.blur}
                                    onChange={(e) => updateLogoShadow({ blur: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                                    className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none"
                                  />
                                </div>
                              </div>

                              {/* 6. Color selection (light mode only) */}
                              {logoShadow.mode === 'light' && (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Teinte lumineuse</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={logoShadow.color || '#ffffff'} 
                                      onChange={(e) => updateLogoShadow({ color: e.target.value })}
                                      className="w-7 h-7 rounded border border-slate-200 cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                                    />
                                    <input 
                                      type="text" 
                                      value={logoShadow.color || '#ffffff'} 
                                      onChange={(e) => updateLogoShadow({ color: e.target.value })}
                                      className="flex-grow px-2 py-1 border border-slate-200 rounded bg-white text-[10px] font-mono text-slate-700 uppercase outline-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* RIGHT COLUMN: Text effect parameters */}
                        <div className="space-y-3.5 pt-4 md:pt-0 pl-0 md:pl-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1">
                              📝 Effet du Texte
                            </span>
                            <button
                              type="button"
                              onClick={() => updateTextShadow({ enabled: !textShadow.enabled })}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border transition-all ${textShadow.enabled ? 'bg-blue-500 border-blue-600 text-white' : 'bg-slate-200 border-slate-300 text-slate-500'}`}
                            >
                              {textShadow.enabled ? 'ACTIF' : 'INACTIF'}
                            </button>
                          </div>

                          {textShadow.enabled && (
                            <div className="space-y-3 pt-1">
                              {/* 1. Mode select */}
                              <div className="grid grid-cols-2 gap-1 bg-slate-200/55 p-1 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => updateTextShadow({ mode: 'shadow' })}
                                  className={`py-1 text-[9px] font-extrabold uppercase rounded-md transition-all flex items-center justify-center gap-1 ${textShadow.mode === 'shadow' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                  <Moon className="w-2.5 h-2.5" /> Ombre
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateTextShadow({ mode: 'light' })}
                                  className={`py-1 text-[9px] font-extrabold uppercase rounded-md transition-all flex items-center justify-center gap-1 ${textShadow.mode === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                  <Sun className="w-2.5 h-2.5" /> Lumière
                                </button>
                              </div>

                              {/* 2. Positions checkboxes */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Orientation physique</label>
                                <div className="grid grid-cols-4 gap-1">
                                  {[
                                    { id: 'bottom-left', label: '↙️ Bas-G' },
                                    { id: 'bottom-center', label: '⬇️ Bas-M' },
                                    { id: 'bottom-right', label: '↘️ Bas-D' },
                                    { id: 'diffused', label: '✨ Diffus' }
                                  ].map(pos => (
                                    <button
                                      type="button"
                                      key={pos.id}
                                      onClick={() => updateTextShadow({ position: pos.id as any })}
                                      className={`py-1 text-[8.5px] font-bold rounded-md border text-center transition-all ${textShadow.position === pos.id ? 'bg-white border-blue-400 text-blue-700 shadow-sm' : 'bg-white/50 border-slate-200 text-slate-500 hover:bg-white'}`}
                                    >
                                      {pos.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 3. Opacity Slider + Input */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                  <span>Intensité (Opacité)</span>
                                  <span className="font-mono text-slate-700">{textShadow.opacity}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={textShadow.opacity} 
                                    onChange={(e) => updateTextShadow({ opacity: Number(e.target.value) })}
                                    className="flex-grow accent-blue-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                                  />
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    value={textShadow.opacity}
                                    onChange={(e) => updateTextShadow({ opacity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                    className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none"
                                  />
                                </div>
                              </div>

                              {/* 4. Distance Slider + Input */}
                              {textShadow.position !== 'diffused' && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                    <span>Distance (Décalage)</span>
                                    <span className="font-mono text-slate-700">{textShadow.distance}px</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="range" 
                                      min="0" 
                                      max="50" 
                                      value={textShadow.distance} 
                                      onChange={(e) => updateTextShadow({ distance: Number(e.target.value) })}
                                      className="flex-grow accent-blue-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                                    />
                                    <input 
                                      type="number" 
                                      min="0" 
                                      max="100" 
                                      value={textShadow.distance}
                                      onChange={(e) => updateTextShadow({ distance: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                      className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* 5. Blur/Softness Slider + Input */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase">
                                  <span>Flou de Diffusion</span>
                                  <span className="font-mono text-slate-700">{textShadow.blur}px</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="50" 
                                    value={textShadow.blur} 
                                    onChange={(e) => updateTextShadow({ blur: Number(e.target.value) })}
                                    className="flex-grow accent-blue-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                                  />
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="50" 
                                    value={textShadow.blur}
                                    onChange={(e) => updateTextShadow({ blur: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                                    className="w-12 px-1 py-0.5 border border-slate-200 rounded bg-white text-center text-[10px] font-mono text-slate-700 shadow-sm outline-none"
                                  />
                                </div>
                              </div>

                              {/* 6. Color selection (light mode only) */}
                              {textShadow.mode === 'light' && (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Teinte lumineuse</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={textShadow.color || '#ffffff'} 
                                      onChange={(e) => updateTextShadow({ color: e.target.value })}
                                      className="w-7 h-7 rounded border border-slate-200 cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                                    />
                                    <input 
                                      type="text" 
                                      value={textShadow.color || '#ffffff'} 
                                      onChange={(e) => updateTextShadow({ color: e.target.value })}
                                      className="flex-grow px-2 py-1 border border-slate-200 rounded bg-white text-[10px] font-mono text-slate-700 uppercase outline-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {rowNumber && (
                      <div className="bg-amber-50/30 border border-amber-200/40 rounded-xl p-4 space-y-2 text-[11px] text-slate-600 leading-normal">
                        <p className="font-bold text-amber-800 text-xs flex items-center gap-1">
                          ✨ Présélection automatique
                        </p>
                        <p>
                          L'aperçu dynamique affiche actuellement les coordonnées du preset <b>{rowNumber}</b>. Si vous modifiez d'autres presets, les boutons s'ajustent automatiquement.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-extrabold tracking-widest uppercase">
                    <span>STATUT CLIENT : SYNCHRONISÉ</span>
                    <span className="text-slate-200">|</span>
                    <span>Échelle 1:2 (640x640)</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 bg-slate-900 text-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.1em]">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Cloud Persistence Active
          </span>
          <span className="text-slate-700">/</span>
          <span className="text-slate-400">{Object.keys(entries).length} Objects Indexed</span>
        </div>
        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em] hidden sm:block">
          AUTO-SAVE IS ON | AES-256 ENCRYPTED SHA-2 CONNECTION
        </div>
      </footer>

      {/* Color Picker Modal Overlay with AnimatePresence */}
      <AnimatePresence>
        {showColorModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Nuancier & Palette de Couleurs Officielle
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      Configurez la couleur pour le champ <span className="text-slate-800 font-bold uppercase">{showColorModal === 'logoColorFill' ? 'RGB / COLOR FILL du Logo' : 'Color Fill du Texte'}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowColorModal(null)}
                  className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-[10px] uppercase font-black tracking-widest text-slate-600 transition-colors cursor-pointer"
                >
                  Fermer [X]
                </button>
              </div>

              {/* Main Modal Body */}
              <div className="flex-grow p-6 overflow-y-auto space-y-6">
                
                {/* Section 1: Direct Link and Quick Presets */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wider">
                      🔗 Charte de Couleurs de Référence
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Cliquez sur le lien de partage ci-dessous pour accéder au nuancier complet et approuvé. Copiez simplement le code HEX (ex: <code className="bg-slate-200 px-1 rounded font-mono text-[10px]">#E21C21</code> ou <code className="bg-slate-200 px-1 rounded font-mono text-[10px]">#000000</code>) et saisissez-le dans le champ ci-contre.
                    </p>
                    <a 
                      href="https://share.google/AsV7H0fvbkxtRHjmA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ouvrir le Nuancier Officiel (Nouveau Onglet) ↗
                    </a>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wider">
                      🎨 Saisie de Couleur & Rendu Live
                    </span>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-grow">
                        <label className="text-[8.5px] font-mono text-slate-400 uppercase font-bold block mb-1">Code HEX (avec #)</label>
                        <input 
                          type="text" 
                          value={modalColorVal}
                          onChange={(e) => handleModalColorChange(e.target.value)}
                          placeholder="Ex: #FFFFFF"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono text-slate-700 focus:ring-1 focus:ring-indigo-400 outline-none uppercase font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[8.5px] font-mono text-slate-400 uppercase font-bold block mb-1">Avis</span>
                        <div 
                          className="w-10 h-10 rounded-xl border border-slate-300 shadow-md transition-all shrink-0"
                          style={{ backgroundColor: /^#([0-9A-F]{3}){1,2}$/i.test(modalColorVal) ? modalColorVal : '#f1f5f9' }}
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">Palette d'accès rapide :</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: 'Noir Intense', hex: '#000000' },
                          { name: 'Blanc Pur', hex: '#FFFFFF' },
                          { name: 'Rouge Bourgogne', hex: '#9E1C1F' },
                          { name: 'Rouge Vif', hex: '#EF4444' },
                          { name: 'Bleu Royal', hex: '#1D4ED8' },
                          { name: 'Jaune Signal', hex: '#F59E0B' },
                          { name: 'Vert Forêt', hex: '#065F46' },
                          { name: 'Gris Ardoise', hex: '#475569' }
                        ].map((preset) => (
                          <button
                            key={preset.hex}
                            type="button"
                            onClick={() => handleModalColorChange(preset.hex)}
                            className={`px-2 py-1 rounded-lg border text-[9px] font-bold flex items-center gap-1.5 transition-all hover:scale-[1.03] cursor-pointer ${modalColorVal.toUpperCase() === preset.hex ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-extrabold' : 'border-slate-200 bg-white text-slate-600'}`}
                          >
                            <span className="w-2.5 h-2.5 rounded border border-slate-200 shrink-0" style={{ backgroundColor: preset.hex }} />
                            <span>{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Embed Document View */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">
                    📝 Aperçu direct du nuancier de référence
                  </span>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 min-h-[400px] flex flex-col relative">
                    <iframe 
                      src="https://share.google/AsV7H0fvbkxtRHjmA" 
                      className="w-full h-[400px] border-0 shrink-0"
                      title="Nuancier de couleurs de référence"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                    <div className="p-3 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-500 font-medium text-center">
                      ℹ️ <i>Note : Si Google bloque l'affichage direct du document ci-dessus par sécurité (restrictions d'iFrames), veuillez cliquer sur le bouton violet "Ouvrir le Nuancier Officiel (Nouveau Onglet)" ci-dessus pour le consulter en plein écran !</i>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowColorModal(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-xs tracking-wider rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                >
                  Appliquer & Fermer la Palette
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirmId && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-2 border border-red-100">
                  <Trash2 className="w-5 h-5 text-red-650 animate-pulse" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  EFFACER ? confirmez
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold max-w-xs mx-auto">
                  Voulez-vous vraiment supprimer définitivement ce preset ?
                </p>
                {entries[deleteConfirmId] && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200/50 rounded-xl mt-2">
                    <span className="text-[10px] font-mono text-slate-800 font-bold block">
                      ID : {entries[deleteConfirmId].imageId || 'Ligne vide'}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-xs tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer text-center"
                >
                  NON
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (deleteConfirmId) {
                      await handleDelete(deleteConfirmId);
                      setDeleteConfirmId(null);
                    }
                  }}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                >
                  OUI
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-2 border border-red-100">
                  <Trash2 className="w-5 h-5 text-red-650 animate-pulse" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  SUPPRESSION GROUPÉE
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold max-w-xs mx-auto">
                  Êtes-vous sûr de vouloir supprimer définitivement les <b className="text-rose-600">{Object.values(selectedRowIds).filter(Boolean).length} presets sélectionnés</b> ? Cette action est irréversible.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-xs tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer text-center disabled:opacity-50"
                >
                  ANNULER
                </button>
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={async () => {
                    setIsDeletingBulk(true);
                    try {
                      const selectedIds = Object.keys(selectedRowIds).filter(id => selectedRowIds[id]);
                      for (const id of selectedIds) {
                        await handleDelete(id);
                      }
                      setSelectedRowIds({});
                      setIsBulkDeleteMode(false);
                      setShowBulkDeleteConfirm(false);
                    } catch (err) {
                      console.error("Error bulk deleting:", err);
                    } finally {
                      setIsDeletingBulk(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingBulk ? 'SUPPRESSION...' : 'CONFIRMER'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
