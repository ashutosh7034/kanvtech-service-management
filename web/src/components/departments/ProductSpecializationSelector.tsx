import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, ProductModule, ProductSubmodule, DepartmentSpecialization } from '../../types';
import { Search, ChevronDown, ChevronRight, CheckSquare, Square, MinusSquare, Package, Box, Layers, X, Info } from 'lucide-react';

interface ProductSpecializationSelectorProps {
  products: Product[];
  value: DepartmentSpecialization[];
  onChange: (specializations: DepartmentSpecialization[], productIds: string[]) => void;
  error?: string | null;
}

interface ProductState {
  isComplete: boolean;
  selectedModuleIds: Set<string>;
  selectedSubmoduleIds: Set<string>;
}

export const ProductSpecializationSelector: React.FC<ProductSpecializationSelectorProps> = ({
  products,
  value,
  onChange,
  error,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  // Convert external value array into fast lookup map
  const selectionMap = useMemo(() => {
    const map: Record<string, ProductState> = {};
    for (const spec of value || []) {
      const prod = products.find((p) => p.id === spec.productId);
      const isComplete = Boolean(spec.isComplete);
      const modIds = new Set<string>(spec.moduleIds || []);
      const submodIds = new Set<string>(spec.submoduleIds || []);

      if (isComplete && prod) {
        // If complete, fill all modules and submodules for clean UI state
        for (const m of prod.modules || []) {
          modIds.add(m.id);
          for (const s of m.submodules || []) {
            submodIds.add(s.id);
          }
        }
      }

      map[spec.productId] = {
        isComplete: isComplete || (Boolean(prod) && (!prod?.modules || prod.modules.length === 0)),
        selectedModuleIds: modIds,
        selectedSubmoduleIds: submodIds,
      };
    }
    return map;
  }, [value, products]);

  // Auto-expand on search
  useEffect(() => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const newExpProds = new Set<string>();
      const newExpMods = new Set<string>();

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
            newExpMods.add(mod.id);
            matchInProd = true;
          }
        }
        if (matchInProd) {
          newExpProds.add(prod.id);
        }
      }

      setExpandedProductIds(newExpProds);
      setExpandedModuleIds(newExpMods);
    }
  }, [searchTerm, products]);

  // Helper calculation functions
  const getProductSelectionStatus = (product: Product): { isFull: boolean; isPartial: boolean } => {
    const state = selectionMap[product.id];
    if (!state) return { isFull: false, isPartial: false };

    const modules = product.modules || [];
    if (modules.length === 0) {
      return { isFull: true, isPartial: false };
    }

    let allModulesFull = true;
    let anySelected = false;

    for (const mod of modules) {
      const submodules = mod.submodules || [];
      if (submodules.length === 0) {
        const isModSel = state.selectedModuleIds.has(mod.id);
        if (isModSel) anySelected = true;
        else allModulesFull = false;
      } else {
        const selectedSubCount = submodules.filter((s) => state.selectedSubmoduleIds.has(s.id)).length;
        if (selectedSubCount === submodules.length && submodules.length > 0) {
          anySelected = true;
        } else if (selectedSubCount > 0) {
          anySelected = true;
          allModulesFull = false;
        } else {
          allModulesFull = false;
        }
      }
    }

    if (state.isComplete || allModulesFull) {
      return { isFull: true, isPartial: false };
    }
    return { isFull: false, isPartial: anySelected };
  };

  const getModuleSelectionStatus = (module: ProductModule, productId: string): { isFull: boolean; isPartial: boolean } => {
    const state = selectionMap[productId];
    if (!state) return { isFull: false, isPartial: false };

    const submodules = module.submodules || [];
    if (submodules.length === 0) {
      const isSel = state.selectedModuleIds.has(module.id) || state.isComplete;
      return { isFull: isSel, isPartial: false };
    }

    if (state.isComplete) {
      return { isFull: true, isPartial: false };
    }

    const selectedCount = submodules.filter((s) => state.selectedSubmoduleIds.has(s.id)).length;
    if (selectedCount === submodules.length && submodules.length > 0) {
      return { isFull: true, isPartial: false };
    }
    if (selectedCount > 0 || state.selectedModuleIds.has(module.id)) {
      return { isFull: false, isPartial: true };
    }
    return { isFull: false, isPartial: false };
  };

  const isSubmoduleSelected = (submoduleId: string, productId: string): boolean => {
    const state = selectionMap[productId];
    if (!state) return false;
    return state.isComplete || state.selectedSubmoduleIds.has(submoduleId);
  };

  // Convert current UI state back to DepartmentSpecialization[] and trigger onChange
  const emitChanges = (newMap: Record<string, ProductState>) => {
    const result: DepartmentSpecialization[] = [];
    const productIds: string[] = [];

    for (const [pId, pState] of Object.entries(newMap)) {
      const prod = products.find((p) => p.id === pId);
      if (!prod) continue;

      const modules = prod.modules || [];
      const hasModules = modules.length > 0;

      // Check if actually selected
      const hasSelectedMods = pState.selectedModuleIds.size > 0;
      const hasSelectedSubs = pState.selectedSubmoduleIds.size > 0;

      if (!pState.isComplete && !hasSelectedMods && !hasSelectedSubs) {
        continue;
      }

      productIds.push(pId);

      // Determine isComplete
      let isComplete = false;
      if (!hasModules) {
        isComplete = true;
      } else {
        const { isFull } = getProductSelectionStatusFromState(prod, pState);
        isComplete = isFull || pState.isComplete;
      }

      result.push({
        productId: pId,
        productName: prod.name,
        productCode: prod.code,
        isComplete,
        moduleIds: Array.from(pState.selectedModuleIds),
        submoduleIds: Array.from(pState.selectedSubmoduleIds),
      });
    }

    onChange(result, productIds);
  };

  const getProductSelectionStatusFromState = (prod: Product, state: ProductState) => {
    const modules = prod.modules || [];
    if (modules.length === 0) return { isFull: true, isPartial: false };

    let allFull = true;
    let anySel = false;

    for (const mod of modules) {
      const subs = mod.submodules || [];
      if (subs.length === 0) {
        if (state.selectedModuleIds.has(mod.id)) anySel = true;
        else allFull = false;
      } else {
        const selCount = subs.filter((s) => state.selectedSubmoduleIds.has(s.id)).length;
        if (selCount === subs.length && subs.length > 0) anySel = true;
        else if (selCount > 0) {
          anySel = true;
          allFull = false;
        } else {
          allFull = false;
        }
      }
    }

    if (state.isComplete || allFull) return { isFull: true, isPartial: false };
    return { isFull: false, isPartial: anySel };
  };

  // Checkbox handlers
  const handleToggleProduct = (product: Product) => {
    const currentStatus = getProductSelectionStatus(product);
    const newMap = { ...selectionMap };

    if (currentStatus.isFull || currentStatus.isPartial) {
      // Unselect product completely
      delete newMap[product.id];
    } else {
      // Select product completely
      const allModIds = new Set<string>();
      const allSubIds = new Set<string>();
      for (const m of product.modules || []) {
        allModIds.add(m.id);
        for (const s of m.submodules || []) {
          allSubIds.add(s.id);
        }
      }
      newMap[product.id] = {
        isComplete: true,
        selectedModuleIds: allModIds,
        selectedSubmoduleIds: allSubIds,
      };
    }

    emitChanges(newMap);
  };

  const handleToggleModule = (product: Product, module: ProductModule) => {
    const modStatus = getModuleSelectionStatus(module, product.id);
    const newMap = { ...selectionMap };
    let pState = newMap[product.id]
      ? {
          isComplete: false,
          selectedModuleIds: new Set(newMap[product.id].selectedModuleIds),
          selectedSubmoduleIds: new Set(newMap[product.id].selectedSubmoduleIds),
        }
      : {
          isComplete: false,
          selectedModuleIds: new Set<string>(),
          selectedSubmoduleIds: new Set<string>(),
        };

    const submodules = module.submodules || [];

    if (modStatus.isFull || modStatus.isPartial) {
      // Unselect module & its submodules
      pState.selectedModuleIds.delete(module.id);
      for (const s of submodules) {
        pState.selectedSubmoduleIds.delete(s.id);
      }
    } else {
      // Select module & its submodules
      pState.selectedModuleIds.add(module.id);
      for (const s of submodules) {
        pState.selectedSubmoduleIds.add(s.id);
      }
    }

    // Check if empty
    if (pState.selectedModuleIds.size === 0 && pState.selectedSubmoduleIds.size === 0) {
      delete newMap[product.id];
    } else {
      newMap[product.id] = pState;
    }

    emitChanges(newMap);
  };

  const handleToggleSubmodule = (product: Product, module: ProductModule, submodule: ProductSubmodule) => {
    const isCurrentlySelected = isSubmoduleSelected(submodule.id, product.id);
    const newMap = { ...selectionMap };
    let pState = newMap[product.id]
      ? {
          isComplete: false,
          selectedModuleIds: new Set(newMap[product.id].selectedModuleIds),
          selectedSubmoduleIds: new Set(newMap[product.id].selectedSubmoduleIds),
        }
      : {
          isComplete: false,
          selectedModuleIds: new Set<string>(),
          selectedSubmoduleIds: new Set<string>(),
        };

    if (isCurrentlySelected) {
      pState.selectedSubmoduleIds.delete(submodule.id);
      pState.selectedModuleIds.delete(module.id);
    } else {
      pState.selectedSubmoduleIds.add(submodule.id);
      // Check if all submodules in this module are now selected
      const allSubs = module.submodules || [];
      const allSelected = allSubs.every((s) => s.id === submodule.id || pState.selectedSubmoduleIds.has(s.id));
      if (allSelected) {
        pState.selectedModuleIds.add(module.id);
      }
    }

    // Check if empty
    if (pState.selectedModuleIds.size === 0 && pState.selectedSubmoduleIds.size === 0) {
      delete newMap[product.id];
    } else {
      newMap[product.id] = pState;
    }

    emitChanges(newMap);
  };

  const toggleExpandProduct = (productId: string) => {
    const next = new Set(expandedProductIds);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    setExpandedProductIds(next);
  };

  const toggleExpandModule = (moduleId: string) => {
    const next = new Set(expandedModuleIds);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    setExpandedModuleIds(next);
  };

  // Filter products by search term
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

  // Total selected count summary
  const totalSelectedProducts = Object.keys(selectionMap).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Search Header */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Search size={15} style={{ position: 'absolute', left: 12, color: '#64748b' }} />
        <input
          type="text"
          className="form-control"
          style={{ paddingLeft: 34, fontSize: 13, height: 38 }}
          placeholder="Search product, module, or submodule specialization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              right: 10,
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Hierarchical Tree Container */}
      <div
        style={{
          border: error ? '1px solid #ef4444' : '1px solid #cbd5e1',
          borderRadius: 8,
          background: '#ffffff',
          maxHeight: 280,
          overflowY: 'auto',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        {filteredProducts.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            {searchTerm ? `No matching products, modules, or submodules found for "${searchTerm}"` : 'No active products found.'}
          </div>
        ) : (
          <div style={{ padding: '6px 0' }}>
            {filteredProducts.map((product) => {
              const { isFull: prodFull, isPartial: prodPartial } = getProductSelectionStatus(product);
              const isExpanded = expandedProductIds.has(product.id) || Boolean(searchTerm);
              const modules = product.modules || [];

              return (
                <div key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {/* Product Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: prodFull ? '#eff6ff' : prodPartial ? '#f8fafc' : 'transparent',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleToggleProduct(product)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      {/* Expand Button */}
                      {modules.length > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandProduct(product.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            color: '#64748b',
                          }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      ) : (
                        <div style={{ width: 20 }} />
                      )}

                      {/* Product Checkbox */}
                      <IndeterminateCheckbox
                        checked={prodFull}
                        indeterminate={prodPartial}
                        onChange={() => handleToggleProduct(product)}
                      />

                      {/* Product Badge & Name */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#0b3b60',
                          background: '#e0f2fe',
                          padding: '1px 6px',
                          borderRadius: 4,
                          letterSpacing: 0.5,
                        }}
                      >
                        PRODUCT
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                        {product.name}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>({product.code})</span>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {prodFull && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#16a34a',
                            background: '#dcfce7',
                            padding: '2px 8px',
                            borderRadius: 10,
                          }}
                        >
                          ✓ Complete Product
                        </span>
                      )}
                      {prodPartial && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#0284c7',
                            background: '#e0f2fe',
                            padding: '2px 8px',
                            borderRadius: 10,
                          }}
                        >
                          Partial Modules
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Modules Level (Children) */}
                  {isExpanded && modules.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '4px 0 6px 0', borderTop: '1px solid #f1f5f9' }}>
                      {modules.map((module) => {
                        const { isFull: modFull, isPartial: modPartial } = getModuleSelectionStatus(module, product.id);
                        const isModExpanded = expandedModuleIds.has(module.id) || Boolean(searchTerm);
                        const submodules = module.submodules || [];

                        return (
                          <div key={module.id}>
                            {/* Module Row */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px 6px 36px',
                                background: modFull ? '#f0fdf4' : modPartial ? '#f1f5f9' : 'transparent',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleToggleModule(product, module)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                {submodules.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandModule(module.id);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                      color: '#64748b',
                                    }}
                                  >
                                    {isModExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : (
                                  <div style={{ width: 18 }} />
                                )}

                                <IndeterminateCheckbox
                                  checked={modFull}
                                  indeterminate={modPartial}
                                  onChange={() => handleToggleModule(product, module)}
                                />

                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: '#475569',
                                    background: '#e2e8f0',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  MODULE
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                                  {module.name}
                                </span>
                              </div>

                              <div>
                                {modFull && submodules.length > 0 && (
                                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>All Submodules</span>
                                )}
                              </div>
                            </div>

                            {/* Submodules Level (Grandchildren) */}
                            {isModExpanded && submodules.length > 0 && (
                              <div style={{ padding: '2px 0 4px 0' }}>
                                {submodules.map((submodule) => {
                                  const isSubSel = isSubmoduleSelected(submodule.id, product.id);

                                  return (
                                    <div
                                      key={submodule.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '5px 12px 5px 68px',
                                        background: isSubSel ? '#f0fdf4' : 'transparent',
                                        cursor: 'pointer',
                                      }}
                                      onClick={() => handleToggleSubmodule(product, module, submodule)}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <IndeterminateCheckbox
                                          checked={isSubSel}
                                          indeterminate={false}
                                          onChange={() => handleToggleSubmodule(product, module, submodule)}
                                        />
                                        <span
                                          style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            background: '#f1f5f9',
                                            border: '1px solid #e2e8f0',
                                            padding: '1px 4px',
                                            borderRadius: 3,
                                            letterSpacing: 0.4,
                                          }}
                                        >
                                          SUBMODULE
                                        </span>
                                        <span style={{ fontSize: 12, color: '#475569' }}>
                                          {submodule.name}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Summary Section */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#f8fafc',
          padding: '10px 14px',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 600, color: '#0b3b60', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} />
            <span>Selected Specializations ({totalSelectedProducts} Product{totalSelectedProducts === 1 ? '' : 's'})</span>
          </div>
          {totalSelectedProducts > 0 && (
            <button
              type="button"
              onClick={() => emitChanges({})}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {totalSelectedProducts === 0 ? (
          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
            No specializations selected. Please check at least one product, module, or submodule above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
            {Object.entries(selectionMap).map(([pId, pState]) => {
              const prod = products.find((p) => p.id === pId);
              if (!prod) return null;

              const { isFull } = getProductSelectionStatus(prod);

              return (
                <div key={pId} style={{ background: '#ffffff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{prod.name} ({prod.code})</span>
                    {isFull && (
                      <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                        Complete Product
                      </span>
                    )}
                  </div>

                  {!isFull && (
                    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid #cbd5e1' }}>
                      {(prod.modules || []).map((mod) => {
                        const { isFull: mFull, isPartial: mPartial } = getModuleSelectionStatus(mod, prod.id);
                        if (!mFull && !mPartial) return null;

                        const selectedSubs = (mod.submodules || []).filter((s) => isSubmoduleSelected(s.id, prod.id));

                        return (
                          <div key={mod.id} style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                            • <strong>{mod.name}</strong> {mFull ? '(All submodules)' : ''}
                            {!mFull && selectedSubs.length > 0 && (
                              <div style={{ paddingLeft: 10, color: '#64748b', fontSize: 11 }}>
                                {selectedSubs.map((s) => (
                                  <div key={s.id}>– {s.name}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Checkbox helper component that supports HTML5 indeterminate property
const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}> = ({ checked, indeterminate, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={(e) => {
        e.stopPropagation();
        onChange();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        cursor: 'pointer',
        width: 16,
        height: 16,
        accentColor: '#0b3b60',
        margin: 0,
      }}
    />
  );
};
