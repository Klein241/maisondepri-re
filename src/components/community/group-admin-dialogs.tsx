'use client';

import { useState } from 'react';
import {
    Send, Search, Loader2, BookOpen, CalendarDays,
    Megaphone, Pin, ArrowRightLeft, Calendar, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Message, ChatGroup, GroupMember } from './chat-types';

// =====================================================
// PROPS INTERFACE
// =====================================================
interface GroupAdminDialogsProps {
    user: { id: string; name: string; avatar?: string };
    currentGroup: ChatGroup | null;
    groupMembers: GroupMember[];

    // Bible tool
    showBibleTool: boolean;
    setShowBibleTool: (v: boolean) => void;
    bibleVersion: string;
    setBibleVersion: (v: string) => void;
    bibleReference: string;
    setBibleReference: (v: string) => void;
    bibleContent: string;
    isFetchingBible: boolean;
    fetchBiblePassage: () => void;
    shareBiblePassage: () => void;

    // Fasting tool
    showFastingTool: boolean;
    setShowFastingTool: (v: boolean) => void;
    fastingTheme: string;
    setFastingTheme: (v: string) => void;
    fastingDuration: number;
    setFastingDuration: (v: number) => void;
    fastingDays: Array<{
        title: string; theme: string; reference: string; passage: string;
        meditation: string; action: string; prayers: string;
    }>;
    setFastingDays: (v: Array<{
        title: string; theme: string; reference: string; passage: string;
        meditation: string; action: string; prayers: string;
    }>) => void;
    initFastingDays: (count: number) => void;
    shareFastingProgram: () => void;

    // Announcement
    showAnnouncementTool: boolean;
    setShowAnnouncementTool: (v: boolean) => void;
    announcementText: string;
    setAnnouncementText: (v: string) => void;
    sendAnnouncement: () => void;

    // Pin prayer
    showPinTool: boolean;
    setShowPinTool: (v: boolean) => void;
    pinText: string;
    setPinText: (v: string) => void;
    setPinnedPrayerSubject: () => void;

    // Event
    showEventTool: boolean;
    setShowEventTool: (v: boolean) => void;
    eventTitle: string;
    setEventTitle: (v: string) => void;
    eventDate: string;
    setEventDate: (v: string) => void;
    eventTime: string;
    setEventTime: (v: string) => void;
    eventDescription: string;
    setEventDescription: (v: string) => void;
    sendEventToGroup: () => void;

    // Migrate
    showMigrateTool: boolean;
    setShowMigrateTool: (v: boolean) => void;
    migrateTargetName: string;
    setMigrateTargetName: (v: string) => void;
    isMigratingMembers: boolean;
    migrateGroupMembers: () => void;

    // Thread
    threadMessage: Message | null;
    setThreadMessage: (v: Message | null) => void;
    threadComments: Array<{ text: string; time: string; userId: string }>;
    setThreadComments: (v: Array<{ text: string; time: string; userId: string }> | ((prev: Array<{ text: string; time: string; userId: string }>) => Array<{ text: string; time: string; userId: string }>)) => void;
    formatTime: (date: string) => string;
}

// =====================================================
// GROUP ADMIN DIALOGS COMPONENT
// =====================================================
export function GroupAdminDialogs(props: GroupAdminDialogsProps) {
    const {
        user, currentGroup, groupMembers,
        showBibleTool, setShowBibleTool, bibleVersion, setBibleVersion,
        bibleReference, setBibleReference, bibleContent, isFetchingBible,
        fetchBiblePassage, shareBiblePassage,
        showFastingTool, setShowFastingTool, fastingTheme, setFastingTheme,
        fastingDuration, setFastingDuration, fastingDays, setFastingDays,
        initFastingDays, shareFastingProgram,
        showAnnouncementTool, setShowAnnouncementTool, announcementText, setAnnouncementText, sendAnnouncement,
        showPinTool, setShowPinTool, pinText, setPinText, setPinnedPrayerSubject,
        showEventTool, setShowEventTool, eventTitle, setEventTitle,
        eventDate, setEventDate, eventTime, setEventTime,
        eventDescription, setEventDescription, sendEventToGroup,
        showMigrateTool, setShowMigrateTool, migrateTargetName, setMigrateTargetName,
        isMigratingMembers, migrateGroupMembers,
        threadMessage, setThreadMessage, threadComments, setThreadComments, formatTime,
    } = props;

    const [threadInput, setThreadInput] = useState('');

    return (
        <>
            {/* Bible Sharing Tool Dialog */}
            <Dialog open={showBibleTool} onOpenChange={setShowBibleTool}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <BookOpen className="h-5 w-5 text-emerald-400" />
                            Partager un passage biblique
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Version</label>
                            <div className="flex gap-2">
                                {['LSG', 'NIV', 'KJV', 'ESV'].map(v => (
                                    <Button
                                        key={v}
                                        size="sm"
                                        variant={bibleVersion === v ? 'default' : 'outline'}
                                        className={bibleVersion === v
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'border-white/10 text-slate-400 hover:bg-white/5'}
                                        onClick={() => setBibleVersion(v)}
                                    >
                                        {v}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Référence</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ex: Jean 3:16 ou Psaume 23"
                                    value={bibleReference}
                                    onChange={e => setBibleReference(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white"
                                    onKeyPress={e => e.key === 'Enter' && fetchBiblePassage()}
                                />
                                <Button
                                    onClick={fetchBiblePassage}
                                    disabled={isFetchingBible}
                                    className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                >
                                    {isFetchingBible ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        {bibleContent && (
                            <div className="p-4 rounded-xl bg-linear-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <BookOpen className="h-4 w-4 text-emerald-400" />
                                    <span className="text-emerald-400 font-semibold text-sm">{bibleReference} ({bibleVersion})</span>
                                </div>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{bibleContent}</p>
                            </div>
                        )}
                        {bibleContent && (
                            <Button
                                onClick={shareBiblePassage}
                                className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                            >
                                <Send className="h-4 w-4 mr-2" />
                                Partager dans le groupe
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Fasting Program Tool Dialog (personnalisable) */}
            <Dialog open={showFastingTool} onOpenChange={setShowFastingTool}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <CalendarDays className="h-5 w-5 text-purple-400" />
                            Programme de jeûne et prière
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Thème du jeûne</label>
                            <Input
                                placeholder="Ex: Renouvellement spirituel, Percée, etc."
                                value={fastingTheme}
                                onChange={e => setFastingTheme(e.target.value)}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Durée (jours)</label>
                            <div className="flex gap-2">
                                {[3, 5, 7, 10, 14, 21, 40].map(d => (
                                    <Button
                                        key={d}
                                        size="sm"
                                        variant={fastingDuration === d ? 'default' : 'outline'}
                                        className={fastingDuration === d
                                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                            : 'border-white/10 text-slate-400 hover:bg-white/5'}
                                        onClick={() => { setFastingDuration(d); initFastingDays(d); }}
                                    >
                                        {d}j
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400 font-medium">Contenu journalier</p>
                            <ScrollArea className="max-h-[40vh]">
                                <div className="space-y-3 pr-2">
                                    {fastingDays.map((day, i) => (
                                        <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-purple-400">📅 {day.title}</span>
                                            </div>
                                            <Input
                                                placeholder="Thème du jour"
                                                value={day.theme}
                                                onChange={e => {
                                                    const updated = [...fastingDays];
                                                    updated[i] = { ...updated[i], theme: e.target.value };
                                                    setFastingDays(updated);
                                                }}
                                                className="bg-white/5 border-white/10 text-sm h-8 text-white"
                                            />
                                            <Input
                                                placeholder="Référence biblique (ex: Matthieu 6:16-18)"
                                                value={day.reference}
                                                onChange={e => {
                                                    const updated = [...fastingDays];
                                                    updated[i] = { ...updated[i], reference: e.target.value };
                                                    setFastingDays(updated);
                                                }}
                                                className="bg-white/5 border-white/10 text-sm h-8 text-white"
                                            />
                                            <Textarea
                                                placeholder="Méditation / réflexion"
                                                value={day.meditation}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                    const updated = [...fastingDays];
                                                    updated[i] = { ...updated[i], meditation: e.target.value };
                                                    setFastingDays(updated);
                                                }}
                                                className="bg-white/5 border-white/10 text-sm min-h-[60px] text-white"
                                            />
                                            <Input
                                                placeholder="Action pratique"
                                                value={day.action}
                                                onChange={e => {
                                                    const updated = [...fastingDays];
                                                    updated[i] = { ...updated[i], action: e.target.value };
                                                    setFastingDays(updated);
                                                }}
                                                className="bg-white/5 border-white/10 text-sm h-8 text-white"
                                            />
                                            <Input
                                                placeholder="Sujets de prière"
                                                value={day.prayers}
                                                onChange={e => {
                                                    const updated = [...fastingDays];
                                                    updated[i] = { ...updated[i], prayers: e.target.value };
                                                    setFastingDays(updated);
                                                }}
                                                className="bg-white/5 border-white/10 text-sm h-8 text-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                        <Button
                            onClick={shareFastingProgram}
                            disabled={!fastingTheme.trim()}
                            className="w-full bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Partager le programme dans le groupe
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Announcement Dialog */}
            <Dialog open={showAnnouncementTool} onOpenChange={setShowAnnouncementTool}>
                <DialogContent className="max-w-md bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Megaphone className="h-5 w-5 text-red-400" />
                            Faire une annonce
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400">Envoyez une annonce importante à tous les membres du groupe.</p>
                        <Textarea
                            placeholder="Votre annonce..."
                            value={announcementText}
                            onChange={e => setAnnouncementText(e.target.value)}
                            className="bg-white/5 border-white/10 text-white min-h-[100px]"
                        />
                        <Button
                            onClick={sendAnnouncement}
                            disabled={!announcementText.trim()}
                            className="w-full bg-linear-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
                        >
                            <Megaphone className="h-4 w-4 mr-2" />
                            Envoyer l&apos;annonce
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Pin Prayer Subject Dialog */}
            <Dialog open={showPinTool} onOpenChange={setShowPinTool}>
                <DialogContent className="max-w-md bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Pin className="h-5 w-5 text-amber-400" />
                            Épingler un sujet de prière
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400">Ce sujet sera visible en haut du chat pour tous les membres.</p>
                        <Textarea
                            placeholder="Sujet de prière à épingler..."
                            value={pinText}
                            onChange={e => setPinText(e.target.value)}
                            className="bg-white/5 border-white/10 text-white min-h-[80px]"
                        />
                        <Button
                            onClick={setPinnedPrayerSubject}
                            disabled={!pinText.trim()}
                            className="w-full bg-linear-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white"
                        >
                            <Pin className="h-4 w-4 mr-2" />
                            Épingler
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Event Planning Dialog */}
            <Dialog open={showEventTool} onOpenChange={setShowEventTool}>
                <DialogContent className="max-w-md bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Calendar className="h-5 w-5 text-blue-400" />
                            Planifier un événement
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Titre de l&apos;événement</label>
                            <Input
                                placeholder="Ex: Soirée de prière, Étude biblique..."
                                value={eventTitle}
                                onChange={e => setEventTitle(e.target.value)}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Date</label>
                                <Input
                                    type="date"
                                    value={eventDate}
                                    onChange={e => setEventDate(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Heure (optionnel)</label>
                                <Input
                                    type="time"
                                    value={eventTime}
                                    onChange={e => setEventTime(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Description (optionnel)</label>
                            <Textarea
                                placeholder="Détails de l'événement..."
                                value={eventDescription}
                                onChange={e => setEventDescription(e.target.value)}
                                className="bg-white/5 border-white/10 text-white min-h-[60px]"
                            />
                        </div>
                        <Button
                            onClick={sendEventToGroup}
                            disabled={!eventTitle.trim() || !eventDate}
                            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                        >
                            <Calendar className="h-4 w-4 mr-2" />
                            Partager l&apos;événement
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Migrate Members Dialog */}
            <Dialog open={showMigrateTool} onOpenChange={setShowMigrateTool}>
                <DialogContent className="max-w-md bg-slate-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <ArrowRightLeft className="h-5 w-5 text-cyan-400" />
                            Migrer les membres
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400">
                            Transférer tous les membres de ce groupe vers un autre groupe.
                            Les membres déjà présents dans le groupe cible seront ignorés.
                        </p>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Nom du groupe cible</label>
                            <Input
                                placeholder="Tapez le nom du groupe cible..."
                                value={migrateTargetName}
                                onChange={e => setMigrateTargetName(e.target.value)}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                            <p className="text-[10px] text-cyan-300">
                                <strong>Groupe actuel :</strong> {currentGroup?.name}<br />
                                <strong>Membres :</strong> {groupMembers.length}
                            </p>
                        </div>
                        <Button
                            onClick={migrateGroupMembers}
                            disabled={!migrateTargetName.trim() || isMigratingMembers}
                            className="w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
                        >
                            {isMigratingMembers ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Migration en cours...</>
                            ) : (
                                <><ArrowRightLeft className="h-4 w-4 mr-2" /> Migrer tous les membres</>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Thread/Comment Dialog */}
            <Dialog open={!!threadMessage} onOpenChange={(open) => { if (!open) { setThreadMessage(null); setThreadComments([]); setThreadInput(''); } }}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-slate-900 border-white/10 p-0">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle className="flex items-center gap-2 text-white text-sm">
                            💬 Fil de commentaire privé
                        </DialogTitle>
                    </DialogHeader>
                    {threadMessage && (
                        <div className="space-y-3 p-4 pt-0">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[10px] text-indigo-400 font-semibold mb-1">{threadMessage.sender?.full_name || 'Message'}</p>
                                <p className="text-sm text-white whitespace-pre-wrap">{threadMessage.content}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{formatTime(threadMessage.created_at)}</p>
                            </div>
                            <div className="text-[10px] text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 text-center">
                                🔒 Ces commentaires sont <strong className="text-slate-400">privés</strong> — ils n&apos;apparaissent pas dans le groupe
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {threadComments.map((c, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                            {user.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="bg-white/5 rounded-xl px-3 py-1.5 flex-1">
                                            <p className="text-xs text-white">{c.text}</p>
                                            <p className="text-[9px] text-slate-500 mt-0.5">{c.time}</p>
                                        </div>
                                    </div>
                                ))}
                                {threadComments.length === 0 && (
                                    <p className="text-xs text-slate-500 text-center py-4">Aucun commentaire. Ajoutez une note privée sur ce message.</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Votre commentaire privé..."
                                    value={threadInput}
                                    onChange={(e) => setThreadInput(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && threadInput.trim()) {
                                            setThreadComments(prev => [...prev, {
                                                text: threadInput.trim(),
                                                time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                                                userId: user.id,
                                            }]);
                                            setThreadInput('');
                                        }
                                    }}
                                    className="flex-1 bg-white/5 border-white/10 rounded-full text-sm"
                                />
                                <Button
                                    size="icon"
                                    onClick={() => {
                                        if (threadInput.trim()) {
                                            setThreadComments(prev => [...prev, {
                                                text: threadInput.trim(),
                                                time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                                                userId: user.id,
                                            }]);
                                            setThreadInput('');
                                        }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-500 rounded-full shrink-0"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
