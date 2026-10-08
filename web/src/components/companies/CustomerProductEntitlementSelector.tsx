import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductModule, ProductSubmodule, CustomerProductEntitlement } from '../../types';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Package,
  AlertCircle,
} from 'lucide-react';

interface CustomerProductEntitlementSelectorProps {
  products: Product[];
  value: CustomerProductEntitlement[];
  onChange: (entitlements: CustomerProductEntitlement[], productIds: string[]) => void;
  error?: string | null;
  disabledProductIds?: string[];
  title?: string;
  subtitle?: string;
}

export const CustomerProductEntitlementSelector: React.FC<CustomerProductEntitlementSelectorProps> = ({
  products,
  value,
  onChange,
  error,
  disabledProductIds = [],
  title = 'Customer Product & Module Entitlements',
  subtitle = 'Select products and optional modules/submodules purchased by the customer.',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  // Fast map from value
  // value is Array of { productId, purchaseType, modules: [{ moduleId, submoduleIds: [] }] }
  const entitlementMap = useMemo(() => {
    const map: Record<string, {
      selected: boolean;
      purchaseType: 'SELECTED_MODULES' | 'COMPLETE';
      moduleMap: Map<string, Set<string>>; // moduleId -> Set of submoduleIds
    }> = {};

    for (const ent of value || []) {
      const prod = products.find((p) => p.id === ent.productId);
      const modMap = new Map<string, Set<string>>();

      if (ent.purchaseType === 'COMPLETE' && prod) {
        for (const m of prod.modules || []) {
          const subSet = new Set<string>();
          for (const s of m.submodules || []) {
            subSet.add(s.id);
          }
          modMap.set(m.id, subSet);
        }
      } else {
        for (const m of ent.modules || []) {
          modMap.set(m.moduleId, new Set(m.submoduleIds || []));
        }
      }

      map[ent.productId] = {
        selected: true,
        purchaseType: ent.purchaseType || 'SELECTED_MODULES',
        moduleMap: modMap,
      };
    }
    return map;
  }, [value, products]);

  // Auto-expand product when it is selected
  useEffect(() => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      for (const ent of value || []) {
        next.add(ent.productId);
      }
      return next;
    });
  }, [value]);

  // Search auto-expand
  useEffect(() => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const expProds = new Set<string>();
      const expMods = new Set<string>();

      for (const prod of products) {
        let matchInProd = prod.name.toLowerCase().includes(q) || prod.code.toLowerCase().includes(q);
        for (const mod of prod.modules || []) {
          let matchInMod = mod.name.toLowerCase().includes(q);
          for (const sub of mod.submodules || []) {
            if (sub.name.toLowerCase().includes(q)) {
              matchInMod = true;
              matchInProd = true;
            }
          }
          if (matchInMod) {
            expMods.add(mod.id);
            matchInProd = true;
          }
        }
        if (matchInProd) {
          expProds.add(prod.id);
        }
      }

      setExpandedProductIds(expProds);
      setExpandedModuleIds(expMods);
    }
  }, [searchTerm, products]);

  // Emit change helper
  const emitChange = (newMap: Record<string, {
    selected: boolean;
    purchaseType: 'SELECTED_MODULES' | 'COMPLETE';
    moduleMap: Map<string, Set<string>>;
  }>) => {
    const newEntitlements: CustomerProductEntitlement[] = [];
    const newProductIds: string[] = [];

    for (const [pid, state] of Object.entries(newMap)) {
      if (!state.selected) continue;
      newProductIds.push(pid);

      const modulesArr: Array<{ moduleId: string; submoduleIds: string[] }> = [];
      state.moduleMap.forEach((subSet, mId) => {
        modulesArr.push({
          moduleId: mId,
          submoduleIds: Array.from(subSet),
        });
      });

      newEntitlements.push({
        productId: pid,
        purchaseType: state.purchaseType,
        modules: modulesArr,
      });
    }

    onChange(newEntitlements, newProductIds);
  };

  // Toggle Product
  const handleToggleProduct = (productId: string) => {
    if (disabledProductIds.includes(productId)) return;
    const current = entitlementMap[productId];
    const newMap = { ...entitlementMap };

    if (current && current.selected) {
      delete newMap[productId];
    } else {
      // New product entitlement: DO NOT automatically check modules
      newMap[productId] = {
        selected: true,
        purchaseType: 'SELECTED_MODULES',
        moduleMap: new Map(),
      };
      setExpandedProductIds((prev) => {
        const s = new Set(prev);
        s.add(productId);
        return s;
      });
    }

    emitChange(newMap);
  };

  // Toggle Module
  const handleToggleModule = (productId: string, moduleId: string) => {
    const current = entitlementMap[productId];
    if (!current || !current.selected) return;

    const newMap = { ...entitlementMap };
    const newModuleMap = new Map(current.moduleMap);

    if (newModuleMap.has(moduleId)) {
      newModuleMap.delete(moduleId);
    } else {
      // Select module: DO NOT automatically check submodules
      newModuleMap.set(moduleId, new Set());
      setExpandedModuleIds((prev) => {
        const s = new Set(prev);
        s.add(moduleId);
        return s;
      });
    }

    newMap[productId] = {
      ...current,
      purchaseType: 'SELECTED_MODULES',
      moduleMap: newModuleMap,
    };

    emitChange(newMap);
  };

  // Toggle Submodule
  const handleToggleSubmodule = (productId: string, moduleId: string, submoduleId: string) => {
    const current = entitlementMap[productId];
    if (!current || !current.selected) return;

    const newMap = { ...entitlementMap };
    const newModuleMap = new Map(current.moduleMap);

    const subSet = new Set(newModuleMap.get(moduleId) || []);
    if (subSet.has(submoduleId)) {
      subSet.delete(submoduleId);
    } else {
      subSet.add(submoduleId);
      if (!newModuleMap.has(moduleId)) {
        newModuleMap.set(moduleId, subSet);
      }
    }

    newModuleMap.set(moduleId, subSet);

    newMap[productId] = {
      ...current,
      purchaseType: 'SELECTED_MODULES',
      moduleMap: newModuleMap,
    };

    emitChange(newMap);
  };

  // Quick action: Select All Modules for a product
  const handleSelectAllModules = (product: Product) => {
    const current = entitlementMap[product.id];
    if (!current || !current.selected) return;

    const newMap = { ...entitlementMap };
    const newModuleMap = new Map<string, Set<string>>();

    for (const m of product.modules || []) {
      const subSet = new Set<string>();
      for (const s of m.submodules || []) {
        subSet.add(s.id);
      }
      newModuleMap.set(m.id, subSet);
    }

    newMap[product.id] = {
      ...current,
      purchaseType: 'SELECTED_MODULES',
      moduleMap: newModuleMap,
    };

    emitChange(newMap);
  };

  // Quick action: Deselect All Modules for a product
  const handleDeselectAllModules = (productId: string) => {
    const current = entitlementMap[productId];
    if (!current || !current.selected) return;

    const newMap = { ...entitlementMap };
    newMap[productId] = {
      ...current,
      purchaseType: 'SELECTED_MODULES',
      moduleMap: new Map(),
    };

    emitChange(newMap);
  };

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase().trim();

    return products.filter((prod) => {
      if (prod.name.toLowerCase().includes(q) || prod.code.toLowerCase().includes(q)) return true;
      for (const mod of prod.modules || []) {
        if (mod.name.toLowerCase().includes(q)) return true;
        for (const sub of mod.submodules || []) {
          if (sub.name.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [products, searchTerm]);

  // Selected count
  const totalSelectedProds = useMemo(() => {
    return Object.values(entitlementMap).filter((s) => s.selected).length;
  }, [entitlementMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={15} color="#2563eb" />
            <span>{title}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{subtitle}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, border: '1px solid #bfdbfe' }}>
          {totalSelectedProds} {totalSelectedProds === 1 ? 'Product' : 'Products'} Selected
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fef2f2',
            color: '#b91c1c',
            borderRadius: 6,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid #fecaca',
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Compact Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search product catalog..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px 6px 28px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            outline: 'none',
            background: '#ffffff',
          }}
        />
      </div>

      {/* Product Hierarchy List - Seamless height, no nested scrollbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12, background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1' }}>
            No products found matching &ldquo;{searchTerm}&rdquo;
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const entState = entitlementMap[prod.id];
            const isSelected = Boolean(entState?.selected);
            const isExpanded = expandedProductIds.has(prod.id);
            const modules = prod.modules || [];
            const selectedModulesCount = entState ? entState.moduleMap.size : 0;
            const isDisabled = disabledProductIds.includes(prod.id);

            return (
              <div
                key={prod.id}
                style={{
                  border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#ffffff',
                  boxShadow: isSelected ? '0 1px 3px rgba(37, 99, 235, 0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                }}
              >
                {/* Product Header Row */}
                <div
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    borderBottom: isSelected && isExpanded && modules.length > 0 ? '1px solid #e2e8f0' : 'none',
                  }}
                  onClick={() => handleToggleProduct(prod.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => {}} // Handled by row click
                      style={{
                        width: 15,
                        height: 15,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        accentColor: '#2563eb',
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#1e40af' : '#0f172a' }}>
                          {prod.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: isSelected ? '#dbeafe' : '#f1f5f9',
                            color: isSelected ? '#1d4ed8' : '#64748b',
                          }}
                        >
                          {prod.code}
                        </span>
                        {prod.category && (
                          <span style={{ fontSize: 11, color: '#64748b' }}>• {prod.category}</span>
                        )}
                      </div>
                      {prod.description && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                          {prod.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: selectedModulesCount > 0 ? '#1d4ed8' : '#64748b',
                          background: selectedModulesCount > 0 ? '#dbeafe' : '#f1f5f9',
                          padding: '1px 7px',
                          borderRadius: 10,
                        }}
                      >
                        {selectedModulesCount}/{modules.length} modules
                      </span>
                    )}

                    {modules.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedProductIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(prod.id)) next.delete(prod.id);
                            else next.add(prod.id);
                            return next;
                          });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 4,
                        }}
                        title={isExpanded ? 'Collapse modules' : 'Expand modules'}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Modules & Submodules Dropdown / Hierarchy */}
                {isSelected && isExpanded && (
                  <div style={{ padding: '10px 12px', background: '#fafbfc' }}>
                    {modules.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                        No modules defined for this product. Product-level entitlement active.
                      </div>
                    ) : (
                      <div>
                        {/* Modules Header & Inline Quick Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Modules
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <button
                              type="button"
                              onClick={() => handleSelectAllModules(prod)}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                            >
                              Select All
                            </button>
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <button
                              type="button"
                              onClick={() => handleDeselectAllModules(prod.id)}
                              style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 500, cursor: 'pointer', padding: 0 }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Modules Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                          {modules.map((mod) => {
                            const isModSelected = entState?.moduleMap.has(mod.id);
                            const submodules = mod.submodules || [];
                            const isModExpanded = expandedModuleIds.has(mod.id);
                            const selectedSubSet = entState?.moduleMap.get(mod.id) || new Set();

                            return (
                              <div
                                key={mod.id}
                                style={{
                                  border: isModSelected ? '1px solid #86efac' : '1px solid #e2e8f0',
                                  borderRadius: 6,
                                  background: isModSelected ? '#f0fdf4' : '#ffffff',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                              >
                                <div
                                  style={{
                                    padding: '6px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleToggleModule(prod.id, mod.id)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(isModSelected)}
                                      onChange={() => {}} // Handled by row click
                                      style={{
                                        width: 14,
                                        height: 14,
                                        cursor: 'pointer',
                                        accentColor: '#16a34a',
                                      }}
                                    />
                                    <span style={{ fontSize: 12, fontWeight: isModSelected ? 600 : 500, color: isModSelected ? '#15803d' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {mod.name}
                                    </span>
                                  </div>

                                  {submodules.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                                      {isModSelected && (
                                        <span style={{ fontSize: 9, fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '1px 4px', borderRadius: 6 }}>
                                          {selectedSubSet.size}/{submodules.length}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedModuleIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(mod.id)) next.delete(mod.id);
                                            else next.add(mod.id);
                                            return next;
                                          });
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}
                                        title={isModExpanded ? 'Hide submodules' : 'Show submodules'}
                                      >
                                        {isModExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Submodules List */}
                                {isModSelected && isModExpanded && submodules.length > 0 && (
                                  <div style={{ padding: '4px 6px 6px 24px', background: '#f8fafc', borderTop: '1px dashed #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {submodules.map((sub) => {
                                      const isSubSelected = selectedSubSet.has(sub.id);
                                      return (
                                        <button
                                          key={sub.id}
                                          type="button"
                                          onClick={() => handleToggleSubmodule(prod.id, mod.id, sub.id)}
                                          style={{
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            border: isSubSelected ? '1px solid #86efac' : '1px solid #cbd5e1',
                                            background: isSubSelected ? '#dcfce7' : '#ffffff',
                                            color: isSubSelected ? '#15803d' : '#475569',
                                            fontSize: 10,
                                            fontWeight: isSubSelected ? 600 : 400,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                          }}
                                        >
                                          <span>{isSubSelected ? '✓' : '+'}</span>
                                          <span>{sub.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
