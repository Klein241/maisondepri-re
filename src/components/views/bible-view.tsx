'use client';

/**
 * PAROLE — Bible LSG 1910
 * =======================
 * Premium Bible experience redesigned with warm parchment theme,
 * serif typography, gold accents, sidebar navigation, and inline tools.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { bibleApi, BibleBook, BIBLE_BOOKS, DEFAULT_TRANSLATION } from '@/lib/unified-bible-api';
import { useBibleFavorites, useBibleHighlights, HIGHLIGHT_COLORS, HighlightColor, shareVerse } from '@/lib/bible-features';
import { useReadingPlanStore, READING_PLANS, MemoryCard, SRSRating } from '@/lib/reading-plans';
import '@/styles/bible-parole.css';

export type ParoleScreen = 'reader' | 'plan' | 'memo';

// ═══════════════════════════════════════
// HIGHLIGHT COLORS for Parole theme
// ═══════════════════════════════════════
const PAROLE_COLORS: { id: HighlightColor; solid: string; }[] = [
    { id: 'yellow', solid: '#F5D547' },
    { id: 'green', solid: '#34C78C' },
    { id: 'blue', solid: '#5096FA' },
    { id: 'red', solid: '#E65050' },
    { id: 'purple', solid: '#BE50DC' },
    { id: 'orange', solid: '#F0A028' },
];

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export function BibleView() {
    const { user, bibleViewTarget, setBibleViewTarget, setBibleNavigation } = useAppStore();
    const { favorites, addFavorite, removeFavorite, isFavorite } = useBibleFavorites(user?.id);
    const { highlights, addHighlight, removeHighlight, getHighlight } = useBibleHighlights(user?.id);
    const { addMemoryCard, getDueCards, getCardStats, reviewCard, memoryCards,
        activePlans, startPlan, completePlanDay, getActivePlan, removePlan } = useReadingPlanStore();

    // Navigation state
    const [screen, setScreen] = useState<ParoleScreen>('reader');
    const [books] = useState<BibleBook[]>(BIBLE_BOOKS);
    const [activeBook, setActiveBook] = useState<BibleBook | null>(null);
    const [activeChapter, setActiveChapter] = useState(1);
    const [chapters, setChapters] = useState<number[]>([]);
    const [verses, setVerses] = useState<{ verse: number; text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [showBookSelector, setShowBookSelector] = useState(false);
    const [selectorTab, setSelectorTab] = useState<'books' | 'chapters'>('books');

    // Reader state
    const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
    const [editingNote, setEditingNote] = useState<number | null>(null);
    const [noteText, setNoteText] = useState('');
    const [panelOpen, setPanelOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [fontOpen, setFontOpen] = useState(false);
    const [fontSize, setFontSize] = useState(19);

    const versesRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Handle external navigation (from other parts of the app)
    useEffect(() => {
        if (bibleViewTarget) {
            const mapping: Record<string, ParoleScreen> = {
                'home': 'reader', 'read': 'reader', 'search': 'reader',
                'favorites': 'reader', 'study': 'plan', 'games': 'reader',
            };
            setScreen(mapping[bibleViewTarget] || 'reader');
            setBibleViewTarget(null);
        }
    }, [bibleViewTarget]);

    // Load initial book
    useEffect(() => {
        // Default to Jean (John)
        const defaultBook = books.find(b => b.id === 'JHN') || books.find(b => b.id === 'JOH') || books[42] || books[0];
        if (defaultBook) {
            selectBook(defaultBook, 3);
        }
    }, []);

    // ═══════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════
    const selectBook = useCallback(async (book: BibleBook, chapter?: number) => {
        setActiveBook(book);
        const chs = bibleApi.getChapters(book.id);
        setChapters(chs);
        const ch = chapter || 1;
        setActiveChapter(ch);
        await loadChapter(book.id, ch);
        setSelectedVerse(null);
        setEditingNote(null);
    }, []);

    const loadChapter = async (bookId: string, chapter: number) => {
        setLoading(true);
        try {
            const data = await bibleApi.getChapterContent(bookId, chapter, DEFAULT_TRANSLATION);
            if (data?.verses?.length) {
                setVerses(data.verses.map((v, i) => ({
                    verse: v.verse || (i + 1),
                    text: v.text,
                })));
            } else {
                setVerses([]);
            }
        } catch {
            setVerses([]);
        }
        setLoading(false);
    };

    const goChapter = (delta: number) => {
        if (!activeBook) return;
        const next = activeChapter + delta;
        if (next < 1 || next > (activeBook.chapters || 150)) return;
        setActiveChapter(next);
        loadChapter(activeBook.id, next);
        setSelectedVerse(null);
        setEditingNote(null);
    };

    // ═══════════════════════════════════════
    // VERSE ACTIONS
    // ═══════════════════════════════════════
    const verseRef = (v: number) => `${activeBook?.name} ${activeChapter}:${v}`;

    const handleHighlight = (v: number, color: HighlightColor) => {
        const ref = verseRef(v);
        const text = verses.find(vs => vs.verse === v)?.text || '';
        const existing = getHighlight(ref);
        if (existing && existing.color === color) {
            removeHighlight(existing.id);
        } else {
            addHighlight(ref, text, DEFAULT_TRANSLATION, color);
        }
    };

    const handleCopy = (v: number) => {
        const ref = verseRef(v);
        const text = verses.find(vs => vs.verse === v)?.text || '';
        navigator.clipboard.writeText(`"${text}" — ${ref}`);
    };

    const handleShare = (v: number) => {
        const ref = verseRef(v);
        const text = verses.find(vs => vs.verse === v)?.text || '';
        shareVerse(ref, text, DEFAULT_TRANSLATION);
    };

    const handleMemorize = (v: number) => {
        const ref = verseRef(v);
        const text = verses.find(vs => vs.verse === v)?.text || '';
        if (activeBook) {
            addMemoryCard(ref, text, activeBook.id, activeChapter, v);
        }
    };

    const openNoteEditor = (v: number) => {
        setEditingNote(v);
        setSelectedVerse(v);
        // Load existing note text if any
        const ref = verseRef(v);
        const fav = favorites.find(f => f.reference === ref);
        setNoteText(fav?.notes || '');
    };

    const saveNote = (v: number) => {
        const ref = verseRef(v);
        const text = verses.find(vs => vs.verse === v)?.text || '';
        if (noteText.trim()) {
            addFavorite(ref, text, DEFAULT_TRANSLATION, noteText.trim());
        }
        setEditingNote(null);
        setNoteText('');
    };

    const cancelNote = () => {
        setEditingNote(null);
        setNoteText('');
    };

    // ═══════════════════════════════════════
    // SEARCH
    // ═══════════════════════════════════════
    const openSearch = () => {
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 100);
    };

    const closeSearch = () => {
        setSearchOpen(false);
        setSearchQuery('');
    };

    const searchMatches = searchQuery.trim()
        ? verses.filter(v => v.text.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    // ═══════════════════════════════════════
    // NOTE COUNT
    // ═══════════════════════════════════════
    const currentNotes = favorites.filter(f =>
        f.reference.startsWith(`${activeBook?.name} ${activeChapter}:`) && f.notes
    );
    const currentHighlights = highlights.filter(h =>
        h.reference.startsWith(`${activeBook?.name} ${activeChapter}:`)
    );

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════
    return (
        <div className="parole" style={{ height: '100%', overflow: 'hidden' }}>
            <div className="parole-layout" style={{ height: '100%' }}>

                {/* ═══ SIDEBAR (Desktop) ═══ */}
                <aside className="parole-sidebar">
                    <div className="parole-sidebar-logo">
                        <div className="parole-logo-mark">
                            <div className="parole-logo-icon">
                                <svg viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.5">
                                    <path d="M4 3h10a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
                                    <path d="M9 3v12M6 7h6M6 10h4" />
                                </svg>
                            </div>
                            <div>
                                <div className="parole-logo-text">Parole</div>
                                <div className="parole-logo-sub">LSG 1910</div>
                            </div>
                        </div>
                    </div>

                    <div className="parole-sidebar-nav">
                        <div className="parole-nav-label">Navigation</div>
                        <button className={`parole-nav-item ${screen === 'reader' ? 'active' : ''}`} onClick={() => setScreen('reader')}>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="4.5" y1="5.5" x2="11.5" y2="5.5" /><line x1="4.5" y1="8" x2="11.5" y2="8" /><line x1="4.5" y1="10.5" x2="9" y2="10.5" /></svg>
                            Lecteur
                        </button>
                        <button className="parole-nav-item" onClick={openSearch}>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
                            Recherche
                        </button>
                        <button className="parole-nav-item" onClick={() => setPanelOpen(!panelOpen)}>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13l1.5-1.5L12 4l-2-2-7.5 7.5z" /><line x1="8" y1="4" x2="12" y2="8" /></svg>
                            Notes &amp; Surlignage
                            <span className="parole-nav-badge">{currentNotes.length + currentHighlights.length}</span>
                        </button>
                        <button className={`parole-nav-item ${screen === 'plan' ? 'active' : ''}`} onClick={() => setScreen('plan')}>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5" /><line x1="2" y1="7" x2="14" y2="7" /><line x1="6" y1="1.5" x2="6" y2="5" /><line x1="10" y1="1.5" x2="10" y2="5" /></svg>
                            Plan de lecture
                        </button>
                        <button className={`parole-nav-item ${screen === 'memo' ? 'active' : ''}`} onClick={() => setScreen('memo')}>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /><line x1="8" y1="11" x2="8" y2="15" /><line x1="5.5" y1="15" x2="10.5" y2="15" /></svg>
                            Mémorisation
                        </button>

                        <div className="parole-nav-label" style={{ marginTop: 20 }}>Livres</div>
                    </div>

                    <div className="parole-sidebar-book">
                        <div className="parole-book-grid">
                            {books.filter(b => b.testament === 'NT').slice(0, 12).map(b => (
                                <button
                                    key={b.id}
                                    className={`parole-book-chip ${activeBook?.id === b.id ? 'active' : ''}`}
                                    onClick={() => { selectBook(b); setScreen('reader'); }}
                                >
                                    {b.abbreviation}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* ═══ MAIN ═══ */}
                <main className="parole-main" style={{ overflow: 'auto' }}>

                    {/* ═══ READER SCREEN ═══ */}
                    {screen === 'reader' && (
                        <>
                            {/* Top Nav */}
                            <nav className="parole-topnav">
                                <div className="parole-topnav-left">
                                    <div className="parole-breadcrumb" style={{ cursor: 'pointer' }} onClick={() => setShowBookSelector(true)}>
                                        <span className="parole-breadcrumb-book">{activeBook?.name || 'Bible'}</span>
                                        <span className="parole-breadcrumb-sep">·</span>
                                        <span className="parole-breadcrumb-ch">Chapitre {activeChapter}</span>
                                    </div>
                                    <div className="parole-ch-nav">
                                        <button className="parole-ch-arrow" onClick={() => goChapter(-1)} disabled={activeChapter <= 1}>←</button>
                                        <button className="parole-ch-arrow" onClick={() => goChapter(1)} disabled={activeChapter >= (activeBook?.chapters || 1)}>→</button>
                                    </div>
                                </div>
                                <div className="parole-topnav-right">
                                    <button className="parole-action-btn" onClick={() => setFontOpen(!fontOpen)}>
                                        <span style={{ fontFamily: 'serif', fontSize: 14 }}>A</span>
                                        <span>Taille</span>
                                    </button>
                                    <button className="parole-action-btn" onClick={openSearch}>
                                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4" /><line x1="9" y1="9" x2="13" y2="13" /></svg>
                                        <span>Chercher</span>
                                    </button>
                                    <button className={`parole-action-btn ${panelOpen ? 'primary' : ''}`} onClick={() => setPanelOpen(!panelOpen)}>
                                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 11l1.2-1.2 6.4-6.4-1.6-1.6-6.4 6.4z" /><line x1="8" y1="3.5" x2="11.5" y2="7" /></svg>
                                        <span>Mes notes</span>
                                    </button>
                                </div>
                            </nav>

                            {/* Font Bar */}
                            <div className={`parole-font-bar ${fontOpen ? 'open' : ''}`}>
                                <label>Taille du texte</label>
                                <input type="range" min={15} max={26} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
                                <span>{fontSize}px</span>
                            </div>

                            {/* Search Bar */}
                            <div className={`parole-search-wrap ${searchOpen ? 'open' : ''}`}>
                                <input
                                    ref={searchRef}
                                    className="parole-search-field"
                                    type="text"
                                    placeholder="Chercher dans ce chapitre…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <span className="parole-search-count">
                                    {searchQuery ? (searchMatches.length > 0 ? `${searchMatches.length} résultat${searchMatches.length > 1 ? 's' : ''}` : 'Aucun résultat') : ''}
                                </span>
                                <button className="parole-btn-ghost" onClick={closeSearch}>Fermer</button>
                            </div>

                            {/* Reading + Side Panel */}
                            <div style={{ display: 'flex', flex: 1 }}>
                                <div className="parole-reading-area">
                                    {/* Chapter Intro */}
                                    <div className="parole-chapter-intro">
                                        <div className="parole-chapter-eyebrow">{activeBook?.nameLong || activeBook?.name || ''}</div>
                                        <h1 className="parole-chapter-name">Chapitre {activeChapter}</h1>
                                        <div className="parole-divider-ornament"><div className="parole-divider-diamond" /></div>
                                    </div>

                                    {/* Verses */}
                                    {loading ? (
                                        <div className="parole-loading">
                                            <div className="parole-spinner" />
                                            <div className="parole-loading-text">Chargement…</div>
                                        </div>
                                    ) : (
                                        <div className="parole-verses-list" ref={versesRef} style={{ '--p-vsize': `${fontSize}px` } as React.CSSProperties}>
                                            {verses.map(v => {
                                                const ref = verseRef(v.verse);
                                                const hl = getHighlight(ref);
                                                const isSel = selectedVerse === v.verse;
                                                const isEditing = editingNote === v.verse;
                                                const fav = favorites.find(f => f.reference === ref);
                                                const hasNote = fav?.notes;
                                                const sq = searchQuery.trim().toLowerCase();
                                                const isMatch = sq && v.text.toLowerCase().includes(sq);

                                                // Build display text
                                                let displayHtml = v.text;
                                                if (isMatch && sq) {
                                                    const re = new RegExp(`(${sq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                                    displayHtml = v.text.replace(re, '<mark>$1</mark>');
                                                }

                                                const hlClass = hl ? ` hl-${hl.color}` : '';
                                                const selClass = isSel && !hl ? ' selected' : '';

                                                return (
                                                    <div key={v.verse}>
                                                        <div className="parole-verse-block">
                                                            <div className="parole-verse-gutter">
                                                                <span className="parole-vnum">{v.verse}</span>
                                                            </div>
                                                            <div
                                                                className={`parole-verse-content${hlClass}${selClass}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedVerse(isSel ? null : v.verse);
                                                                    if (editingNote !== v.verse) setEditingNote(null);
                                                                }}
                                                            >
                                                                <div className="parole-vtext" dangerouslySetInnerHTML={{ __html: displayHtml }} />
                                                                {hasNote && !isEditing && (
                                                                    <div className="parole-note-preview">{hasNote}</div>
                                                                )}
                                                                {hasNote && <span className="parole-note-pill">✎ note</span>}
                                                            </div>

                                                            {/* Verse Toolbar */}
                                                            <AnimatePresence>
                                                                {isSel && (
                                                                    <motion.div
                                                                        className="parole-verse-toolbar"
                                                                        initial={{ opacity: 0, y: 5 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        exit={{ opacity: 0, y: 5 }}
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        {PAROLE_COLORS.map(c => (
                                                                            <div
                                                                                key={c.id}
                                                                                className={`parole-hl-swatch ${hl?.color === c.id ? 'on' : ''}`}
                                                                                style={{ background: c.solid }}
                                                                                onClick={() => handleHighlight(v.verse, c.id)}
                                                                            />
                                                                        ))}
                                                                        <div className="parole-tb-div" />
                                                                        <button className="parole-tb-act" onClick={() => openNoteEditor(v.verse)}>
                                                                            {hasNote ? '✎ Note' : '+ Note'}
                                                                        </button>
                                                                        <button className="parole-tb-act" onClick={() => handleCopy(v.verse)}>Copier</button>
                                                                        <button className="parole-tb-act" onClick={() => handleShare(v.verse)}>Partager</button>
                                                                        <button className="parole-tb-act" onClick={() => handleMemorize(v.verse)}>🧠</button>
                                                                        {hl && (
                                                                            <>
                                                                                <div className="parole-tb-div" />
                                                                                <button className="parole-tb-act rm" onClick={() => removeHighlight(hl.id)}>Effacer</button>
                                                                            </>
                                                                        )}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>

                                                        {/* Note Editor */}
                                                        {isEditing && (
                                                            <div className="parole-note-editor">
                                                                <textarea
                                                                    className="parole-note-ta"
                                                                    placeholder="Ta réflexion sur ce verset…"
                                                                    value={noteText}
                                                                    onChange={e => setNoteText(e.target.value)}
                                                                    autoFocus
                                                                />
                                                                <div className="parole-note-footer">
                                                                    <span className="parole-note-hint">{ref}</span>
                                                                    <div className="parole-note-btns">
                                                                        <button className="parole-btn-ghost" onClick={cancelNote}>Annuler</button>
                                                                        <button className="parole-btn-save" onClick={() => saveNote(v.verse)}>Enregistrer</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Side Panel */}
                                <div className={`parole-side-panel ${panelOpen ? 'open' : ''}`}>
                                    <div className="parole-panel-title">Notes &amp; surlignages</div>
                                    {currentNotes.length === 0 && currentHighlights.length === 0 ? (
                                        <div className="parole-empty-panel">Aucune annotation dans ce chapitre.</div>
                                    ) : (
                                        <>
                                            {[...currentHighlights, ...currentNotes.map(n => ({
                                                ...n, color: getHighlight(n.reference)?.color
                                            }))].sort((a, b) => {
                                                const va = parseInt(a.reference.split(':').pop() || '0');
                                                const vb = parseInt(b.reference.split(':').pop() || '0');
                                                return va - vb;
                                            }).map((entry, i) => {
                                                const vn = entry.reference.split(':').pop();
                                                const colorStyle = PAROLE_COLORS.find(c => c.id === (entry as any).color);
                                                return (
                                                    <div
                                                        key={`ann-${i}`}
                                                        className="parole-ann-card"
                                                        onClick={() => {
                                                            const v = parseInt(vn || '1');
                                                            setSelectedVerse(v);
                                                        }}
                                                    >
                                                        <div className="parole-ann-card-ref">{entry.reference}</div>
                                                        <div className="parole-ann-card-text">
                                                            {'notes' in entry && entry.notes ? entry.notes : entry.text}
                                                        </div>
                                                        {colorStyle && (
                                                            <div className="parole-hl-tag" style={{ background: colorStyle.solid }} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ READING PLANS SCREEN ═══ */}
                    {screen === 'plan' && (
                        <div className="parole-screen">
                            <div className="parole-screen-eyebrow">Discipline spirituelle</div>
                            <h1 className="parole-screen-title">Plan de lecture</h1>
                            <p className="parole-screen-sub">Parcourir la Parole chaque jour, un chapitre à la fois</p>

                            {/* Stats */}
                            <div className="parole-streak-row">
                                {activePlans.map(ap => {
                                    const plan = READING_PLANS.find(p => p.id === ap.planId);
                                    if (!plan) return null;
                                    const pct = Math.round((ap.completedDays.length / plan.totalDays) * 100);
                                    return (
                                        <div key={ap.planId} className="parole-streak-card">
                                            <div className="parole-streak-num">{ap.streak}</div>
                                            <div className="parole-streak-label">Jours consécutifs</div>
                                            <div className="parole-streak-sub">{plan.name}</div>
                                        </div>
                                    );
                                })}
                                {activePlans.length === 0 && (
                                    <div className="parole-streak-card">
                                        <div className="parole-streak-num">0</div>
                                        <div className="parole-streak-label">Aucun plan actif</div>
                                        <div className="parole-streak-sub">Choisissez un plan ci-dessous</div>
                                    </div>
                                )}
                            </div>

                            {/* Active Plans */}
                            {activePlans.map(ap => {
                                const plan = READING_PLANS.find(p => p.id === ap.planId);
                                if (!plan) return null;
                                const pct = Math.round((ap.completedDays.length / plan.totalDays) * 100);
                                const remaining = plan.totalDays - ap.completedDays.length;
                                return (
                                    <div key={ap.planId} className="parole-plan-card">
                                        <div className="parole-plan-card-header">
                                            <div>
                                                <div className="parole-plan-card-name">{plan.icon} {plan.name}</div>
                                                <div className="parole-plan-card-prog">
                                                    Jour {ap.currentDay} sur {plan.totalDays} · {remaining} jours restants
                                                </div>
                                            </div>
                                            <button className="parole-btn-ghost" onClick={() => removePlan(ap.planId)}>Retirer</button>
                                        </div>
                                        <div className="parole-prog-bar"><div className="parole-prog-fill" style={{ width: `${pct}%` }} /></div>
                                        <div className="parole-prog-label-row">
                                            <span>{pct}% accompli</span>
                                            <span>{remaining} jours restants</span>
                                        </div>
                                        {/* Day rows */}
                                        {Array.from({ length: Math.min(7, plan.totalDays) }, (_, i) => {
                                            const day = ap.currentDay - 2 + i;
                                            if (day < 1 || day > plan.totalDays) return null;
                                            const done = ap.completedDays.includes(day);
                                            const isToday = day === ap.currentDay;
                                            return (
                                                <div
                                                    key={day}
                                                    className={`parole-day-row ${isToday ? 'today' : ''}`}
                                                    onClick={() => completePlanDay(ap.planId, day)}
                                                >
                                                    <div className={`parole-day-check ${done ? 'done' : ''} ${isToday && !done ? 'today-ring' : ''}`} />
                                                    <div className="parole-day-info">
                                                        <div className="parole-day-label">
                                                            {isToday ? "Aujourd'hui" : `Jour ${day}`}
                                                            {isToday && !done && <span className="parole-day-badge">À lire</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {/* Available Plans */}
                            <div className="parole-plan-section-title" style={{ marginTop: 32 }}>
                                {activePlans.length > 0 ? 'Autres programmes' : 'Programmes disponibles'}
                            </div>
                            <div className="parole-plans-grid">
                                {READING_PLANS.filter(p => !activePlans.some(ap => ap.planId === p.id)).map(plan => (
                                    <div
                                        key={plan.id}
                                        className="parole-plan-option"
                                        onClick={() => startPlan(plan.id)}
                                    >
                                        <div className="parole-plan-opt-title">{plan.icon} {plan.name}</div>
                                        <div className="parole-plan-opt-desc">{plan.description}</div>
                                        <div className="parole-plan-opt-dur">{plan.totalDays} jours</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ═══ MEMORIZATION SCREEN ═══ */}
                    {screen === 'memo' && <MemoScreen />}

                    {/* ═══ MOBILE BOTTOM NAV ═══ */}
                    <div className="parole-mobile-nav">
                        <div className="parole-mobile-nav-inner">
                            <button className={`parole-mobile-pill ${screen === 'reader' ? 'active' : ''}`} onClick={() => setScreen('reader')}>
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="4.5" y1="5.5" x2="11.5" y2="5.5" /><line x1="4.5" y1="8" x2="11.5" y2="8" /></svg>
                                Lecteur
                            </button>
                            <button className={`parole-mobile-pill ${screen === 'plan' ? 'active' : ''}`} onClick={() => setScreen('plan')}>
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5" /><line x1="2" y1="7" x2="14" y2="7" /></svg>
                                Plans
                            </button>
                            <button className={`parole-mobile-pill ${screen === 'memo' ? 'active' : ''}`} onClick={() => setScreen('memo')}>
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /><line x1="8" y1="11" x2="8" y2="15" /></svg>
                                Mémoriser
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            {/* ═══ BOOK/CHAPTER SELECTOR MODAL ═══ */}
            <AnimatePresence>
                {showBookSelector && (
                    <motion.div
                        className="parole-book-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowBookSelector(false)}
                    >
                        <motion.div
                            className="parole-book-modal"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="parole-book-modal-header">
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    <button
                                        className={`parole-btn-ghost`}
                                        style={selectorTab === 'books' ? { background: 'var(--gold-l)', color: 'var(--gold-d)', borderColor: 'var(--gold)' } : {}}
                                        onClick={() => setSelectorTab('books')}
                                    >
                                        Livres
                                    </button>
                                    <button
                                        className={`parole-btn-ghost`}
                                        style={selectorTab === 'chapters' ? { background: 'var(--gold-l)', color: 'var(--gold-d)', borderColor: 'var(--gold)' } : {}}
                                        onClick={() => setSelectorTab('chapters')}
                                    >
                                        Chapitres
                                    </button>
                                </div>
                                {selectorTab === 'chapters' && (
                                    <div className="parole-book-modal-sub">{activeBook?.name} — {activeBook?.chapters} chapitres</div>
                                )}
                            </div>
                            <div className="parole-book-modal-body">
                                {selectorTab === 'books' ? (
                                    <>
                                        <div className="parole-nav-label" style={{ color: 'var(--ink4)', padding: 0, marginBottom: 8 }}>Ancien Testament</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 16 }}>
                                            {books.filter(b => b.testament === 'OT').map(b => (
                                                <button
                                                    key={b.id}
                                                    className={`parole-chapter-btn ${activeBook?.id === b.id ? 'active' : ''}`}
                                                    style={{ aspectRatio: 'auto', padding: '6px 4px', fontSize: 11 }}
                                                    onClick={() => {
                                                        selectBook(b);
                                                        setSelectorTab('chapters');
                                                    }}
                                                >
                                                    {b.abbreviation}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="parole-nav-label" style={{ color: 'var(--ink4)', padding: 0, marginBottom: 8 }}>Nouveau Testament</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                                            {books.filter(b => b.testament === 'NT').map(b => (
                                                <button
                                                    key={b.id}
                                                    className={`parole-chapter-btn ${activeBook?.id === b.id ? 'active' : ''}`}
                                                    style={{ aspectRatio: 'auto', padding: '6px 4px', fontSize: 11 }}
                                                    onClick={() => {
                                                        selectBook(b);
                                                        setSelectorTab('chapters');
                                                    }}
                                                >
                                                    {b.abbreviation}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="parole-chapter-grid">
                                        {chapters.map(ch => (
                                            <button
                                                key={ch}
                                                className={`parole-chapter-btn ${activeChapter === ch ? 'active' : ''}`}
                                                onClick={() => {
                                                    if (activeBook) {
                                                        setActiveChapter(ch);
                                                        loadChapter(activeBook.id, ch);
                                                        setShowBookSelector(false);
                                                        setScreen('reader');
                                                    }
                                                }}
                                            >
                                                {ch}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ═══════════════════════════════════════
// MEMORIZATION SCREEN (extracted for clarity)
// ═══════════════════════════════════════
function MemoScreen() {
    const { getDueCards, getCardStats, reviewCard, memoryCards } = useReadingPlanStore();
    const [currentIdx, setCurrentIdx] = useState(0);
    const [revealed, setRevealed] = useState(false);

    const dueCards = getDueCards();
    const stats = getCardStats();
    const currentCard = dueCards[currentIdx];

    const handleReveal = () => setRevealed(true);

    const handleRate = (rating: SRSRating) => {
        if (!currentCard) return;
        reviewCard(currentCard.id, rating);
        setRevealed(false);
        if (currentIdx < dueCards.length - 1) {
            setCurrentIdx(currentIdx + 1);
        }
    };

    const getDueStatus = (card: MemoryCard) => {
        const now = new Date();
        const next = new Date(card.nextReview);
        const diff = next.getTime() - now.getTime();
        if (diff <= 0) return 'now';
        if (diff < 3 * 24 * 60 * 60 * 1000) return 'soon';
        return 'later';
    };

    return (
        <div className="parole-screen">
            <div className="parole-screen-eyebrow">Répétition espacée</div>
            <h1 className="parole-screen-title">Mémorisation</h1>
            <p className="parole-screen-sub">Graver la Parole dans le cœur, un verset à la fois</p>

            {/* Stats */}
            <div className="parole-memo-stats-row">
                <div className="parole-memo-stat">
                    <div className="parole-memo-stat-num" style={{ color: '#C03030' }}>{stats.new + (stats as any).reviewing || dueCards.length}</div>
                    <div className="parole-memo-stat-label">À revoir</div>
                </div>
                <div className="parole-memo-stat">
                    <div className="parole-memo-stat-num" style={{ color: '#B8963E' }}>{stats.learning}</div>
                    <div className="parole-memo-stat-label">En cours</div>
                </div>
                <div className="parole-memo-stat">
                    <div className="parole-memo-stat-num" style={{ color: '#1A8C5E' }}>{stats.mastered}</div>
                    <div className="parole-memo-stat-label">Maîtrisés</div>
                </div>
            </div>

            {/* Flash Card */}
            <div className="parole-flash-wrap">
                {currentCard ? (
                    <>
                        <div
                            className={`parole-flash-card ${revealed ? 'flipped' : ''}`}
                            onClick={handleReveal}
                        >
                            <div className="parole-flash-ref">{currentCard.reference}</div>
                            <div className={`parole-flash-text ${revealed ? '' : 'parole-flash-hidden'} ${revealed ? 'revealed' : ''}`}>
                                {currentCard.text}
                            </div>
                            <div className="parole-flash-hint">
                                {revealed ? "Comment l'avais-tu en mémoire ?" : 'Appuie pour révéler le verset'}
                            </div>
                        </div>

                        <div className="parole-flash-actions">
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <button className="parole-flash-btn hard" disabled={!revealed} onClick={() => handleRate('hard')}>Difficile</button>
                                <div className="parole-flash-sub">Revoir demain</div>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <button className="parole-flash-btn ok" disabled={!revealed} onClick={() => handleRate('good')}>Correct</button>
                                <div className="parole-flash-sub">Revoir dans 3 j</div>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <button className="parole-flash-btn easy" disabled={!revealed} onClick={() => handleRate('easy')}>Facile</button>
                                <div className="parole-flash-sub">Revoir dans 7 j</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="parole-flash-card">
                        <div className="parole-flash-text">
                            {memoryCards.length === 0
                                ? 'Ajoutez des versets à mémoriser depuis le lecteur (icône 🧠)'
                                : 'Bravo ! Tu as revu tous tes versets pour aujourd\'hui.'}
                        </div>
                    </div>
                )}
            </div>

            {/* Queue */}
            {memoryCards.length > 0 && (
                <div className="parole-memo-queue">
                    <div className="parole-memo-queue-title">File d&apos;apprentissage ({memoryCards.length} versets)</div>
                    {memoryCards.slice(0, 8).map(card => {
                        const status = getDueStatus(card);
                        return (
                            <div key={card.id} className="parole-queue-item">
                                <span className="parole-queue-ref">{card.reference}</span>
                                <span className="parole-queue-preview">{card.text}</span>
                                <span className={`parole-queue-due parole-due-${status}`}>
                                    {status === 'now' ? 'Maintenant' : status === 'soon' ? 'Bientôt' : 'Plus tard'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Backward compatibility exports
export type { ParoleScreen as BibleTab };
export { BibleSearch } from '@/components/views/bible-search';
