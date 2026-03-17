'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, MessageCircle, Heart, BookOpen, Users } from 'lucide-react';

interface FloatingBubbleItem {
    id: string;
    type: 'prayer' | 'tool' | 'group' | 'bible';
    title: string;
    icon?: string;
    onClick?: () => void;
}

interface FloatingBubbleProps {
    items: FloatingBubbleItem[];
    onRemove: (id: string) => void;
}

const ICONS = {
    prayer: Heart,
    tool: MessageCircle,
    group: Users,
    bible: BookOpen,
};

const COLORS = {
    prayer: 'from-rose-500 to-pink-600',
    tool: 'from-indigo-500 to-purple-600',
    group: 'from-emerald-500 to-teal-600',
    bible: 'from-amber-500 to-orange-600',
};

function DraggableBubble({
    item,
    index,
    onRemove,
}: {
    item: FloatingBubbleItem;
    index: number;
    onRemove: (id: string) => void;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const constraintsRef = useRef<HTMLDivElement>(null);

    const Icon = ICONS[item.type] || Heart;
    const colorClass = COLORS[item.type] || COLORS.prayer;

    const handleDragEnd = (_: any, info: PanInfo) => {
        setIsDragging(false);
        setPosition(prev => ({
            x: prev.x + info.offset.x,
            y: prev.y + info.offset.y,
        }));
    };

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: 1,
                opacity: 1,
                x: position.x,
                y: position.y,
            }}
            exit={{ scale: 0, opacity: 0 }}
            drag
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 1.1, zIndex: 100 }}
            className="fixed z-9990 cursor-grab active:cursor-grabbing"
            style={{
                right: 16,
                bottom: 100 + index * 60,
            }}
        >
            {/* Main bubble */}
            <div
                onClick={() => {
                    if (!isDragging) {
                        if (item.onClick) item.onClick();
                        else setIsExpanded(!isExpanded);
                    }
                }}
                className={`relative w-12 h-12 rounded-full bg-linear-to-br ${colorClass} shadow-lg shadow-black/30 flex items-center justify-center`}
            >
                {item.icon ? (
                    <span className="text-lg">{item.icon}</span>
                ) : (
                    <Icon className="h-5 w-5 text-white" />
                )}

                {/* Pulse animation */}
                <div className={`absolute inset-0 rounded-full bg-linear-to-br ${colorClass} animate-ping opacity-20`} />

                {/* Close button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-md"
                >
                    <X className="h-3 w-3 text-white" />
                </button>
            </div>

            {/* Expanded label */}
            {isExpanded && (
                <motion.div
                    initial={{ opacity: 0, x: 10, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-white/10 max-w-[200px]"
                >
                    <p className="font-semibold truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Appuyez pour ouvrir · Glissez pour déplacer</p>
                </motion.div>
            )}
        </motion.div>
    );
}

export function FloatingBubbles({ items, onRemove }: FloatingBubbleProps) {
    if (items.length === 0) return null;

    return (
        <>
            {items.map((item, i) => (
                <DraggableBubble
                    key={item.id}
                    item={item}
                    index={i}
                    onRemove={onRemove}
                />
            ))}
        </>
    );
}
