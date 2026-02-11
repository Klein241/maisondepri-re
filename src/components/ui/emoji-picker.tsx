'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

// Emoji categories with popular emojis
const EMOJI_CATEGORIES = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
    'Prière': ['🙏', '✝️', '✡️', '☪️', '🕉️', '☯️', '🙌', '👏', '🤲', '👐', '❤️', '🔥', '⭐', '✨', '💫', '🌟', '💖', '💗', '💕', '💞', '💓', '💝', '🕊️', '👼', '😇', '🫂', '💒', '⛪', '📖', '📿'],
    'Mains': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '💪'],
    'Coeurs': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '❤️‍🔥', '❤️‍🩹'],
    'Nature': ['🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲', '🌳', '🌴', '🌵', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌍', '🌎', '🌏', '🌙', '⭐', '🌟', '✨', '☀️', '🌈', '💧', '🔥'],
    'Objets': ['🎁', '🎈', '🎉', '🎊', '🎂', '🕯️', '📿', '📖', '📚', '✏️', '💌', '📨', '💐', '🏆', '🎖️', '🏅', '🎗️', '🎀', '🎁', '🔔', '🔕', '🎵', '🎶', '🎤', '🎧']
};

export function EmojiPicker({ onEmojiSelect, isOpen, onClose }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Prière');

    if (!isOpen) return null;

    return (
        <div className="absolute bottom-full left-0 mb-2 bg-slate-800 rounded-xl border border-white/10 shadow-xl p-3 w-80 z-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Emojis</span>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white text-xl leading-none"
                >
                    ×
                </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                {Object.keys(EMOJI_CATEGORIES).map((category) => (
                    <button
                        key={category}
                        onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                            activeCategory === category
                                ? "bg-indigo-600 text-white"
                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                        )}
                    >
                        {category}
                    </button>
                ))}
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto scrollbar-thin">
                {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
                    <button
                        key={`${emoji}-${index}`}
                        onClick={() => {
                            onEmojiSelect(emoji);
                            onClose();
                        }}
                        className="p-2 text-xl hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Quick Access - Recently Used could be added here */}
            <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-slate-500 mb-2">Fréquents</p>
                <div className="flex gap-1">
                    {['🙏', '❤️', '🔥', '✨', '😊', '🙌', '💕', '🕊️'].map((emoji, index) => (
                        <button
                            key={`quick-${emoji}-${index}`}
                            onClick={() => {
                                onEmojiSelect(emoji);
                                onClose();
                            }}
                            className="p-2 text-lg hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Inline emoji button component
export function EmojiButton({
    onEmojiSelect,
    className
}: {
    onEmojiSelect: (emoji: string) => void;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "p-2 text-slate-400 hover:text-white transition-colors",
                    className
                )}
            >
                😊
            </button>
            <EmojiPicker
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onEmojiSelect={onEmojiSelect}
            />
        </div>
    );
}
