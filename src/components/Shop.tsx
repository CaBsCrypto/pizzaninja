import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Sparkles, Sword } from 'lucide-react';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  type: 'blade' | 'background';
  color?: string; // Hex color for the blade
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'blade_red', name: 'Sable Carmesí', description: 'Corte rojo letal', price: 50, icon: '🗡️', type: 'blade', color: '#ff0000' },
  { id: 'blade_gold', name: 'Hoja Dorada', description: 'Estela brillante', price: 100, icon: '✨', type: 'blade', color: '#ffd700' },
  { id: 'blade_purple', name: 'Filo Cósmico', description: 'Corte violeta galáctico', price: 150, icon: '🌌', type: 'blade', color: '#8a2be2' },
];

interface ShopProps {
  onClose: () => void;
  balance: number;
  onPurchase: (item: ShopItem) => void;
  unlockedItems: string[];
  hasOvenNFT?: boolean;
}

export default function Shop({ onClose, balance, onPurchase, unlockedItems, hasOvenNFT = false }: ShopProps) {
  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-950/90 p-4 rounded-3xl backdrop-blur-sm">
      <div className="panel-clash p-6 rounded-3xl w-full max-w-lg shadow-2xl relative border-2 border-emerald-500/50 max-h-[80vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-900/50 rounded-full mb-3 border border-emerald-500/50">
            <ShoppingCart className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-pixel text-white text-stroke-sm">Mercado Web3</h2>
          <p className="font-sans text-emerald-200 mt-2">Usa tus $SLICE para desbloquear cosméticos</p>
          <div className="mt-3 inline-block bg-slate-900 px-4 py-1 rounded-full border border-amber-500/30">
            <span className="font-pixel text-amber-400 text-sm">Tu Saldo: {balance.toFixed(0)} $SLICE</span>
          </div>
        </div>

        <div className="space-y-4">
          {SHOP_ITEMS.map((item) => {
            const isUnlocked = unlockedItems.includes(item.id);
            const isNFTUnlock = item.id === 'blade_gold' && hasOvenNFT;
            const canAfford = balance >= item.price;

            return (
              <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isUnlocked ? 'bg-slate-800/80 border-blue-500/50' : 'bg-slate-900 border-slate-700 hover:border-emerald-500/30'}`}>
                <div className="flex items-center gap-4">
                  <div className="text-3xl bg-slate-800 p-2 rounded-xl">{item.icon}</div>
                  <div>
                    <h3 className="font-pixel text-lg text-white flex items-center gap-1.5">
                      {item.name}
                      {isNFTUnlock && (
                        <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-pixel uppercase tracking-wide">
                          NFT
                        </span>
                      )}
                    </h3>
                    <p className="font-sans text-xs text-slate-400">{item.description}</p>
                    {item.id === 'blade_gold' && !isUnlocked && (
                      <p className="font-pixel text-[9px] text-blue-400 mt-1 flex items-center gap-1">
                        🎁 ¡Gratis si tienes Oven NFT!
                      </p>
                    )}
                  </div>
                </div>
                
                {isUnlocked ? (
                  isNFTUnlock ? (
                    <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-blue-500/20 text-amber-300 font-pixel text-[9px] rounded-xl border border-amber-500/30 flex flex-col items-center leading-normal">
                      <span>✨ DETECTOR</span>
                      <span className="text-[8px] text-blue-300">OVEN NFT</span>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-blue-900/40 text-blue-300 font-pixel text-sm rounded-xl border border-blue-500/30">
                      ADQUIRIDO
                    </div>
                  )
                ) : (
                  <button 
                    onClick={() => canAfford && onPurchase(item)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-xl font-pixel text-sm flex items-center gap-2 transition-transform active:scale-95 ${
                      canAfford 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg border-b-4 border-emerald-800' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed border-b-4 border-slate-800'
                    }`}
                  >
                    <span>{item.price}</span>
                    <span className="text-[10px]">$SLICE</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
