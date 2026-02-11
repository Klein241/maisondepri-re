'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Star, Clock, CheckCircle2, XCircle, Zap, Heart, Award, RefreshCw, Play, ChevronRight, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { quizGenerator, QuizQuestion as GeneratedQuestion } from '@/lib/quiz-generator';

// Types
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'menu' | 'playing' | 'result';

interface QuizQuestion {
    id: number | string;
    question: string;
    options: string[];
    correct: number;
    reference: string;
    explanation?: string;
}

interface BibleQuizProps {
    onBack: () => void;
    onSaveScore?: (score: number, maxScore: number, difficulty: Difficulty, timeSeconds: number) => void;
}

// Questions Database (French)
const QUESTIONS_EASY: QuizQuestion[] = [
    {
        id: 1,
        question: "Qui a construit l'arche à la demande de Dieu ?",
        options: ["Abraham", "Noé", "Moïse", "David"],
        correct: 1,
        reference: "Genèse 6:13-14",
        explanation: "Dieu a demandé à Noé de construire l'arche pour sauver sa famille et les animaux du déluge."
    },
    {
        id: 2,
        question: "Combien de jours Jésus a-t-il passé dans le désert ?",
        options: ["7 jours", "21 jours", "40 jours", "100 jours"],
        correct: 2,
        reference: "Matthieu 4:2",
        explanation: "Jésus a jeûné 40 jours et 40 nuits dans le désert avant d'être tenté par le diable."
    },
    {
        id: 3,
        question: "Quel est le premier livre de la Bible ?",
        options: ["Exode", "Lévitique", "Genèse", "Nombres"],
        correct: 2,
        reference: "Genèse 1:1",
        explanation: "La Genèse est le premier livre de la Bible et raconte la création du monde."
    },
    {
        id: 4,
        question: "Qui a été avalé par un grand poisson ?",
        options: ["Pierre", "Jonas", "Paul", "Jean"],
        correct: 1,
        reference: "Jonas 1:17",
        explanation: "Jonas a été avalé par un grand poisson pendant trois jours après avoir fui la volonté de Dieu."
    },
    {
        id: 5,
        question: "Combien d'apôtres Jésus avait-il ?",
        options: ["7", "10", "12", "20"],
        correct: 2,
        reference: "Matthieu 10:2-4",
        explanation: "Jésus a choisi 12 apôtres pour le suivre et propager son enseignement."
    },
    {
        id: 6,
        question: "Dans quelle ville Jésus est-il né ?",
        options: ["Nazareth", "Jérusalem", "Bethléem", "Capernaüm"],
        correct: 2,
        reference: "Matthieu 2:1",
        explanation: "Jésus est né à Bethléem de Judée, accomplissant la prophétie de Michée."
    },
    {
        id: 7,
        question: "Qui a trahi Jésus pour 30 pièces d'argent ?",
        options: ["Pierre", "Thomas", "Judas", "Jean"],
        correct: 2,
        reference: "Matthieu 26:14-16",
        explanation: "Judas Iscariote a trahi Jésus pour 30 pièces d'argent."
    },
    {
        id: 8,
        question: "Quel est le dernier livre de la Bible ?",
        options: ["Jude", "Jean", "Apocalypse", "Malachie"],
        correct: 2,
        reference: "Apocalypse 1:1",
        explanation: "L'Apocalypse est le dernier livre du Nouveau Testament et de toute la Bible."
    },
    {
        id: 9,
        question: "Qui a vaincu le géant Goliath avec une fronde ?",
        options: ["Saül", "Jonathan", "David", "Samson"],
        correct: 2,
        reference: "1 Samuel 17",
        explanation: "David, alors jeune berger, a vaincu le géant philistin Goliath avec une simple fronde et une pierre."
    },
    {
        id: 10,
        question: "Combien de disciples étaient avec Jésus lors de sa Transfiguration ?",
        options: ["2", "3", "4", "12"],
        correct: 1,
        reference: "Matthieu 17:1",
        explanation: "Jésus a pris avec lui Pierre, Jacques et Jean sur la montagne lors de sa Transfiguration."
    },
    {
        id: 11,
        question: "Qui a été transformée en statue de sel pour avoir regardé en arrière ?",
        options: ["Sarah", "La femme de Lot", "Ève", "Rébecca"],
        correct: 1,
        reference: "Genèse 19:26",
        explanation: "La femme de Lot a regardé en arrière vers Sodome malgré l'avertissement des anges et est devenue une statue de sel."
    },
    {
        id: 12,
        question: "Quel signe Dieu a-t-il donné à Noé comme promesse de ne plus détruire la terre par l'eau ?",
        options: ["Une étoile", "Une colombe", "Un arc-en-ciel", "Un olivier"],
        correct: 2,
        reference: "Genèse 9:13",
        explanation: "L'arc-en-ciel est le signe de l'alliance de Dieu avec la terre après le déluge."
    },
    {
        id: 13,
        question: "Qui est la mère de Jésus ?",
        options: ["Marthe", "Marie-Madeleine", "Élisabeth", "Marie"],
        correct: 3,
        reference: "Luc 1:30-31",
        explanation: "L'ange Gabriel a annoncé à Marie qu'elle enfanterait le Fils de Dieu."
    },
    {
        id: 14,
        question: "Que signifie littéralement le mot 'Évangile' ?",
        options: ["Livre sacré", "Bonne nouvelle", "Parole de Dieu", "Vie de Jésus"],
        correct: 1,
        reference: "Étymologie grecque",
        explanation: "Le mot Évangile vient du grec 'euangelion' qui signifie 'Bonne Nouvelle'."
    },
    {
        id: 15,
        question: "Quel animal a parlé au prophète Balaam ?",
        options: ["Un lion", "Un corbeau", "Une ânesse", "Un serpent"],
        correct: 2,
        reference: "Nombres 22:28",
        explanation: "Dieu a ouvert la bouche de l'ânesse de Balaam pour lui parler et lui éviter d'être tué par l'ange de l'Éternel."
    },
];

const QUESTIONS_MEDIUM: QuizQuestion[] = [
    {
        id: 1,
        question: "Combien de livres y a-t-il dans la Bible ?",
        options: ["52", "66", "72", "81"],
        correct: 1,
        reference: "Canon biblique",
        explanation: "La Bible contient 66 livres: 39 dans l'Ancien Testament et 27 dans le Nouveau."
    },
    {
        id: 2,
        question: "Quel livre contient le plus grand nombre de chapitres ?",
        options: ["Genèse", "Ésaïe", "Psaumes", "Jérémie"],
        correct: 2,
        reference: "Psaumes",
        explanation: "Le livre des Psaumes contient 150 chapitres, le plus grand nombre de tous les livres bibliques."
    },
    {
        id: 3,
        question: "Qui a écrit la majorité des lettres du Nouveau Testament ?",
        options: ["Pierre", "Jean", "Paul", "Jacques"],
        correct: 2,
        reference: "Épîtres pauliniennes",
        explanation: "Paul a écrit 13 des 27 livres du Nouveau Testament."
    },
    {
        id: 4,
        question: "Combien de plaies Dieu a-t-il envoyées sur l'Égypte ?",
        options: ["5", "7", "10", "12"],
        correct: 2,
        reference: "Exode 7-12",
        explanation: "Dieu a envoyé 10 plaies sur l'Égypte pour libérer le peuple d'Israël."
    },
    {
        id: 5,
        question: "Quel prophète a été enlevé au ciel dans un char de feu ?",
        options: ["Moïse", "Élie", "Élisée", "Ésaïe"],
        correct: 1,
        reference: "2 Rois 2:11",
        explanation: "Élie a été enlevé au ciel dans un tourbillon avec un char et des chevaux de feu."
    },
    {
        id: 6,
        question: "Quel était le métier de Matthieu avant de suivre Jésus ?",
        options: ["Pêcheur", "Collecteur d'impôts", "Berger", "Charpentier"],
        correct: 1,
        reference: "Matthieu 9:9",
        explanation: "Matthieu était collecteur d'impôts (publicain) avant d'être appelé par Jésus."
    },
    {
        id: 7,
        question: "Quelle est la montagne où Moïse a reçu les dix commandements ?",
        options: ["Mont Carmel", "Mont Sinaï", "Mont des Oliviers", "Mont Morija"],
        correct: 1,
        reference: "Exode 19-20",
        explanation: "Dieu a donné les dix commandements à Moïse sur le Mont Sinaï."
    },
    {
        id: 8,
        question: "Qui était le père de Salomon ?",
        options: ["Saül", "David", "Samuel", "Nathan"],
        correct: 1,
        reference: "2 Samuel 12:24",
        explanation: "Salomon était le fils du roi David et de Bath-Shéba."
    },
    {
        id: 9,
        question: "Qui a reconnu l'enfant Jésus comme le Messie au temple ?",
        options: ["Zacharie", "Siméon", "Nicodème", "Gamaliel"],
        correct: 1,
        reference: "Luc 2:25-32",
        explanation: "Siméon, un homme juste et pieux, a béni Dieu en voyant Jésus, disant que ses yeux avaient vu le salut."
    },
    {
        id: 10,
        question: "Quelle femme juge a mené Israël à la victoire militaire ?",
        options: ["Ruth", "Esther", "Débora", "Jaël"],
        correct: 2,
        reference: "Juges 4",
        explanation: "Débora était prophétesse et juge en Israël; elle a accompagné Barak à la bataille contre Sisera."
    },
    {
        id: 11,
        question: "De quel bois l'arche de Noé a-t-elle été construite ?",
        options: ["Cèdre", "Acacia", "Gopher (Cyprès)", "Chêne"],
        correct: 2,
        reference: "Genèse 6:14",
        explanation: "Dieu a ordonné à Noé de faire l'arche en bois de gopher (souvent identifié au cyprès)."
    },
    {
        id: 12,
        question: "Qui a écrit le livre des Actes des Apôtres ?",
        options: ["Pierre", "Paul", "Jean", "Luc"],
        correct: 3,
        reference: "Actes 1:1",
        explanation: "Luc a écrit les Actes comme une suite à son Évangile, adressée à Théophile."
    },
    {
        id: 13,
        question: "Quel roi a vu une main mystérieuse écrire sur un mur ?",
        options: ["Nebucadnetsar", "Darius", "Belschatsar", "Cyrus"],
        correct: 2,
        reference: "Daniel 5",
        explanation: "Le roi Belschatsar a vu une main écrire 'MENE, MENE, THEKEL, UPHARSIN' lors d'un festin impie."
    },
    {
        id: 14,
        question: "Combien d'années les Israélites ont-ils erré dans le désert ?",
        options: ["12 ans", "40 ans", "70 ans", "100 ans"],
        correct: 1,
        reference: "Nombres 14:33-34",
        explanation: "À cause de leur incrédulité, les Israélites ont dû errer 40 ans dans le désert, une année pour chaque jour d'exploration."
    },
    {
        id: 15,
        question: "Qui a succédé à Moïse pour faire entrer Israël en Terre Promise ?",
        options: ["Caleb", "Aaron", "Josué", "Gédéon"],
        correct: 2,
        reference: "Josué 1:1-2",
        explanation: "Après la mort de Moïse, Josué a été choisi par Dieu pour conduire le peuple à travers le Jourdain."
    },
];

const QUESTIONS_HARD: QuizQuestion[] = [
    {
        id: 1,
        question: "Quel est le verset le plus court de la Bible en français ?",
        options: ["Jean 11:35", "Luc 17:32", "1 Thessaloniciens 5:16", "Exode 20:13"],
        correct: 0,
        reference: "Jean 11:35",
        explanation: "'Jésus pleura' est traditionnellement considéré comme le verset le plus court."
    },
    {
        id: 2,
        question: "Quel roi a régné 40 ans sur Israël après David ?",
        options: ["Roboam", "Salomon", "Jéroboam", "Asa"],
        correct: 1,
        reference: "1 Rois 11:42",
        explanation: "Salomon a régné 40 ans sur Israël, de 970 à 930 av. J.-C. environ."
    },
    {
        id: 3,
        question: "Quel nom signifie 'Dieu avec nous' ?",
        options: ["Josué", "Emmanuel", "Élohim", "Adonaï"],
        correct: 1,
        reference: "Matthieu 1:23",
        explanation: "Emmanuel signifie 'Dieu avec nous' et était un nom prophétique pour le Messie."
    },
    {
        id: 4,
        question: "Combien de juges sont mentionnés dans le livre des Juges ?",
        options: ["7", "12", "15", "20"],
        correct: 1,
        reference: "Livre des Juges",
        explanation: "Le livre des Juges mentionne 12 juges principaux d'Israël."
    },
    {
        id: 5,
        question: "Quel prophète a été dans la fosse aux lions ?",
        options: ["Ézéchiel", "Jérémie", "Daniel", "Ésaïe"],
        correct: 2,
        reference: "Daniel 6:16",
        explanation: "Daniel a été jeté dans la fosse aux lions par le roi Darius et a été protégé par Dieu."
    },
    {
        id: 6,
        question: "Quelle épître Paul a-t-il écrite en prison à Rome ?",
        options: ["Romains", "Galates", "Philippiens", "1 Corinthiens"],
        correct: 2,
        reference: "Philippiens 1:13-14",
        explanation: "Paul a écrit Philippiens pendant son emprisonnement à Rome."
    },
    {
        id: 7,
        question: "Qui a vécu le plus longtemps selon la Bible ?",
        options: ["Adam (930 ans)", "Noé (950 ans)", "Mathusalem (969 ans)", "Jared (962 ans)"],
        correct: 2,
        reference: "Genèse 5:27",
        explanation: "Mathusalem a vécu 969 ans, la plus longue durée de vie enregistrée dans la Bible."
    },
    {
        id: 8,
        question: "Quel apôtre est appelé 'le disciple que Jésus aimait' ?",
        options: ["Pierre", "Jacques", "Jean", "André"],
        correct: 2,
        reference: "Jean 21:20",
        explanation: "L'apôtre Jean se désigne lui-même comme 'le disciple que Jésus aimait' dans son évangile."
    },
    {
        id: 9,
        question: "Quel était le nom de la femme de Moïse ?",
        options: ["Miriam", "Sépora (Zippora)", "Dina", "Kétura"],
        correct: 1,
        reference: "Exode 2:21",
        explanation: "Moïse a épousé Sépora (ou Zippora), la fille de Jéthro, prêtre de Madian."
    },
    {
        id: 10,
        question: "Combien de temps a duré la construction du temple de Salomon ?",
        options: ["3 ans", "7 ans", "12 ans", "46 ans"],
        correct: 1,
        reference: "1 Rois 6:38",
        explanation: "Salomon a construit la maison de l'Éternel en sept ans."
    },
    {
        id: 11,
        question: "Qui était le grand-père du roi David ?",
        options: ["Jessé", "Boaz", "Obed", "Aminadab"],
        correct: 2,
        reference: "Ruth 4:21-22",
        explanation: "Boaz engendra Obed, Obed engendra Jessé, et Jessé engendra David."
    },
    {
        id: 12,
        question: "Dans quelle ville l'apôtre Paul a-t-il été lapidé et laissé pour mort ?",
        options: ["Damas", "Antioche", "Lystre", "Iconium"],
        correct: 2,
        reference: "Actes 14:19",
        explanation: "À Lystre, des Juifs lapidèrent Paul et le traînèrent hors de la ville, pensant qu'il était mort."
    },
    {
        id: 13,
        question: "Quel prophète Dieu a-t-il ordonné d'épouser une femme prostituée ?",
        options: ["Amos", "Osée", "Joël", "Michée"],
        correct: 1,
        reference: "Osée 1:2",
        explanation: "Dieu a dit à Osée d'épouser une femme prostituée pour symboliser l'infidélité d'Israël envers Dieu."
    },
    {
        id: 14,
        question: "Quel est le chapitre le plus long de la Bible ?",
        options: ["Psaume 119", "Nombres 7", "1 Rois 8", "Lamentations 3"],
        correct: 0,
        reference: "Psaume 119",
        explanation: "Le Psaume 119 compte 176 versets, ce qui en fait le plus long chapitre de la Bible."
    },
];

const DIFFICULTY_CONFIG = {
    easy: { label: 'Facile', icon: '🌱', color: 'emerald', questions: QUESTIONS_EASY, timePerQuestion: 20, pointsPerQuestion: 10 },
    medium: { label: 'Moyen', icon: '⚡', color: 'amber', questions: QUESTIONS_MEDIUM, timePerQuestion: 15, pointsPerQuestion: 20 },
    hard: { label: 'Difficile', icon: '🔥', color: 'red', questions: QUESTIONS_HARD, timePerQuestion: 10, pointsPerQuestion: 30 },
};

export function BibleQuiz({ onBack, onSaveScore }: BibleQuizProps) {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [timeLeft, setTimeLeft] = useState(20);
    const [totalTime, setTotalTime] = useState(0);
    const [answers, setAnswers] = useState<{ correct: boolean; time: number }[]>([]);
    const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
    const [lives, setLives] = useState(3);

    const config = DIFFICULTY_CONFIG[difficulty];
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const totalQuestions = shuffledQuestions.length;
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

    // Shuffle function
    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // Start game - now uses dynamic quiz generator
    const startGame = async (diff: Difficulty) => {
        setDifficulty(diff);
        setGameState('playing'); // Show loading state
        setCurrentQuestionIndex(0);
        setScore(0);
        setStreak(0);
        setBestStreak(0);
        setLives(3);
        setTotalTime(0);
        setAnswers([]);
        setSelectedAnswer(null);
        setIsAnswerRevealed(false);
        setTimeLeft(DIFFICULTY_CONFIG[diff].timePerQuestion);

        try {
            // Get questions from the dynamic generator
            const dynamicQuestions = await quizGenerator.getQuestions(8, diff);

            // Convert to component's expected format
            const formattedQuestions: QuizQuestion[] = dynamicQuestions.map((q, i) => ({
                id: q.id || i,
                question: q.question,
                options: q.options,
                correct: q.correctIndex,
                reference: q.reference,
                explanation: q.explanation
            }));

            setShuffledQuestions(formattedQuestions);
        } catch (error) {
            console.warn('Dynamic questions failed, using static fallback');
            // Fallback to static questions from config
            const staticQuestions = shuffleArray(DIFFICULTY_CONFIG[diff].questions).slice(0, 8);
            setShuffledQuestions(staticQuestions);
        }
    };

    // Timer effect
    useEffect(() => {
        if (gameState !== 'playing' || isAnswerRevealed) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    handleTimeout();
                    return 0;
                }
                return prev - 1;
            });
            setTotalTime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState, isAnswerRevealed, currentQuestionIndex]);

    // Handle timeout
    const handleTimeout = () => {
        setIsAnswerRevealed(true);
        setStreak(0);
        setLives(prev => prev - 1);
        setAnswers(prev => [...prev, { correct: false, time: config.timePerQuestion }]);

        if (lives <= 1) {
            setTimeout(() => endGame(), 2000);
        } else {
            setTimeout(() => nextQuestion(), 2500);
        }
    };

    // Handle answer selection
    const handleAnswer = (index: number) => {
        if (isAnswerRevealed) return;

        setSelectedAnswer(index);
        setIsAnswerRevealed(true);

        const isCorrect = index === currentQuestion.correct;
        const responseTime = config.timePerQuestion - timeLeft;

        setAnswers(prev => [...prev, { correct: isCorrect, time: responseTime }]);

        if (isCorrect) {
            // Calculate bonus points for speed
            const timeBonus = Math.floor((timeLeft / config.timePerQuestion) * 10);
            const streakBonus = streak >= 3 ? Math.floor(config.pointsPerQuestion * 0.5) : 0;
            const totalPoints = config.pointsPerQuestion + timeBonus + streakBonus;

            setScore(prev => prev + totalPoints);
            setStreak(prev => {
                const newStreak = prev + 1;
                if (newStreak > bestStreak) setBestStreak(newStreak);
                return newStreak;
            });

            // Confetti for correct answer
            confetti({
                particleCount: 30,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#10b981', '#34d399', '#6ee7b7'],
            });
        } else {
            setStreak(0);
            setLives(prev => prev - 1);

            if (lives <= 1) {
                setTimeout(() => endGame(), 2000);
                return;
            }
        }

        // Move to next question after delay
        setTimeout(() => nextQuestion(), 2500);
    };

    // Next question
    const nextQuestion = () => {
        if (currentQuestionIndex + 1 >= totalQuestions) {
            endGame();
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setIsAnswerRevealed(false);
            setTimeLeft(config.timePerQuestion);
        }
    };

    // End game
    const endGame = () => {
        setGameState('result');

        // Big confetti for game completion
        if (score > 0) {
            confetti({
                particleCount: 100,
                spread: 100,
                origin: { y: 0.6 },
            });
        }

        // Save score
        if (onSaveScore) {
            onSaveScore(score, totalQuestions * config.pointsPerQuestion, difficulty, totalTime);
        }
    };

    // Get grade based on score
    const getGrade = () => {
        const maxScore = totalQuestions * config.pointsPerQuestion;
        const percentage = (score / maxScore) * 100;

        if (percentage >= 90) return { grade: 'A+', emoji: '🏆', label: 'Excellent!' };
        if (percentage >= 80) return { grade: 'A', emoji: '⭐', label: 'Très bien!' };
        if (percentage >= 70) return { grade: 'B', emoji: '👍', label: 'Bien joué!' };
        if (percentage >= 60) return { grade: 'C', emoji: '💪', label: 'Pas mal!' };
        if (percentage >= 50) return { grade: 'D', emoji: '📚', label: 'Continue!' };
        return { grade: 'F', emoji: '🙏', label: 'Révise tes classiques!' };
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full" />
            </div>

            <AnimatePresence mode="wait">
                {/* ========== MENU STATE ========== */}
                {gameState === 'menu' && (
                    <motion.div
                        key="menu"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="relative z-10 min-h-screen flex flex-col"
                    >
                        {/* Header */}
                        <header className="px-6 pt-12 pb-6">
                            <Button variant="ghost" size="icon" onClick={onBack} className="mb-6">
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                    <span className="text-4xl">🧠</span>
                                </div>
                                <h1 className="text-3xl font-black mb-2">Quiz Biblique</h1>
                                <p className="text-slate-400">Testez vos connaissances bibliques</p>
                            </div>
                        </header>

                        {/* Difficulty Selection */}
                        <div className="flex-1 px-6 py-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 text-center">Choisir la difficulté</h2>

                            <div className="space-y-4">
                                {/* Easy */}
                                <Button
                                    variant="ghost"
                                    className="w-full h-24 rounded-3xl bg-gradient-to-r from-emerald-600/20 to-emerald-600/10 border border-emerald-500/20 hover:border-emerald-500/40 justify-start p-6 group transition-all hover:scale-[1.02]"
                                    onClick={() => startGame('easy')}
                                >
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                            🌱
                                        </div>
                                        <div className="text-left flex-1">
                                            <h3 className="font-bold text-lg text-white">Facile</h3>
                                            <p className="text-sm text-emerald-400/80">20s par question • 10 pts</p>
                                        </div>
                                        <ChevronRight className="h-6 w-6 text-slate-500 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Button>

                                {/* Medium */}
                                <Button
                                    variant="ghost"
                                    className="w-full h-24 rounded-3xl bg-gradient-to-r from-amber-600/20 to-amber-600/10 border border-amber-500/20 hover:border-amber-500/40 justify-start p-6 group transition-all hover:scale-[1.02]"
                                    onClick={() => startGame('medium')}
                                >
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                            ⚡
                                        </div>
                                        <div className="text-left flex-1">
                                            <h3 className="font-bold text-lg text-white">Moyen</h3>
                                            <p className="text-sm text-amber-400/80">15s par question • 20 pts</p>
                                        </div>
                                        <ChevronRight className="h-6 w-6 text-slate-500 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Button>

                                {/* Hard */}
                                <Button
                                    variant="ghost"
                                    className="w-full h-24 rounded-3xl bg-gradient-to-r from-red-600/20 to-red-600/10 border border-red-500/20 hover:border-red-500/40 justify-start p-6 group transition-all hover:scale-[1.02]"
                                    onClick={() => startGame('hard')}
                                >
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                            🔥
                                        </div>
                                        <div className="text-left flex-1">
                                            <h3 className="font-bold text-lg text-white">Difficile</h3>
                                            <p className="text-sm text-red-400/80">10s par question • 30 pts</p>
                                        </div>
                                        <ChevronRight className="h-6 w-6 text-slate-500 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Button>
                            </div>
                        </div>

                        {/* Stats Bar */}
                        <div className="px-6 pb-10">
                            <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-around border border-white/5">
                                <div className="text-center">
                                    <p className="text-2xl font-black text-white">8</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Questions</p>
                                </div>
                                <div className="w-[1px] h-8 bg-white/10" />
                                <div className="text-center">
                                    <p className="text-2xl font-black text-white">3</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Vies</p>
                                </div>
                                <div className="w-[1px] h-8 bg-white/10" />
                                <div className="text-center">
                                    <p className="text-2xl font-black text-indigo-400">∞</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Bonus</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ========== PLAYING STATE ========== */}
                {gameState === 'playing' && currentQuestion && (
                    <motion.div
                        key={`playing-${currentQuestionIndex}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="relative z-10 min-h-screen flex flex-col"
                    >
                        {/* Game Header */}
                        <header className="px-6 pt-8 pb-4">
                            <div className="flex items-center justify-between mb-4">
                                {/* Lives */}
                                <div className="flex items-center gap-1">
                                    {[...Array(3)].map((_, i) => (
                                        <Heart
                                            key={i}
                                            className={cn(
                                                "h-6 w-6 transition-all",
                                                i < lives ? "text-red-500 fill-red-500" : "text-slate-700"
                                            )}
                                        />
                                    ))}
                                </div>

                                {/* Score */}
                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl">
                                    <Star className="h-5 w-5 text-amber-400" />
                                    <span className="font-black text-white">{score}</span>
                                </div>

                                {/* Timer */}
                                <div className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
                                    timeLeft <= 5 ? "bg-red-500/20 animate-pulse" : "bg-white/5"
                                )}>
                                    <Clock className={cn("h-5 w-5", timeLeft <= 5 ? "text-red-400" : "text-slate-400")} />
                                    <span className={cn("font-black", timeLeft <= 5 ? "text-red-400" : "text-white")}>
                                        {timeLeft}s
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative">
                                <Progress value={progress} className="h-2 bg-white/5" />
                                <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <span>Question {currentQuestionIndex + 1}/{totalQuestions}</span>
                                    {streak >= 3 && (
                                        <span className="text-amber-400 flex items-center gap-1">
                                            <Zap className="h-3 w-3" />
                                            {streak}x Combo!
                                        </span>
                                    )}
                                </div>
                            </div>
                        </header>

                        {/* Question Card */}
                        <div className="flex-1 px-6 py-6">
                            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 rounded-3xl overflow-hidden">
                                <CardContent className="p-6">
                                    <Badge variant="outline" className="mb-4 border-indigo-500/30 text-indigo-400">
                                        {config.label}
                                    </Badge>
                                    <h2 className="text-xl font-bold text-white leading-relaxed mb-6">
                                        {currentQuestion.question}
                                    </h2>

                                    {/* Answer Options */}
                                    <div className="space-y-3">
                                        {currentQuestion.options.map((option, index) => {
                                            const isSelected = selectedAnswer === index;
                                            const isCorrect = currentQuestion.correct === index;
                                            const showResult = isAnswerRevealed;

                                            let buttonClass = "bg-white/5 border-white/10 hover:bg-white/10";

                                            if (showResult) {
                                                if (isCorrect) {
                                                    buttonClass = "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30";
                                                } else if (isSelected && !isCorrect) {
                                                    buttonClass = "bg-red-500/20 border-red-500/50";
                                                } else {
                                                    buttonClass = "bg-white/5 border-white/10 opacity-50";
                                                }
                                            } else if (isSelected) {
                                                buttonClass = "bg-indigo-600/20 border-indigo-500/50 ring-2 ring-indigo-500/30";
                                            }

                                            return (
                                                <motion.button
                                                    key={index}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className={cn(
                                                        "w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 group",
                                                        buttonClass,
                                                        !isAnswerRevealed && "hover:scale-[1.02]"
                                                    )}
                                                    onClick={() => handleAnswer(index)}
                                                    disabled={isAnswerRevealed}
                                                >
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all",
                                                        showResult && isCorrect ? "bg-emerald-500" :
                                                            showResult && isSelected && !isCorrect ? "bg-red-500" :
                                                                "bg-white/10"
                                                    )}>
                                                        {showResult && isCorrect ? (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        ) : showResult && isSelected && !isCorrect ? (
                                                            <XCircle className="h-5 w-5" />
                                                        ) : (
                                                            String.fromCharCode(65 + index)
                                                        )}
                                                    </div>
                                                    <span className="font-medium flex-1">{option}</span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>

                                    {/* Explanation (shown after answer) */}
                                    <AnimatePresence>
                                        {isAnswerRevealed && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                                                    <p className="text-sm text-slate-300 leading-relaxed">
                                                        <span className="font-bold text-indigo-400">{currentQuestion.reference}:</span>{' '}
                                                        {currentQuestion.explanation}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {/* ========== RESULT STATE ========== */}
                {gameState === 'result' && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12"
                    >
                        <div className="text-center mb-8">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                                className="w-28 h-28 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/30"
                            >
                                <span className="text-5xl">{getGrade().emoji}</span>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <h1 className="text-4xl font-black mb-2">{getGrade().label}</h1>
                                <p className="text-slate-400">Quiz terminé</p>
                            </motion.div>
                        </div>

                        {/* Score Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="w-full max-w-sm"
                        >
                            <Card className="bg-white/5 border-white/10 rounded-3xl overflow-hidden mb-6">
                                <CardContent className="p-6">
                                    <div className="text-center">
                                        <p className="text-6xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                                            {score}
                                        </p>
                                        <p className="text-slate-500 font-medium">points</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-white">
                                                {answers.filter(a => a.correct).length}/{totalQuestions}
                                            </p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Correct</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-amber-400">{bestStreak}x</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Meilleur combo</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-white">{totalTime}s</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Temps</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10"
                                    onClick={onBack}
                                >
                                    <ArrowLeft className="h-5 w-5 mr-2" />
                                    Retour
                                </Button>
                                <Button
                                    className="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500"
                                    onClick={() => setGameState('menu')}
                                >
                                    <RefreshCw className="h-5 w-5 mr-2" />
                                    Rejouer
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
