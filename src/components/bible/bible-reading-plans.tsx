'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Flame, Trophy, Play, Check, Bell, BellOff, ChevronRight, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useReadingPlanStore, READING_PLANS, ReadingPlan } from "@/lib/reading-plans";

export function BibleReadingPlans() {
    const { activePlans, startPlan, completePlanDay, removePlan, notifSettings, setNotifSettings } = useReadingPlanStore();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [viewingPlan, setViewingPlan] = useState<string | null>(null);

    const activePlanData = viewingPlan ? activePlans.find(p => p.planId === viewingPlan) : null;
    const viewingPlanInfo = viewingPlan ? READING_PLANS.find(p => p.id === viewingPlan) : null;

    // Detail view of an active plan
    if (viewingPlan && activePlanData && viewingPlanInfo) {
        const progress = (activePlanData.completedDays.length / viewingPlanInfo.totalDays) * 100;
        return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400" onClick={() => setViewingPlan(null)}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h3 className="text-base font-black text-white">{viewingPlanInfo.icon} {viewingPlanInfo.name}</h3>
                        <p className="text-[10px] text-slate-500">Jour {activePlanData.currentDay} sur {viewingPlanInfo.totalDays}</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-5 pb-3">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="rounded-2xl bg-gradient-to-br from-rose-500/15 to-pink-500/10 border border-rose-500/10 p-3 text-center">
                            <Flame className="h-5 w-5 text-rose-400 mx-auto mb-1" />
                            <p className="text-xl font-black text-rose-400">{activePlanData.streak}</p>
                            <p className="text-[9px] font-bold text-rose-400/50 uppercase">Série</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/10 p-3 text-center">
                            <Check className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                            <p className="text-xl font-black text-emerald-400">{activePlanData.completedDays.length}</p>
                            <p className="text-[9px] font-bold text-emerald-400/50 uppercase">Faits</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border border-indigo-500/10 p-3 text-center">
                            <Trophy className="h-5 w-5 text-indigo-400 mx-auto mb-1" />
                            <p className="text-xl font-black text-indigo-400">{Math.round(progress)}%</p>
                            <p className="text-[9px] font-bold text-indigo-400/50 uppercase">Progrès</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Progress value={progress} className="h-2.5 bg-white/[0.06] rounded-full [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-violet-500 [&>div]:rounded-full" />
                        <p className="text-[10px] text-slate-500 mt-1.5 text-right">{activePlanData.completedDays.length}/{viewingPlanInfo.totalDays} jours</p>
                    </div>
                </div>

                {/* Days Grid */}
                <ScrollArea className="flex-1 px-5">
                    <div className="grid grid-cols-7 gap-2 pb-32">
                        {Array.from({ length: viewingPlanInfo.totalDays }, (_, i) => i + 1).map(day => {
                            const isDone = activePlanData.completedDays.includes(day);
                            const isCurrent = day === activePlanData.currentDay;
                            const isFuture = day > activePlanData.currentDay;
                            return (
                                <motion.button
                                    key={day}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: day * 0.005 }}
                                    onClick={() => {
                                        if (!isDone && !isFuture) {
                                            completePlanDay(viewingPlan!, day);
                                            toast.success(`Jour ${day} complété ! 🎉`);
                                        }
                                    }}
                                    className={cn(
                                        "aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all duration-200",
                                        isDone && "bg-gradient-to-br from-emerald-500/30 to-teal-500/20 text-emerald-400 border border-emerald-500/20",
                                        isCurrent && !isDone && "bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-white border border-indigo-500/30 ring-2 ring-indigo-500/30 animate-pulse",
                                        isFuture && "bg-white/[0.03] text-slate-600 border border-white/[0.04]",
                                        !isDone && !isCurrent && !isFuture && "bg-white/[0.05] text-slate-400 border border-white/[0.06] hover:bg-indigo-500/10 hover:border-indigo-500/20",
                                    )}
                                >
                                    {isDone ? <Check className="h-3.5 w-3.5" /> : day}
                                </motion.button>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-5 py-3 bg-[#0B0E14]/80 backdrop-blur-xl border-t border-white/[0.06]">
                    <Button variant="destructive" size="sm" className="w-full rounded-xl h-10 gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10" onClick={() => { removePlan(viewingPlan!); setViewingPlan(null); toast.info("Plan supprimé"); }}>
                        <Trash2 className="h-4 w-4" /> Abandonner ce plan
                    </Button>
                </div>
            </motion.div>
        );
    }

    // Plan list view
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Active plans */}
            {activePlans.length > 0 && (
                <div className="px-5 pt-4 pb-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3">Plans en cours</h3>
                    <div className="space-y-3 mb-4">
                        {activePlans.map(ap => {
                            const plan = READING_PLANS.find(p => p.id === ap.planId);
                            if (!plan) return null;
                            const progress = (ap.completedDays.length / plan.totalDays) * 100;
                            return (
                                <motion.button key={ap.planId} className="w-full" onClick={() => setViewingPlan(ap.planId)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                    <div className={cn("relative overflow-hidden rounded-2xl border border-white/[0.08] p-4 bg-gradient-to-br text-left hover:scale-[1.01] transition-all", plan.gradient)}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{plan.icon}</span>
                                                <div>
                                                    <p className="font-bold text-white text-sm">{plan.name}</p>
                                                    <p className="text-[10px] text-slate-400">Jour {ap.currentDay}/{plan.totalDays}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {ap.streak > 0 && (
                                                    <Badge className="bg-rose-500/20 text-rose-400 border-none gap-1 text-[10px]">
                                                        <Flame className="h-3 w-3" /> {ap.streak}
                                                    </Badge>
                                                )}
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                            </div>
                                        </div>
                                        <Progress value={progress} className="h-1.5 bg-white/[0.08] rounded-full [&>div]:bg-white/40 [&>div]:rounded-full" />
                                        <p className="text-[10px] text-slate-400 mt-1.5">{Math.round(progress)}% complété</p>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Notification toggle */}
            <div className="px-5 pb-2">
                <button onClick={() => setNotifSettings({ enabled: !notifSettings.enabled })} className={cn("w-full flex items-center justify-between p-4 rounded-2xl border transition-all", notifSettings.enabled ? "bg-indigo-500/10 border-indigo-500/20" : "bg-white/[0.03] border-white/[0.06]")}>
                    <div className="flex items-center gap-3">
                        {notifSettings.enabled ? <Bell className="h-5 w-5 text-indigo-400" /> : <BellOff className="h-5 w-5 text-slate-500" />}
                        <div className="text-left">
                            <p className="text-sm font-bold text-white">Rappels quotidiens</p>
                            <p className="text-[10px] text-slate-500">{notifSettings.enabled ? `Chaque jour à ${notifSettings.time}` : 'Désactivés'}</p>
                        </div>
                    </div>
                    <div className={cn("w-11 h-6 rounded-full transition-all flex items-center px-0.5", notifSettings.enabled ? "bg-indigo-500" : "bg-white/10")}>
                        <div className={cn("w-5 h-5 rounded-full bg-white shadow transition-transform", notifSettings.enabled ? "translate-x-5" : "translate-x-0")} />
                    </div>
                </button>
            </div>

            {/* Available plans */}
            <ScrollArea className="flex-1 px-5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 pt-2">Plans disponibles</h3>
                <div className="space-y-3 pb-32">
                    {READING_PLANS.filter(p => !activePlans.find(ap => ap.planId === p.id)).map((plan, i) => (
                        <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br transition-all hover:scale-[1.01]", plan.gradient)}>
                            <div className="p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">{plan.icon}</div>
                                    <div>
                                        <h4 className="font-bold text-white">{plan.name}</h4>
                                        <p className="text-[10px] text-slate-400">{plan.totalDays} jours</p>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">{plan.description}</p>
                                <Button className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm backdrop-blur-sm border border-white/10" onClick={() => { startPlan(plan.id); toast.success(`Plan "${plan.name}" démarré ! 🚀`); }}>
                                    <Play className="h-4 w-4 mr-2" /> Commencer
                                </Button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </ScrollArea>
        </motion.div>
    );
}
